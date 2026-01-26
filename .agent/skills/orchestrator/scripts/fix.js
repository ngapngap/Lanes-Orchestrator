#!/usr/bin/env node
/**
 * AutoFix Command (aat fix)
 *
 * Reads verification report and DoD, applies fixes for failing gates.
 *
 * Usage:
 *   npx aat fix --run-id <id> [--attempt-num N] [--project-path PATH]
 *
 * Context Inputs:
 * - 60_verification/verification.report.json - Failed gates/checks
 * - 40_spec/DEFINITION_OF_DONE.md - Deliverables, constraints, commands
 * - 40_spec/spec.md - Feature specification
 *
 * Rules:
 * - Only fix implementation bugs, config issues, docker issues
 * - Never change spec files (intake.json, spec.md, debate.inputs_for_spec.json)
 * - Respect must_not constraints from DoD
 * - If not fixable within spec, show Change Request guidance
 *
 * Exit codes:
 * - 0: Fix attempted (may or may not have resolved all issues)
 * - 1: Runtime error
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
            const phases = {
                'verification': '60_verification',
                'spec': '40_spec',
                'fix': '70_fix'
            };
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
    const options = {
        runId: null,
        attemptNum: null,
        projectPath: process.cwd(),
        approveChange: false,
        dryRun: false,
        rerunQa: false
    };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--run-id' && args[i + 1]) options.runId = args[++i];
        else if (args[i] === '--attempt-num' && args[i + 1]) options.attemptNum = parseInt(args[++i], 10);
        else if (args[i] === '--project-path' && args[i + 1]) options.projectPath = args[++i];
        else if (args[i] === '--path' && args[i + 1]) options.projectPath = args[++i];
        else if (args[i] === '--approve-change') options.approveChange = true;
        else if (args[i] === '--dry-run') options.dryRun = true;
        else if (args[i] === '--rerun-qa') options.rerunQa = true;
    }
    return options;
};

// Load verification report (from aat verify)
const loadVerificationReport = (runId) => {
    const reportPath = path.join(utils.getArtifactPath(runId, 'verification'), 'verification.report.json');
    if (!fs.existsSync(reportPath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (e) {
        return null;
    }
};

// Load DoD (DEFINITION_OF_DONE.md)
const loadDoD = (runId) => {
    const dodPath = path.join(utils.getArtifactPath(runId, 'spec'), 'DEFINITION_OF_DONE.md');
    if (!fs.existsSync(dodPath)) {
        return null;
    }
    try {
        return fs.readFileSync(dodPath, 'utf8');
    } catch (e) {
        return null;
    }
};

// Parse DoD YAML metadata
const parseDodMetadata = (dodContent) => {
    if (!dodContent) return null;
    const yamlMatch = dodContent.match(/^---\n([\s\S]*?)\n---/);
    if (!yamlMatch) return null;

    const yaml = yamlMatch[1];
    const metadata = {};

    // Parse key: value pairs
    const lines = yaml.split('\n');
    let currentKey = null;
    let inArray = false;

    for (const line of lines) {
        // Handle comments
        if (line.trim().startsWith('#')) continue;

        const keyMatch = line.match(/^([a-z_]+):\s*(.*)$/);
        if (keyMatch) {
            currentKey = keyMatch[1];
            const value = keyMatch[2].trim();
            if (value === '') {
                metadata[currentKey] = [];
                inArray = true;
            } else if (value.startsWith('[') && value.endsWith(']')) {
                // Inline array
                metadata[currentKey] = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
                inArray = false;
            } else {
                metadata[currentKey] = value.replace(/"/g, '');
                inArray = false;
            }
        } else if (inArray && line.match(/^\s+-\s+/)) {
            const itemMatch = line.match(/^\s+-\s+(.+)$/);
            if (itemMatch && currentKey) {
                metadata[currentKey].push(itemMatch[1].replace(/"/g, '').trim());
            }
        }
    }

    return metadata;
};

// Load legacy QA report (fallback)
const loadReport = (runId) => {
    const reportPath = path.join(utils.getArtifactPath(runId, 'verification'), 'verification.report.json');
    if (!fs.existsSync(reportPath)) {
        return null;
    }
    try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        // Standardize legacy report to match schema expectations if needed
        if (!report.status && report.overall_status) report.status = report.overall_status;
        return report;
    } catch (e) {
        return null;
    }
};

// Generate fix instructions for an issue
const getFixInstructions = (issue) => {
    const category = issue.triage?.category || issue.category || 'unknown';

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
        'missing_deliverable': [
            'Create the missing file or directory',
            'Check if the path in DoD matches your project structure',
            'Ensure build step runs if the file is generated'
        ],
        'must_not_violation': [
            'Remove the violating code/dependency',
            'Check DoD must_not constraints',
            'This may require reverting recent changes'
        ],
        'command_failed': [
            'Review the command output for errors',
            'Check if dependencies are installed',
            'Verify the project builds correctly'
        ],
        'unknown': [
            'Review the full error output',
            'Check recent code changes',
            'Try running the command manually to debug'
        ]
    };

    return instructions[category] || instructions['unknown'];
};

// Categorize verification report failures into fixable issues
const categorizeVerificationFailures = (verificationReport, dodMetadata) => {
    const issues = [];

    if (!verificationReport) return issues;

    const gates = verificationReport.gates || {};

    // Process G_DELIVERABLES failures
    if (gates.G_DELIVERABLES) {
        const deliverables = gates.G_DELIVERABLES.details?.deliverables || [];
        for (const d of deliverables) {
            if (!d.exists) {
                issues.push({
                    gate: 'G_DELIVERABLES',
                    check: 'deliverable',
                    message: `Missing deliverable: ${d.path}`,
                    path: d.path,
                    category: 'missing_deliverable',
                    fixable: true
                });
            }
        }
    }

    // Process G_MUST_NOT failures
    if (gates.G_MUST_NOT) {
        const violations = gates.G_MUST_NOT.violations || [];
        for (const v of violations) {
            issues.push({
                gate: 'G_MUST_NOT',
                check: 'must_not',
                message: `Constraint violation: ${v.rule}`,
                rule: v.rule,
                detection: v.detection,
                category: 'must_not_violation',
                fixable: false // Usually requires manual review
            });
        }
    }

    // Process G_COMMANDS failures
    if (gates.G_COMMANDS) {
        const commands = gates.G_COMMANDS.details?.commands || [];
        for (const cmd of commands) {
            if (!cmd.passed) {
                issues.push({
                    gate: 'G_COMMANDS',
                    check: 'command',
                    message: `Command failed: ${cmd.description || cmd.command}`,
                    command: cmd.command,
                    output: cmd.output,
                    category: 'command_failed',
                    fixable: true
                });
            }
        }
    }

    return issues;
};

// Apply auto-fixes where possible
const applyAutoFixes = (runId, issues, options, projectPath) => {
    const applied = [];
    const manual = [];

    for (const issue of issues) {
        if (issue.fixable === false) {
            manual.push({
                ...issue,
                reason: issue.category === 'must_not_violation'
                    ? 'Violates DoD constraint - manual review required'
                    : 'Requires spec change - see CHANGE_REQUEST.md'
            });
            continue;
        }

        const category = issue.category || issue.triage?.category || 'unknown';

        // Auto-fixable categories
        if (category === 'missing_dependency') {
            if (!options.dryRun) {
                console.log(`${c.cyan}[AUTO-FIX]${c.reset} Installing missing dependencies...`);
                const result = spawnSync('npm', ['install'], {
                    cwd: projectPath || REPO_ROOT,
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

// Save fix summary to attempt directory
const saveFixSummary = (runId, attemptNum, issues, applied, manual, projectPath) => {
    const fixDir = path.join(REPO_ROOT, 'artifacts', 'runs', runId, '70_fix', `attempt_${attemptNum || 1}`);
    if (!fs.existsSync(fixDir)) {
        fs.mkdirSync(fixDir, { recursive: true });
    }

    // Create fix summary
    const summary = {
        run_id: runId,
        attempt: attemptNum || 1,
        timestamp: new Date().toISOString(),
        project_path: projectPath,
        issues_found: issues.length,
        auto_fixed: applied.length,
        manual_required: manual.length,
        applied: applied.map(a => ({ check: a.check, action: a.action })),
        manual: manual.map(m => ({ check: m.check, message: m.message, category: m.category }))
    };

    fs.writeFileSync(path.join(fixDir, 'fix_report.json'), JSON.stringify(summary, null, 2));

    // Create markdown summary
    const md = `# Fix Attempt ${attemptNum || 1}

**Run ID:** ${runId}
**Timestamp:** ${summary.timestamp}
**Project:** ${projectPath}

## Summary
- Issues Found: ${issues.length}
- Auto-Fixed: ${applied.length}
- Manual Required: ${manual.length}

## Auto-Fixed
${applied.length === 0 ? '_None_' : applied.map(a => `- [${a.check}] ${a.action}`).join('\n')}

## Manual Required
${manual.length === 0 ? '_None_' : manual.map(m => `- [${m.check}] ${m.message}\n  - Category: ${m.category}\n  - ${m.instructions ? m.instructions.map(i => `  • ${i}`).join('\n  ') : m.reason || ''}`).join('\n')}
`;

    fs.writeFileSync(path.join(fixDir, 'fix_summary.md'), md);

    return fixDir;
};

// Main fix function
const runFix = async () => {
    const options = parseArgs();
    const runId = options.runId || process.env.RUN_ID || utils.getLatestRunId();
    const projectPath = options.projectPath;
    const attemptNum = options.attemptNum;

    console.log(`\n${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}${c.bold}   AUTOFIX - AI Agent Toolkit${c.reset}`);
    console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    if (!runId) {
        console.log(`${c.red}[ERROR]${c.reset} No run found. Run vibe or init first.`);
        process.exit(1);
    }

    console.log(`Run ID: ${runId}`);
    if (attemptNum) console.log(`Attempt: ${attemptNum}`);
    console.log(`Project: ${projectPath}\n`);

    // Handle --approve-change
    if (options.approveChange) {
        console.log(`${c.yellow}[APPROVE-CHANGE]${c.reset} Approving spec change...`);
        const newState = qaGate.bumpSpecVersion(runId);
        console.log(`${c.green}[OK]${c.reset} Spec version bumped to ${newState.spec_version}`);
        console.log(`     Autofix attempts reset to 0\n`);
        console.log(`Next: Run ${c.cyan}npx aat verify${c.reset} to re-verify`);
        process.exit(0);
    }

    // Load DoD for context
    const dodContent = loadDoD(runId);
    const dodMetadata = parseDodMetadata(dodContent);
    if (dodContent) {
        console.log(`${c.green}[DOD]${c.reset} Loaded DEFINITION_OF_DONE.md`);
        if (dodMetadata) {
            console.log(`  Project: ${dodMetadata.project_name || 'unknown'}`);
            console.log(`  Kind: ${dodMetadata.project_kind || 'unknown'}`);
        }
    }

    // Load verification report (from aat verify)
    const verificationReport = loadVerificationReport(runId);
    let allIssues = [];

    if (verificationReport) {
        console.log(`${c.green}[VERIFY]${c.reset} Loaded verification.report.json`);
        console.log(`  Status: ${verificationReport.status}`);

        if (verificationReport.status === 'PASS') {
            console.log(`\n${c.green}[OK]${c.reset} Verification already passing. No fixes needed.`);
            process.exit(0);
        }

        // Extract issues from verification report
        allIssues = categorizeVerificationFailures(verificationReport, dodMetadata);
        console.log(`  Failed Gates: ${Object.keys(verificationReport.gates || {}).filter(g => verificationReport.gates[g].status === 'FAIL').join(', ') || 'none'}\n`);
    } else {
        // Fall back to legacy QA report
        const report = loadReport(runId);
        if (!report) {
            console.log(`${c.yellow}[INFO]${c.reset} No verification report found. Run ${c.cyan}npx aat verify${c.reset} first.`);
            process.exit(0);
        }

        if (report.overall_status === 'pass') {
            console.log(`${c.green}[OK]${c.reset} QA already passing. No fixes needed.`);
            process.exit(0);
        }

        // Use legacy blocking issues
        allIssues = (report.blocking_issues || []).map(issue => ({
            ...issue,
            category: issue.triage?.category || 'unknown',
            fixable: issue.triage?.fixable ?? true
        }));
    }

    if (allIssues.length === 0) {
        console.log(`${c.yellow}[INFO]${c.reset} No issues found to fix.`);
        process.exit(0);
    }

    console.log(`${c.yellow}[ISSUES]${c.reset} ${allIssues.length} issue(s) found:\n`);

    // Categorize issues
    const fixable = allIssues.filter(i => i.fixable !== false);
    const needsManual = allIssues.filter(i => i.fixable === false);

    // Show fixable issues
    if (fixable.length > 0) {
        console.log(`${c.green}Potentially fixable (${fixable.length}):${c.reset}`);
        fixable.forEach((issue, i) => {
            console.log(`  ${i + 1}. [${issue.gate || issue.check}] ${issue.message}`);
            console.log(`     ${c.dim}Category: ${issue.category}${c.reset}`);
        });
        console.log();
    }

    // Show issues needing manual intervention
    if (needsManual.length > 0) {
        console.log(`${c.red}Requires manual review (${needsManual.length}):${c.reset}`);
        needsManual.forEach((issue, i) => {
            console.log(`  ${i + 1}. [${issue.gate || issue.check}] ${issue.message}`);
            console.log(`     ${c.dim}Category: ${issue.category}${c.reset}`);
        });
        console.log();
    }

    // Apply auto-fixes
    let applied = [];
    let manual = needsManual;

    if (fixable.length > 0) {
        console.log(`${c.cyan}[FIX]${c.reset} Attempting fixes...\n`);

        const result = applyAutoFixes(runId, fixable, options, projectPath);
        applied = result.applied;
        manual = [...manual, ...result.manual];

        if (applied.length > 0) {
            console.log(`${c.green}[APPLIED]${c.reset} ${applied.length} auto-fix(es)`);
            applied.forEach(fix => {
                console.log(`  - ${fix.check || fix.gate}: ${fix.action}`);
            });
            console.log();
        }

        if (result.manual.length > 0) {
            console.log(`${c.yellow}[MANUAL]${c.reset} ${result.manual.length} issue(s) need manual fix:\n`);
            result.manual.forEach((issue, i) => {
                console.log(`${c.bold}${i + 1}. [${issue.gate || issue.check}] ${issue.message}${c.reset}`);
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

    // Save fix summary
    const fixDir = saveFixSummary(runId, attemptNum, allIssues, applied, manual, projectPath);
    console.log(`${c.dim}Fix summary saved to: ${fixDir}${c.reset}\n`);

    // Re-run verification if requested
    if (options.rerunQa) {
        console.log(`${c.cyan}[RE-RUN]${c.reset} Running verification...\n`);
        const result = spawnSync('node', [
            path.join(REPO_ROOT, '.agent/skills/orchestrator/scripts/verify.js'),
            '--run-id', runId,
            '--path', projectPath
        ], {
            cwd: REPO_ROOT,
            stdio: 'inherit'
        });
        process.exit(result.status || 0);
    } else {
        console.log(`${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        console.log(`\n${c.bold}Next steps:${c.reset}`);
        console.log(`  1. Apply manual fixes listed above`);
        console.log(`  2. Run: ${c.cyan}npx aat verify${c.reset} to verify`);
        console.log(`  Or: ${c.cyan}npx aat loop${c.reset} to run fix-verify loop\n`);
    }
};

runFix().catch(e => {
    console.error(`${c.red}[ERROR]${c.reset} ${e.message}`);
    process.exit(1);
});
