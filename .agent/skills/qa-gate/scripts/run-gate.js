#!/usr/bin/env node
/**
 * Run QA Gate Script
 * Chạy tất cả verification checks với AutoFix support
 *
 * Outputs to: artifacts/runs/<run_id>/60_verification/
 *
 * AutoFix Rules:
 * - Only fix implementation bugs, config issues, docker issues
 * - Never change spec files (intake.json, spec.md, debate.inputs_for_spec.json)
 * - Max 2 autofix retries
 * - If not fixable within spec, create Change Request
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Import utils for artifact paths
const REPO_ROOT = (() => {
    let dir = __dirname;
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'AGENTS.md'))) return dir;
        dir = path.dirname(dir);
    }
    return process.cwd();
})();

let utils;
try {
    utils = require(path.join(REPO_ROOT, '.agent/lib/utils.js'));
} catch (e) {
    utils = {
        getArtifactPath: (runId, phase) => {
            const phases = { 'verification': '60_verification' };
            return path.join(REPO_ROOT, 'artifacts', 'runs', runId, phases[phase] || phase);
        },
        writeArtifact: (runId, phase, filename, content) => {
            const phasePath = utils.getArtifactPath(runId, phase);
            if (!fs.existsSync(phasePath)) {
                fs.mkdirSync(phasePath, { recursive: true });
            }
            const filePath = path.join(phasePath, filename);
            const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
            fs.writeFileSync(filePath, data, 'utf8');
            return filePath;
        },
        getLatestRunId: () => {
            const runsDir = path.join(REPO_ROOT, 'artifacts', 'runs');
            if (!fs.existsSync(runsDir)) return null;
            const runs = fs.readdirSync(runsDir).sort().reverse();
            return runs[0] || null;
        }
    };
}

// Parse args
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--run-id' && args[i + 1]) options.runId = args[++i];
        else if (args[i] === '--policy' && args[i + 1]) options.policy = args[++i];
        else if (args[i] === '--checks' && args[i + 1]) options.checks = args[++i];
        else if (args[i] === '--path' && args[i + 1]) options.path = args[++i];
        else if (args[i] === '--strict') options.strict = true;
    }
    return options;
};

const options = parseArgs();
const RUN_ID = options.runId || process.env.RUN_ID || utils.getLatestRunId();

// AutoFix configuration
const AUTOFIX_MAX_ATTEMPTS_PER_SPEC = 2;

// Protected files (source of truth - never modify in autofix)
const PROTECTED_FILES = [
    '10_intake/intake.json',
    '40_spec/spec.md',
    '30_debate/debate.inputs_for_spec.json'
];

/**
 * AutoFix State Management
 * Tracks attempts per spec version to enforce the 2-attempt limit
 */
const getAutofixStatePath = (runId) => {
    return path.join(REPO_ROOT, 'artifacts', 'runs', runId, '60_verification', 'autofix_state.json');
};

const loadAutofixState = (runId) => {
    const statePath = getAutofixStatePath(runId);
    if (fs.existsSync(statePath)) {
        try {
            return JSON.parse(fs.readFileSync(statePath, 'utf8'));
        } catch (e) {
            console.warn('Warning: Could not parse autofix_state.json, starting fresh');
        }
    }
    // Default state
    return {
        spec_version: 1,
        attempt_in_spec: 0,
        last_failure_fingerprint: null,
        history: []
    };
};

