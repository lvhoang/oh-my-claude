# oh-my-claude

> Curated `CLAUDE.md` templates + `.claude/settings.json` configs for [Claude Code](https://claude.ai/code).

Stop writing CLAUDE.md from scratch. Pick a template, install it, and get coding.

---

## Quick Start

```bash
# Install a template into your current project
npx oh-my-claude install nextjs

# List all available templates
npx oh-my-claude list

# Preview a template before installing
npx oh-my-claude preview servicenow
```

---

## Available Templates

| Template | Description |
|----------|-------------|
| `nextjs` | Next.js 14+ with App Router, TypeScript, Tailwind CSS, and shadcn/ui |
| `servicenow` | ServiceNow scoped app development — GlideRecord, Flow Designer, Business Rules |
| `python-api` | Python FastAPI with Pydantic v2, SQLAlchemy async, pytest, and ruff |

More templates coming. [Contribute one →](#contributing)

---

## What Gets Installed

Running `npx oh-my-claude install <template>` copies two things into your project:

```
your-project/
├── CLAUDE.md                 ← main instructions for Claude Code
└── .claude/
    └── settings.json         ← tool permissions + env hints
```

**Existing files are not overwritten** unless you pass `--force`.

---

## Template Structure

Each template lives in `templates/<name>/`:

```
templates/nextjs/
├── CLAUDE.md               ← the main file Claude reads
├── README.md               ← human description of the template
└── .claude/
    └── settings.json       ← optional Claude Code settings
```

### CLAUDE.md

Tells Claude Code:
- What stack and tools are in use
- Code style and naming conventions
- Common patterns with copy-paste examples
- How to run, test, and build the project
- What to avoid (gotchas, anti-patterns)

### .claude/settings.json

Controls what Claude Code is allowed to do — which bash commands, env variable hints, etc.

---

## Contributing

Want to add a template? 

1. Fork the repo
2. Create `templates/<your-template>/CLAUDE.md` — make it practical, not generic
3. Add `templates/<your-template>/README.md` — one paragraph description
4. Optionally add `.claude/settings.json`
5. Open a PR

**Good templates are specific.** "React" is too broad. "Next.js App Router + Prisma + Clerk" is great.

---

## CLI

The `omc` CLI is also available as a local binary after `npm install -g oh-my-claude`:

```bash
omc list
omc install python-api
omc preview nextjs
omc help
```

---

## License

MIT — [lvhoang/oh-my-claude](https://github.com/lvhoang/oh-my-claude)
