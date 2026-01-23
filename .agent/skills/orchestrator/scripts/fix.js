#!/usr/bin/env node
/**
 * AutoFix Command
 *
 * Reads blocking issues from QA report, applies fixes for fixable issues,
 * and re-runs QA gate.
 *
 * Rules:
 * - Max 2 attempts per spec version
 * - Only fix implementation bugs, config issues, docker issues
 * - Never change spec files (intake.json, spec.md, debate.inputs_for_spec.json)
 * - If not fixable within spec, show Change Request guidance
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
        },
        getArtifactPath: (runId, phase) => {
            const phases = { 'verification': '60_verification', 'spec': '40_spec' };
            return path.join(REPO_ROOT, 'artifacts', 'runs', runId, phases[phase] || phase);
        }
    };
}

// Import QA gate functions
let qaGate;
try {
    qaGate = require(path.join(REPO_ROOT, '.agent/skills/qa-gate/scripts/run-gate.js'));
} catch (e) {
    qaGate = {
        AUTOFIX_MAX_ATTEMPTS_PER_SPEC: 2,
        loadAutofixState: () => ({ spec_version: 1, attempt_in_spec: 0, history: [] }),
        bumpSpecVersion: () => {}
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
    cyan: '\x1b[36m'
};

// Parse args
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--run-id' && args[i + 1]) options.runId = args[++i];
        else if (args[i] === '--approve-change') options.approveChange = true;
        else if (args[i] === '--dry-run') options.dryRun = true;
        else if (args[i] === '--rerun-qa') options.rerunQa = true;
    }
    return options;
};

// Load QA report
const loadReport = (runId) => {
    const reportPath = path.join(utils.getArtifactPath(runId, 'verification'), 'report.json');
    if (!fs.existsSync(reportPath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (e) {
        return null;
    }
};

// Generate fix instructions for an issue
const getFixInstructions = (issue) => {
    const category = issue.triage?.category || 'unknown';

    const instructions = {
        'implementation_bug': [
            'Review the error message and stack trace',
            'Check the failing code for typos, undefined variables, or logic errors',
            'Run the specific test/check to verify the fix'
        ],
        'missing_dependency': [
            'Run: npm install <missing-package>',
            'Or check if the import path is correct',
            'Verify package.json has the dependency'
        ],
        'config_issue': [
            'Check .env file has all required variables',
            'Verify config files (tsconfig, vite.config, etc.)',
            'Check port availability if address-in-use error'
        ],
        'docker_issue': [
            'Verify Dockerfile syntax',
            'Check docker-compose.yml for errors',
            'Ensure base image is available'
        ],
        'test_mismatch': [
            'Compare test expectation with actual implementation',
            'Either fix the implementation to match test',
            'Or update test if implementation is correct per spec'
        ],
        'unknown': [
            'Review the full error output',
            'Check recent code changes',
            'Try running the command manually to debug'
        ]
    };

    return instructions[category] || instructions['unknown'];
};

// Apply auto-fixes where possible
const applyAutoFixes = (runId, issues, options) => {
    const applied = [];
    const manual = [];

    for (const issue of issues) {
        if (!issue.triage?.fixable) {
            manual.push({
                ...issue,
                reason: 'Requires spec change - see CHANGE_REQUEST.md'
            });
            continue;
        }

        const category = issue.triage?.category || 'unknown';

        // Auto-fixable categories
        if (category === 'missing_dependency') {
            if (!options.dryRun) {
                console.log(`${c.cyan}[AUTO-FIX]${c.reset} Installing missing dependencies...`);
                const result = spawnSync('npm', ['install'], {
                    cwd: REPO_ROOT,
                    stdio: 'inherit',
                    shell: true
                });
                if (result.status === 0) {
                    applied.push({ ...issue, action: 'npm install' });
                } else {
                    manual.push({ ...issue, reason: 'npm install failed' });
                }
            } else {
                console.log(`${c.dim}[DRY-RUN] Would run: npm install${c.reset}`);
                applied.push({ ...issue, action: 'npm install (dry-run)' });
            }
        } else {
            // For other categories, provide guidance
            manual.push({
                ...issue,
                instructions: getFixInstructions(issue)
            });
        }
    }

    return { applied, manual };
};

// Main fix function
const runFix = async () => {
    const options = parseArgs();
    const runId = options.runId || process.env.RUN_ID || utils.getLatestRunId();

    console.log(`\n${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}${c.bold}   AUTOFIX - AI Agent Toolkit${c.reset}`);
    console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    if (!runId) {
        console.log(`${c.red}[ERROR]${c.reset} No run found. Run vibe or init first.`);
        process.exit(1);
    }

    console.log(`Run ID: ${runId}\n`);

    // Handle --approve-change
    if (options.approveChange) {
        console.log(`${c.yellow}[APPROVE-CHANGE]${c.reset} Approving spec change...`);
        const newState = qaGate.bumpSpecVersion(runId);
        console.log(`${c.green}[OK]${c.reset} Spec version bumped to ${newState.spec_version}`);
        console.log(`     Autofix attempts reset to 0\n`);
        console.log(`Next: Run ${c.cyan}npx aat qa${c.reset} to re-verify`);
        process.exit(0);
    }

    // Load report
    const report = loadReport(runId);
    if (!report) {
        console.log(`${c.yellow}[INFO]${c.reset} No QA report found. Run ${c.cyan}npx aat qa${c.reset} first.`);
        process.exit(0);
    }

    // Check status
    if (report.overall_status === 'pass') {
        console.log(`${c.green}[OK]${c.reset} QA already passing. No fixes needed.`);
        process.exit(0);
    }

    // Load autofix state
    const state = qaGate.loadAutofixState(runId);
    const maxAttempts = qaGate.AUTOFIX_MAX_ATTEMPTS_PER_SPEC || 2;

    console.log(`AutoFix State: spec v${state.spec_version}, attempt ${state.attempt_in_spec}/${maxAttempts}\n`);

    // Check if we can proceed
    if (state.attempt_in_spec >= maxAttempts) {
        console.log(`${c.red}[STOP]${c.reset} Max autofix attempts reached for spec v${state.spec_version}`);
        console.log(`\nOptions:`);
        console.log(`  1. Fix manually and run ${c.cyan}npx aat qa${c.reset}`);
        console.log(`  2. Approve spec change: ${c.cyan}npx aat fix --approve-change${c.reset}`);
        console.log(`\nSee: artifacts/runs/latest/60_verification/fix_summary.md`);
        process.exit(1);
    }

    // Get blocking issues
    const blockingIssues = report.blocking_issues || [];
    if (blockingIssues.length === 0) {
        console.log(`${c.yellow}[INFO]${c.reset} No blocking issues in report.`);
        process.exit(0);
    }

    console.log(`${c.yellow}[ISSUES]${c.reset} ${blockingIssues.length} blocking issue(s):\n`);

    // Categorize issues
    const fixable = blockingIssues.filter(i => i.triage?.fixable);
    const needsSpec = blockingIssues.filter(i => !i.triage?.fixable);

    // Show fixable issues
    if (fixable.length > 0) {
        console.log(`${c.green}Fixable within spec (${fixable.length}):${c.reset}`);
        fixable.forEach((issue, i) => {
            console.log(`  ${i + 1}. [${issue.check}] ${issue.message}`);
            console.log(`     ${c.dim}Category: ${issue.triage?.category || 'unknown'}${c.reset}`);
        });
        console.log();
    }

    // Show issues needing spec change
    if (needsSpec.length > 0) {
        console.log(`${c.red}Requires spec change (${needsSpec.length}):${c.reset}`);
        needsSpec.forEach((issue, i) => {
            console.log(`  ${i + 1}. [${issue.check}] ${issue.message}`);
            console.log(`     ${c.dim}Category: ${issue.triage?.category || 'unknown'}${c.reset}`);
        });
        console.log(`\n${c.yellow}⚠${c.reset} Review CHANGE_REQUEST.md and run:`);
        console.log(`  ${c.cyan}npx aat fix --approve-change${c.reset}\n`);
    }

    // Apply auto-fixes
    if (fixable.length > 0) {
        console.log(`${c.cyan}[FIX]${c.reset} Attempting auto-fixes...\n`);

        const { applied, manual } = applyAutoFixes(runId, fixable, options);

        if (applied.length > 0) {
            console.log(`${c.green}[APPLIED]${c.reset} ${applied.length} auto-fix(es)`);
            applied.forEach(fix => {
                console.log(`  - ${fix.check}: ${fix.action}`);
            });
            console.log();
        }

        if (manual.length > 0) {
            console.log(`${c.yellow}[MANUAL]${c.reset} ${manual.length} issue(s) need manual fix:\n`);
            manual.forEach((issue, i) => {
                console.log(`${c.bold}${i + 1}. [${issue.check}] ${issue.message}${c.reset}`);
                if (issue.instructions) {
                    issue.instructions.forEach(inst => {
                        console.log(`   ${c.dim}• ${inst}${c.reset}`);
                    });
                }
                if (issue.reason) {
                    console.log(`   ${c.dim}Reason: ${issue.reason}${c.reset}`);
                }
                console.log();
            });
        }
    }

    // Re-run QA if requested or if auto-fixes were applied
    if (options.rerunQa) {
        console.log(`${c.cyan}[RE-RUN]${c.reset} Running QA gate...\n`);
        const result = spawnSync('node', [
            path.join(REPO_ROOT, '.agent/skills/qa-gate/scripts/run-gate.js'),
            '--run-id', runId
        ], {
            cwd: REPO_ROOT,
            stdio: 'inherit'
        });
        process.exit(result.status || 0);
    } else {
        console.log(`${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        console.log(`\n${c.bold}Next steps:${c.reset}`);
        console.log(`  1. Apply manual fixes listed above`);
        console.log(`  2. Run: ${c.cyan}npx aat qa${c.reset} to verify`);
        console.log(`  Or: ${c.cyan}npx aat fix --rerun-qa${c.reset} to auto-fix and verify\n`);
    }
};

runFix().catch(e => {
    console.error(`${c.red}[ERROR]${c.reset} ${e.message}`);
    process.exit(1);
});
