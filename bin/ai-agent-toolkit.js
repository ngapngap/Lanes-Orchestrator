#!/usr/bin/env node
/**
 * AI Agent Toolkit - CLI
 *
 * Unified CLI entrypoint with auto-discovery of skill commands
 *
 * Usage:
 *   npx ai-agent-toolkit <command> [options]
 *   npx ai-agent-toolkit <skill>:<command> [options]
 *
 * Examples:
 *   npx aat init my-project
 *   npx aat intake --quick
 *   npx aat research:search "nodejs auth"
 *   npx aat code-review:review --path src/
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Find repo root
const findRepoRoot = () => {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'AGENTS.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
};

const REPO_ROOT = findRepoRoot();
const SKILLS_DIR = path.join(REPO_ROOT, '.agent', 'skills');
const LIB_DIR = path.join(REPO_ROOT, '.agent', 'lib');

// Colors for terminal
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const log = {
  info: (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`),
  success: (msg) => console.log(`${c.green}✓${c.reset} ${msg}`),
  warn: (msg) => console.log(`${c.yellow}⚠${c.reset} ${msg}`),
  error: (msg) => console.log(`${c.red}✗${c.reset} ${msg}`),
  header: (msg) => console.log(`\n${c.bold}${c.blue}${msg}${c.reset}\n`)
};

// ============================================
// Skill Discovery & Registry
// ============================================

const discoverSkills = () => {
  const skills = {};

  if (!fs.existsSync(SKILLS_DIR)) return skills;

  const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const skillName of skillDirs) {
    const manifestPath = path.join(SKILLS_DIR, skillName, 'skill.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        skills[skillName] = {
          ...manifest,
          path: path.join(SKILLS_DIR, skillName)
        };
      } catch (e) {
        // Invalid manifest, skip
      }
    }
  }

  return skills;
};

// Build command registry from all skills
const buildCommandRegistry = (skills) => {
  const registry = {
    commands: {},      // Direct commands (e.g., "review")
    aliases: {},       // Skill:command format (e.g., "code-review:review")
    shortcuts: {}      // Shortcut mappings
  };

  // Built-in commands
  registry.commands['help'] = { type: 'builtin', handler: 'help' };
  registry.commands['init'] = { type: 'builtin', handler: 'init' };
  registry.commands['list'] = { type: 'builtin', handler: 'list' };
  registry.commands['status'] = { type: 'builtin', handler: 'status' };
  registry.commands['skills'] = { type: 'builtin', handler: 'skills' };

  // Register skill commands
  for (const [skillName, skill] of Object.entries(skills)) {
    if (!skill.commands) continue;

    for (const [cmdName, cmdDef] of Object.entries(skill.commands)) {
      const fullName = `${skillName}:${cmdName}`;

      // Register full name (skill:command)
      registry.aliases[fullName] = {
        type: 'skill',
        skill: skillName,
        command: cmdName,
        script: cmdDef.script,
        description: cmdDef.description,
        args: cmdDef.args || []
      };

      // Register shortcut if no conflict
      if (!registry.commands[cmdName]) {
        registry.commands[cmdName] = {
          type: 'skill',
          skill: skillName,
          command: cmdName,
          script: cmdDef.script,
          description: cmdDef.description,
          args: cmdDef.args || []
        };
      }
    }
  }

  // Common shortcuts
  registry.shortcuts = {
    'selfcheck': 'orchestrator:selfcheck',
    'intake': 'intake:start',
    'research': 'research:search',
    'debate': 'debate:run',
    'spec': 'spec-agent:spec',
    'tasks': 'spec-agent:tasks',
    'qa': 'qa-gate:run',
    'review': 'code-review:review',
    'test': 'test-generator:generate'
  };

  return registry;
};

// ============================================
// Command Execution
// ============================================

const parseArgs = (args) => {
  const result = { _: [], options: {} };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      result.options[key] = value;
    } else if (args[i].startsWith('-') && args[i].length === 2) {
      const key = args[i].slice(1);
      const value = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : true;
      result.options[key] = value;
    } else {
      result._.push(args[i]);
    }
  }
  return result;
};

const runSkillCommand = (skillPath, scriptPath, args = []) => {
  const fullScriptPath = path.join(skillPath, scriptPath);

  if (!fs.existsSync(fullScriptPath)) {
    log.error(`Script not found: ${fullScriptPath}`);
    return 1;
  }

  const result = spawnSync('node', [fullScriptPath, ...args], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env }
  });

  return result.status || 0;
};

// ============================================
// Built-in Commands
// ============================================

const builtinCommands = {
  help: (args, skills, registry) => {
    console.log(`
${c.bold}AI Agent Toolkit${c.reset} - Unified CLI for AI-powered development pipeline

${c.cyan}USAGE${c.reset}
  npx ai-agent-toolkit <command> [options]
  npx ai-agent-toolkit <skill>:<command> [options]
  npx aat <command> [options]

${c.cyan}PIPELINE COMMANDS${c.reset}
  ${c.green}init${c.reset} <slug>           Initialize a new pipeline run
  ${c.green}intake${c.reset}                Start requirements gathering
  ${c.green}research${c.reset} [query]      Search for repos/patterns
  ${c.green}debate${c.reset}                Run council decision
  ${c.green}spec${c.reset}                  Generate specification
  ${c.green}tasks${c.reset}                 Generate task breakdown

${c.cyan}QUALITY COMMANDS${c.reset}
  ${c.green}review${c.reset}                Run code review
  ${c.green}test${c.reset}                  Generate tests
  ${c.green}qa${c.reset}                    Run QA gate

${c.cyan}MANAGEMENT${c.reset}
  ${c.green}list${c.reset}                  List all runs
  ${c.green}status${c.reset} [run_id]       Show run status
  ${c.green}selfcheck${c.reset}             Validate environment
  ${c.green}skills${c.reset}                List available skills

${c.cyan}OPTIONS${c.reset}
  --run-id <id>         Specify run ID
  --help, -h            Show help

${c.cyan}EXAMPLES${c.reset}
  npx aat init my-project
  npx aat research "nodejs auth starter"
  npx aat code-review:review --path src/
  npx aat qa --run-id 20260123_1430_myproject

${c.dim}See 'npx aat skills' for all available skill commands${c.reset}
`);
    return 0;
  },

  skills: (args, skills, registry) => {
    log.header('Available Skills & Commands');

    for (const [skillName, skill] of Object.entries(skills)) {
      console.log(`${c.bold}${skillName}${c.reset} - ${skill.description || ''}`);

      if (skill.commands) {
        for (const [cmdName, cmdDef] of Object.entries(skill.commands)) {
          console.log(`  ${c.green}${skillName}:${cmdName}${c.reset}`);
          console.log(`    ${c.dim}${cmdDef.description || ''}${c.reset}`);

          if (cmdDef.args && cmdDef.args.length > 0) {
            cmdDef.args.forEach(arg => {
              const defaultStr = arg.default !== undefined ? ` (default: ${arg.default})` : '';
              console.log(`    ${c.cyan}${arg.name}${c.reset} - ${arg.description}${defaultStr}`);
            });
          }
        }
      }
      console.log();
    }

    return 0;
  },

  init: (args) => {
    const slug = args._[1] || 'new-project';

    try {
      const utils = require(path.join(LIB_DIR, 'utils.js'));
      const runId = utils.generateRunId(slug);
      const runDir = utils.initRunDir(runId);

      const userRequestPath = path.join(runDir, '00_user_request.md');
      fs.writeFileSync(userRequestPath, `# User Request

## Project
${slug}

## Description
[Add project description here]

## Goals
- [Goal 1]
- [Goal 2]

---
*Created: ${new Date().toISOString()}*
`, 'utf8');

      log.success(`Initialized new run: ${runId}`);
      log.info(`Run directory: ${runDir}`);
      console.log(`\n${c.cyan}Next steps:${c.reset}`);
      console.log(`  1. Edit ${userRequestPath}`);
      console.log(`  2. Run: ${c.green}npx aat intake --run-id ${runId}${c.reset}`);
      console.log(`\nExport run ID:`);
      console.log(`  ${c.yellow}export RUN_ID=${runId}${c.reset}`);

      return 0;
    } catch (e) {
      log.error(`Failed to initialize: ${e.message}`);
      return 1;
    }
  },

  list: (args) => {
    log.header('Pipeline Runs');

    try {
      const utils = require(path.join(LIB_DIR, 'utils.js'));
      const runs = utils.listRuns();

      if (runs.length === 0) {
        log.info('No runs found. Create one with: npx aat init <name>');
        return 0;
      }

      runs.forEach((runId, i) => {
        const prefix = i === 0 ? `${c.green}(latest)${c.reset} ` : '         ';
        console.log(`  ${prefix}${runId}`);
      });

      return 0;
    } catch (e) {
      log.error(`Failed to list runs: ${e.message}`);
      return 1;
    }
  },

  status: (args) => {
    const runId = args._[1] || args.options['run-id'] || process.env.RUN_ID;

    try {
      const utils = require(path.join(LIB_DIR, 'utils.js'));
      const targetRunId = runId || utils.getLatestRunId();

      if (!targetRunId) {
        log.error('No runs found. Create one with: npx aat init <name>');
        return 1;
      }

      log.header(`Run Status: ${targetRunId}`);

      const phases = [
        { id: 'intake', path: '10_intake', check: ['intake.json'] },
        { id: 'research', path: '20_research', check: ['research.shortlist.json'] },
        { id: 'debate', path: '30_debate', check: ['debate.inputs_for_spec.json'] },
        { id: 'spec', path: '40_spec', check: ['spec.md', 'task_breakdown.json'] },
        { id: 'design', path: '45_design', check: ['handoff.md'] },
        { id: 'implementation', path: '50_implementation', check: [] },
        { id: 'verification', path: '60_verification', check: ['report.json'] }
      ];

      const runDir = path.join(utils.ARTIFACTS_DIR, targetRunId);

      if (!fs.existsSync(runDir)) {
        log.error(`Run not found: ${targetRunId}`);
        return 1;
      }

      phases.forEach(phase => {
        const phasePath = path.join(runDir, phase.path);
        const exists = fs.existsSync(phasePath);
        const hasFiles = exists && phase.check.some(f => fs.existsSync(path.join(phasePath, f)));

        if (hasFiles) {
          log.success(`${phase.id}`);
        } else if (exists && fs.readdirSync(phasePath).length > 0) {
          log.warn(`${phase.id} (in progress)`);
        } else {
          console.log(`  ${c.dim}○ ${phase.id}${c.reset}`);
        }
      });

      return 0;
    } catch (e) {
      log.error(`Failed to get status: ${e.message}`);
      return 1;
    }
  }
};

// ============================================
// Main
// ============================================

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'help';

  // Show help
  if (args.options.help || args.options.h || command === '-h') {
    builtinCommands.help(args, {}, {});
    process.exit(0);
  }

  // Discover skills
  const skills = discoverSkills();
  const registry = buildCommandRegistry(skills);

  // Resolve command
  let resolvedCmd = null;

  // Check if it's a skill:command format
  if (command.includes(':')) {
    resolvedCmd = registry.aliases[command];
  }
  // Check shortcuts
  else if (registry.shortcuts[command]) {
    resolvedCmd = registry.aliases[registry.shortcuts[command]];
  }
  // Check direct commands
  else if (registry.commands[command]) {
    resolvedCmd = registry.commands[command];
  }

  // Execute
  if (!resolvedCmd) {
    log.error(`Unknown command: ${command}`);
    log.info('Run "npx aat help" for available commands');
    log.info('Run "npx aat skills" for all skill commands');
    process.exit(1);
  }

  if (resolvedCmd.type === 'builtin') {
    const status = builtinCommands[resolvedCmd.handler](args, skills, registry);
    process.exit(status || 0);
  }

  if (resolvedCmd.type === 'skill') {
    const skill = skills[resolvedCmd.skill];
    if (!skill) {
      log.error(`Skill not found: ${resolvedCmd.skill}`);
      process.exit(1);
    }

    log.header(`${resolvedCmd.skill}:${resolvedCmd.command}`);

    // Build args for script
    const scriptArgs = [];
    for (const [key, value] of Object.entries(args.options)) {
      if (value === true) {
        scriptArgs.push(`--${key}`);
      } else {
        scriptArgs.push(`--${key}`, String(value));
      }
    }
    // Add positional args after command
    scriptArgs.push(...args._.slice(1));

    const status = runSkillCommand(skill.path, resolvedCmd.script, scriptArgs);
    process.exit(status);
  }
};

main();
