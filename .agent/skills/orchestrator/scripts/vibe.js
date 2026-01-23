#!/usr/bin/env node
/**
 * Vibe Mode Orchestrator
 *
 * One-command pipeline for non-technical users.
 * Asks 5 questions → runs full pipeline → outputs spec + tasks + next steps
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
        generateRunId: (slug) => {
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
            return `${dateStr}_${timeStr}_${slug}`;
        },
        getArtifactPath: (runId, phase) => {
            const phases = {
                'intake': '10_intake',
                'research': '20_research',
                'debate': '30_debate',
                'spec': '40_spec',
                'implementation': '50_implementation',
                'verification': '60_verification',
                'deploy': 'deploy'
            };
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
        }
    };
}

// Colors
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
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
        description: null,
        nonInteractive: false,
        answersJson: null,
        answersFile: null,
        answersStdin: false
    };

    // Join all non-flag args as description
    const descParts = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--run-id' && args[i + 1]) {
            options.runId = args[++i];
        } else if (args[i] === '--non-interactive') {
            options.nonInteractive = true;
        } else if (args[i] === '--answers-json' && args[i + 1]) {
            options.answersJson = args[++i];
        } else if (args[i] === '--answers-file' && args[i + 1]) {
            options.answersFile = args[++i];
        } else if (args[i] === '--answers-stdin') {
            options.answersStdin = true;
        } else if (!args[i].startsWith('--')) {
            descParts.push(args[i]);
        }
    }
    if (descParts.length > 0) {
        options.description = descParts.join(' ');
    }

    // Auto-detect non-interactive if stdin is not TTY
    if (!process.stdin.isTTY) {
        options.nonInteractive = true;
    }

    return options;
};

// Readline helper
const createRL = () => readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (rl, question) => new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
});

// ============================================
// Project Type Classification
// ============================================

const PROJECT_TYPES = {
    cli: {
        id: 'cli',
        name: 'Command-Line Application',
        patterns: [
            /\bcli\b/i, /\bcommand[- ]?line\b/i, /\bconsole\b/i, /\bterminal\b/i,
            /\bargparse\b/i, /\bclick\b/i, /\btyper\b/i, /\bcobra\b/i,
            /\bscript\b/i, /\bbatch\b/i, /\bshell\b/i
        ],
        defaults: {
            platform: 'cli',
            auth: 'none',
            data_sensitivity: 'none',
            deploy: 'pip/npm package'
        },
        questions: ['goal', 'features', 'language', 'deploy']
    },
    api: {
        id: 'api',
        name: 'REST/GraphQL API',
        patterns: [
            /\bapi\b/i, /\brest\b/i, /\bgraphql\b/i, /\bendpoint/i,
            /\bbackend\b/i, /\bserver\b/i, /\bmicroservice/i
        ],
        defaults: {
            platform: 'api',
            auth: 'api-key',
            data_sensitivity: 'depends',
            deploy: 'Docker'
        },
        questions: ['goal', 'features', 'auth', 'data_sensitivity', 'deploy']
    },
    library: {
        id: 'library',
        name: 'Library/Package',
        patterns: [
            /\blibrary\b/i, /\bpackage\b/i, /\bmodule\b/i, /\bsdk\b/i,
            /\bnpm\b/i, /\bpip\b/i, /\bnuget\b/i, /\bcrate\b/i, /\bgem\b/i
        ],
        defaults: {
            platform: 'library',
            auth: 'none',
            data_sensitivity: 'none',
            deploy: 'package registry'
        },
        questions: ['goal', 'features', 'language']
    },
    mobile: {
        id: 'mobile',
        name: 'Mobile Application',
        patterns: [
            /\bmobile\b/i, /\bios\b/i, /\bandroid\b/i, /\bapp store\b/i,
            /\breact native\b/i, /\bflutter\b/i, /\bswift\b/i, /\bkotlin\b/i
        ],
        defaults: {
            platform: 'mobile',
            auth: 'email',
            data_sensitivity: 'personal info',
            deploy: 'App Store/Play Store'
        },
        questions: ['goal', 'features', 'platform', 'auth', 'data_sensitivity', 'deploy']
    },
    web: {
        id: 'web',
        name: 'Web Application',
        patterns: [
            /\bweb\b/i, /\bwebsite\b/i, /\bfrontend\b/i, /\bfull[- ]?stack\b/i,
            /\breact\b/i, /\bvue\b/i, /\bangular\b/i, /\bnext\.?js\b/i,
            /\bdashboard\b/i, /\bportal\b/i, /\bsaas\b/i
        ],
        defaults: {
            platform: 'web responsive',
            auth: 'email',
            data_sensitivity: 'personal info',
            deploy: 'Vercel'
        },
        questions: ['goal', 'features', 'platform', 'auth', 'data_sensitivity', 'deploy']
    }
};

// Language detection for CLI/library projects
const LANGUAGE_PATTERNS = {
    python: [/\bpython\b/i, /\bpy\b/i, /\bpip\b/i, /\bdjango\b/i, /\bflask\b/i, /\bfastapi\b/i],
    node: [/\bnode\b/i, /\bjavascript\b/i, /\btypescript\b/i, /\bnpm\b/i, /\bjs\b/i, /\bts\b/i],
    dotnet: [/\b\.net\b/i, /\bc#\b/i, /\bcsharp\b/i, /\bdotnet\b/i, /\bnuget\b/i, /\brazor\b/i],
    go: [/\bgo\b/i, /\bgolang\b/i],
    rust: [/\brust\b/i, /\bcargo\b/i],
    java: [/\bjava\b/i, /\bspring\b/i, /\bmaven\b/i, /\bgradle\b/i]
};

/**
 * Detect project type from description
 */
const detectProjectType = (description) => {
    if (!description) return PROJECT_TYPES.web;

    const text = description.toLowerCase();

    // Check each project type
    for (const [typeId, typeInfo] of Object.entries(PROJECT_TYPES)) {
        for (const pattern of typeInfo.patterns) {
            if (pattern.test(text)) {
                return typeInfo;
            }
        }
    }

    // Default to web
    return PROJECT_TYPES.web;
};

