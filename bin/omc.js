#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function c(color, text) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function getTemplates() {
  return fs.readdirSync(TEMPLATES_DIR).filter((name) => {
    const stat = fs.statSync(path.join(TEMPLATES_DIR, name));
    return stat.isDirectory();
  });
}

function getTemplateInfo(name) {
  const dir = path.join(TEMPLATES_DIR, name);
  const readmePath = path.join(dir, 'README.md');
  if (!fs.existsSync(readmePath)) return { name, description: '' };
  const content = fs.readFileSync(readmePath, 'utf8');
  const firstLine = content.split('\n').find((l) => l && !l.startsWith('#'));
  return { name, description: firstLine?.trim() || '' };
}

function list() {
  const templates = getTemplates();
  console.log(`\n${c('bold', '  oh-my-claude')} ${c('dim', '— available templates')}\n`);
  for (const name of templates) {
    const info = getTemplateInfo(name);
    console.log(`  ${c('cyan', name.padEnd(16))} ${c('dim', info.description)}`);
  }
  console.log(`\n  ${c('dim', `Run ${c('yellow', 'omc install <template>')} to install`)}\n`);
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'README.md') continue; // skip template readme
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      if (fs.existsSync(destPath)) {
        console.log(`  ${c('yellow', 'skip')}  ${entry.name} (already exists)`);
      } else {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ${c('green', 'copy')}  ${path.relative(process.cwd(), destPath)}`);
      }
    }
  }
}

function install(templateName) {
  const templates = getTemplates();
  if (!templates.includes(templateName)) {
    console.error(`\n  ${c('red', 'Error:')} Template "${templateName}" not found.`);
    console.error(`  ${c('dim', 'Available:')} ${templates.join(', ')}\n`);
    process.exit(1);
  }

  const src = path.join(TEMPLATES_DIR, templateName);
  const dest = process.cwd();

  console.log(`\n  ${c('bold', 'Installing')} ${c('cyan', templateName)} ${c('dim', 'template...')}\n`);
  copyRecursive(src, dest);
  console.log(`\n  ${c('green', 'Done!')} Claude Code is now configured for ${c('cyan', templateName)}.`);
  console.log(`  ${c('dim', 'Review CLAUDE.md and .claude/settings.json to customize.')}\n`);
}

function preview(templateName) {
  const templates = getTemplates();
  if (!templates.includes(templateName)) {
    console.error(`\n  ${c('red', 'Error:')} Template "${templateName}" not found.`);
    console.error(`  ${c('dim', 'Available:')} ${templates.join(', ')}\n`);
    process.exit(1);
  }

  const src = path.join(TEMPLATES_DIR, templateName);

  console.log(`\n${c('bold', `  Template: ${templateName}`)}\n`);

  // Show README
  const readmePath = path.join(src, 'README.md');
  if (fs.existsSync(readmePath)) {
    console.log(c('dim', '  ─── README.md ───'));
    console.log(fs.readFileSync(readmePath, 'utf8').split('\n').map((l) => `  ${l}`).join('\n'));
  }

  // Show CLAUDE.md
  const claudePath = path.join(src, 'CLAUDE.md');
  if (fs.existsSync(claudePath)) {
    console.log(`\n${c('dim', '  ─── CLAUDE.md ───')}`);
    console.log(fs.readFileSync(claudePath, 'utf8').split('\n').map((l) => `  ${l}`).join('\n'));
  }

  // Show settings.json
  const settingsPath = path.join(src, '.claude', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    console.log(`\n${c('dim', '  ─── .claude/settings.json ───')}`);
    console.log(fs.readFileSync(settingsPath, 'utf8').split('\n').map((l) => `  ${l}`).join('\n'));
  }

  console.log('');
}

function usage() {
  console.log(`
  ${c('bold', 'oh-my-claude')} ${c('dim', '(omc)')} — Claude Code templates for every project

  ${c('bold', 'Usage:')}
    omc list                 Show available templates
    omc install <template>   Install template into current directory
    omc preview <template>   Preview template contents
    omc help                 Show this help message

  ${c('bold', 'Examples:')}
    ${c('dim', '$')} omc list
    ${c('dim', '$')} omc install nextjs
    ${c('dim', '$')} omc preview python-api
`);
}

// --- main ---
const [, , command, ...args] = process.argv;

switch (command) {
  case 'list':
  case 'ls':
    list();
    break;
  case 'install':
  case 'i':
    if (!args[0]) {
      console.error(`\n  ${c('red', 'Error:')} Specify a template name. Run ${c('yellow', 'omc list')} to see options.\n`);
      process.exit(1);
    }
    install(args[0]);
    break;
  case 'preview':
  case 'p':
    if (!args[0]) {
      console.error(`\n  ${c('red', 'Error:')} Specify a template name. Run ${c('yellow', 'omc list')} to see options.\n`);
      process.exit(1);
    }
    preview(args[0]);
    break;
  case 'help':
  case '-h':
  case '--help':
  case undefined:
    usage();
    break;
  default:
    console.error(`\n  ${c('red', 'Unknown command:')} ${command}`);
    usage();
    process.exit(1);
}
