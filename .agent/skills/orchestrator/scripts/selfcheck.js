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
    warn('BRAVE_API_KEY not set - brave-search skill will not work');
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
    'package.json',
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
    'debug-security',
    'code-review',
    'test-generator'
];

requiredSkills.forEach(skill => {
    const skillPath = path.join(skillsDir, skill);
    const skillJson = path.join(skillPath, 'skill.json');
    const skillMd = path.join(skillPath, 'SKILL.md');

    if (fs.existsSync(skillPath)) {
        if (fs.existsSync(skillJson)) {
            ok(`${skill} (has skill.json)`);
        } else if (fs.existsSync(skillMd)) {
            ok(`${skill} (has SKILL.md)`);
        } else {
            warn(`${skill} - folder exists but missing skill.json/SKILL.md`);
        }
    } else {
        warn(`Missing skill: ${skill}`);
    }
});

// ===========================================
// 4. Check Agents (6 agents after merge)
// ===========================================
console.log('\n─── Agents (6 total) ───\n');

const agentsDir = path.join(repoRoot, 'agents');
const requiredAgents = [
    'orchestrator.agent.md',
    'ask.agent.md',
    'architect.agent.md',      // Merged: Research + Debate + Spec
    'design.agent.md',
    'code.agent.md',
    'qa_gate.agent.md',
    'debug_security.agent.md'
];

// Deprecated agents (should NOT exist)
const deprecatedAgents = [
    'debate.agent.md',
    'spec.agent.md'
];

requiredAgents.forEach(agent => {
    const agentPath = path.join(agentsDir, agent);
    if (fs.existsSync(agentPath)) {
        ok(agent);
    } else {
        fail(`Missing agent: ${agent}`);
    }
});

// Check for deprecated agents
deprecatedAgents.forEach(agent => {
    const agentPath = path.join(agentsDir, agent);
    if (fs.existsSync(agentPath)) {
        warn(`Deprecated agent still exists: ${agent} (now merged into architect.agent.md)`);
    }
});

// ===========================================
// 5. Check Dependencies (optional)
// ===========================================
console.log('\n─── Dependencies ───\n');

// node-pty is optional - only warn, don't fail
try {
    require('node-pty');
    ok('node-pty is installed');
} catch (e) {
    info('node-pty not installed (optional - for advanced terminal features)');
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

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion >= 18) {
    ok(`Node.js ${nodeVersion} (>=18 required)`);
} else {
    fail(`Node.js ${nodeVersion} - version 18+ required`);
}

// ===========================================
// 6. Check MCP Servers
// ===========================================
console.log('\n─── MCP Servers ───\n');

const mcpDir = path.join(repoRoot, '.agent/mcp/servers');
const mcpServers = ['github-server.js', 'brave-server.js', 'artifacts-server.js'];

mcpServers.forEach(server => {
    const serverPath = path.join(mcpDir, server);
    if (fs.existsSync(serverPath)) {
        ok(server);
    } else {
        warn(`Missing MCP server: ${server}`);
    }
});

// ===========================================
// 7. Check Artifacts Directory
// ===========================================
console.log('\n─── Artifacts Directory ───\n');

const artifactsDir = path.join(repoRoot, 'artifacts/runs');
if (fs.existsSync(artifactsDir)) {
    ok('artifacts/runs/ directory exists');
    const runs = fs.readdirSync(artifactsDir).filter(f =>
        fs.statSync(path.join(artifactsDir, f)).isDirectory()
    );
    info(`Found ${runs.length} run(s)`);
    if (runs.length > 0) {
        info(`Latest: ${runs.sort().reverse()[0]}`);
    }
} else {
    info('artifacts/runs/ directory does not exist');
    info('Will be created when pipeline runs');
}

// ===========================================
// 8. Check utils.js
// ===========================================
console.log('\n─── Utilities ───\n');

const utilsPath = path.join(repoRoot, '.agent/lib/utils.js');
if (fs.existsSync(utilsPath)) {
    ok('utils.js exists');
    try {
        const utils = require(utilsPath);
        if (typeof utils.writeArtifact === 'function') {
            ok('utils.writeArtifact available');
        } else {
            warn('utils.writeArtifact not found');
        }
        if (typeof utils.getArtifactPath === 'function') {
            ok('utils.getArtifactPath available');
        } else {
            warn('utils.getArtifactPath not found');
        }
    } catch (e) {
        warn(`utils.js load error: ${e.message}`);
    }
} else {
    fail('Missing: .agent/lib/utils.js');
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

if (errors === 0) {
    console.log('Quick start:');
    console.log('  npx aat init my-project');
    console.log('  npx aat intake --run-id <generated-id>');
    console.log('  npx aat research');
    console.log('  npx aat spec');
    console.log('  npx aat qa\n');
}

process.exit(errors > 0 ? 1 : 0);