const saveAutofixState = (runId, state) => {
    const statePath = getAutofixStatePath(runId);
    const dir = path.dirname(statePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
    return statePath;
};

/**
 * Generate failure fingerprint for tracking same errors
 */
const generateFailureFingerprint = (blockingIssues) => {
    const key = blockingIssues
        .map(i => `${i.check}:${i.triage?.category || 'unknown'}`)
        .sort()
        .join('|');
    // Simple hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
};

/**
 * Check if autofix should proceed or stop
 */
const shouldProceedWithAutofix = (state, fingerprint) => {
    // If this is a new failure pattern, reset attempt count
    if (state.last_failure_fingerprint !== fingerprint) {
        return {
            proceed: true,
            reason: 'new_failure_pattern',
            attemptsRemaining: AUTOFIX_MAX_ATTEMPTS_PER_SPEC
        };
    }

    // Same failure pattern - check attempt count
    if (state.attempt_in_spec >= AUTOFIX_MAX_ATTEMPTS_PER_SPEC) {
        return {
            proceed: false,
            reason: 'max_attempts_reached',
            attemptsRemaining: 0
        };
    }

    return {
        proceed: true,
        reason: 'attempts_remaining',
        attemptsRemaining: AUTOFIX_MAX_ATTEMPTS_PER_SPEC - state.attempt_in_spec
    };
};

/**
 * Increment autofix attempt and update state
 */
const recordAutofixAttempt = (runId, state, fingerprint, blockingIssues) => {
    const newState = {
        ...state,
        attempt_in_spec: state.attempt_in_spec + 1,
        last_failure_fingerprint: fingerprint,
        last_attempt_at: new Date().toISOString(),
        history: [
            ...state.history,
            {
                attempt: state.attempt_in_spec + 1,
                spec_version: state.spec_version,
                fingerprint,
                timestamp: new Date().toISOString(),
                issues: blockingIssues.map(i => ({
                    check: i.check,
                    category: i.triage?.category || 'unknown',
                    fixable: i.triage?.fixable || false
                }))
            }
        ]
    };
    saveAutofixState(runId, newState);
    return newState;
};

/**
 * Reset autofix state after spec version bump (user approved change)
 */
const bumpSpecVersion = (runId) => {
    const state = loadAutofixState(runId);
    const newState = {
        ...state,
        spec_version: state.spec_version + 1,
        attempt_in_spec: 0,
        last_failure_fingerprint: null,
        spec_bumped_at: new Date().toISOString()
    };
    saveAutofixState(runId, newState);
    console.log(`[AUTOFIX] Spec version bumped to ${newState.spec_version}, attempt counter reset`);
    return newState;
};

/**
 * Generate fix_summary.md when autofix stops
 */
const generateFixSummary = (runId, state, blockingIssues) => {
    const content = `# AutoFix Summary - Requires Manual Intervention

## Status: STOPPED

AutoFix has reached the maximum number of attempts (${AUTOFIX_MAX_ATTEMPTS_PER_SPEC}) for spec version ${state.spec_version}.

---

## Current Blocking Issues

${blockingIssues.map((issue, i) => `
### ${i + 1}. [${issue.check}] ${issue.message}

- **Category:** ${issue.triage?.category || 'unknown'}
- **Fixable within spec:** ${issue.triage?.fixable ? 'Yes' : 'No'}
- **Suggestion:** ${issue.action || 'Review manually'}
`).join('\n')}

---

## Attempt History

| Attempt | Spec Version | Timestamp | Issues |
|---------|--------------|-----------|--------|
${state.history.map(h =>
    `| ${h.attempt} | v${h.spec_version} | ${h.timestamp.slice(0, 16)} | ${h.issues.map(i => i.check).join(', ')} |`
).join('\n')}

---

## Options

### Option A: Fix Manually
Review the blocking issues above and fix them in the codebase.
Then run \`npx aat qa\` again.

### Option B: Change Specification
If the issues require spec changes, review \`CHANGE_REQUEST.md\` (if exists)
and approve the changes by running:
\`\`\`
npx aat approve-change
\`\`\`

### Option C: Reduce Scope
Remove the blocking features from MVP scope.

---

*AutoFix stopped at ${new Date().toISOString()}*
*Spec Version: ${state.spec_version} | Attempts: ${state.attempt_in_spec}/${AUTOFIX_MAX_ATTEMPTS_PER_SPEC}*
`;

    if (runId) {
        utils.writeArtifact(runId, 'verification', 'fix_summary.md', content);
    }
    return content;
};

/**
 * Triage failure - determine if fixable within spec
 */
const triageFailure = (check, error, output) => {
    const fullOutput = `${error} ${output}`.toLowerCase();

    // Patterns that indicate fixable issues
    const fixablePatterns = [
        { pattern: /typeerror|referenceerror|syntaxerror/i, category: 'implementation_bug' },
        { pattern: /cannot find module|module not found/i, category: 'missing_dependency' },
        { pattern: /enoent|econnrefused|eaddrinuse/i, category: 'config_issue' },
        { pattern: /docker|container|dockerfile/i, category: 'docker_issue' },
        { pattern: /expected.*but got|assertion.*failed/i, category: 'test_mismatch' },
        { pattern: /undefined is not|null is not/i, category: 'implementation_bug' },
        { pattern: /import.*failed|require.*failed/i, category: 'missing_dependency' },
        { pattern: /port.*already|address already/i, category: 'config_issue' },
    ];

    // Patterns that indicate spec change required
    const notFixablePatterns = [
        { pattern: /scope|requirement|specification/i, category: 'scope_mismatch' },
        { pattern: /security|vulnerability|cve/i, category: 'security_blocker' },
        { pattern: /architecture|design|infeasible/i, category: 'architecture_issue' },
        { pattern: /api.*changed|breaking.*change/i, category: 'external_dependency' },
        { pattern: /deprecated.*removed|no longer.*supported/i, category: 'external_dependency' },
    ];

    for (const { pattern, category } of fixablePatterns) {
        if (pattern.test(fullOutput)) {
            return {
                fixable: true,
                category,
                reason: `Detected ${category.replace(/_/g, ' ')}`,
                suggestion: getSuggestionForCategory(category, check)
            };
        }
    }

    for (const { pattern, category } of notFixablePatterns) {
        if (pattern.test(fullOutput)) {
            return {
                fixable: false,
                category,
                reason: `Detected ${category.replace(/_/g, ' ')} - requires spec change`,
                suggestion: null
            };
        }
    }

    // Default: assume fixable for unknown errors
    return {
        fixable: true,
        category: 'unknown',
        reason: 'Unknown error - attempting fix',
        suggestion: `Review ${check} output and fix implementation`
    };
};

/**
 * Get suggestion for fixable category
 */
const getSuggestionForCategory = (category, check) => {
    const suggestions = {
        'implementation_bug': `Fix the ${check} implementation error`,
        'missing_dependency': 'Install missing dependencies (npm install)',
        'config_issue': 'Check configuration files and environment variables',
        'docker_issue': 'Fix Dockerfile or docker-compose configuration',
        'test_mismatch': 'Update test to match implementation or fix implementation',
        'unknown': `Review ${check} output and fix accordingly`
    };
    return suggestions[category] || suggestions['unknown'];
};

/**
 * Generate Change Request when spec change is needed
 */
const generateChangeRequest = (check, error, triage, report) => {
    const timestamp = new Date().toISOString();

    return {
        id: `CR-${Date.now()}`,
        timestamp,
        check,
        category: triage.category,
        blocking_error: error.slice(0, 500),
        reason: triage.reason,
        options: [
            {
                id: 'A',
                description: 'Modify specification to accommodate current limitation',
                impact: 'Scope change required'
            },
            {
                id: 'B',
                description: 'Find alternative implementation approach',
                impact: 'May require more development time'
            },
            {
                id: 'C',
                description: 'Remove the blocking feature from MVP',
                impact: 'Reduced scope'
            }
        ],
        status: 'pending_user_approval',
        markdown: `## Change Request

**ID:** CR-${Date.now()}
**Check:** ${check}
**Category:** ${triage.category.replace(/_/g, ' ')}

### Lỗi chặn hoàn thành:
\`\`\`
${error.slice(0, 500)}
\`\`\`

### Vì sao không thể fix trong scope hiện tại:
${triage.reason}

### Đề xuất thay đổi:
- **Option A:** Modify specification to accommodate current limitation
- **Option B:** Find alternative implementation approach
- **Option C:** Remove the blocking feature from MVP

### Tác động:
- Scope: Có thể thay đổi
- Timeline: Có thể kéo dài
- Security: Cần đánh giá lại

---

⚠️ **Cần user approval để tiếp tục.**
`
    };
};

// Detect project configuration
const detectConfig = (projectPath) => {
    const hasFile = (name) => fs.existsSync(path.join(projectPath, name));
    const readJson = (name) => {
        try {
            return JSON.parse(fs.readFileSync(path.join(projectPath, name), 'utf8'));
        } catch { return null; }
    };

    const packageJson = readJson('package.json') || {};
    const scripts = packageJson.scripts || {};

    return {
        hasTests: !!scripts.test || hasFile('vitest.config.ts') || hasFile('jest.config.js'),
        testRunner: scripts.test?.includes('vitest') ? 'vitest' :
                    scripts.test?.includes('jest') ? 'jest' :
                    scripts.test?.includes('mocha') ? 'mocha' : 'npm test',
        hasLint: !!scripts.lint || hasFile('.eslintrc.json') || hasFile('eslint.config.js') || hasFile('biome.json'),
        lintTool: hasFile('biome.json') ? 'biome' : 'eslint',
        hasTypeScript: hasFile('tsconfig.json'),
        hasBuild: !!scripts.build,
        buildTool: scripts.build?.includes('vite') ? 'vite' :
                   scripts.build?.includes('next') ? 'next' :
                   scripts.build?.includes('webpack') ? 'webpack' : 'npm build',
        packageManager: hasFile('pnpm-lock.yaml') ? 'pnpm' :
                        hasFile('yarn.lock') ? 'yarn' :
                        hasFile('bun.lockb') ? 'bun' : 'npm'
    };
};

// Run a command and capture output
const runCommand = (command, cwd = process.cwd()) => {
    const startTime = Date.now();
    try {
        const result = spawnSync(command, [], {
            shell: true,
            cwd,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });
        return {
            success: result.status === 0,
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            duration_ms: Date.now() - startTime,
            exitCode: result.status
        };
    } catch (error) {
        return {
            success: false,
            stdout: '',
            stderr: error.message,
            duration_ms: Date.now() - startTime,
            exitCode: 1
        };
    }
};

// Parse test results
const parseTestResults = (output, runner) => {
    const result = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        failed_tests: []
    };

    const summaryMatch = output.match(/Tests:\s+(\d+)\s+passed.*?(\d+)\s+total/s) ||
                        output.match(/(\d+)\s+passed,\s+(\d+)\s+total/);
    const failMatch = output.match(/(\d+)\s+failed/);

    if (summaryMatch) {
        result.passed = parseInt(summaryMatch[1]) || 0;
        result.total = parseInt(summaryMatch[2]) || result.passed;
    }
    if (failMatch) {
        result.failed = parseInt(failMatch[1]) || 0;
    }

    const failedTestMatches = output.matchAll(/FAIL\s+(.+?)\n|✕\s+(.+)/g);
    for (const match of failedTestMatches) {
        result.failed_tests.push({
            name: match[1] || match[2],
            file: '',
            error: ''
        });
    }

    return result;
};

