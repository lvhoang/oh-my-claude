# ServiceNow Development — CLAUDE.md

## Stack Context

This is a **ServiceNow scoped application** project. All code runs on the ServiceNow platform — a cloud-based enterprise IT management suite.

### Key Platform Concepts
- **Scoped apps** (`x_<vendor>_<app>` prefix) — isolated from global scope, own namespace
- **GlideRecord** — server-side ORM for table operations
- **GlideAjax / GlideForm / GlideUser** — client-side APIs
- **Flow Designer** — no-code/low-code workflow automation (preferred over legacy Workflows)
- **Service Catalog** — request management, catalog items, variables
- **Update Sets** — version control mechanism for transporting changes between instances

### Instance Types
- `dev` — personal developer instance (PDI)
- `test/uat` — staging
- `prod` — production

---

## Code Conventions

### General
- All scripts use **ES5** compatible JavaScript (no arrow functions, no `let`/`const` in older instances — check target instance version)
- For instances on **Utah+**, ES6+ is supported in server scripts
- Always add a **comment block** at the top of business rules, script includes, and scheduled jobs
- Use `gs.log()`, `gs.info()`, `gs.warn()`, `gs.error()` — never `console.log()` on server side

### Naming
- Script Includes: `PascalCase` (e.g., `IncidentUtils`)
- Business Rules: `[Table] - [Description]` (e.g., `Incident - Set Priority on Insert`)
- Scheduled Jobs: `[Frequency] - [Description]` (e.g., `Daily - Sync User Groups`)
- Variables/parameters: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

---

## Server Scripts

### Script Include (utility class pattern)
```javascript
var IncidentUtils = Class.create();
IncidentUtils.prototype = {
    initialize: function() {
        // constructor
    },

    /**
     * Get incidents by caller and state
     * @param {string} callerId - sys_id of the caller
     * @param {number} state - incident state value
     * @returns {GlideRecord} result set
     */
    getIncidentsByCaller: function(callerId, state) {
        var gr = new GlideRecord('incident');
        gr.addQuery('caller_id', callerId);
        gr.addQuery('state', state);
        gr.query();
        return gr;
    },

    type: 'IncidentUtils'
};
```

### Business Rules
```javascript
// Business Rule: Incident - Auto-assign on insert
// Table: incident | When: before | Insert: true

(function executeRule(current, previous) {
    if (current.category == 'network' && current.assignment_group.nil()) {
        var gr = new GlideRecord('sys_user_group');
        gr.addQuery('name', 'Network Support');
        gr.setLimit(1);
        gr.query();
        if (gr.next()) {
            current.assignment_group = gr.sys_id;
        }
    }
})(current, previous);
```

### UI Actions (server-side condition)
```javascript
// Condition script example
current.state == 1 && gs.hasRole('itil')
```

---

## GlideRecord Patterns

### Query (read multiple records)
```javascript
var gr = new GlideRecord('incident');
gr.addQuery('state', 'IN', '1,2');              // IN list
gr.addQuery('priority', '<=', 2);
gr.addEncodedQuery('active=true^assigned_toISEMPTY');
gr.orderByDesc('sys_created_on');
gr.setLimit(100);
gr.query();

while (gr.next()) {
    gs.info('Incident: ' + gr.number + ' - ' + gr.short_description);
}
```

### Get single record by sys_id
```javascript
var gr = new GlideRecord('incident');
if (gr.get(sysId)) {
    // record found
    gs.info(gr.getValue('number'));
}
```

### Insert
```javascript
var gr = new GlideRecord('incident');
gr.initialize();
gr.setValue('short_description', 'Network outage reported');
gr.setValue('caller_id', gs.getUserID());
gr.setValue('category', 'network');
gr.setValue('urgency', 2);
gr.setValue('impact', 2);
var sysId = gr.insert();
gs.info('Created incident: ' + sysId);
```

### Update
```javascript
var gr = new GlideRecord('incident');
gr.addQuery('state', 1);
gr.addQuery('assigned_to', gs.getUserID());
gr.query();

while (gr.next()) {
    gr.setValue('state', 2);         // In Progress
    gr.setValue('work_notes', 'Picked up by automation');
    gr.update();
}
```

### Delete (use sparingly — prefer deactivation)
```javascript
var gr = new GlideRecord('x_myapp_temp_records');
gr.addQuery('sys_created_on', '<', gs.daysAgo(30));
gr.deleteMultiple();  // bulk delete — no loop needed
```

### Aggregate queries
```javascript
var agg = new GlideAggregate('incident');
agg.addQuery('state', 'IN', '1,2,3');
agg.addAggregate('COUNT');
agg.groupBy('category');
agg.query();

while (agg.next()) {
    gs.info(agg.category + ': ' + agg.getAggregate('COUNT'));
}
```

