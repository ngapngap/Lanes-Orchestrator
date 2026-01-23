#!/usr/bin/env node
/**
 * Regression Test Runner for Vibe Mode
 * DoD vNext Section 6.1-6.3
 *
 * Runs all prompts from prompts.json through vibe mode
 * and validates the outputs match expected assertions.
 *
 * Usage:
 *   node scripts/regression/run-prompts.js [--prompt-id <id>] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Find repo root
const REPO_ROOT = (() => {
    let dir = __dirname;
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'AGENTS.md'))) return dir;
        dir = path.dirname(dir);
    }
    return process.cwd();
})();

// Colors
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

// Parse args
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        promptId: null,
        dryRun: false,
        verbose: false
    };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--prompt-id' && args[i + 1]) options.promptId = args[++i];
        else if (args[i] === '--dry-run') options.dryRun = true;
        else if (args[i] === '--verbose' || args[i] === '-v') options.verbose = true;
    }
    return options;
};

// Load prompts
const loadPrompts = () => {
    const promptsFile = path.join(__dirname, 'prompts.json');
    if (!fs.existsSync(promptsFile)) {
        console.error(`${c.red}[ERROR]${c.reset} prompts.json not found`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(promptsFile, 'utf8'));
};

// Run vibe for a single prompt
const runVibe = (prompt, promptId) => {
    const tempDir = path.join(REPO_ROOT, 'artifacts', 'runs', `regression_${promptId}_${Date.now()}`);

    console.log(`  ${c.dim}Running vibe...${c.reset}`);

    const result = spawnSync('node', [
        path.join(REPO_ROOT, '.agent/skills/orchestrator/scripts/vibe.js'),
        prompt,
        '--non-interactive',
        '--path', tempDir
    ], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: 60000 // 1 minute timeout
    });

    if (result.status !== 0) {
        return { success: false, error: result.stderr || `Vibe failed with exit code ${result.status}`, runDir: tempDir, exitCode: result.status };
    }

    return { success: true, runDir: tempDir, exitCode: result.status };
};

// Load artifacts from run directory
const loadArtifacts = (runDir) => {
    const artifacts = {};

    const tryLoad = (subPath, key) => {
        const filePath = path.join(runDir, subPath);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            if (subPath.endsWith('.json')) {
                try {
                    artifacts[key] = JSON.parse(content);
                } catch (e) {
                    artifacts[key] = null;
                }
            } else {
                artifacts[key] = content;
            }
        }
    };

    tryLoad('05_classify/classify.json', 'classify');
    tryLoad('10_intake/intake.json', 'intake');
    tryLoad('20_research/research.shortlist.json', 'research');
    tryLoad('30_decisions/decisions.json', 'decisions');
    tryLoad('40_spec/spec.md', 'spec');
    tryLoad('40_spec/task_breakdown.json', 'tasks');
    tryLoad('60_verification/verification.report.json', 'verification');
    tryLoad('deploy/docker-compose.yml', 'dockerCompose');
    tryLoad('deploy/env.example', 'envExample');

    return artifacts;
};

// Import assertions
const { runAssertions } = require('./assertions.js');

// Run a single test
const runTest = (promptData, options) => {
    const { id, prompt, expected, assertions } = promptData;

    console.log(`\n${c.cyan}[TEST]${c.reset} ${c.bold}${id}${c.reset}`);
    console.log(`  ${c.dim}Prompt: ${prompt.substring(0, 60)}...${c.reset}`);

    if (options.dryRun) {
        console.log(`  ${c.yellow}[DRY-RUN]${c.reset} Would run vibe with this prompt`);
        return { id, status: 'skipped' };
    }

    // Run vibe
    const vibeResult = runVibe(prompt, id);
    if (!vibeResult.success) {
        console.log(`  ${c.red}[FAIL]${c.reset} Vibe execution failed: ${vibeResult.error}`);
        return { id, status: 'error', error: vibeResult.error };
    }

    // Load artifacts
    const artifacts = loadArtifacts(vibeResult.runDir);

    if (!artifacts.classify) {
        console.log(`  ${c.red}[FAIL]${c.reset} classify.json not found`);
        return { id, status: 'fail', failedAssertions: ['classify.json not found'] };
    }

    // Run assertions
    const assertionResults = runAssertions(assertions, artifacts, expected);
    const passed = assertionResults.filter(a => a.passed);
    const failed = assertionResults.filter(a => !a.passed);

    if (failed.length === 0) {
        console.log(`  ${c.green}[PASS]${c.reset} ${passed.length}/${assertions.length} assertions passed`);
        return { id, status: 'pass', runDir: vibeResult.runDir };
    } else {
        console.log(`  ${c.red}[FAIL]${c.reset} ${failed.length}/${assertions.length} assertions failed:`);
        failed.forEach(f => {
            console.log(`    ${c.red}✗${c.reset} ${f.assertion}: ${f.reason}`);
        });
        if (options.verbose) {
            console.log(`  ${c.dim}Artifacts dir: ${vibeResult.runDir}${c.reset}`);
        }
        return { id, status: 'fail', failedAssertions: failed.map(f => f.assertion), runDir: vibeResult.runDir };
    }
};

// Main
const main = async () => {
    const options = parseArgs();
    const promptsData = loadPrompts();

    console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}${c.bold}   REGRESSION TEST SUITE - Vibe Mode${c.reset}`);
    console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);

    let prompts = promptsData.prompts;
    if (options.promptId) {
        prompts = prompts.filter(p => p.id === options.promptId);
        if (prompts.length === 0) {
            console.error(`${c.red}[ERROR]${c.reset} Prompt ID '${options.promptId}' not found`);
            process.exit(1);
        }
    }

    console.log(`\nRunning ${prompts.length} test(s)...`);

    const results = [];
    for (const promptData of prompts) {
        const result = runTest(promptData, options);
        results.push(result);
    }

    // Summary
    console.log(`\n${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.bold}SUMMARY${c.reset}\n`);

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const errors = results.filter(r => r.status === 'error').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    console.log(`  ${c.green}Passed:${c.reset}  ${passed}`);
    console.log(`  ${c.red}Failed:${c.reset}  ${failed}`);
    console.log(`  ${c.yellow}Errors:${c.reset}  ${errors}`);
    console.log(`  ${c.dim}Skipped: ${skipped}${c.reset}`);

    const exitCode = (failed > 0 || errors > 0) ? 1 : 0;

    if (exitCode === 0) {
        console.log(`\n${c.green}${c.bold}✓ All tests passed!${c.reset}`);
    } else {
        console.log(`\n${c.red}${c.bold}✗ Some tests failed${c.reset}`);
        if (failed > 0) {
            console.log(`\nFailed tests:`);
            results.filter(r => r.status === 'fail').forEach(r => {
                console.log(`  - ${r.id}`);
            });
        }
    }

    process.exit(exitCode);
};

main().catch(e => {
    console.error(`${c.red}[ERROR]${c.reset} ${e.message}`);
    process.exit(2);
});
