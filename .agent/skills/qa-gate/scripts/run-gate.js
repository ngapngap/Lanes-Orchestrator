#!/usr/bin/env node
/**
 * Run QA Gate Script
 * Chạy tất cả verification checks
 *
 * Outputs to: artifacts/runs/<run_id>/60_verification/
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

    const report = {
        version: '1.0',
        run_id: RUN_ID || null,
        timestamp: new Date().toISOString(),
        project: {
            name: path.basename(projectPath),
            path: projectPath
        },
        overall_status: 'pending',
        summary: {
            total_checks: 0,
            passed: 0,
            failed: 0,
            warnings: 0
        },
        checks: {},
        blocking_issues: [],
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
            report.blocking_issues.push({
                check: 'tests',
                severity: 'error',
                message: `${parsed.failed} tests failed`,
                action: 'Fix failing tests before merge'
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
            report.blocking_issues.push({
                check: 'typecheck',
                severity: 'error',
                message: `${errorCount} TypeScript errors`,
                action: 'Fix type errors before merge'
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
            report.blocking_issues.push({
                check: 'build',
                severity: 'error',
                message: 'Build failed',
                action: 'Fix build errors'
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

    // Save artifacts
    if (RUN_ID) {
        const reportPath = utils.writeArtifact(RUN_ID, 'verification', 'report.json', report);
        const markdown = generateMarkdownReport(report);
        const summaryPath = utils.writeArtifact(RUN_ID, 'verification', 'summary.md', markdown);

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
    if (report.blocking_issues.length > 0) {
        console.log('\nBlocking Issues:');
        report.blocking_issues.forEach(issue => {
            console.log(`  - [${issue.check}] ${issue.message}`);
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

runQAGate().then(success => {
    process.exit(success ? 0 : 1);
});