/**
 * Detect programming language from description
 */
const detectLanguage = (description) => {
    if (!description) return null;

    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(description)) {
                return lang;
            }
        }
    }

    return null;
};

/**
 * Check if description explicitly says "no X"
 */
const detectExplicitNegations = (description) => {
    if (!description) return {};

    const negations = {};
    const text = description.toLowerCase();

    // No auth patterns
    if (/\bno\s+(auth|authentication|login)\b/i.test(text) ||
        /\bwithout\s+(auth|authentication|login)\b/i.test(text)) {
        negations.auth = 'none';
    }

    // No database patterns
    if (/\bno\s+(database|db|storage)\b/i.test(text) ||
        /\bwithout\s+(database|db|storage)\b/i.test(text)) {
        negations.database = 'none';
    }

    // No UI patterns (for API/CLI)
    if (/\bno\s+(ui|frontend|interface)\b/i.test(text)) {
        negations.ui = 'none';
    }

    return negations;
};

// ============================================
// Dynamic Questions based on Project Type
// ============================================

const BASE_QUESTIONS = {
    goal: {
        id: 'goal',
        question: '1. Mục tiêu chính là gì và ai sẽ dùng?',
        example: 'VD: Tool quản lý file cho developers',
        required: true
    },
    features: {
        id: 'features',
        question: '2. MVP cần những chức năng nào? (liệt kê, cách nhau bằng dấu phẩy)',
        example: 'VD: list files, search, filter by type',
        required: true
    },
    language: {
        id: 'language',
        question: '3. Ngôn ngữ lập trình?',
        example: 'VD: Python, Node.js, Go, Rust, C#',
        default: 'Python'
    },
    platform: {
        id: 'platform',
        question: '3. Nền tảng: web, mobile app, hay cả hai?',
        example: 'VD: web responsive',
        default: 'web responsive'
    },
    auth: {
        id: 'auth',
        question: '4. Cần đăng nhập không? (Google/email/API key/không cần)',
        example: 'VD: không cần',
        default: 'none'
    },
    data_sensitivity: {
        id: 'data_sensitivity',
        question: '5. Dữ liệu nhạy cảm? (thông tin cá nhân/thanh toán/y tế/không có)',
        example: 'VD: không có',
        default: 'none'
    },
    deploy: {
        id: 'deploy',
        question: '6. Deploy ở đâu?',
        example: 'VD: pip package, Docker, Vercel',
        default: 'Docker'
    }
};

/**
 * Get questions for a specific project type
 */
const getQuestionsForType = (projectType) => {
    const questionIds = projectType.questions || ['goal', 'features', 'platform', 'auth', 'data_sensitivity', 'deploy'];
    return questionIds.map(id => ({
        ...BASE_QUESTIONS[id],
        default: projectType.defaults[id] || BASE_QUESTIONS[id].default
    }));
};

// Legacy VIBE_QUESTIONS for backward compatibility (will be overridden)
const VIBE_QUESTIONS = Object.values(BASE_QUESTIONS);

// Read stdin as string (for --answers-stdin)
const readStdin = () => new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data.trim()));
    // Timeout after 100ms if no data
    setTimeout(() => resolve(data.trim()), 100);
});

