#!/usr/bin/env node
/**
 * create-command.js
 * Tạo command file cho AI agents
 *
 * Usage: node create-command.js --agent <agent> --name <command-name>
 */

const fs = require('fs');
const path = require('path');

// Agent configurations - sử dụng CLI tool name làm key
const AGENT_CONFIG = {
  'claude': {
    name: 'Claude Code',
    folder: '.claude/commands/',
    format: 'markdown',
    extension: '.md'
  },
  'gemini': {
    name: 'Gemini CLI',
    folder: '.gemini/commands/',
    format: 'toml',
    extension: '.toml'
  },
  'copilot': {
    name: 'GitHub Copilot',
    folder: '.github/agents/',
    format: 'markdown',
    extension: '.md'
  },
  'cursor-agent': {
    name: 'Cursor',
    folder: '.cursor/commands/',
    format: 'markdown',
    extension: '.md'
  },
  'qwen': {
    name: 'Qwen Code',
    folder: '.qwen/commands/',
    format: 'toml',
    extension: '.toml'
  },
  'opencode': {
    name: 'opencode',
    folder: '.opencode/command/',
    format: 'markdown',
    extension: '.md'
  },
  'codex': {
    name: 'Codex CLI',
    folder: '.codex/commands/',
    format: 'markdown',
    extension: '.md'
  },
  'windsurf': {
    name: 'Windsurf',
    folder: '.windsurf/workflows/',
    format: 'markdown',
    extension: '.md'
  },
  'q': {
    name: 'Amazon Q Developer',
    folder: '.amazonq/prompts/',
    format: 'markdown',
    extension: '.md'
  },
  'amp': {
    name: 'Amp',
    folder: '.agents/commands/',
    format: 'markdown',
    extension: '.md'
  },
  'kilocode': {
    name: 'Kilo Code',
    folder: '.kilocode/rules/',
    format: 'markdown',
    extension: '.md'
  },
  'auggie': {
    name: 'Auggie CLI',
    folder: '.augment/rules/',
    format: 'markdown',
    extension: '.md'
  },
  'roo': {
    name: 'Roo Code',
    folder: '.roo/rules/',
    format: 'markdown',
    extension: '.md'
  },
  'codebuddy': {
    name: 'CodeBuddy CLI',
    folder: '.codebuddy/commands/',
    format: 'markdown',
    extension: '.md'
  },
  'qoder': {
    name: 'Qoder CLI',
    folder: '.qoder/commands/',
    format: 'markdown',
    extension: '.md'
  },
  'shai': {
    name: 'SHAI',
    folder: '.shai/commands/',
    format: 'markdown',
    extension: '.md'
  },
  'bob': {
    name: 'IBM Bob',
    folder: '.bob/commands/',
    format: 'markdown',
    extension: '.md'
  }
};

// Command templates
const COMMAND_TEMPLATES = {
  markdown: (name, description) => `---
description: "${description}"
---

# ${name}

[Mô tả chi tiết command này làm gì]

## Input
$ARGUMENTS

## Quy trình
1. [Bước 1]
2. [Bước 2]
3. [Bước 3]

## Output
[Mô tả output mong đợi]

## Ví dụ
\`\`\`
/${name} [arguments]
\`\`\`

## Lưu ý
- [Lưu ý 1]
- [Lưu ý 2]
`,

  toml: (name, description) => `description = "${description}"

prompt = """
# ${name}

[Mô tả chi tiết command này làm gì]

## Input
{{args}}

## Quy trình
1. [Bước 1]
2. [Bước 2]
3. [Bước 3]

## Output
[Mô tả output mong đợi]

## Lưu ý
- [Lưu ý 1]
- [Lưu ý 2]
"""
`
};

// Parse arguments
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      result[key] = value;
      if (value !== true) i++;
    }
  }
  return result;
}

// Convert kebab-case to Title Case
function toTitleCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created: ${dirPath}`);
  }
}

// Main function
function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = args.cwd || process.cwd();
  const agent = args.agent || 'claude';
  const name = args.name;
  const description = args.description || `Command: ${toTitleCase(name || 'custom')}`;

  // Validate inputs
  if (!name) {
    console.error('❌ Error: --name is required');
    console.log('Usage: node create-command.js --agent <agent> --name <command-name>');
    console.log(`Available agents: ${Object.keys(AGENT_CONFIG).join(', ')}`);
    process.exit(1);
  }

  if (!AGENT_CONFIG[agent]) {
    console.error(`❌ Error: Unknown agent "${agent}"`);
    console.log(`Available agents: ${Object.keys(AGENT_CONFIG).join(', ')}`);
    process.exit(1);
  }

  const config = AGENT_CONFIG[agent];
  const fileName = `${name}${config.extension}`;
  const filePath = path.join(projectRoot, config.folder, fileName);
  const title = toTitleCase(name);

  console.log(`\n🚀 Creating command: ${title}`);
  console.log(`🤖 Agent: ${config.name}\n`);

  // Check if file exists
  if (fs.existsSync(filePath)) {
    console.error(`❌ Error: Command already exists at ${filePath}`);
    process.exit(1);
  }

  // Ensure directory exists
  ensureDir(path.join(projectRoot, config.folder));

  // Create command file
  const template = COMMAND_TEMPLATES[config.format];
  const content = template(title, description);
  fs.writeFileSync(filePath, content);
  console.log(`📄 Created: ${filePath}`);

  console.log(`\n✅ Command created successfully!`);
  console.log(`\nUsage:
  /${name} [arguments]

Edit the command at: ${filePath}
`);
}

main();