// Parse lint results
const parseLintResults = (output, tool) => {
    const result = {
        errors: 0,
        warnings: 0,
        fixable: 0,
        issues: []
    };

    if (tool === 'eslint') {
        const errorMatch = output.match(/(\d+)\s+errors?/);
        const warningMatch = output.match(/(\d+)\s+warnings?/);
        if (errorMatch) result.errors = parseInt(errorMatch[1]);
        if (warningMatch) result.warnings = parseInt(warningMatch[1]);
    } else if (tool === 'biome') {
        const errorMatch = output.match(/(\d+)\s+errors?/);
        const warningMatch = output.match(/(\d+)\s+warnings?/);
        if (errorMatch) result.errors = parseInt(errorMatch[1]);
        if (warningMatch) result.warnings = parseInt(warningMatch[1]);
    } else {
        // Fallback for unknown tools: check for "error" or "fail" in output if exit code was non-zero
        // Note: exit code is already handled in runQAGate
        if (output.toLowerCase().includes('error') || output.toLowerCase().includes('fail')) {
            result.errors = 1; // Assume at least one error
        }
    }

    return result;
};

// Main QA gate function
const runQAGate = async () => {
    const projectPath = options.path || process.cwd();
    const policy = options.policy || process.env.QA_POLICY || 'standard';
    const checksToRun = options.checks ? options.checks.split(',') : ['tests', 'lint', 'typecheck', 'build'];

    console.log('\n========================================');
    console.log('   QA GATE - Verification');
    console.log('========================================\n');
    console.log(`Project: ${projectPath}`);
    console.log(`Policy: ${policy}`);
    if (RUN_ID) console.log(`Run ID: ${RUN_ID}`);
    console.log(`Checks: ${checksToRun.join(', ')}\n`);

    const config = detectConfig(projectPath);
    console.log('Detected configuration:');
    console.log(`  Tests: ${config.hasTests ? config.testRunner : 'Not found'}`);
    console.log(`  Lint: ${config.hasLint ? config.lintTool : 'Not found'}`);
    console.log(`  TypeScript: ${config.hasTypeScript ? 'Yes' : 'No'}`);
    console.log(`  Build: ${config.hasBuild ? config.buildTool : 'Not found'}`);
    console.log(`  Package Manager: ${config.packageManager}\n`);

    // Load autofix state
    const autofixState = RUN_ID ? loadAutofixState(RUN_ID) : { spec_version: 1, attempt_in_spec: 0, history: [] };
    console.log(`AutoFix State: spec v${autofixState.spec_version}, attempt ${autofixState.attempt_in_spec}/${AUTOFIX_MAX_ATTEMPTS_PER_SPEC}\n`);

    const report = {
        version: '1.2',
        run_id: RUN_ID || null,
        timestamp: new Date().toISOString(),
        project: {
            name: path.basename(projectPath),
            path: projectPath
        },
        overall_status: 'pending',
        autofix: {
            enabled: true,
            max_attempts_per_spec: AUTOFIX_MAX_ATTEMPTS_PER_SPEC,
            spec_version: autofixState.spec_version,
            attempt_in_spec: autofixState.attempt_in_spec,
            protected_files: PROTECTED_FILES
        },
        summary: {
            total_checks: 0,
            passed: 0,
            failed: 0,
            warnings: 0,
            fixable_within_spec: 0,
            requires_spec_change: 0
        },
        checks: {},
        blocking_issues: [],
        triage_results: [],
        change_requests: [],
        recommendations: []
    };

    // Run Tests
    if (checksToRun.includes('tests') && config.hasTests) {
        console.log('[RUN] Tests...');
        const result = runCommand(`${config.packageManager} test`, projectPath);
        const parsed = parseTestResults(result.stdout + result.stderr, config.testRunner);

        report.checks.tests = {
            status: result.success ? 'pass' : 'fail',
            runner: config.testRunner,
            ...parsed,
            duration_ms: result.duration_ms
        };

        report.summary.total_checks++;
        if (result.success) {
            report.summary.passed++;
            console.log(`  [PASS] ${parsed.passed}/${parsed.total} tests passed\n`);
        } else {
            report.summary.failed++;
            console.log(`  [FAIL] ${parsed.failed} tests failed\n`);

            // Triage the failure
            const triage = triageFailure('tests', result.stderr, result.stdout);
            report.triage_results.push({ check: 'tests', ...triage });

            if (triage.fixable) {
                report.summary.fixable_within_spec++;
                console.log(`  [TRIAGE] Fixable: ${triage.category} - ${triage.suggestion}\n`);
            } else {
                report.summary.requires_spec_change++;
                const cr = generateChangeRequest('tests', result.stderr, triage, report);
                report.change_requests.push(cr);
                console.log(`  [TRIAGE] Requires spec change: ${triage.category}\n`);
            }

            report.blocking_issues.push({
                check: 'tests',
                severity: 'error',
                message: `${parsed.failed} tests failed`,
                triage: triage,
                action: triage.fixable ? triage.suggestion : 'Create Change Request'
            });
        }
    }

    // Run Lint
    if (checksToRun.includes('lint') && config.hasLint) {
        console.log('[RUN] Lint...');
        const result = runCommand(`${config.packageManager} run lint`, projectPath);
        const parsed = parseLintResults(result.stdout + result.stderr, config.lintTool);

        const status = parsed.errors > 0 ? 'fail' : parsed.warnings > 0 ? 'warning' : 'pass';
        report.checks.lint = {
            status,
            tool: config.lintTool,
            ...parsed,
            duration_ms: result.duration_ms
        };

        report.summary.total_checks++;
        if (status === 'pass') {
            report.summary.passed++;
            console.log('  [PASS] No lint issues\n');
        } else if (status === 'warning') {
            report.summary.warnings++;
            console.log(`  [WARN] ${parsed.warnings} warnings\n`);
        } else {
            report.summary.failed++;
            console.log(`  [FAIL] ${parsed.errors} errors\n`);
        }
    }

    // Run TypeCheck
    if (checksToRun.includes('typecheck') && config.hasTypeScript) {
        console.log('[RUN] TypeCheck...');
        const result = runCommand('npx tsc --noEmit', projectPath);

        const errorCount = (result.stderr.match(/error TS\d+/g) || []).length;
        report.checks.typecheck = {
            status: result.success ? 'pass' : 'fail',
            errors: errorCount,
            duration_ms: result.duration_ms,
            issues: []
        };

        report.summary.total_checks++;
        if (result.success) {
            report.summary.passed++;
            console.log('  [PASS] No type errors\n');
        } else {
            report.summary.failed++;
            console.log(`  [FAIL] ${errorCount} type errors\n`);

            // Triage the failure
            const triage = triageFailure('typecheck', result.stderr, result.stdout);
            report.triage_results.push({ check: 'typecheck', ...triage });

            if (triage.fixable) {
                report.summary.fixable_within_spec++;
                console.log(`  [TRIAGE] Fixable: ${triage.category}\n`);
            } else {
                report.summary.requires_spec_change++;
                const cr = generateChangeRequest('typecheck', result.stderr, triage, report);
                report.change_requests.push(cr);
                console.log(`  [TRIAGE] Requires spec change: ${triage.category}\n`);
            }

            report.blocking_issues.push({
                check: 'typecheck',
                severity: 'error',
                message: `${errorCount} TypeScript errors`,
                triage: triage,
                action: triage.fixable ? triage.suggestion : 'Create Change Request'
            });
        }
    }

    // Run Build
    if (checksToRun.includes('build') && config.hasBuild) {
        console.log('[RUN] Build...');
        const result = runCommand(`${config.packageManager} run build`, projectPath);

        report.checks.build = {
            status: result.success ? 'pass' : 'fail',
            tool: config.buildTool,
            duration_ms: result.duration_ms,
            errors: result.success ? [] : [result.stderr.slice(0, 500)]
        };

        report.summary.total_checks++;
        if (result.success) {
            report.summary.passed++;
            console.log(`  [PASS] Build successful (${result.duration_ms}ms)\n`);
        } else {
            report.summary.failed++;
            console.log('  [FAIL] Build failed\n');

            // Triage the failure
            const triage = triageFailure('build', result.stderr, result.stdout);
            report.triage_results.push({ check: 'build', ...triage });

            if (triage.fixable) {
                report.summary.fixable_within_spec++;
                console.log(`  [TRIAGE] Fixable: ${triage.category}\n`);
            } else {
                report.summary.requires_spec_change++;
                const cr = generateChangeRequest('build', result.stderr, triage, report);
                report.change_requests.push(cr);
                console.log(`  [TRIAGE] Requires spec change: ${triage.category}\n`);
            }

            report.blocking_issues.push({
                check: 'build',
                severity: 'error',
                message: 'Build failed',
                triage: triage,
                action: triage.fixable ? triage.suggestion : 'Create Change Request'
            });
        }
    }

    // Determine overall status
    if (report.summary.failed > 0) {
        report.overall_status = 'fail';
    } else if (report.summary.warnings > 0) {
        report.overall_status = 'warning';
    } else if (report.summary.total_checks === 0) {
        report.overall_status = 'skip';
        report.recommendations.push('No checks were run. Configure tests/lint/build in package.json');
    } else {
        report.overall_status = 'pass';
    }

    // AutoFix state management
    let autofixDecision = { proceed: true, reason: 'no_failures' };

    if (report.overall_status === 'fail' && RUN_ID && report.blocking_issues.length > 0) {
        const fingerprint = generateFailureFingerprint(report.blocking_issues);
        autofixDecision = shouldProceedWithAutofix(autofixState, fingerprint);

        // Record the attempt
        const newState = recordAutofixAttempt(RUN_ID, autofixState, fingerprint, report.blocking_issues);
        report.autofix.attempt_in_spec = newState.attempt_in_spec;
        report.autofix.fingerprint = fingerprint;
        report.autofix.can_proceed = autofixDecision.proceed;
        report.autofix.decision_reason = autofixDecision.reason;

        if (!autofixDecision.proceed) {
            // Generate fix_summary.md when max attempts reached
            generateFixSummary(RUN_ID, newState, report.blocking_issues);
            console.log(`\n[STOP] AutoFix has reached max attempts (${AUTOFIX_MAX_ATTEMPTS_PER_SPEC}) for spec v${newState.spec_version}`);
            console.log(`       See: artifacts/runs/latest/60_verification/fix_summary.md`);
        }
    }

    // Save artifacts
    if (RUN_ID) {
        const reportPath = utils.writeArtifact(RUN_ID, 'verification', 'report.json', report);
        const markdown = generateMarkdownReport(report);
        const summaryPath = utils.writeArtifact(RUN_ID, 'verification', 'summary.md', markdown);

        // Save change requests separately if any
        if (report.change_requests.length > 0) {
            const crPath = utils.writeArtifact(RUN_ID, 'verification', 'change_requests.json', report.change_requests);
            const crMd = report.change_requests.map(cr => cr.markdown).join('\n\n---\n\n');
            utils.writeArtifact(RUN_ID, 'verification', 'CHANGE_REQUEST.md', crMd);
            console.log(`\n[!] Change Requests saved - requires user approval`);
        }

        console.log(`\n[OK] Reports saved to:`);
        console.log(`  - ${reportPath}`);
        console.log(`  - ${summaryPath}`);
    } else {
        console.log('\n[INFO] No RUN_ID specified, skipping artifact save.');
        console.log('       Use --run-id or set RUN_ID env var to save artifacts.');
    }

    // Print summary
    console.log('\n========================================');
    console.log('   SUMMARY');
    console.log('========================================\n');
    console.log(`Overall Status: ${report.overall_status.toUpperCase()}`);
    console.log(`Checks: ${report.summary.passed}/${report.summary.total_checks} passed`);
    console.log(`AutoFix: spec v${report.autofix.spec_version}, attempt ${report.autofix.attempt_in_spec}/${AUTOFIX_MAX_ATTEMPTS_PER_SPEC}`);

    if (report.summary.fixable_within_spec > 0 && autofixDecision.proceed) {
        console.log(`\nAutoFix Eligible: ${report.summary.fixable_within_spec} issues (${autofixDecision.attemptsRemaining} attempts remaining)`);
    }
    if (!autofixDecision.proceed) {
        console.log(`\n🛑 AutoFix STOPPED: ${autofixDecision.reason}`);
        console.log(`   Manual intervention required.`);
    }
    if (report.summary.requires_spec_change > 0) {
        console.log(`\n⚠️  Requires Spec Change: ${report.summary.requires_spec_change} issues`);
        console.log(`   See: artifacts/runs/latest/60_verification/CHANGE_REQUEST.md`);
    }

    if (report.blocking_issues.length > 0) {
        console.log('\nBlocking Issues:');
        report.blocking_issues.forEach(issue => {
            const triageInfo = issue.triage ? ` [${issue.triage.fixable ? 'fixable' : 'needs CR'}]` : '';
            console.log(`  - [${issue.check}] ${issue.message}${triageInfo}`);
        });
    }

    return report.overall_status === 'pass' || report.overall_status === 'warning';
};