// Get answers from non-interactive sources
const getAnswersNonInteractive = async (options) => {
    let rawAnswers = {};

    // Priority: --answers-json > --answers-file > --answers-stdin > defaults
    if (options.answersJson) {
        try {
            rawAnswers = JSON.parse(options.answersJson);
        } catch (e) {
            console.error(`${c.yellow}⚠${c.reset} Invalid --answers-json, using defaults`);
        }
    } else if (options.answersFile) {
        try {
            const content = fs.readFileSync(options.answersFile, 'utf8');
            rawAnswers = JSON.parse(content);
        } catch (e) {
            console.error(`${c.yellow}⚠${c.reset} Cannot read --answers-file, using defaults`);
        }
    } else if (options.answersStdin) {
        try {
            const stdinData = await readStdin();
            if (stdinData) {
                rawAnswers = JSON.parse(stdinData);
            }
        } catch (e) {
            console.error(`${c.yellow}⚠${c.reset} Invalid JSON from stdin, using defaults`);
        }
    }

    // Detect project type from description
    const description = options.description || rawAnswers.goal || '';
    const projectType = detectProjectType(description);
    const detectedLanguage = detectLanguage(description);
    const negations = detectExplicitNegations(description);

    console.log(`${c.cyan}[DETECT]${c.reset} Project type: ${projectType.name}`);
    if (detectedLanguage) {
        console.log(`${c.cyan}[DETECT]${c.reset} Language: ${detectedLanguage}`);
    }
    if (Object.keys(negations).length > 0) {
        console.log(`${c.cyan}[DETECT]${c.reset} Explicit: ${Object.entries(negations).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }

    // Get questions for this project type
    const questions = getQuestionsForType(projectType);

    // Build answers with smart defaults
    const answers = {
        initial: description,
        _projectType: projectType.id,
        _detectedLanguage: detectedLanguage
    };

    for (const q of questions) {
        // Priority: rawAnswers > negations > project type defaults
        if (rawAnswers[q.id]) {
            answers[q.id] = rawAnswers[q.id];
        } else if (negations[q.id]) {
            answers[q.id] = negations[q.id];
        } else {
            answers[q.id] = q.default || '';
        }
    }

    // Auto-fill language if detected
    if (detectedLanguage && !answers.language) {
        answers.language = detectedLanguage;
    }

    // Use description as goal if goal is empty
    if (!answers.goal && description) {
        answers.goal = description;
    }

    // Extract features from description if not provided
    if (!answers.features && description) {
        answers.features = extractFeaturesFromDescription(description);
    }

    return answers;
};

/**
 * Extract features from description using simple heuristics
 */
const extractFeaturesFromDescription = (description) => {
    // Look for flag patterns like --health, --version
    const flagMatches = description.match(/--\w+/g);
    if (flagMatches) {
        return flagMatches.map(f => f.replace('--', '')).join(', ');
    }

    // Look for "prints X", "outputs Y", "generates Z"
    const actionMatches = description.match(/(?:prints?|outputs?|generates?|creates?|shows?)\s+["']?([^"',]+)["']?/gi);
    if (actionMatches) {
        return actionMatches.map(m => m.replace(/^(prints?|outputs?|generates?|creates?|shows?)\s+/i, '')).join(', ');
    }

    return '';
};

// Collect answers (interactive TTY mode)
const collectAnswers = async (initialDescription) => {
    const rl = createRL();
    const answers = {};

    // Detect project type first
    const projectType = detectProjectType(initialDescription);
    const detectedLanguage = detectLanguage(initialDescription);
    const negations = detectExplicitNegations(initialDescription);

    console.log(`\n${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}${c.bold}   VIBE MODE - Mô tả dự án của bạn${c.reset}`);
    console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    if (initialDescription) {
        console.log(`${c.dim}Mô tả ban đầu: ${initialDescription}${c.reset}`);
        console.log(`${c.cyan}[DETECT]${c.reset} Project type: ${projectType.name}`);
        if (detectedLanguage) {
            console.log(`${c.cyan}[DETECT]${c.reset} Language: ${detectedLanguage}`);
        }
        console.log();
        answers.initial = initialDescription;
    }

    answers._projectType = projectType.id;
    answers._detectedLanguage = detectedLanguage;

    // Get questions for this project type
    const questions = getQuestionsForType(projectType);

    console.log(`${c.dim}Trả lời ${questions.length} câu hỏi sau (Enter để dùng mặc định):${c.reset}\n`);

    for (const q of questions) {
        // Skip questions with explicit negations
        if (negations[q.id]) {
            answers[q.id] = negations[q.id];
            console.log(`${c.dim}${q.question} → ${negations[q.id]} (từ mô tả)${c.reset}\n`);
            continue;
        }

        console.log(`${c.yellow}${q.question}${c.reset}`);
        console.log(`${c.dim}${q.example} [mặc định: ${q.default}]${c.reset}`);

        const answer = await ask(rl, `${c.green}> ${c.reset}`);
        answers[q.id] = answer || q.default || '';
        console.log();
    }

    rl.close();
    return answers;
};

// Generate project slug from answers
const generateSlug = (answers) => {
    const text = answers.goal || answers.initial || 'project';
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .slice(0, 3)
        .join('-')
        .slice(0, 30) || 'vibe-project';
};

// Parse features from comma-separated string
const parseFeatures = (featuresStr) => {
    if (!featuresStr) return [];
    return featuresStr
        .split(/[,;]/)
        .map(f => f.trim())
        .filter(f => f.length > 0)
        .map((name, i) => ({
            id: `F${i + 1}`,
            name,
            priority: i < 3 ? 'P0' : 'P1',
            description: name,
            steps: [`User thực hiện ${name}`],
            criteria: [`${name} hoạt động đúng`]
        }));
};

// Determine tech stack based on project type and language
const determineTechStack = (answers) => {
    const projectType = answers._projectType || 'web';
    const language = answers._detectedLanguage || answers.language;
    const platform = answers.platform || '';
    const auth = answers.auth || 'none';
    const stack = [];

    // CLI projects
    if (projectType === 'cli') {
        if (language === 'python') {
            stack.push({ layer: 'Language', tech: 'Python 3.10+', reason: 'Widely supported' });
            stack.push({ layer: 'CLI Framework', tech: 'argparse or click', reason: 'Standard library / popular' });
            stack.push({ layer: 'Package', tech: 'pip + pyproject.toml', reason: 'Modern Python packaging' });
        } else if (language === 'node') {
            stack.push({ layer: 'Language', tech: 'Node.js 18+', reason: 'LTS version' });
            stack.push({ layer: 'CLI Framework', tech: 'commander or yargs', reason: 'Popular, well-documented' });
            stack.push({ layer: 'Package', tech: 'npm', reason: 'Standard for Node' });
        } else if (language === 'go') {
            stack.push({ layer: 'Language', tech: 'Go 1.21+', reason: 'Fast compilation' });
            stack.push({ layer: 'CLI Framework', tech: 'cobra', reason: 'Industry standard' });
        } else if (language === 'rust') {
            stack.push({ layer: 'Language', tech: 'Rust', reason: 'Performance, safety' });
            stack.push({ layer: 'CLI Framework', tech: 'clap', reason: 'De facto standard' });
        } else if (language === 'dotnet') {
            stack.push({ layer: 'Language', tech: 'C# / .NET 8', reason: 'Latest LTS' });
            stack.push({ layer: 'CLI Framework', tech: 'System.CommandLine', reason: 'Official MS library' });
        }
        return stack;
    }

    // API projects
    if (projectType === 'api') {
        if (language === 'python') {
            stack.push({ layer: 'Language', tech: 'Python 3.10+', reason: 'Widely supported' });
            stack.push({ layer: 'Framework', tech: 'FastAPI', reason: 'Async, auto OpenAPI docs' });
            stack.push({ layer: 'ORM', tech: 'SQLAlchemy + Alembic', reason: 'Mature, flexible' });
        } else if (language === 'node') {
            stack.push({ layer: 'Language', tech: 'Node.js / TypeScript', reason: 'Type safety' });
            stack.push({ layer: 'Framework', tech: 'Express or Fastify', reason: 'Popular, performant' });
            stack.push({ layer: 'ORM', tech: 'Prisma', reason: 'Modern, type-safe' });
        } else {
            stack.push({ layer: 'Framework', tech: 'FastAPI (Python)', reason: 'Default API framework' });
        }

        if (auth !== 'none' && auth !== 'không') {
            stack.push({ layer: 'Auth', tech: 'JWT / API Key', reason: 'Standard for APIs' });
        }

        stack.push({ layer: 'Deploy', tech: 'Docker', reason: 'Portable, consistent' });
        return stack;
    }

    // Library projects
    if (projectType === 'library') {
        if (language === 'python') {
            stack.push({ layer: 'Language', tech: 'Python 3.8+', reason: 'Wide compatibility' });
            stack.push({ layer: 'Build', tech: 'pyproject.toml + setuptools', reason: 'PEP 621' });
            stack.push({ layer: 'Test', tech: 'pytest', reason: 'De facto standard' });
            stack.push({ layer: 'Publish', tech: 'PyPI', reason: 'Package registry' });
        } else if (language === 'node') {
            stack.push({ layer: 'Language', tech: 'TypeScript', reason: 'Type safety for libs' });
            stack.push({ layer: 'Build', tech: 'tsup or esbuild', reason: 'Fast bundling' });
            stack.push({ layer: 'Test', tech: 'vitest', reason: 'Fast, modern' });
            stack.push({ layer: 'Publish', tech: 'npm', reason: 'Package registry' });
        }
        return stack;
    }

    // Mobile projects
    if (projectType === 'mobile') {
        stack.push({ layer: 'Framework', tech: 'React Native', reason: 'Cross-platform' });
        stack.push({ layer: 'Navigation', tech: 'React Navigation', reason: 'Standard' });
        if (auth !== 'none' && auth !== 'không') {
            stack.push({ layer: 'Auth', tech: 'Firebase Auth', reason: 'Easy mobile auth' });
        }
        stack.push({ layer: 'Deploy', tech: 'EAS Build', reason: 'Expo tooling' });
        return stack;
    }

    // Web projects (default)
    if (platform.includes('web') || projectType === 'web') {
        stack.push({ layer: 'Frontend', tech: 'Next.js + React', reason: 'Full-stack capable' });
        stack.push({ layer: 'Styling', tech: 'Tailwind CSS', reason: 'Utility-first' });
    }

    // Only add database if needed
    const needsDb = auth !== 'none' || (answers.data_sensitivity && answers.data_sensitivity !== 'none');
    if (needsDb) {
        stack.push({ layer: 'Database', tech: 'PostgreSQL + Prisma', reason: 'Type-safe ORM' });
    }

    if (auth && auth !== 'none' && auth !== 'không' && auth !== 'không cần') {
        stack.push({ layer: 'Auth', tech: 'NextAuth.js', reason: 'Multi-provider' });
    }

    stack.push({ layer: 'Hosting', tech: 'Vercel', reason: 'Zero-config deploy' });

    return stack;
};

// Generate intake from answers
const generateIntake = (answers, runId) => {
    const features = parseFeatures(answers.features || '');
    const projectType = answers._projectType || 'web';
    const language = answers._detectedLanguage || answers.language;

    // Determine actual platform based on project type
    let platform = answers.platform;
    if (!platform || platform === 'web responsive') {
        if (projectType === 'cli') platform = 'cli';
        else if (projectType === 'api') platform = 'api';
        else if (projectType === 'library') platform = 'library';
        else if (projectType === 'mobile') platform = 'mobile';
    }

    // Handle auth - respect "none" values
    let auth = answers.auth;
    if (auth === 'none' || auth === 'không' || auth === 'không cần') {
        auth = 'none';
    }

    return {
        version: '1.0',
        run_id: runId,
        timestamp: new Date().toISOString(),
        mode: 'vibe',
        project: {
            name: generateSlug(answers).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: projectType,
            platform: platform,
            language: language,
            description: answers.goal || answers.initial || ''
        },
        target_users: {
            primary: answers.goal?.split(',')[0] || 'Developers',
            secondary: ''
        },
        scope: {
            mvp_features: features.filter(f => f.priority === 'P0').map(f => f.name),
            future_features: features.filter(f => f.priority === 'P1').map(f => f.name),
            out_of_scope: []
        },
        constraints: {
            auth: auth || 'none',
            platform: platform,
            language: language,
            data_sensitivity: answers.data_sensitivity || 'none',
            deploy: answers.deploy || 'Docker'
        },
        _raw_answers: answers
    };
};

// Generate spec from intake
const generateSpec = (intake, researchNote) => {
    const features = parseFeatures(intake._raw_answers?.features || '');
    const techStack = determineTechStack(intake._raw_answers || {});
    const projectType = intake.project?.type || 'web';
    const language = intake.project?.language || intake.constraints?.language;
    const auth = intake.constraints?.auth || 'none';
    const isAuthRequired = auth !== 'none' && auth !== 'không' && auth !== 'không cần';

    // Build spec based on project type
    let spec = `# ${intake.project.name} - Specification

> This document describes the project for developer or AI agent implementation.
> **Version:** 1.0 | **Created:** ${new Date().toISOString()}

---

## 1. Overview

### What is this project?
${intake.project.description}

### Project Type
- **Type:** ${PROJECT_TYPES[projectType]?.name || projectType}
${language ? `- **Language:** ${language}` : ''}
- **Platform:** ${intake.constraints?.platform || projectType}

### Target Users
${intake.target_users?.primary || 'Developers'}

### MVP Features
${intake.scope?.mvp_features?.length > 0 ? intake.scope.mvp_features.map(f => `- ${f}`).join('\n') : '- See feature list below'}

---

## 2. Features (MVP)
`;

    // Generate feature section based on project type
    if (projectType === 'cli') {
        spec += `
> Command-line interface features

${features.filter(f => f.priority === 'P0').map((f, i) => `
### ${i + 1}. \`--${f.name}\` flag

**Description:** ${f.description}

**Usage:**
\`\`\`bash
${intake.project.name.toLowerCase().replace(/\s+/g, '-')} --${f.name}
\`\`\`

**Acceptance criteria:**
- [ ] Flag \`--${f.name}\` works correctly
- [ ] Proper error handling
- [ ] Help text describes this flag
`).join('\n---\n')}
`;
    } else if (projectType === 'api') {
        spec += `
> API endpoints

${features.filter(f => f.priority === 'P0').map((f, i) => `
### ${i + 1}. ${f.name}

**Endpoint:** \`/api/${f.name.toLowerCase().replace(/\s+/g, '-')}\`

**Method:** GET/POST (as appropriate)

**Response:**
\`\`\`json
{ "status": "ok", "data": {} }
\`\`\`

**Acceptance criteria:**
- [ ] Endpoint responds correctly
- [ ] Proper error codes
- [ ] Input validation
`).join('\n---\n')}
`;
    } else if (projectType === 'library') {
        spec += `
> Library functions/classes

${features.filter(f => f.priority === 'P0').map((f, i) => `
### ${i + 1}. ${f.name}

**Function/Class:** \`${f.name.replace(/\s+/g, '_')}\`

**Usage:**
\`\`\`${language || 'python'}
# Example usage
result = ${f.name.replace(/\s+/g, '_')}()
\`\`\`

**Acceptance criteria:**
- [ ] Function works as documented
- [ ] Unit tests pass
- [ ] Type hints/docs provided
`).join('\n---\n')}
`;
    } else {
        // Web/Mobile - original format
        spec += `
${features.filter(f => f.priority === 'P0').map((f, i) => `
### ${i + 1}. ${f.name}

**Description:** ${f.description}

**User flow:**
1. User accesses ${f.name} feature
2. User performs action
3. System processes and responds

**Acceptance criteria:**
- [ ] Feature ${f.name} works correctly
- [ ] Good UX
- [ ] No critical bugs
`).join('\n---\n')}
`;
    }

    spec += `
---

## 3. Future Features (Not MVP)

${features.filter(f => f.priority === 'P1').map(f => `- **${f.name}**: Post-MVP`).join('\n') || '- No future features defined yet'}

---

## 4. Technical Requirements

### Platform & Language
- **Type:** ${projectType}
${language ? `- **Language:** ${language}` : ''}
- **Platform:** ${intake.constraints?.platform || 'N/A'}

### Authentication
- **Required:** ${isAuthRequired ? 'Yes' : 'No'}
${isAuthRequired ? `- **Method:** ${auth}` : ''}

### Database
- **Required:** ${intake.constraints?.data_sensitivity !== 'none' ? 'Yes' : 'No'}

### Tech Stack

| Layer | Technology | Reason |
|-------|------------|--------|
${techStack.map(t => `| ${t.layer} | ${t.tech} | ${t.reason} |`).join('\n')}

---

## 5. Constraints

${intake.constraints?.data_sensitivity && intake.constraints.data_sensitivity !== 'none'
    ? `- **Data sensitivity:** ${intake.constraints.data_sensitivity}`
    : '- No special data handling required'}
${intake.constraints?.special ? `- **Special requirements:** ${intake.constraints.special}` : ''}

---

${researchNote ? `## 6. Research Notes

> ${researchNote}

---` : ''}

## Checklist Before Coding

- [ ] Understand project goal (Section 1)
- [ ] Understand MVP features (Section 2)
- [ ] Setup tech stack (Section 4)
- [ ] Implement features
- [ ] Test all features

---

*Spec generated by AI Agent Toolkit - Vibe Mode*
*Run ID: ${intake.run_id}*
`;

    return spec;
};

// Generate task breakdown
const generateTasks = (intake) => {
    const features = parseFeatures(intake._raw_answers?.features || '');
    const tasks = [];
    let taskId = 1;

    // Setup tasks
    tasks.push({
        id: `T${taskId++}`,
        name: 'Project Setup',
        description: 'Khởi tạo project với tech stack đề xuất',
        priority: 'P0',
        lane: 'setup',
        estimated_hours: 2,
        dependencies: [],
        status: 'pending'
    });

    // Auth task if needed
    if (intake.constraints?.auth && intake.constraints.auth !== 'không' && intake.constraints.auth !== 'không cần') {
        tasks.push({
            id: `T${taskId++}`,
            name: 'Authentication Setup',
            description: `Implement đăng nhập bằng ${intake.constraints.auth}`,
            priority: 'P0',
            lane: 'api',
            estimated_hours: 4,
            dependencies: ['T1'],
            status: 'pending'
        });
    }

    // Feature tasks
    features.forEach((f, i) => {
        tasks.push({
            id: `T${taskId++}`,
            name: f.name,
            description: `Implement tính năng: ${f.name}`,
            priority: f.priority,
            lane: 'ui',
            estimated_hours: f.priority === 'P0' ? 4 : 2,
            dependencies: taskId > 3 ? [`T${taskId - 2}`] : ['T1'],
            status: 'pending'
        });
    });

    // Testing task
    tasks.push({
        id: `T${taskId++}`,
        name: 'Testing & QA',
        description: 'Test tất cả tính năng, fix bugs',
        priority: 'P0',
        lane: 'qa',
        estimated_hours: 4,
        dependencies: tasks.filter(t => t.priority === 'P0').map(t => t.id),
        status: 'pending'
    });

    // Deploy task
    tasks.push({
        id: `T${taskId++}`,
        name: 'Deploy MVP',
        description: 'Deploy lên production',
        priority: 'P0',
        lane: 'devops',
        estimated_hours: 2,
        dependencies: [`T${taskId - 2}`],
        status: 'pending'
    });

    return {
        version: '1.0',
        run_id: intake.run_id,
        timestamp: new Date().toISOString(),
        total_tasks: tasks.length,
        estimated_total_hours: tasks.reduce((sum, t) => sum + t.estimated_hours, 0),
        tasks,
        lanes: ['setup', 'api', 'ui', 'qa', 'devops', 'security']
    };
};

// Generate Security Review (Layer C)
const generateSecurityReview = (intake) => {
    const dataSensitivity = intake.constraints?.data_sensitivity || 'unknown';
    const hasAuth = intake.constraints?.auth && intake.constraints.auth !== 'không';
    const hasPII = dataSensitivity.includes('cá nhân') || dataSensitivity.includes('personal');
    const hasPayment = dataSensitivity.includes('thanh toán') || dataSensitivity.includes('payment');
    const hasHealth = dataSensitivity.includes('y tế') || dataSensitivity.includes('health');

    const threats = [];
    const mitigations = [];
    const tasks = [];

    // Authentication threats
    if (hasAuth) {
        threats.push('Brute force attacks on login');
        threats.push('Session hijacking');
        mitigations.push('Rate limiting on auth endpoints');
        mitigations.push('Secure session management (httpOnly, secure cookies)');
        tasks.push({ name: 'Implement rate limiting', priority: 'P0', lane: 'security' });
        tasks.push({ name: 'Configure secure session cookies', priority: 'P0', lane: 'security' });
    }

    // PII threats
    if (hasPII) {
        threats.push('Data breach exposing personal information');
        threats.push('Unauthorized access to user data');
        mitigations.push('Encrypt PII at rest and in transit');
        mitigations.push('Implement role-based access control');
        tasks.push({ name: 'Add data encryption for PII fields', priority: 'P0', lane: 'security' });
        tasks.push({ name: 'Implement RBAC for data access', priority: 'P1', lane: 'security' });
    }

    // Payment threats
    if (hasPayment) {
        threats.push('Payment fraud');
        threats.push('Credit card data theft');
        mitigations.push('Use PCI-compliant payment provider (Stripe, PayPal)');
        mitigations.push('Never store raw card numbers');
        tasks.push({ name: 'Integrate PCI-compliant payment gateway', priority: 'P0', lane: 'security' });
    }

    // Health data threats
    if (hasHealth) {
        threats.push('HIPAA/health data compliance violations');
        mitigations.push('Implement audit logging');
        mitigations.push('Consider HIPAA compliance requirements');
        tasks.push({ name: 'Add audit logging for health data access', priority: 'P0', lane: 'security' });
    }

    // OWASP baseline
    const owaspChecklist = [
        { item: 'SQL Injection', check: 'Use parameterized queries/ORM', status: 'pending' },
        { item: 'XSS', check: 'Sanitize user input, use Content-Security-Policy', status: 'pending' },
        { item: 'CSRF', check: 'Use CSRF tokens for state-changing requests', status: 'pending' },
        { item: 'Broken Auth', check: 'Implement proper session management', status: hasAuth ? 'pending' : 'n/a' },
        { item: 'Sensitive Data Exposure', check: 'Use HTTPS, encrypt at rest', status: 'pending' },
        { item: 'Security Misconfiguration', check: 'Review default configs, disable debug in prod', status: 'pending' },
        { item: 'Components with Vulnerabilities', check: 'Run npm audit, keep deps updated', status: 'pending' }
    ];

    return `# Security Review - ${intake.project.name}

## Data Classification

| Category | Has Data | Sensitivity Level |
|----------|----------|-------------------|
| Personal Information (PII) | ${hasPII ? 'Yes' : 'No'} | ${hasPII ? 'High' : 'Low'} |
| Payment Data | ${hasPayment ? 'Yes' : 'No'} | ${hasPayment ? 'Critical' : 'N/A'} |
| Health Data | ${hasHealth ? 'Yes' : 'No'} | ${hasHealth ? 'Critical' : 'N/A'} |
| Authentication | ${hasAuth ? 'Yes' : 'No'} | ${hasAuth ? 'High' : 'Low'} |

## Threat Model

### Identified Threats
${threats.length > 0 ? threats.map((t, i) => `${i + 1}. ${t}`).join('\n') : '- No critical threats identified based on data classification'}

### Mitigations
${mitigations.length > 0 ? mitigations.map((m, i) => `${i + 1}. ${m}`).join('\n') : '- Standard security practices recommended'}

## OWASP Top 10 Checklist

| Vulnerability | Mitigation | Status |
|---------------|------------|--------|
${owaspChecklist.map(c => `| ${c.item} | ${c.check} | ${c.status} |`).join('\n')}

## Secret Handling

- [ ] Use environment variables for secrets (never commit to git)
- [ ] Create .env.example with placeholder values
- [ ] Add .env to .gitignore
- [ ] Document required secrets in DEPLOY.md

## Security Tasks (Add to DAG)

${tasks.length > 0 ? tasks.map((t, i) => `${i + 1}. **${t.name}** (${t.priority}, lane: ${t.lane})`).join('\n') : 'No additional security tasks required for MVP'}

---

*Generated by AI Agent Toolkit - Security Review*
*Run ID: ${intake.run_id}*
`;
};

// Generate Deploy Kit (Layer C)
const generateDeployKit = (intake) => {
    const projectName = generateSlug(intake._raw_answers).replace(/-/g, '_');
    const deployTarget = intake.constraints?.deploy || 'Docker';
    const platform = intake.constraints?.platform || 'web';
    const hasAuth = intake.constraints?.auth && intake.constraints.auth !== 'không';

    const dockerfile = `# Dockerfile for ${intake.project.name}
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "start"]
`;

    const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
${hasAuth ? '      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}\n      - NEXTAUTH_URL=${NEXTAUTH_URL}' : ''}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=\${DB_USER:-postgres}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-postgres}
      - POSTGRES_DB=\${DB_NAME:-${projectName}}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
`;

    const envExample = `# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${projectName}
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=${projectName}

${hasAuth ? `# Authentication
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars
NEXTAUTH_URL=http://localhost:3000
` : ''}
# API Keys (optional)
# BRAVE_API_KEY=
# GITHUB_TOKEN=

# App Config
NODE_ENV=development
PORT=3000
`;

    const deployMd = `# Deploy Guide - ${intake.project.name}

## Quick Start (Docker)

### 1. Prerequisites
- Docker & Docker Compose installed
- Git

### 2. Clone & Configure

\`\`\`bash
git clone <your-repo-url>
cd ${generateSlug(intake._raw_answers)}

# Copy environment file
cp env.example .env

# Edit .env with your values
nano .env
\`\`\`

### 3. Build & Run

\`\`\`bash
# Build and start
docker-compose up -d --build

# Check logs
docker-compose logs -f app

# App will be available at http://localhost:3000
\`\`\`

### 4. Database Migration

\`\`\`bash
# Run migrations
docker-compose exec app npx prisma migrate deploy

# Seed data (if available)
docker-compose exec app npx prisma db seed
\`\`\`

---

## Production Deploy

### Option A: VPS (DigitalOcean, Linode, etc.)

1. SSH into server
2. Install Docker & Docker Compose
3. Clone repo
4. Configure .env with production values
5. Run \`docker-compose -f docker-compose.prod.yml up -d\`
6. Setup reverse proxy (nginx/Caddy)
7. Configure SSL (Let's Encrypt)

### Option B: Vercel (Recommended for Next.js)

1. Push to GitHub
2. Connect repo to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

---

## Monitoring

\`\`\`bash
# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Restart
docker-compose restart

# Stop
docker-compose down
\`\`\`

## Backup

\`\`\`bash
# Backup database
docker-compose exec db pg_dump -U postgres ${projectName} > backup.sql

# Restore
docker-compose exec -T db psql -U postgres ${projectName} < backup.sql
\`\`\`

---

*Generated by AI Agent Toolkit*
*Run ID: ${intake.run_id}*
`;

    return {
        dockerfile,
        dockerCompose,
        envExample,
        deployMd
    };
};

// Generate NEXT_STEPS.md (For users already in IDE - no run_id, use "latest")
const generateNextSteps = (intake, tasks) => {
    const totalHours = tasks.estimated_total_hours;
    const projectName = intake.project.name;
    const taskCount = tasks.total_tasks;

    return `# ${projectName} - Bước Tiếp Theo

## ✅ Hoàn thành! Đã tạo xong bản thiết kế.

Bây giờ bạn có thể bắt đầu code ngay trong IDE này.

---

## 🚀 Cách làm (Ngay trong IDE)

### Bước 1: Yêu cầu AI tạo code

Gõ vào chat của IDE (Claude Code, Cursor, Windsurf...):

> Đọc file artifacts/runs/latest/40_spec/spec.md và bắt đầu implement

### Bước 2: Theo dõi tiến độ

AI sẽ tự động:
- Tạo project structure
- Implement từng tính năng trong spec
- Chạy test và fix lỗi

Bạn chỉ cần xem và confirm khi AI hỏi.

### Bước 3: Chạy thử

Khi AI báo xong, gõ:

> Chạy app để test thử

---

## 📋 Danh sách công việc (${taskCount} tasks)

${tasks.tasks.slice(0, 7).map((t, i) => `${i + 1}. ${t.name}`).join('\n')}
${tasks.tasks.length > 7 ? `\n_(và ${tasks.tasks.length - 7} tasks khác)_` : ''}

---

## 📁 Đường dẫn kết quả

\`\`\`
artifacts/runs/latest/
├── 40_spec/spec.md          ← Đặc tả (gửi cho AI)
├── 40_spec/NEXT_STEPS.md    ← File này
├── deploy/                   ← Docker files
└── ...
\`\`\`

---

## ❓ Gặp vấn đề?

**AI làm sai?** → Nói: "Đọc lại spec.md phần [tên tính năng]"

**Muốn deploy?** → Gõ: \`npx aat deploy\` hoặc xem \`artifacts/runs/latest/deploy/DEPLOY.md\`

**Muốn chạy QA?** → Gõ: \`npx aat qa\`

---

*${projectName} | ${taskCount} tasks | ~${totalHours}h*
`;
};

// Build research query based on project type
const buildResearchQuery = (intake) => {
    const projectType = intake.project?.type || 'web';
    const language = intake.project?.language || intake.constraints?.language;
    const features = intake.scope?.mvp_features?.slice(0, 2) || [];

    // Language-specific query terms
    const langTerms = {
        python: 'python',
        node: 'nodejs typescript',
        dotnet: 'dotnet csharp',
        go: 'golang',
        rust: 'rust',
        java: 'java'
    };

    // Project type-specific query terms
    const typeTerms = {
        cli: 'cli command-line',
        api: 'api rest',
        library: 'library package',
        mobile: 'mobile app',
        web: 'web'
    };

    const langTerm = langTerms[language] || '';
    const typeTerm = typeTerms[projectType] || 'web';
    const featureTerms = features.join(' ');

    // Build query: language + type + features
    const query = `${langTerm} ${typeTerm} ${featureTerms}`.trim();

    return query + ' stars:>100';
};

// Try to run research (best effort)
const tryResearch = async (intake) => {
    if (!process.env.BRAVE_API_KEY && !process.env.GITHUB_TOKEN) {
        return { success: false, note: 'Research skipped (no BRAVE_API_KEY or GITHUB_TOKEN)' };
    }

    // Build project-type specific query
    const query = buildResearchQuery(intake);

    console.log(`  ${c.dim}Search query: ${query}${c.reset}`);

    // Try GitHub search
    const https = require('https');

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`,
            headers: {
                'User-Agent': 'AI-Agent-Toolkit-Vibe',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        if (process.env.GITHUB_TOKEN) {
            options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.items && result.items.length > 0) {
                        const repos = result.items.slice(0, 3).map(r => ({
                            name: r.full_name,
                            url: r.html_url,
                            stars: r.stargazers_count,
                            description: r.description
                        }));
                        resolve({
                            success: true,
                            repos,
                            query,
                            note: `Found ${repos.length} reference repos`
                        });
                    } else {
                        resolve({ success: false, note: 'No reference repos found', query });
                    }
                } catch (e) {
                    resolve({ success: false, note: 'Error parsing response', query });
                }
            });
        });

        req.on('error', () => resolve({ success: false, note: 'GitHub connection error', query }));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve({ success: false, note: 'GitHub search timeout', query });
        });
        req.end();
    });
};

// Main vibe function
const runVibe = async () => {
    const options = parseArgs();

    console.log(`\n${c.magenta}${c.bold}╔══════════════════════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.magenta}${c.bold}║            🎨 VIBE MODE - AI Agent Toolkit                   ║${c.reset}`);
    console.log(`${c.magenta}${c.bold}╚══════════════════════════════════════════════════════════════╝${c.reset}`);
    console.log(`\n${c.dim}Mô tả dự án → Nhận spec + tasks + security + deploy kit${c.reset}\n`);

    // Step 1: Collect answers (interactive or non-interactive)
    let answers;
    if (options.nonInteractive) {
        console.log(`${c.dim}[Non-interactive mode]${c.reset}\n`);
        answers = await getAnswersNonInteractive(options);
    } else {
        answers = await collectAnswers(options.description);
    }

    // Validate required fields
    if (!answers.goal && !answers.features) {
        console.error(`${c.yellow}⚠${c.reset} Missing required fields (goal, features).`);
        console.error(`  In non-interactive mode, provide answers via:`);
        console.error(`    --answers-json '{"goal":"...","features":"..."}'`);
        console.error(`    --answers-file answers.json`);
        console.error(`    --answers-stdin (pipe JSON to stdin)`);
        process.exit(1);
    }

    // Step 2: Generate run ID
    const slug = generateSlug(answers);
    const runId = options.runId || utils.generateRunId?.(slug) || (() => {
        const now = new Date();
        const d = now.toISOString().slice(0, 10).replace(/-/g, '');
        const t = now.toTimeString().slice(0, 5).replace(':', '');
        return `${d}_${t}_${slug}`;
    })();

    // Step 2b: Create run directory immediately
    const runDir = path.join(REPO_ROOT, 'artifacts', 'runs', runId);
    if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
    }

    // Save initial user request
    const userRequestContent = `# User Request\n\n**Description:** ${options.description || '(interactive)'}\n\n**Answers:**\n${JSON.stringify(answers, null, 2)}\n`;
    fs.writeFileSync(path.join(runDir, '00_user_request.md'), userRequestContent);

    console.log(`\n${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}   Đang xử lý... Run ID: ${runId}${c.reset}`);
    console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    // Step 3: Generate intake
    console.log(`${c.yellow}[1/7]${c.reset} Thu thập yêu cầu...`);
    const intake = generateIntake(answers, runId);
    const intakePath = utils.writeArtifact(runId, 'intake', 'intake.json', intake);
    console.log(`  ${c.green}✓${c.reset} Saved: ${intakePath}\n`);

    // Step 4: Try research (best effort)
    console.log(`${c.yellow}[2/7]${c.reset} Nghiên cứu giải pháp...`);
    const research = await tryResearch(intake);
    if (research.success) {
        utils.writeArtifact(runId, 'research', 'research.shortlist.json', {
            run_id: runId,
            repos: research.repos,
            note: research.note
        });
        console.log(`  ${c.green}✓${c.reset} ${research.note}\n`);
    } else {
        console.log(`  ${c.yellow}⚠${c.reset} ${research.note}\n`);
    }

    // Step 5: Generate spec
    console.log(`${c.yellow}[3/7]${c.reset} Tạo specification...`);
    const researchNote = research.success
        ? `Repos tham khảo: ${research.repos.map(r => r.name).join(', ')}`
        : research.note;
    const spec = generateSpec(intake, researchNote);
    const specPath = utils.writeArtifact(runId, 'spec', 'spec.md', spec);
    console.log(`  ${c.green}✓${c.reset} Saved: ${specPath}\n`);

    // Step 6: Generate tasks
    console.log(`${c.yellow}[4/7]${c.reset} Chia nhỏ công việc...`);
    const tasks = generateTasks(intake);
    const tasksPath = utils.writeArtifact(runId, 'spec', 'task_breakdown.json', tasks);
    console.log(`  ${c.green}✓${c.reset} Saved: ${tasksPath}\n`);

    // Step 7: Security Review (Layer C)
    console.log(`${c.yellow}[5/7]${c.reset} Security review...`);
    const securityReview = generateSecurityReview(intake);
    const securityPath = utils.writeArtifact(runId, 'verification', 'security_review.md', securityReview);
    console.log(`  ${c.green}✓${c.reset} Saved: ${securityPath}\n`);

    // Step 8: Deploy Kit (Layer C)
    console.log(`${c.yellow}[6/7]${c.reset} Tạo deploy kit...`);
    const deployKit = generateDeployKit(intake);

    // Create deploy directory using utils
    const deployDir = utils.getArtifactPath(runId, 'deploy');
    if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir, { recursive: true });
    }

    fs.writeFileSync(path.join(deployDir, 'Dockerfile'), deployKit.dockerfile);
    fs.writeFileSync(path.join(deployDir, 'docker-compose.yml'), deployKit.dockerCompose);
    fs.writeFileSync(path.join(deployDir, 'env.example'), deployKit.envExample);
    fs.writeFileSync(path.join(deployDir, 'DEPLOY.md'), deployKit.deployMd);
    console.log(`  ${c.green}✓${c.reset} Saved: ${deployDir}/\n`);

    // Step 9: Generate NEXT_STEPS
    console.log(`${c.yellow}[7/7]${c.reset} Tạo hướng dẫn...`);
    const nextSteps = generateNextSteps(intake, tasks);
    const nextStepsPath = utils.writeArtifact(runId, 'spec', 'NEXT_STEPS.md', nextSteps);
    console.log(`  ${c.green}✓${c.reset} Saved: ${nextStepsPath}\n`);

    // Set this as latest run
    if (utils.setLatestRunId) {
        utils.setLatestRunId(runId);
    } else {
        // Fallback if utils doesn't have setLatestRunId
        const latestFile = path.join(REPO_ROOT, 'artifacts', 'runs', '.latest');
        fs.writeFileSync(latestFile, runId, 'utf8');
    }

    // Summary (Non-coder friendly - show output path, no run_id)
    console.log(`${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.green}${c.bold}   ✅ HOÀN THÀNH!${c.reset}`);
    console.log(`${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    console.log(`${c.bold}📂 Kết quả:${c.reset} ${c.cyan}artifacts/runs/latest/${c.reset}\n`);

    console.log(`${c.bold}Bước tiếp theo:${c.reset}`);
    console.log(`  Gõ vào IDE: ${c.cyan}Đọc file artifacts/runs/latest/40_spec/spec.md và bắt đầu implement${c.reset}\n`);

    return { runId, intake, spec, tasks, securityReview, deployKit };
};

// Run
runVibe().catch(console.error);
