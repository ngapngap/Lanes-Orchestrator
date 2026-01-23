#!/usr/bin/env node
/**
 * Orchestrator Self-Check Script
 *
 * Validates environment setup before running pipeline
 */

const fs = require('fs');
const path = require('path');

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║              AI Agent Toolkit - Self Check                   ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let errors = 0;
let warnings = 0;

// Helper functions
function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); warnings++; }
function fail(msg) { console.log(`  ✗ ${msg}`); errors++; }
function info(msg) { console.log(`  ℹ ${msg}`); }

// ===========================================
// 1. Check Environment Variables
// ===========================================
console.log('─── Environment Variables ───\n');

// BRAVE_API_KEY
if (process.env.BRAVE_API_KEY) {
    if (process.env.BRAVE_API_KEY.startsWith('BSA')) {
        ok('BRAVE_API_KEY is set (looks valid)');
    } else {
        warn('BRAVE_API_KEY is set but format looks unusual');
    }
} else {
    fail('BRAVE_API_KEY not set - brave-search skill will not work');
    info('Get your key at: https://brave.com/search/api/');
}

// GITHUB_TOKEN
if (process.env.GITHUB_TOKEN) {
    ok('GITHUB_TOKEN is set (5000 req/hour)');
} else {
    warn('GITHUB_TOKEN not set - GitHub API limited to 60 req/hour');
    info('Create at: https://github.com/settings/tokens');
}

// RUN_ID
if (process.env.RUN_ID) {
    if (/^\d{8}_\d{4}_[\w-]+$/.test(process.env.RUN_ID)) {
        ok(`RUN_ID is set: ${process.env.RUN_ID}`);
    } else {
        warn(`RUN_ID format unusual: ${process.env.RUN_ID}`);
        info('Expected format: YYYYMMDD_HHMM_<slug>');
    }
} else {
    info('RUN_ID not set - will auto-generate when pipeline runs');
}

// ===========================================
// 2. Check Required Files
// ===========================================
console.log('\n─── Required Files ───\n');

const repoRoot = path.resolve(__dirname, '../../../..');
const requiredFiles = [
    'AGENTS.md',
    'RULES.md',
    'qa.md',
    'LICENSE_POLICY.md',
    'schemas/intake.schema.json',
    'schemas/research.shortlist.schema.json',
    'schemas/research.reuse_assessment.schema.json',
    'schemas/debate.inputs_for_spec.schema.json',
    'schemas/task_breakdown.schema.json',
    'schemas/verification.report.schema.json'
];

requiredFiles.forEach(f => {
    const fullPath = path.join(repoRoot, f);
    if (fs.existsSync(fullPath)) {
        ok(f);
    } else {
        fail(`Missing: ${f}`);
    }
});

// ===========================================
// 3. Check Skills
// ===========================================
console.log('\n─── Skills ───\n');

const skillsDir = path.join(repoRoot, '.agent/skills');
const requiredSkills = [
    'intake',
    'research',
    'brave-search',
    'github',
    'debate',
    'spec-agent',
    'orchestrator',
    'ui-ux',
    'qa-gate',
    'debug-security'
];

requiredSkills.forEach(skill => {
    const skillPath = path.join(skillsDir, skill);
    const skillMd = path.join(skillPath, 'SKILL.md');
    if (fs.existsSync(skillPath) && fs.existsSync(skillMd)) {
        ok(skill);
    } else if (fs.existsSync(skillPath)) {
        warn(`${skill} - folder exists but missing SKILL.md`);
    } else {
        fail(`Missing skill: ${skill}`);
    }
});

// ===========================================
// 4. Check Agents
// ===========================================
console.log('\n─── Agents ───\n');

const agentsDir = path.join(repoRoot, 'agents');
const requiredAgents = [
    'orchestrator.agent.md',
    'ask.agent.md',
    'architect.agent.md',
    'debate.agent.md',
    'spec.agent.md',
    'design.agent.md',
    'code.agent.md',
    'qa_gate.agent.md',
    'debug_security.agent.md'
];

requiredAgents.forEach(agent => {
    const agentPath = path.join(agentsDir, agent);
    if (fs.existsSync(agentPath)) {
        ok(agent);
    } else {
        fail(`Missing agent: ${agent}`);
    }
});

// ===========================================
// 5. Check Dependencies
// ===========================================
console.log('\n─── Dependencies ───\n');

try {
    require('node-pty');
    ok('node-pty is installed');
} catch (e) {
    warn('node-pty not found - orchestrator run-agent.js may not work');
    info('Install with: npm install node-pty');
}

// Check gh CLI
const { execSync } = require('child_process');
try {
    execSync('gh --version', { stdio: 'pipe' });
    ok('gh CLI is installed');
} catch (e) {
    warn('gh CLI not found - github skill will have limited functionality');
    info('Install from: https://cli.github.com/');
}

// ===========================================
// 6. Check Artifacts Directory
// ===========================================
console.log('\n─── Artifacts Directory ───\n');

const artifactsDir = path.join(repoRoot, 'artifacts/runs');
if (fs.existsSync(artifactsDir)) {
    ok('artifacts/runs/ directory exists');
    const runs = fs.readdirSync(artifactsDir);
    info(`Found ${runs.length} run(s)`);
} else {
    warn('artifacts/runs/ directory does not exist');
    info('Will be created when pipeline runs');
}

// ===========================================
// Summary
// ===========================================
console.log('\n╔══════════════════════════════════════════════════════════════╗');
if (errors === 0 && warnings === 0) {
    console.log('║  ✓ All checks passed! Ready to run pipeline.                 ║');
} else if (errors === 0) {
    console.log(`║  ⚠ ${warnings} warning(s) - pipeline may have limited functionality ║`);
} else {
    console.log(`║  ✗ ${errors} error(s), ${warnings} warning(s) - please fix before running ║`);
}
console.log('╚══════════════════════════════════════════════════════════════╝\n');

process.exit(errors > 0 ? 1 : 0);