// Generate markdown report
const generateMarkdownReport = (report) => {
    const checkRows = Object.entries(report.checks).map(([name, check]) => {
        const status = check.status === 'pass' ? 'PASS' :
                       check.status === 'fail' ? 'FAIL' : 'WARN';
        let details = '';
        if (name === 'tests') details = `${check.passed}/${check.total} passed`;
        if (name === 'lint') details = `${check.errors} errors, ${check.warnings} warnings`;
        if (name === 'typecheck') details = `${check.errors} errors`;
        if (name === 'build') details = `${check.duration_ms}ms`;
        return `| ${name} | ${status} | ${details} |`;
    }).join('\n');

    return `# QA Verification Report

## Run Info
- **Run ID**: ${report.run_id || 'N/A'}
- **Timestamp**: ${report.timestamp}
- **Overall Status**: ${report.overall_status.toUpperCase()}

## Summary

| Check | Status | Details |
|-------|--------|---------|
${checkRows || '| - | - | No checks run |'}

---

## Blocking Issues

${report.blocking_issues.length > 0 ?
    report.blocking_issues.map(i => `- **[${i.check}]** ${i.message}\n  - Action: ${i.action}`).join('\n') :
    'No blocking issues found.'}

---

## Recommendations

${report.recommendations.length > 0 ?
    report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') :
    'No recommendations at this time.'}

---

*Generated by QA-Gate Skill | ${report.timestamp}*
`;
};

// Export functions for use by other scripts (approve-change, etc.)
module.exports = {
    bumpSpecVersion,
    loadAutofixState,
    saveAutofixState,
    generateFixSummary,
    AUTOFIX_MAX_ATTEMPTS_PER_SPEC
};

// Run if executed directly
if (require.main === module) {
    runQAGate().then(success => {
        process.exit(success ? 0 : 1);
    });
}
