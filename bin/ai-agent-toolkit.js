#!/usr/bin/env node
/**
 * AI Agent Toolkit - CLI
 *
 * Main entry point for running the toolkit
 *
 * Usage:
 *   npx ai-agent-toolkit <command> [options]
 *
 * Commands:
 *   init          Initialize a new run
 *   intake        Start intake session
 *   research      Run research phase
 *   debate        Run debate phase
 *   spec          Generate spec + tasks
 *   qa            Run QA gate
 *   selfcheck     Validate environment
 *   list          List all runs
 *   status        Show run status
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.blue}${msg}${colors.reset}\n`)
};

// Parse arguments
const parseArgs = (args) => {
  const result = { _: [], options: {} };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      result.options[key] = value;
    } else if (args[i].startsWith('-')) {
      const key = args[i].slice(1);
      const value = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : true;
      result.options[key] = value;
    } else {
      result._.push(args[i]);
    }
  }
  return result;
};

// Run a skill script
const runSkill = (skill, script, args = []) => {
  const scriptPath = path.join(SKILLS_DIR, skill, 'scripts', script);
  if (!fs.existsSync(scriptPath)) {
    log.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }

  const result = spawnSync('node', [scriptPath, ...args], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env }
  });

  return result.status;
};

// Commands
const commands = {
  help: () => {
    console.log(`
${colors.bright}AI Agent Toolkit${colors.reset}

${colors.cyan}Usage:${colors.reset}
  ai-agent-toolkit <command> [options]

${colors.cyan}Commands:${colors.reset}
  ${colors.green}init${colors.reset} [slug]        Initialize a new run
  ${colors.green}intake${colors.reset}            Start requirements gathering
  ${colors.green}research${colors.reset} [query]  Search for similar repos/patterns
  ${colors.green}debate${colors.reset}            Run debate phase
  ${colors.green}spec${colors.reset}              Generate spec + task breakdown
  ${colors.green}qa${colors.reset}                Run QA gate
  ${colors.green}review${colors.reset}            Run code review
  ${colors.green}selfcheck${colors.reset}         Validate environment setup
  ${colors.green}list${colors.reset}              List all runs
  ${colors.green}status${colors.reset} [run_id]   Show run status

${colors.cyan}Options:${colors.reset}
  --run-id <id>     Specify run ID (default: from env or latest)
  --quick           Quick mode (skip interactive prompts)
  --help, -h        Show this help

${colors.cyan}Examples:${colors.reset}
  ai-agent-toolkit init my-project
  ai-agent-toolkit intake --quick
  ai-agent-toolkit research "nodejs auth starter"
  ai-agent-toolkit qa --run-id 20260123_1430_my-project
`);
  },

  selfcheck: () => {
    log.header('Running Self-Check');
    return runSkill('orchestrator', 'selfcheck.js');
  },

  init: (args) => {
    const slug = args._[1] || 'new-project';

    // Use utils to init run
    try {
      const utils = require(path.join(LIB_DIR, 'utils.js'));
      const runId = utils.generateRunId(slug);
      const runDir = utils.initRunDir(runId);

      // Create initial user request file
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
      log.info(`\nNext steps:`);
      log.info(`  1. Edit ${userRequestPath}`);
      log.info(`  2. Run: ai-agent-toolkit intake --run-id ${runId}`);

      // Set environment variable for subsequent commands
      console.log(`\nExport run ID:`);
      console.log(`  export RUN_ID=${runId}`);

      return 0;
    } catch (e) {
      log.error(`Failed to initialize: ${e.message}`);
      return 1;
    }
  },

  intake: (args) => {
    log.header('Starting Intake Phase');

    if (args.options.quick) {
      return runSkill('intake', 'start-intake.js', ['--quick', '--name', args._[1] || 'project']);
    }
    return runSkill('intake', 'start-intake.js');
  },

  research: (args) => {
    log.header('Starting Research Phase');
    const query = args._[1] || '';
    const searchArgs = query ? ['--query', query] : [];
    return runSkill('research', 'search-github.js', searchArgs);
  },

  debate: (args) => {
    log.header('Starting Debate Phase');
    const inputFile = args.options.input || 'research.shortlist.json';
    return runSkill('debate', 'debate.js', ['--input', inputFile]);
  },

  spec: (args) => {
    log.header('Generating Spec + Tasks');
    const debateFile = args.options.debate || 'debate.inputs_for_spec.json';

    // Run both spec generation scripts
    let status = runSkill('spec-agent', 'generate-spec.js', ['--debate', debateFile]);
    if (status === 0) {
      status = runSkill('spec-agent', 'generate-tasks.js', ['--debate', debateFile]);
    }
    return status;
  },

  qa: (args) => {
    log.header('Running QA Gate');
    return runSkill('qa-gate', 'run-gate.js');
  },

  review: (args) => {
    log.header('Running Code Review');
    const reviewPath = path.join(SKILLS_DIR, 'code-review', 'review.js');
    if (!fs.existsSync(reviewPath)) {
      log.error(`Review script not found: ${reviewPath}`);
      return 1;
    }
    const result = spawnSync('node', [reviewPath, ...args._.slice(1)], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env }
    });
    return result.status;
  },

  test: (args) => {
    log.header('Running Test Generator');
    const testPath = path.join(SKILLS_DIR, 'test-generator', 'generate.js');
    if (!fs.existsSync(testPath)) {
      log.error(`Test generator script not found: ${testPath}`);
      return 1;
    }
    const result = spawnSync('node', [testPath, ...args._.slice(1)], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env }
    });
    return result.status;
  },

  list: () => {
    log.header('Available Runs');

    try {
      const utils = require(path.join(LIB_DIR, 'utils.js'));
      const runs = utils.listRuns();

      if (runs.length === 0) {
        log.info('No runs found. Create one with: ai-agent-toolkit init <name>');
        return 0;
      }

      runs.forEach((runId, i) => {
        const prefix = i === 0 ? `${colors.green}(latest)${colors.reset} ` : '         ';
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
        log.error('No runs found. Create one with: ai-agent-toolkit init <name>');
        return 1;
      }

      log.header(`Run Status: ${targetRunId}`);

      const phases = [
        { id: 'intake', path: '10_intake', files: ['intake.json', 'intake.summary.md'] },
        { id: 'research', path: '20_research', files: ['research.shortlist.json', 'research.reuse_assessment.json'] },
        { id: 'debate', path: '30_debate', files: ['debate.inputs_for_spec.json', 'debate.decision.md'] },
        { id: 'spec', path: '40_spec', files: ['spec.md', 'task_breakdown.json'] },
        { id: 'design', path: '45_design', files: ['handoff.md'] },
        { id: 'verify', path: '60_verification', files: ['report.json', 'summary.md'] }
      ];

      const runDir = path.join(utils.ARTIFACTS_DIR, targetRunId);

      if (!fs.existsSync(runDir)) {
        log.error(`Run not found: ${targetRunId}`);
        return 1;
      }

      phases.forEach(phase => {
        const phasePath = path.join(runDir, phase.path);
        const exists = fs.existsSync(phasePath);
        const hasFiles = exists && phase.files.some(f => fs.existsSync(path.join(phasePath, f)));

        if (hasFiles) {
          log.success(`${phase.id}: Complete`);
        } else if (exists) {
          log.warn(`${phase.id}: In progress`);
        } else {
          console.log(`  ${colors.reset}○ ${phase.id}: Pending`);
        }
      });

      return 0;
    } catch (e) {
      log.error(`Failed to get status: ${e.message}`);
      return 1;
    }
  }
};

// Main
const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'help';

  if (args.options.help || args.options.h) {
    commands.help();
    process.exit(0);
  }

  if (commands[command]) {
    const status = commands[command](args);
    process.exit(status || 0);
  } else {
    log.error(`Unknown command: ${command}`);
    log.info('Run "ai-agent-toolkit help" for usage');
    process.exit(1);
  }
};

main();
