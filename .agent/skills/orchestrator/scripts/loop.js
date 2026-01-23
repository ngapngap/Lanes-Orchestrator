#!/usr/bin/env node
/**
 * Fix Loop Command (aat loop)
 *
 * Runs verify -> fix -> verify in a loop until pass or max attempts reached.
 *
 * Usage:
 *   npx aat loop --run-id <id> --max-attempts 3
 *
 * Exit codes:
 * - 0: PASS (eventually passed)
 * - 1: FAIL (max attempts reached, still failing)
 * - 2: Runtime error
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

// Import utils
let utils;
try {
    utils = require(path.join(REPO_ROOT, '.agent/lib/utils.js'));
} catch (e) {
    utils = {
        getLatestRunId: () => {
            const runsDir = path.join(REPO_ROOT, 'artifacts', 'runs');
            const latestFile = path.join(runsDir, '.latest');
            if (fs.existsSync(latestFile)) {
                const runId = fs.readFileSync(latestFile, 'utf8').trim();
                if (runId && fs.existsSync(path.join(runsDir, runId))) {
                    return runId;
                }
            }
            if (!fs.existsSync(runsDir)) return null;
            const runs = fs.readdirSync(runsDir)
                .filter(f => fs.statSync(path.join(runsDir, f)).isDirectory())
                .sort().reverse();
            return runs[0] || null;
        }
    };
}

// Colors
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Parse args
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        runId: null,
        maxAttempts: 3,
        projectPath: process.cwd(),
        fast: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--run-id' && args[i + 1]) options.runId = args[++i];
        else if (args[i] === '--max-attempts' && args[i + 1]) options.maxAttempts = parseInt(args[++i], 10);
        else if (args[i] === '--path' && args[i + 1]) options.projectPath = args[++i];
        else if (args[i] === '--fast') options.fast = true;
    }

    return options;
};

// Run verify command
const runVerify = (runId, projectPath, fast) => {
    const args = [
        path.join(REPO_ROOT, '.agent/skills/orchestrator/scripts/verify.js'),
        '--run-id', runId,
        '--path', projectPath
    ];
    if (fast) args.push('--fast');

    const result = spawnSync('node', args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: 'inherit'
    });

    return result.status === 0;
};

// Run fix command
const runFix = (runId, projectPath, attemptNum) => {
    const result = spawnSync('node', [
        path.join(REPO_ROOT, '.agent/skills/orchestrator/scripts/fix.js'),
        '--run-id', runId
    ], {
        cwd: projectPath,
        encoding: 'utf8',
        stdio: 'inherit'
    });

    // Save attempt record
    const runDir = path.join(REPO_ROOT, 'artifacts', 'runs', runId);
    const fixDir = path.join(runDir, '70_fix', `attempt_${attemptNum}`);
    if (!fs.existsSync(fixDir)) {
        fs.mkdirSync(fixDir, { recursive: true });
    }

    fs.writeFileSync(path.join(fixDir, 'fix_summary.md'), `# Fix Attempt ${attemptNum}

**Timestamp:** ${new Date().toISOString()}
**Exit Code:** ${result.status}

## Context
- Run ID: ${runId}
- Project Path: ${projectPath}

## Result
${result.status === 0 ? 'Fix completed successfully' : 'Fix encountered issues'}
`);

    return result.status === 0;
};

// Main loop function
const runLoop = async () => {
    const options = parseArgs();
    const runId = options.runId || process.env.RUN_ID || utils.getLatestRunId();
    const maxAttempts = options.maxAttempts;
    const projectPath = options.projectPath;

    console.log(`\n${c.magenta}${c.bold}╔══════════════════════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.magenta}${c.bold}║            🔄 FIX LOOP - AI Agent Toolkit                    ║${c.reset}`);
    console.log(`${c.magenta}${c.bold}╚══════════════════════════════════════════════════════════════╝${c.reset}\n`);

    if (!runId) {
        console.error(`${c.red}[ERROR]${c.reset} No run found. Run vibe first or specify --run-id.`);
        process.exit(2);
    }

    console.log(`Run ID: ${runId}`);
    console.log(`Max Attempts: ${maxAttempts}`);
    console.log(`Project: ${projectPath}\n`);

    const runDir = path.join(REPO_ROOT, 'artifacts', 'runs', runId);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        console.log(`${c.cyan}${c.bold}   Attempt ${attempt}/${maxAttempts}${c.reset}`);
        console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

        // Step 1: Verify
        console.log(`${c.yellow}[VERIFY]${c.reset} Running verification...\n`);
        const verifyPassed = runVerify(runId, projectPath, options.fast);

        if (verifyPassed) {
            console.log(`\n${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
            console.log(`${c.green}${c.bold}   ✅ PASS - Verification succeeded!${c.reset}`);
            console.log(`${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
            console.log(`Attempts used: ${attempt}/${maxAttempts}`);

            // Save loop summary
            fs.writeFileSync(path.join(runDir, 'loop_summary.md'), `# Fix Loop Summary

**Status:** PASS
**Attempts Used:** ${attempt}/${maxAttempts}
**Completed At:** ${new Date().toISOString()}

The project passed verification after ${attempt} attempt(s).
`);
            process.exit(0);
        }

        // If this is the last attempt, don't try to fix
        if (attempt === maxAttempts) {
            console.log(`\n${c.red}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
            console.log(`${c.red}${c.bold}   ✗ FAIL - Max attempts reached${c.reset}`);
            console.log(`${c.red}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
            console.log(`Verification failed after ${maxAttempts} attempts.`);
            console.log(`\nNext steps:`);
            console.log(`  1. Review: ${c.cyan}${path.join(runDir, '60_verification', 'verification.report.json')}${c.reset}`);
            console.log(`  2. Fix manually and run: ${c.cyan}npx aat verify --run-id ${runId}${c.reset}`);

            // Save loop summary
            fs.writeFileSync(path.join(runDir, 'loop_summary.md'), `# Fix Loop Summary

**Status:** FAIL
**Attempts Used:** ${maxAttempts}/${maxAttempts}
**Completed At:** ${new Date().toISOString()}

The project failed verification after ${maxAttempts} attempts.

## Next Steps
1. Review verification report at \`60_verification/verification.report.json\`
2. Fix issues manually
3. Run \`npx aat verify --run-id ${runId}\` to check again
`);
            process.exit(1);
        }

        // Step 2: Fix
        console.log(`\n${c.yellow}[FIX]${c.reset} Attempting to fix issues (attempt ${attempt})...\n`);
        runFix(runId, projectPath, attempt);

        console.log(`\n${c.dim}Continuing to next attempt...${c.reset}\n`);
    }
};

// Run
runLoop().catch(e => {
    console.error(`${c.red}[ERROR]${c.reset} ${e.message}`);
    process.exit(2);
});