---

## Client Scripts

### Form onLoad
```javascript
function onLoad() {
    var state = g_form.getValue('state');
    if (state == '6') {  // Resolved
        g_form.setMandatory('close_code', true);
        g_form.setMandatory('close_notes', true);
    }
}
```

### onChange
```javascript
function onChange(control, oldValue, newValue, isLoading) {
    if (isLoading || newValue === '') return;
    
    if (newValue == '1') {  // Critical urgency
        g_form.showFieldMsg('urgency', 'Critical urgency requires manager approval', 'info');
    } else {
        g_form.hideFieldMsg('urgency');
    }
}
```

### GlideAjax (client → server call)
```javascript
// Client script
function fetchData() {
    var ga = new GlideAjax('IncidentUtils');
    ga.addParam('sysparm_name', 'getIncidentCount');
    ga.addParam('sysparm_category', g_form.getValue('category'));
    ga.getXMLAnswer(function(answer) {
        g_form.showFieldMsg('category', 'Open incidents: ' + answer, 'info');
    });
}
```

---

## Scripted REST APIs

```javascript
// Scripted REST API Resource handler
(function process(request, response) {
    var method = request.getHttpMethod();
    
    if (method === 'GET') {
        var id = request.pathParams.id;
        var gr = new GlideRecord('incident');
        
        if (!gr.get(id)) {
            response.setStatus(404);
            response.setBody({ error: 'Incident not found', id: id });
            return;
        }
        
        response.setStatus(200);
        response.setBody({
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            short_description: gr.getValue('short_description'),
            state: gr.getValue('state'),
            priority: gr.getValue('priority')
        });
        return;
    }
    
    response.setStatus(405);
    response.setBody({ error: 'Method not allowed' });
})(request, response);
```

---

## Flow Designer

- Prefer Flow Designer over **legacy Workflow Editor** for new automations
- Use **Subflows** for reusable logic (e.g., "Send notification", "Create task")
- **Actions** wrap script logic for reuse across flows
- Use **Spoke integrations** for external systems (Jira, Slack, etc.)
- Always test flows in `dev` before promoting via Update Set

---

## Scheduled Jobs

```javascript
// Scheduled Script Execution
// Name: Daily - Close Stale Incidents
// Run: Daily at 02:00

var threshold = new GlideDateTime();
threshold.addDaysUTC(-30);

var gr = new GlideRecord('incident');
gr.addQuery('state', 4);  // Awaiting User Info
gr.addQuery('sys_updated_on', '<', threshold);
gr.query();

var count = 0;
while (gr.next()) {
    gr.setValue('state', 7);  // Closed
    gr.setValue('close_code', 'Closed by System');
    gr.setValue('close_notes', 'Auto-closed after 30 days without update');
    gr.update();
    count++;
}

gs.info('Auto-closed ' + count + ' stale incidents');
```

---

## Testing Approach

### ATF (Automated Test Framework)
- Use ServiceNow's built-in ATF for integration tests
- Test suites live in **System Definition > Automated Test Framework > Test Suites**
- Write tests for: business rule triggers, Script Include methods, REST API endpoints

### Unit Testing Script Includes
```javascript
// Run in background script on dev instance
var utils = new IncidentUtils();

// Test: getIncidentsByCaller
var gr = utils.getIncidentsByCaller('some-user-sys-id', 1);
var count = 0;
while (gr.next()) count++;
gs.info('Test getIncidentsByCaller: ' + (count > 0 ? 'PASS' : 'FAIL - no results'));
```

### Background Scripts (dev only)
- Use **System Definition > Scripts - Background** for quick ad-hoc testing
- Always run in `dev` — never test in `prod`
- Add `// TESTING ONLY` comment header

---

## Update Sets & Deployment

```
dev → update set → export XML → import to test → preview → commit → export → import to prod
```

- Keep update sets **small and focused** (one feature per update set)
- Always **preview** before committing (catches conflicts)
- Use **Batch Update Sets** for complex releases
- Source-control integration available via **GitHub for ServiceNow** (recommended for team projects)

---

## Common Pitfalls

1. **Never use `gr.get()` in a loop** — use `addQuery()` instead
2. **GlideRecord.setValue() vs direct assignment** — use `setValue()` in server scripts for proper coercion
3. **Reference fields** — `gr.assigned_to` returns a GlideElement object; use `gr.getValue('assigned_to')` for sys_id string
4. **Display values** — `gr.getDisplayValue('state')` for human-readable, `gr.getValue('state')` for raw value
5. **`deleteMultiple()`** — skips business rules; use deliberately
6. **Client scripts scope** — `g_form` only available in form context, not list view
7. **Scoped app restrictions** — some tables/APIs require `glide.script.block.client.globals=false` or explicit cross-scope access
