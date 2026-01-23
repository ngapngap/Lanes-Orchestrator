#!/usr/bin/env node
/**
 * Verification Command (aat verify)
 *
 * Runs verification checks against DEFINITION_OF_DONE.md
 * - Checks deliverables exist
 * - Runs verification commands
 * - Checks must-not rules
 * - Generates verification.report.json
 *
 * Exit codes:
 * - 0: PASS
 * - 1: FAIL (any gate/command failed)
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
        },
        getArtifactPath: (runId, phase) => {
            const phases = { 'verification': '60_verification', 'spec': '40_spec' };
            return path.join(REPO_ROOT, 'artifacts', 'runs', runId, phases[phase] || phase);
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
    cyan: '\x1b[36m'
};

// Parse args
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        runId: null,
        projectPath: process.cwd(),
        fast: false,
        json: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--run-id' && args[i + 1]) options.runId = args[++i];
        else if (args[i] === '--path' && args[i + 1]) options.projectPath = args[++i];
        else if (args[i] === '--fast') options.fast = true;
        else if (args[i] === '--json') options.json = true;
    }

    return options;
};

// Parse YAML-like frontmatter from DoD
const parseDodMetadata = (content) => {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const yaml = match[1];
    const metadata = {};
    let currentKey = null;

    yaml.split('\n').forEach(line => {
        if (!line.trim() || line.startsWith('#')) return;

        const isNested = line.startsWith('  ');
        const colonIdx = line.indexOf(':');

        if (colonIdx > 0) {
            const key = line.slice(0, colonIdx).trim();
            const value = line.slice(colonIdx + 1).trim();

            if (isNested && currentKey) {
                metadata[currentKey] = metadata[currentKey] || {};
                metadata[currentKey][key] = value;
            } else {
                metadata[key] = value;
                currentKey = key;
            }
        }
    });

    return metadata;
};

// Check if file/folder exists (supports glob patterns like *.csproj)
const checkDeliverable = (projectPath, deliverablePath) => {
    if (deliverablePath.includes('*')) {
        // Glob pattern
        const dir = path.dirname(deliverablePath);
        const pattern = path.basename(deliverablePath);
        const fullDir = path.join(projectPath, dir === '.' ? '' : dir);
        if (!fs.existsSync(fullDir)) return false;
        const files = fs.readdirSync(fullDir);
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return files.some(f => regex.test(f));
    }

    const fullPath = path.join(projectPath, deliverablePath);
    return fs.existsSync(fullPath);
};

// Run a shell command and capture result
const runCommand = (cmd, projectPath, timeoutMs = 60000) => {
    const startTime = Date.now();
    const result = spawnSync(cmd, {
        cwd: projectPath,
        shell: true,
        encoding: 'utf8',
        timeout: timeoutMs
    });

    return {
        cmd,
        exitCode: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        durationMs: Date.now() - startTime,
        success: result.status === 0
    };
};

// Check must-not rules by scanning files
const checkMustNotRules = (projectPath, constraints) => {
    const violations = [];

    // Check for auth violations
    if (constraints.auth === 'none') {
        // Check package.json for auth deps
        const pkgPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            const authDeps = ['next-auth', 'passport', 'firebase-auth', 'jsonwebtoken', 'express-session'];
            authDeps.forEach(dep => {
                if (allDeps[dep]) {
                    violations.push({
                        type: 'MUST_NOT',
                        rule: 'MUST NOT add authentication',
                        detail: `Found auth dependency: ${dep} in package.json`
                    });
                }
            });
        }

        // Check requirements.txt for Python
        const reqPath = path.join(projectPath, 'requirements.txt');
        if (fs.existsSync(reqPath)) {
            const reqs = fs.readFileSync(reqPath, 'utf8');
            const authPyDeps = ['flask-login', 'django-allauth', 'python-jose', 'pyjwt'];
            authPyDeps.forEach(dep => {
                if (reqs.includes(dep)) {
                    violations.push({
                        type: 'MUST_NOT',
                        rule: 'MUST NOT add authentication',
                        detail: `Found auth dependency: ${dep} in requirements.txt`
                    });
                }
            });
        }

        // Check env files for auth vars
        const envFiles = ['env.example', '.env.example', '.env'];
        envFiles.forEach(envFile => {
            const envPath = path.join(projectPath, envFile);
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                if (envContent.includes('NEXTAUTH_') || envContent.includes('JWT_SECRET') || envContent.includes('SESSION_SECRET')) {
                    violations.push({
                        type: 'MUST_NOT',
                        rule: 'MUST NOT add authentication',
                        detail: `Found auth env vars in ${envFile}`
                    });
                }
            }
        });
    }

    // Check for database violations
    if (constraints.db === 'none') {
        // Check package.json
        const pkgPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            const dbDeps = ['prisma', '@prisma/client', 'sequelize', 'typeorm', 'mongoose', 'pg', 'mysql2', 'better-sqlite3'];
            dbDeps.forEach(dep => {
                if (allDeps[dep]) {
                    violations.push({
                        type: 'MUST_NOT',
                        rule: 'MUST NOT add database',
                        detail: `Found DB dependency: ${dep} in package.json`
                    });
                }
            });
        }

        // Check requirements.txt
        const reqPath = path.join(projectPath, 'requirements.txt');
        if (fs.existsSync(reqPath)) {
            const reqs = fs.readFileSync(reqPath, 'utf8');
            const dbPyDeps = ['sqlalchemy', 'psycopg2', 'pymysql', 'pymongo', 'sqlite3'];
            dbPyDeps.forEach(dep => {
                if (reqs.includes(dep)) {
                    violations.push({
                        type: 'MUST_NOT',
                        rule: 'MUST NOT add database',
                        detail: `Found DB dependency: ${dep} in requirements.txt`
                    });
                }
            });
        }

        // Check docker-compose for db service
        const composePath = path.join(projectPath, 'docker-compose.yml');
        if (fs.existsSync(composePath)) {
            const compose = fs.readFileSync(composePath, 'utf8');
            if (compose.includes('postgres') || compose.includes('mysql') || compose.includes('mongo')) {
                violations.push({
                    type: 'MUST_NOT',
                    rule: 'MUST NOT add database',
                    detail: 'Found database service in docker-compose.yml'
                });
            }
        }

        // Check env for DATABASE_URL
        const envFiles = ['env.example', '.env.example', '.env'];
        envFiles.forEach(envFile => {
            const envPath = path.join(projectPath, envFile);
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                if (envContent.includes('DATABASE_URL') || envContent.includes('DB_HOST')) {
                    violations.push({
                        type: 'MUST_NOT',
                        rule: 'MUST NOT add database',
                        detail: `Found DB env vars in ${envFile}`
                    });
                }
            }
        });
    }

    return violations;
};

// Extract deliverables from DoD content
const extractDeliverables = (dodContent) => {
    const deliverables = [];
    const section = dodContent.match(/## 1\. Repo Deliverables[\s\S]*?(?=---)/);
    if (section) {
        const lines = section[0].split('\n');
        lines.forEach(line => {
            const match = line.match(/- \[ \] `([^`]+)`/);
            if (match) {
                deliverables.push(match[1]);
            }
        });
    }
    return deliverables;
};

// Extract verification commands from DoD content
const extractVerificationCommands = (dodContent) => {
    const commands = [];
    const section = dodContent.match(/## 5\. Verification Commands[\s\S]*?```bash\n([\s\S]*?)```/);
    if (section) {
        const cmdBlock = section[1];
        cmdBlock.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                commands.push(trimmed);
            }
        });
    }
    return commands;
};

// Main verify function
const runVerify = async () => {
    const options = parseArgs();
    const runId = options.runId || process.env.RUN_ID || utils.getLatestRunId();
    const projectPath = options.projectPath;
    const logLines = [];
    const log = (msg) => logLines.push(`[${new Date().toISOString()}] ${msg}`);

    if (!options.json) {
        console.log(`\n${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        console.log(`${c.cyan}${c.bold}   VERIFY - AI Agent Toolkit${c.reset}`);
        console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
    }

    if (!runId) {
        console.error(`${c.red}[ERROR]${c.reset} No run found. Run vibe first or specify --run-id.`);
        process.exit(2);
    }

    log(`Verify started for run: ${runId}`);

    // Load artifacts
    const runDir = path.join(REPO_ROOT, 'artifacts', 'runs', runId);
    const dodPath = path.join(runDir, '40_spec', 'DEFINITION_OF_DONE.md');
    const intakePath = path.join(runDir, '10_intake', 'intake.json');

    if (!fs.existsSync(dodPath)) {
        console.error(`${c.red}[ERROR]${c.reset} DEFINITION_OF_DONE.md not found at ${dodPath}`);
        process.exit(2);
    }

    const dodContent = fs.readFileSync(dodPath, 'utf8');
    const metadata = parseDodMetadata(dodContent);
    const intake = fs.existsSync(intakePath) ? JSON.parse(fs.readFileSync(intakePath, 'utf8')) : null;

    if (!metadata) {
        console.error(`${c.red}[ERROR]${c.reset} Could not parse DoD metadata`);
        process.exit(2);
    }

    if (!options.json) {
        console.log(`Run ID: ${runId}`);
        console.log(`Project: ${projectPath}`);
        console.log(`Kind: ${metadata.project_kind}`);
        console.log(`Language: ${metadata.language}\n`);
    }

    // Initialize report
    const report = {
        run_id: runId,
        timestamp: new Date().toISOString(),
        status: 'PASS',
        gates: {}, // Change from [] to {} (DoD vNext Fix)
        commands: [],
        violations: [],
        deliverables: [],
        summary: {
            failedCount: 0,
            passedCount: 0,
            nextAction: null
        }
    };

    // Gate 1: Check deliverables
    if (!options.json) console.log(`${c.yellow}[1/5]${c.reset} Checking deliverables...`);
    const deliverables = extractDeliverables(dodContent);
    let deliverablesPass = true;

    deliverables.forEach(d => {
        const exists = checkDeliverable(projectPath, d);
        report.deliverables.push({ path: d, exists });
        if (!exists) {
            deliverablesPass = false;
            log(`Deliverable missing: ${d}`);
        }
    });

    report.gates.G_DELIVERABLES = {
        id: 'G_DELIVERABLES',
        status: deliverablesPass ? 'PASS' : 'FAIL',
        message: deliverablesPass ? 'All deliverables exist' : `${report.deliverables.filter(d => !d.exists).length} deliverable(s) missing`,
        details: { deliverables: report.deliverables }
    };

    if (!options.json) {
        const missingCount = report.deliverables.filter(d => !d.exists).length;
        if (deliverablesPass) {
            console.log(`  ${c.green}✓${c.reset} All ${deliverables.length} deliverables exist\n`);
        } else {
            console.log(`  ${c.red}✗${c.reset} ${missingCount}/${deliverables.length} deliverables missing\n`);
            report.deliverables.filter(d => !d.exists).forEach(d => {
                console.log(`    - ${d.path}`);
            });
        }
    }

    // Gate 2: Check must-not rules
    if (!options.json) console.log(`${c.yellow}[2/5]${c.reset} Checking must-not rules...`);
    const violations = checkMustNotRules(projectPath, metadata.constraints || {});
    report.violations = violations;

    const mustNotPass = violations.length === 0;
    report.gates.G_MUST_NOT = {
        id: 'G_MUST_NOT',
        status: mustNotPass ? 'PASS' : 'FAIL',
        message: mustNotPass ? 'No violations found' : `${violations.length} violation(s) found`,
        violations: violations
    };

    if (!options.json) {
        if (mustNotPass) {
            console.log(`  ${c.green}✓${c.reset} No violations\n`);
        } else {
            console.log(`  ${c.red}✗${c.reset} ${violations.length} violation(s)\n`);
            violations.forEach(v => {
                console.log(`    - ${v.rule}: ${v.detail}`);
            });
        }
    }

    // Gate 3: MVP not empty (DoD G3)
    if (!options.json) console.log(`${c.yellow}[3/5]${c.reset} Checking MVP scope...`);
    const mvpFeatures = intake?.scope?.mvp_features || [];
    const mvpPass = mvpFeatures.length >= 2;
    report.gates.G_MVP_SIZE = {
        id: 'G_MVP_SIZE',
        status: mvpPass ? 'PASS' : 'FAIL',
        message: mvpPass ? `MVP features count: ${mvpFeatures.length}` : `MVP features count too low: ${mvpFeatures.length} (required >= 2)`
    };

    if (!options.json) {
        if (mvpPass) {
            console.log(`  ${c.green}✓${c.reset} MVP scope has ${mvpFeatures.length} features\n`);
        } else {
            console.log(`  ${c.red}✗${c.reset} MVP scope only has ${mvpFeatures.length} features (must be >= 2)\n`);
        }
    }

    // Gate 4: Run verification commands
    if (!options.json) console.log(`${c.yellow}[4/5]${c.reset} Running verification commands...`);

    if (!options.fast) {
        const commands = extractVerificationCommands(dodContent);
        let commandsPass = true;

        for (const cmd of commands) {
            if (cmd.startsWith('#')) continue; // Skip comments/manual commands

            const result = runCommand(cmd, projectPath);
            report.commands.push(result);
            log(`Command: ${cmd} -> exit ${result.exitCode}`);

            if (!result.success) {
                commandsPass = false;
            }

            if (!options.json) {
                if (result.success) {
                    console.log(`  ${c.green}✓${c.reset} ${cmd} (${result.durationMs}ms)`);
                } else {
                    console.log(`  ${c.red}✗${c.reset} ${cmd} (exit ${result.exitCode})`);
                }
            }
        }

        report.gates.G_COMMANDS = {
            id: 'G_COMMANDS',
            status: commandsPass ? 'PASS' : 'FAIL',
            message: commandsPass ? 'All commands passed' : 'Some commands failed',
            details: { commands: report.commands }
        };

        if (!options.json) console.log();
    } else {
        report.gates.G_COMMANDS = {
            id: 'G_COMMANDS',
            status: 'PASS',
            message: 'Skipped (--fast mode)'
        };
        if (!options.json) console.log(`  ${c.dim}Skipped (--fast mode)${c.reset}\n`);
    }

    // Gate 5: Load and compare with spec (basic consistency check)
    if (!options.json) console.log(`${c.yellow}[5/5]${c.reset} Final consistency check...`);

    const specPath = path.join(runDir, '40_spec', 'spec.md');
    const specExists = fs.existsSync(specPath);
    report.gates.G_SPEC_EXISTS = {
        id: 'G_SPEC_EXISTS',
        status: specExists ? 'PASS' : 'FAIL',
        message: specExists ? 'spec.md exists' : 'spec.md not found'
    };

    if (!options.json) {
        if (specExists) {
            console.log(`  ${c.green}✓${c.reset} spec.md exists\n`);
        } else {
            console.log(`  ${c.red}✗${c.reset} spec.md not found\n`);
        }
    }

    // Calculate overall status
    const gateValues = Object.values(report.gates);
    const failedGates = gateValues.filter(g => g.status === 'FAIL');
    report.summary.failedCount = failedGates.length;
    report.summary.passedCount = gateValues.length - failedGates.length;
    report.status = failedGates.length > 0 ? 'FAIL' : 'PASS';

    if (report.status === 'fail') {
        report.summary.nextAction = `run npx aat fix --run-id ${runId}`;
    }

    // Save report
    const verifyDir = path.join(runDir, '60_verification');
    if (!fs.existsSync(verifyDir)) {
        fs.mkdirSync(verifyDir, { recursive: true });
    }
    fs.writeFileSync(path.join(verifyDir, 'verification.report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(verifyDir, 'verification.log'), logLines.join('\n'));

    // Output
    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        if (report.status === 'pass') {
            console.log(`${c.green}${c.bold}✓ PASS${c.reset} - All gates passed`);
        } else {
            console.log(`${c.red}${c.bold}✗ FAIL${c.reset} - ${failedGates.length} gate(s) failed`);
            console.log(`\nNext: ${c.cyan}npx aat fix --run-id ${runId}${c.reset}`);
            console.log(`Or:   ${c.cyan}npx aat loop --run-id ${runId}${c.reset}`);
        }
        console.log(`\nReport: ${c.dim}${path.join(verifyDir, 'verification.report.json')}${c.reset}\n`);
    }

    process.exit(report.status === 'pass' ? 0 : 1);
};

// Run
runVerify().catch(e => {
    console.error(`${c.red}[ERROR]${c.reset} ${e.message}`);
    process.exit(2);
});
