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

// Parse args - Extended CLI contract
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        description: null,
        nonInteractive: false,
        answersJson: null,
        answersFile: null,
        answersStdin: false,
        // New flags for DoD compliance
        path: null,           // --path <dir> - output directory
        mode: 'full',         // --mode full|fast - fast = stub outputs
        kind: null,           // --kind cli|api|web|library|mobile - override detection
        language: null,       // --language python|node|go|... - override detection
        auth: null,           // --auth none|email|api-key|oauth - override
        noAuth: false,        // --no-auth - force auth=none
        db: null,             // --db none|postgres|sqlite - override
        noDb: false,          // --no-db - force db=none
        deploy: null,         // --deploy local|docker|vercel|none - override
        fast: false           // --fast - alias for --mode fast
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
        } else if (args[i] === '--path' && args[i + 1]) {
            options.path = args[++i];
        } else if (args[i] === '--mode' && args[i + 1]) {
            options.mode = args[++i];
        } else if (args[i] === '--fast') {
            options.fast = true;
            options.mode = 'fast';
        } else if (args[i] === '--kind' && args[i + 1]) {
            options.kind = args[++i];
        } else if (args[i] === '--language' && args[i + 1]) {
            options.language = args[++i];
        } else if (args[i] === '--auth' && args[i + 1]) {
            options.auth = args[++i];
        } else if (args[i] === '--no-auth') {
            options.noAuth = true;
            options.auth = 'none';
        } else if (args[i] === '--db' && args[i + 1]) {
            options.db = args[++i];
        } else if (args[i] === '--no-db') {
            options.noDb = true;
            options.db = 'none';
        } else if (args[i] === '--deploy' && args[i + 1]) {
            options.deploy = args[++i];
        } else if (!args[i].startsWith('--')) {
            descParts.push(args[i]);
        }
    }
    if (descParts.length > 0) {
        options.description = descParts.join(' ');
    }

    // Auto-detect non-interactive (DoD vNext 3.1)
    if (!process.stdin.isTTY || options.description || options.answersJson || options.answersFile || options.answersStdin) {
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
 * Returns: { type, confidence, signals }
 */
const detectProjectType = (description) => {
    if (!description) {
        return {
            type: null,
            confidence: 0,
            signals: ['no description provided'],
            needsConfirmation: true
        };
    }

    const text = description.toLowerCase();
    const signals = [];

    // Check each project type
    for (const [typeId, typeInfo] of Object.entries(PROJECT_TYPES)) {
        for (const pattern of typeInfo.patterns) {
            if (pattern.test(text)) {
                signals.push(`matched pattern: ${pattern.toString()}`);
                return {
                    type: typeInfo,
                    confidence: 0.9,
                    signals,
                    needsConfirmation: false
                };
            }
        }
    }

    // No match - return null, not web
    return {
        type: null,
        confidence: 0,
        signals: ['no project type patterns matched'],
        needsConfirmation: true
    };
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
// Step 0: Classifier - Generate 05_classify/classify.json
// ============================================

/**
 * Generate classifier output with full schema per DoD
 * @param {string} description - User's project description
 * @param {object} options - CLI flags that can override detection
 * @returns {object} classify.json schema
 */
const generateClassify = (description, options = {}) => {
    const typeResult = detectProjectType(description);
    const detectedLanguage = detectLanguage(description);
    const negations = detectExplicitNegations(description);

    // Build signals array
    const signals = [...(typeResult.signals || [])];
    if (detectedLanguage) signals.push(`detected language: ${detectedLanguage}`);
    if (negations.auth) signals.push('explicit: no auth');
    if (negations.database) signals.push('explicit: no database');
    if (negations.ui) signals.push('explicit: no ui');

    // Build overrides from CLI flags
    const overrides = {};
    if (options.kind) overrides.project_kind = options.kind;
    if (options.language) overrides.language = options.language;
    if (options.auth !== undefined && options.auth !== null) overrides.needs_auth = options.auth;
    if (options.noAuth) overrides.needs_auth = 'none';
    if (options.db !== undefined && options.db !== null) overrides.needs_db = options.db;
    if (options.noDb) overrides.needs_db = 'none';
    if (options.deploy) overrides.deploy = options.deploy;

    // Determine final values (override > detection > safe default)
    const projectKind = overrides.project_kind || typeResult.type?.id || 'unknown';
    const language = overrides.language || detectedLanguage || 'unknown';

    // Auth: override > negation > unknown (not default email)
    let needsAuth = 'unknown';
    if (overrides.needs_auth !== undefined) {
        needsAuth = overrides.needs_auth;
    } else if (negations.auth) {
        needsAuth = 'none';
    } else if (typeResult.type?.id === 'cli' || typeResult.type?.id === 'library') {
        // CLI and library default to no auth
        needsAuth = 'none';
    }

    // DB: override > negation > unknown (not default postgres)
    let needsDb = 'unknown';
    if (overrides.needs_db !== undefined) {
        needsDb = overrides.needs_db;
    } else if (negations.database) {
        needsDb = 'none';
    } else if (typeResult.type?.id === 'cli' || typeResult.type?.id === 'library') {
        // CLI and library default to no db
        needsDb = 'none';
    }

    // Deploy: override > type default > local
    let deploy = 'local';
    if (overrides.deploy) {
        deploy = overrides.deploy;
    } else if (typeResult.type?.defaults?.deploy) {
        deploy = typeResult.type.defaults.deploy;
    }

    // Calculate overall confidence
    let confidence = typeResult.confidence;
    if (projectKind === 'unknown') confidence = 0;
    if (language === 'unknown') confidence = Math.min(confidence, 0.5);
    if (needsAuth === 'unknown') confidence = Math.min(confidence, 0.7);
    if (needsDb === 'unknown') confidence = Math.min(confidence, 0.7);

    return {
        version: '1.0',
        timestamp: new Date().toISOString(),
        input: {
            description: description || '',
            cli_flags: Object.keys(overrides).length > 0 ? overrides : null
        },
        classification: {
            project_kind: projectKind,
            language: language,
            needs_auth: needsAuth,
            needs_db: needsDb,
            deploy: deploy
        },
        confidence: Math.round(confidence * 100) / 100,
        signals: signals,
        overrides: Object.keys(overrides).length > 0 ? overrides : null,
        needs_confirmation: projectKind === 'unknown' || needsAuth === 'unknown' || needsDb === 'unknown'
    };
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
    // Handle both raw type info and classification result
    const typeInfo = projectType?.type || projectType || PROJECT_TYPES.web;
    const defaults = typeInfo.defaults || {};
    const questionIds = typeInfo.questions || ['goal', 'features', 'platform', 'auth', 'data_sensitivity', 'deploy'];

    return questionIds.map(id => ({
        ...BASE_QUESTIONS[id],
        default: defaults[id] || BASE_QUESTIONS[id]?.default || ''
    }));
};

// Legacy VIBE_QUESTIONS for backward compatibility (will be overridden)
const VIBE_QUESTIONS = Object.values(BASE_QUESTIONS);

// Read stdin as string (for --answers-stdin)
const readStdin = () => new Promise((resolve) => {
    if (process.stdin.isTTY) {
        return resolve('');
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', () => resolve(data.trim()));
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
    const description = options?.description || rawAnswers?.goal || '';
    const projectTypeResult = detectProjectType(description);
    const typeInfo = projectTypeResult.type;
    const detectedLanguage = detectLanguage(description);
    const negations = detectExplicitNegations(description);

    console.log(`${c.cyan}[DETECT]${c.reset} Project type: ${typeInfo?.name || 'unknown'}`);
    if (detectedLanguage) {
        console.log(`${c.cyan}[DETECT]${c.reset} Language: ${detectedLanguage}`);
    }
    if (Object.keys(negations).length > 0) {
        console.log(`${c.cyan}[DETECT]${c.reset} Explicit: ${Object.entries(negations).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }

    // Get questions for this project type
    const questions = getQuestionsForType(projectTypeResult);

    // Build answers with smart defaults
    const answers = {
        initial: description,
        _projectType: typeInfo?.id || 'web',
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
        answers.features = extractFeaturesFromDescription(description, typeInfo?.id);
    }

    return answers;
};

/**
 * Extract features from description using simple heuristics
 * Ensures at least 2 items per Gate G3 (DoD vNext 4.2.5)
 */
const extractFeaturesFromDescription = (description, projectType = 'web') => {
    const features = [];
    const text = description.toLowerCase();

    // 1. Look for flag patterns like --health, --version
    const flagMatches = description.match(/--\w+/g);
    if (flagMatches) {
        flagMatches.forEach(f => features.push(f.replace('--', '') + ' flag'));
    }

    // 2. Look for "prints X", "outputs Y", "generates Z"
    const actionMatches = description.match(/(?:prints?|outputs?|generates?|creates?|shows?)\s+["']?([^"',.]+)["']?/gi);
    if (actionMatches) {
        actionMatches.forEach(m => {
            const feature = m.replace(/^(prints?|outputs?|generates?|creates?|shows?)\s+/i, '').trim();
            if (feature) features.push(feature);
        });
    }

    // 3. Fallback/Default features based on project kind to ensure >= 2 items (Gate G3)
    const defaultsByKind = {
        cli: ['--help usage info', '--version info'],
        api: ['health check endpoint', 'api documentation'],
        web: ['home page', 'responsive layout'],
        library: ['core function implementation', 'unit tests'],
        mobile: ['main screen', 'navigation']
    };

    const kindDefaults = defaultsByKind[projectType] || defaultsByKind.web;

    // Add defaults until we have at least 2
    let i = 0;
    while (features.length < 2 && i < kindDefaults.length) {
        if (!features.some(f => f.toLowerCase().includes(kindDefaults[i].split(' ')[0]))) {
            features.push(kindDefaults[i]);
        }
        i++;
    }

    return features.join(', ');
};

// Collect answers (interactive TTY mode)
const collectAnswers = async (initialDescription) => {
    const rl = createRL();
    const answers = {};

    // Detect project type first
    const projectTypeResult = detectProjectType(initialDescription);
    const typeInfo = projectTypeResult.type;
    const detectedLanguage = detectLanguage(initialDescription);
    const negations = detectExplicitNegations(initialDescription);

    console.log(`\n${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}${c.bold}   VIBE MODE - Mô tả dự án của bạn${c.reset}`);
    console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    if (initialDescription) {
        console.log(`${c.dim}Mô tả ban đầu: ${initialDescription}${c.reset}`);
        console.log(`${c.cyan}[DETECT]${c.reset} Project type: ${typeInfo?.name || 'unknown'}`);
        if (detectedLanguage) {
            console.log(`${c.cyan}[DETECT]${c.reset} Language: ${detectedLanguage}`);
        }
        console.log();
        answers.initial = initialDescription;
    }

    answers._projectType = typeInfo?.id || 'web';
    answers._detectedLanguage = detectedLanguage;

    // Get questions for this project type
    const questions = getQuestionsForType(projectTypeResult);

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

    // Build assumptions and open_questions (DoD vNext 4.2.4)
    const assumptions = [];
    const openQuestions = [];

    if (auth === 'none') {
        assumptions.push('No authentication required per prompt');
    }
    if (answers.data_sensitivity === 'none' || !answers.data_sensitivity) {
        assumptions.push('No database/persistence required per prompt');
    }
    if (projectType === 'cli' || projectType === 'library') {
        assumptions.push(`Project type is ${projectType} based on description`);
    }
    if (language) {
        assumptions.push(`Primary language is ${language} based on detection`);
    }

    // Open questions based on unknowns
    if (!projectType || projectType === 'unknown') {
        openQuestions.push('Project type could not be determined from description');
    }
    if (!language || language === 'unknown') {
        openQuestions.push('Programming language not specified');
    }

    return {
        version: '1.1',
        run_id: runId,
        timestamp: new Date().toISOString(),
        mode: 'vibe',
        project: {
            name: generateSlug(answers).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            kind: projectType,
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
            db: answers.data_sensitivity === 'none' ? 'none' : (answers.data_sensitivity ? 'postgres' : 'none'),
            platform: platform,
            language: language,
            data_sensitivity: answers.data_sensitivity || 'none',
            deploy: answers.deploy || 'Docker'
        },
        assumptions: assumptions,
        open_questions: openQuestions,
        _raw_answers: answers
    };
};

// Generate spec from intake (with decisions for out_of_scope)
const generateSpec = (intake, researchNote, decisions = null) => {
    const features = parseFeatures(intake._raw_answers?.features || '');
    const techStack = determineTechStack(intake._raw_answers || {});
    const projectType = intake.project?.type || 'web';
    const language = intake.project?.language || intake.constraints?.language;
    const auth = intake.constraints?.auth || 'none';
    const isAuthRequired = auth !== 'none' && auth !== 'không' && auth !== 'không cần';
    const needsDb = intake.constraints?.data_sensitivity && intake.constraints.data_sensitivity !== 'none';
    const outOfScope = decisions?.out_of_scope || [];

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

### Out of Scope
${outOfScope.length > 0 ? outOfScope.map(s => `- ${s}`).join('\n') : '- None specified'}

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
- **Required:** ${needsDb ? 'Yes' : 'No'}
${!needsDb ? '- *No database/persistence required for this project*' : ''}

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

/**
 * Generate task breakdown (Layer B) - Lane-aware
 */
const generateTasks = (intake, classify = null) => {
    const features = parseFeatures(intake._raw_answers?.features || '');
    const projectKind = classify?.classification?.project_kind || intake.project?.type || 'web';
    const needsAuth = classify?.classification?.needs_auth !== 'none' &&
                      intake.constraints?.auth &&
                      intake.constraints.auth !== 'none';
    const needsDb = classify?.classification?.needs_db !== 'none' &&
                    intake.constraints?.data_sensitivity &&
                    intake.constraints.data_sensitivity !== 'none';

    const tasks = [];
    let taskId = 1;

    // Lanes mapping
    const lanes = projectKind === 'cli' || projectKind === 'library'
        ? { core: 'core', packaging: 'packaging' }
        : { core: 'api', packaging: 'devops' };

    // Setup task
    tasks.push({
        node_id: 'T1',
        title: 'Project Setup',
        owner_lane: 'setup',
        depends_on: [],
        inputs: ['artifacts/runs/latest/10_intake/intake.json'],
        artifact_out: ['package.json'],
        exit_criteria: ['Project structure initialized', 'Dependencies configured'],
        validation_cmd: ['ls package.json']
    });

    // Auth task (conditional)
    if (needsAuth) {
        tasks.push({
            node_id: `T${++taskId}`,
            title: 'Authentication Layer',
            owner_lane: 'security',
            depends_on: ['T1'],
            inputs: ['package.json'],
            artifact_out: ['src/auth/'],
            exit_criteria: ['Auth provider configured', 'Login/session logic implemented'],
            validation_cmd: []
        });
    }

    // Database task (conditional)
    if (needsDb) {
        tasks.push({
            node_id: `T${++taskId}`,
            title: 'Database Schema & Connection',
            owner_lane: 'data',
            depends_on: ['T1'],
            inputs: ['package.json'],
            artifact_out: ['src/db/'],
            exit_criteria: ['DB connection established', 'Initial migrations/schemas created'],
            validation_cmd: []
        });
    }

    // Feature tasks
    const featureNodes = [];

    if (features.length === 0) {
        const id = `T${++taskId}`;
        featureNodes.push(id);
        tasks.push({
            node_id: id,
            title: 'Core Feature Implementation',
            owner_lane: lanes.core,
            depends_on: ['T1'],
            inputs: ['package.json'],
            artifact_out: [],
            exit_criteria: ['Main project functionality implemented'],
            validation_cmd: []
        });
    } else {
        features.forEach((f, i) => {
            const id = `T${++taskId}`;
            featureNodes.push(id);
            tasks.push({
                node_id: id,
                title: f.name,
                owner_lane: lanes.core,
                depends_on: i === 0 ? ['T1'] : [`T${taskId - 1}`],
                inputs: ['package.json'],
                artifact_out: [],
                exit_criteria: [`Feature "${f.name}" implemented`],
                validation_cmd: []
            });
        });
    }

    // Testing task
    const qaId = `T${++taskId}`;
    const language = classify?.classification?.language || 'node';
    const testCmd = language === 'python' ? 'pytest' :
                    language === 'go' ? 'go test ./...' : 'npm test';

    tasks.push({
        node_id: qaId,
        title: 'Testing & QA',
        owner_lane: 'qa',
        depends_on: featureNodes,
        inputs: [],
        artifact_out: ['tests/'],
        exit_criteria: ['All features tested', 'All tests passing'],
        validation_cmd: [testCmd]
    });

    // Deploy/Package task
    tasks.push({
        node_id: `T${++taskId}`,
        title: projectKind === 'library' ? 'Publish Package' : 'Deploy MVP',
        owner_lane: lanes.packaging,
        depends_on: [qaId],
        inputs: [],
        artifact_out: [],
        exit_criteria: ['Project ready for distribution/deployment'],
        validation_cmd: []
    });

    // Determine milestones based on tasks
    const milestones = [
        {
            id: 'M1',
            title: 'Foundation',
            exit_criteria: ['Environment ready', 'Core structure exists'],
            tasks: tasks.slice(0, 3).map(t => t.node_id)
        },
        {
            id: 'M2',
            title: 'Core Features',
            exit_criteria: ['MVP functionality complete'],
            tasks: featureNodes
        },
        {
            id: 'M3',
            title: 'Delivery',
            exit_criteria: ['Verified and Deployed'],
            tasks: tasks.slice(-2).map(t => t.node_id)
        }
    ];

    return {
        milestones,
        tasks,
        provenance: {
            timestamp: new Date().toISOString()
        }
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

// Generate Deploy Kit (Layer C) - Conditional based on project type and db setting
const generateDeployKit = (intake, classify = null) => {
    const projectName = generateSlug(intake._raw_answers).replace(/-/g, '_');
    const projectKind = classify?.classification?.project_kind || intake.project?.type || 'web';
    const language = classify?.classification?.language || intake.project?.language || 'node';
    const deployTarget = classify?.classification?.deploy || intake.constraints?.deploy || 'Docker';
    const needsAuth = classify?.classification?.needs_auth !== 'none' &&
                      intake.constraints?.auth &&
                      intake.constraints.auth !== 'none' &&
                      intake.constraints.auth !== 'không';
    const needsDb = classify?.classification?.needs_db !== 'none' &&
                    intake.constraints?.data_sensitivity &&
                    intake.constraints.data_sensitivity !== 'none';

    let dockerfile = null;
    let dockerCompose = null;
    let envExample = '';
    let deployMd = '';

    // CLI projects - no Docker, package-based deployment
    if (projectKind === 'cli') {
        if (language === 'python') {
            envExample = `# No environment variables needed for CLI tool
# If your CLI needs config, use ~/.config/${projectName}/config.json
`;
            deployMd = `# Deploy Guide - ${intake.project.name} (Python CLI)

## Installation

### From PyPI (when published)
\`\`\`bash
pip install ${projectName.replace(/_/g, '-')}
\`\`\`

### From source
\`\`\`bash
git clone <your-repo-url>
cd ${generateSlug(intake._raw_answers)}
pip install -e .
\`\`\`

## Usage
\`\`\`bash
${projectName.replace(/_/g, '-')} --help
\`\`\`

## Publishing to PyPI
\`\`\`bash
pip install build twine
python -m build
twine upload dist/*
\`\`\`

---
*Generated by AI Agent Toolkit*
`;
        } else {
            envExample = `# No environment variables needed for CLI tool
`;
            deployMd = `# Deploy Guide - ${intake.project.name} (CLI)

## Installation
\`\`\`bash
npm install -g ${projectName.replace(/_/g, '-')}
\`\`\`

## Usage
\`\`\`bash
${projectName.replace(/_/g, '-')} --help
\`\`\`

---
*Generated by AI Agent Toolkit*
`;
        }
    }
    // API projects
    else if (projectKind === 'api') {
        if (language === 'python') {
            dockerfile = `# Dockerfile for ${intake.project.name} (Python API)
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
        } else {
            dockerfile = `# Dockerfile for ${intake.project.name} (Node API)
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
`;
        }

        // Only add db service if needed
        if (needsDb) {
            dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "${language === 'python' ? '8000:8000' : '3000:3000'}"
    environment:
      - DATABASE_URL=\${DATABASE_URL}
${needsAuth ? '      - API_SECRET_KEY=${API_SECRET_KEY}' : ''}
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
            envExample = `# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${projectName}
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=${projectName}

${needsAuth ? '# Authentication\nAPI_SECRET_KEY=your-secret-key-here\n' : ''}
# App Config
PORT=${language === 'python' ? '8000' : '3000'}
`;
        } else {
            // No DB - simpler compose
            dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "${language === 'python' ? '8000:8000' : '3000:3000'}"
    environment:
      - PORT=${language === 'python' ? '8000' : '3000'}
${needsAuth ? '      - API_SECRET_KEY=${API_SECRET_KEY}' : ''}
    restart: unless-stopped
`;
            envExample = `# App Config
PORT=${language === 'python' ? '8000' : '3000'}
${needsAuth ? '\n# Authentication\nAPI_SECRET_KEY=your-secret-key-here\n' : ''}
`;
        }

        deployMd = `# Deploy Guide - ${intake.project.name} (API)

## Local Development
\`\`\`bash
${language === 'python' ? 'pip install -r requirements.txt\nuvicorn main:app --reload' : 'npm install\nnpm run dev'}
\`\`\`

## Docker
\`\`\`bash
docker-compose up -d --build
\`\`\`

## API Endpoints
- Health check: GET /health
- See spec.md for full API documentation

---
*Generated by AI Agent Toolkit*
`;
    }
    // Web projects
    else if (projectKind === 'web' || projectKind === 'mobile') {
        dockerfile = `# Dockerfile for ${intake.project.name}
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "start"]
`;

        if (needsDb) {
            dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
${needsAuth ? '      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}\n      - NEXTAUTH_URL=${NEXTAUTH_URL}' : ''}
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
            envExample = `# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${projectName}
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=${projectName}

${needsAuth ? `# Authentication
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars
NEXTAUTH_URL=http://localhost:3000
` : ''}
# App Config
NODE_ENV=development
PORT=3000
`;
        } else {
            // No DB
            dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
${needsAuth ? '      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}\n      - NEXTAUTH_URL=${NEXTAUTH_URL}' : ''}
    restart: unless-stopped
`;
            envExample = `${needsAuth ? `# Authentication
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars
NEXTAUTH_URL=http://localhost:3000
` : ''}# App Config
NODE_ENV=development
PORT=3000
`;
        }

        deployMd = `# Deploy Guide - ${intake.project.name}

## Local Development
\`\`\`bash
npm install
npm run dev
\`\`\`

## Docker
\`\`\`bash
docker-compose up -d --build
\`\`\`

## Vercel (Recommended)
1. Push to GitHub
2. Connect to Vercel
3. Configure environment variables
4. Deploy

---
*Generated by AI Agent Toolkit*
`;
    }
    // Library projects - no deploy kit
    else {
        envExample = `# No environment variables needed for library
`;
        deployMd = `# Publish Guide - ${intake.project.name} (Library)

## npm
\`\`\`bash
npm publish
\`\`\`

## PyPI
\`\`\`bash
python -m build
twine upload dist/*
\`\`\`

---
*Generated by AI Agent Toolkit*
`;
    }

    return {
        dockerfile,
        dockerCompose,
        envExample,
        deployMd
    };
};

// ============================================
// Step: Decisions - Generate 30_decisions/decisions.json
// ============================================

/**
 * Synthesize decisions from classify + intake + research
 */
const generateDecisions = (classify, intake, research) => {
    const projectKind = classify.classification.project_kind;
    const language = classify.classification.language;
    const needsAuth = classify.classification.needs_auth;
    const needsDb = classify.classification.needs_db;
    const deploy = classify.classification.deploy;

    // Build tech stack decisions
    const techDecisions = [];

    // Language decision
    if (language !== 'unknown') {
        techDecisions.push({
            category: 'language',
            choice: language,
            rationale: `Detected from description`,
            alternatives_considered: [],
            risks: []
        });
    }

    // Framework decision based on project kind
    const frameworkMap = {
        cli: { python: 'argparse/click', node: 'commander', go: 'cobra', rust: 'clap', dotnet: 'System.CommandLine' },
        api: { python: 'FastAPI', node: 'Express/Fastify', go: 'gin/chi', rust: 'actix-web', dotnet: 'ASP.NET Core' },
        web: { node: 'Next.js', python: 'Django/FastAPI' },
        library: { python: 'setuptools', node: 'tsup/esbuild' },
        mobile: { node: 'React Native', dart: 'Flutter' }
    };

    const framework = frameworkMap[projectKind]?.[language] || 'TBD';
    techDecisions.push({
        category: 'framework',
        choice: framework,
        rationale: `Standard for ${projectKind} in ${language}`,
        alternatives_considered: [],
        risks: []
    });

    // Auth decision
    if (needsAuth !== 'none' && needsAuth !== 'unknown') {
        techDecisions.push({
            category: 'authentication',
            choice: needsAuth,
            rationale: 'Per user requirement',
            alternatives_considered: ['none', 'api-key', 'oauth'],
            risks: ['Session management complexity']
        });
    }

    // Database decision
    if (needsDb !== 'none' && needsDb !== 'unknown') {
        techDecisions.push({
            category: 'database',
            choice: needsDb === 'yes' ? 'PostgreSQL' : needsDb,
            rationale: 'Per user requirement',
            alternatives_considered: ['SQLite', 'MongoDB'],
            risks: ['Migration management']
        });
    }

    // Build out of scope list
    const outOfScope = [];
    if (needsAuth === 'none') outOfScope.push('User authentication');
    if (needsDb === 'none') outOfScope.push('Database/data persistence');
    if (projectKind === 'cli' || projectKind === 'api') outOfScope.push('Frontend UI');
    if (projectKind === 'library') outOfScope.push('Deployment infrastructure');

    // Build unknowns/risks
    const unknowns = [];
    if (classify.confidence < 0.7) {
        unknowns.push('Project type classification confidence is low');
    }
    if (needsAuth === 'unknown') {
        unknowns.push('Authentication requirement unclear - defaulting to none');
    }
    if (needsDb === 'unknown') {
        unknowns.push('Database requirement unclear - defaulting to none');
    }

    // Research-based decisions
    const referencePatterns = [];
    if (research.success && research.repos) {
        research.repos.forEach(repo => {
            referencePatterns.push({
                repo: repo.name,
                pattern_to_reuse: repo.description || 'General architecture',
                why_relevant: `${repo.stars} stars, similar ${projectKind} project`
            });
        });
    }

    return {
        version: '1.0',
        run_id: intake.run_id,
        timestamp: new Date().toISOString(),
        summary: {
            project_kind: projectKind,
            language: language,
            auth: needsAuth === 'none' ? 'Not required' : needsAuth,
            database: needsDb === 'none' ? 'Not required' : needsDb,
            deploy: deploy
        },
        tech_decisions: techDecisions,
        out_of_scope: outOfScope,
        unknowns: unknowns,
        reference_patterns: referencePatterns,
        rationale: `This is a ${projectKind} project in ${language}. ${needsAuth === 'none' ? 'No authentication required.' : ''} ${needsDb === 'none' ? 'No database required.' : ''}`
    };
};

// ============================================
// Step: Verification Gate - Generate verification.report.json
// ============================================

/**
 * Cross-check and validate all artifacts
 */
const generateVerificationReport = (classify, intake, decisions, tasks) => {
    const checks = [];
    const errors = [];
    const warnings = [];

    const projectKind = classify.classification.project_kind;
    const language = classify.classification.language;

    // Check 1: Project kind consistency
    const intakeKind = intake.project?.type;
    if (projectKind !== intakeKind) {
        warnings.push(`Project kind mismatch: classify=${projectKind}, intake=${intakeKind}`);
    }
    checks.push({
        id: 'G_KIND_CONSISTENCY',
        status: projectKind === intakeKind ? 'PASS' : 'SKIP',
        message: `classify: ${projectKind}, intake: ${intakeKind}`
    });

    // Check 2: MVP features not empty
    const mvpFeatures = intake.scope?.mvp_features || [];
    if (mvpFeatures.length < 2) {
        errors.push(`MVP features list has ${mvpFeatures.length} items - must have at least 2 items per Gate G3`);
    }
    checks.push({
        id: 'G_MVP_SIZE',
        status: mvpFeatures.length >= 2 ? 'PASS' : 'FAIL',
        message: `${mvpFeatures.length} MVP feature(s) defined (required >= 2)`
    });

    // Check 3: Tasks exist
    const taskCount = tasks?.tasks?.length || 0;
    if (taskCount === 0) {
        errors.push('No tasks generated');
    }
    checks.push({
        id: 'G_TASKS_GENERATED',
        status: taskCount > 0 ? 'PASS' : 'FAIL',
        message: `${taskCount} task(s) generated`
    });

    // Overall status
    const hasErrors = errors.length > 0;
    const overallStatus = hasErrors ? 'FAIL' : 'PASS';

    // Gate object mapping for schema
    const gates = {};
    checks.forEach(c => {
        gates[c.id] = {
            status: c.status,
            message: c.message
        };
    });

    return {
        run_id: intake.run_id,
        status: overallStatus,
        timestamp: new Date().toISOString(),
        gates: gates,
        summary: {
            total_checks: checks.length,
            passed: checks.filter(c => c.status === 'PASS').length,
            failed: checks.filter(c => c.status === 'FAIL').length
        },
        errors: errors,
        warnings: warnings,
        recommendation: hasErrors
            ? 'Fix errors before proceeding to implementation'
            : 'Ready for implementation'
    };
};

// Generate NEXT_STEPS.md (per-kind run commands)
const generateNextSteps = (intake, tasks, classify = null) => {
    const totalHours = tasks.estimated_total_hours;
    const projectName = intake.project.name;
    const taskCount = tasks.total_tasks;
    const projectKind = classify?.classification?.project_kind || intake.project?.type || 'web';
    const language = classify?.classification?.language || intake.project?.language || 'node';

    // Per-kind run commands
    const runCommands = {
        cli: {
            python: `python -m ${projectName.toLowerCase().replace(/\\s+/g, '_')} --help`,
            node: `node index.js --help`,
            default: `./bin/${projectName.toLowerCase().replace(/\\s+/g, '-')} --help`
        },
        api: {
            python: `uvicorn main:app --reload`,
            node: `npm run dev`,
            default: `npm run dev`
        },
        library: {
            python: `pytest`,
            node: `npm test`,
            default: `npm test`
        },
        web: {
            default: `npm run dev`
        },
        mobile: {
            default: `npx expo start`
        }
    };

    const runCmd = runCommands[projectKind]?.[language] || runCommands[projectKind]?.default || 'npm run dev';

    // Per-kind verify success
    const verifyInstructions = {
        cli: `- Run \`${runCmd}\` and check help output`,
        api: `- Run \`curl http://localhost:8000/health\` - should return OK`,
        library: `- Run \`${runCmd}\` - all tests should pass`,
        web: `- Open http://localhost:3000 - should see homepage`,
        mobile: `- Scan QR code with Expo Go app`
    };

    const verify = verifyInstructions[projectKind] || verifyInstructions.web;

    return `# ${projectName} - Next Steps

## ✅ Specification complete!

**Project Type:** ${projectKind}
**Language:** ${language}

---

## 🚀 Getting Started

### Step 1: Ask AI to implement

Tell your IDE AI:

> Read file artifacts/runs/latest/40_spec/spec.md and implement the project

### Step 2: Run locally

\`\`\`bash
${projectKind === 'cli' && language === 'python' ? 'pip install -e .' :
  projectKind === 'api' && language === 'python' ? 'pip install -r requirements.txt' :
  'npm install'}

${runCmd}
\`\`\`

### Step 3: Verify success
${verify}

---

## 📋 Tasks (${taskCount} total)

${tasks.tasks.slice(0, 7).map((t, i) => `${i + 1}. ${t.name}`).join('\n')}
${tasks.tasks.length > 7 ? `\n_(and ${tasks.tasks.length - 7} more)_` : ''}

---

## 📁 Artifacts

\`\`\`
artifacts/runs/latest/
├── 05_classify/classify.json    ← Project classification
├── 10_intake/intake.json        ← Requirements
├── 20_research/                  ← Reference repos
├── 30_decisions/decisions.json  ← Tech decisions
├── 40_spec/spec.md              ← Specification (main)
├── 40_spec/task_breakdown.json  ← Task list
├── 60_verification/             ← Security review
├── deploy/                      ← Deploy kit
├── run_summary.md               ← Summary
└── run.log                      ← Execution log
\`\`\`

---

## ❓ Troubleshooting

**Missing dependencies?**
${projectKind === 'cli' && language === 'python' ? '→ `pip install -e .`' :
  projectKind === 'api' && language === 'python' ? '→ `pip install -r requirements.txt`' :
  '→ `npm install`'}

**Tests failing?**
→ Check spec.md acceptance criteria

**Deploy issues?**
→ See \`artifacts/runs/latest/deploy/DEPLOY.md\`

**Run QA check:**
\`\`\`bash
npx aat qa
\`\`\`

---

*${projectName} | ${projectKind} | ${language} | ${taskCount} tasks*
`;
};

// ============================================
// Generate DEFINITION_OF_DONE.md (Repo-wide DoD)
// ============================================

/**
 * Generate repo-wide Definition of Done file
 * @param {object} classify - Classification result
 * @param {object} intake - Intake document
 * @param {object} decisions - Decisions document
 * @param {object} tasks - Task breakdown
 * @returns {string} DoD markdown content
 */
const generateDefinitionOfDone = (classify, intake, decisions, tasks) => {
    const runId = intake.run_id;
    const projectKind = classify.classification.project_kind;
    const language = classify.classification.language;
    const projectName = intake.project?.name || 'Project';
    const authConstraint = classify.classification.needs_auth || 'none';
    const dbConstraint = classify.classification.needs_db || 'none';
    const deployConstraint = classify.classification.deploy || 'local';
    const mvpFeatures = intake.scope?.mvp_features || [];

    // Build deliverables based on project kind and language
    const deliverables = getDeliverables(projectKind, language);

    // Build acceptance criteria from MVP features
    const acceptanceCriteria = buildAcceptanceCriteria(projectKind, language, mvpFeatures);

    // Build must-not rules from constraints
    const mustNotRules = buildMustNotRules(authConstraint, dbConstraint, projectKind);

    // Build verification commands
    const verificationCommands = buildVerificationCommands(projectKind, language, projectName);

    // YAML metadata header (DoD vNext 11.1)
    const metadata = `---
run_id: ${runId}
project_name: ${projectName}
project_kind: ${projectKind}
language: ${language}
auth_constraint: ${authConstraint}
db_constraint: ${dbConstraint}
deliverables:
${deliverables.map(d => `  - ${d.path}`).join('\n')}
must_not:
${mustNotRules.map(r => `  - ${r.rule}`).join('\n')}
verification_commands:
${verificationCommands.map(c => `  - ${c.command}`).join('\n')}
generated_at: ${new Date().toISOString()}
---`;

    return `${metadata}

# Definition of Done — ${projectName}

> This document defines the acceptance criteria for project completion.
> All checks must pass for the project to be considered DONE.

---

## 1. Repo Deliverables (must exist)

The following files/folders MUST exist in the project root:

${deliverables.map(d => `- [ ] \`${d.path}\` — ${d.description}`).join('\n')}

---

## 2. Functional Acceptance Criteria (MVP)

These criteria are machine-checkable. Each MUST pass:

${acceptanceCriteria.map((c, i) => `### ${i + 1}. ${c.name}
- **Check**: ${c.check}
- **Expected**: ${c.expected}
- **Command**: \`${c.command}\``).join('\n\n')}

---

## 3. Must-NOT Rules (Anti-Drift)

These constraints MUST NOT be violated:

${mustNotRules.map(r => `- ❌ **${r.rule}**
  - Detection: ${r.detection}`).join('\n\n')}

---

## 4. Out of Scope

The following are explicitly OUT OF SCOPE for this project:

${decisions.out_of_scope?.map(s => `- ${s}`).join('\n') || '- None specified'}

---

## 5. Verification Commands

Run these commands to verify the project. ALL must exit with code 0:

\`\`\`bash
${verificationCommands.map(c => `# ${c.description}\n${c.command}`).join('\n\n')}
\`\`\`

---

## 6. Pass Condition

**PASS** = All of the following:
1. All deliverables exist
2. All acceptance criteria pass
3. No must-not rules violated
4. All verification commands exit 0

**FAIL** = Any of the above not met

---

## 7. How to Verify

\`\`\`bash
# Run verification
npx aat verify --run-id ${runId}

# If failed, run fix loop
npx aat loop --run-id ${runId} --max-attempts 3
\`\`\`

---

*Generated by AI Agent Toolkit — Run ID: ${runId}*
`;
};

/**
 * Get required deliverables based on project kind and language
 */
const getDeliverables = (projectKind, language) => {
    const common = [
        { path: 'README.md', description: 'Project documentation' }
    ];

    const byKindAndLang = {
        cli: {
            python: [
                { path: 'src/__init__.py', description: 'Package init (or app.py)' },
                { path: 'pyproject.toml', description: 'Project config (or requirements.txt)' },
                { path: 'tests/', description: 'Test directory' }
            ],
            node: [
                { path: 'package.json', description: 'Package config' },
                { path: 'src/index.js', description: 'Main entry (or bin/)' },
                { path: 'tests/', description: 'Test directory' }
            ],
            dotnet: [
                { path: '*.csproj', description: 'Project file' },
                { path: 'Program.cs', description: 'Entry point' }
            ],
            go: [
                { path: 'go.mod', description: 'Go module file' },
                { path: 'main.go', description: 'Entry point' }
            ],
            default: [
                { path: 'src/', description: 'Source directory' },
                { path: 'tests/', description: 'Test directory' }
            ]
        },
        api: {
            python: [
                { path: 'main.py', description: 'FastAPI/Flask entry' },
                { path: 'requirements.txt', description: 'Dependencies' },
                { path: 'tests/', description: 'Test directory' }
            ],
            node: [
                { path: 'package.json', description: 'Package config' },
                { path: 'src/index.js', description: 'Server entry (or app.js)' },
                { path: 'tests/', description: 'Test directory' }
            ],
            go: [
                { path: 'go.mod', description: 'Go module file' },
                { path: 'main.go', description: 'Server entry' }
            ],
            default: [
                { path: 'src/', description: 'Source directory' },
                { path: 'tests/', description: 'Test directory' }
            ]
        },
        library: {
            python: [
                { path: 'src/', description: 'Source package' },
                { path: 'pyproject.toml', description: 'Build config' },
                { path: 'tests/', description: 'Test directory' }
            ],
            node: [
                { path: 'package.json', description: 'Package config' },
                { path: 'src/index.ts', description: 'Library entry (or index.js)' },
                { path: 'tests/', description: 'Test directory' }
            ],
            default: [
                { path: 'src/', description: 'Source directory' },
                { path: 'tests/', description: 'Test directory' }
            ]
        },
        web: {
            node: [
                { path: 'package.json', description: 'Package config' },
                { path: 'src/', description: 'Source directory (or app/, pages/)' },
                { path: 'public/', description: 'Static assets (optional)' }
            ],
            default: [
                { path: 'src/', description: 'Source directory' },
                { path: 'index.html', description: 'Entry page (or pages/)' }
            ]
        },
        mobile: {
            dart: [
                { path: 'pubspec.yaml', description: 'Flutter config' },
                { path: 'lib/main.dart', description: 'App entry' }
            ],
            default: [
                { path: 'src/', description: 'Source directory' }
            ]
        }
    };

    const kindDeliverables = byKindAndLang[projectKind] || byKindAndLang.cli;
    const langDeliverables = kindDeliverables[language] || kindDeliverables.default || [];

    return [...common, ...langDeliverables];
};

/**
 * Build acceptance criteria from MVP features
 */
const buildAcceptanceCriteria = (projectKind, language, mvpFeatures) => {
    const criteria = [];

    // Always add a health/basic check based on kind
    if (projectKind === 'cli') {
        criteria.push({
            name: 'CLI Help Command',
            check: 'Running --help shows usage',
            expected: 'Exit code 0, output contains usage info',
            command: language === 'python' ? 'python -m app --help' : 'node src/index.js --help'
        });
        criteria.push({
            name: 'CLI Health Check',
            check: 'Running --health prints OK',
            expected: 'Exit code 0, stdout contains "OK"',
            command: language === 'python' ? 'python -m app --health' : 'node src/index.js --health'
        });
    } else if (projectKind === 'api') {
        criteria.push({
            name: 'Health Endpoint',
            check: 'GET /health returns 200',
            expected: 'HTTP 200, JSON {status: "ok"}',
            command: 'curl -s http://localhost:8000/health | grep -q ok'
        });
    } else if (projectKind === 'web') {
        criteria.push({
            name: 'Homepage Loads',
            check: 'GET / returns 200',
            expected: 'HTTP 200, HTML content',
            command: 'curl -s http://localhost:3000/ | head -1'
        });
    } else if (projectKind === 'library') {
        criteria.push({
            name: 'Library Imports',
            check: 'Can import main exports',
            expected: 'No import errors',
            command: language === 'python' ? 'python -c "from src import *"' : 'node -e "require(\'./src\')"'
        });
    }

    // Add criteria from MVP features (first 3)
    mvpFeatures.slice(0, 3).forEach((feature, i) => {
        criteria.push({
            name: `MVP Feature ${i + 1}: ${feature}`,
            check: `Feature "${feature}" works as specified`,
            expected: 'Behavior matches spec',
            command: '# Manual verification or custom test'
        });
    });

    // Tests pass
    criteria.push({
        name: 'All Tests Pass',
        check: 'Unit/integration tests pass',
        expected: 'Exit code 0',
        command: language === 'python' ? 'python -m pytest -q' : 'npm test'
    });

    return criteria;
};

/**
 * Build must-not rules from constraints
 */
const buildMustNotRules = (authConstraint, dbConstraint, projectKind) => {
    const rules = [];

    if (authConstraint === 'none') {
        rules.push({
            rule: 'MUST NOT add authentication',
            detection: 'No login/auth routes, no NEXTAUTH_*, no JWT/session config'
        });
        rules.push({
            rule: 'MUST NOT include auth dependencies',
            detection: 'No next-auth, passport, firebase-auth in dependencies'
        });
    }

    if (dbConstraint === 'none') {
        rules.push({
            rule: 'MUST NOT add database',
            detection: 'No DATABASE_URL, no postgres/mysql/sqlite in docker-compose'
        });
        rules.push({
            rule: 'MUST NOT include ORM/DB dependencies',
            detection: 'No prisma, sequelize, sqlalchemy, typeorm in dependencies'
        });
    }

    if (projectKind === 'cli' || projectKind === 'api') {
        rules.push({
            rule: 'MUST NOT add UI/frontend',
            detection: 'No React, Vue, Angular dependencies; no pages/ or components/'
        });
    }

    if (projectKind === 'library') {
        rules.push({
            rule: 'MUST NOT add runtime server',
            detection: 'No express, fastapi, http server in main code'
        });
    }

    return rules;
};

/**
 * Build verification commands based on project kind and language
 */
const buildVerificationCommands = (projectKind, language, projectName) => {
    const commands = [];

    // Install dependencies
    if (language === 'python') {
        commands.push({
            description: 'Install dependencies',
            command: 'pip install -e . || pip install -r requirements.txt'
        });
    } else if (language === 'node') {
        commands.push({
            description: 'Install dependencies',
            command: 'npm ci || npm install'
        });
    } else if (language === 'go') {
        commands.push({
            description: 'Download dependencies',
            command: 'go mod download'
        });
    }

    // Lint (if applicable)
    if (language === 'python') {
        commands.push({
            description: 'Lint check (optional)',
            command: 'python -m flake8 src/ --max-line-length=120 || true'
        });
    } else if (language === 'node') {
        commands.push({
            description: 'Lint check (optional)',
            command: 'npm run lint || true'
        });
    }

    // Run tests
    if (language === 'python') {
        commands.push({
            description: 'Run tests',
            command: 'python -m pytest -q'
        });
    } else if (language === 'node') {
        commands.push({
            description: 'Run tests',
            command: 'npm test'
        });
    } else if (language === 'go') {
        commands.push({
            description: 'Run tests',
            command: 'go test ./...'
        });
    }

    // Smoke test based on kind
    if (projectKind === 'cli') {
        if (language === 'python') {
            commands.push({
                description: 'Smoke test: CLI health',
                command: `python -m ${projectName.toLowerCase().replace(/\\s+/g, '_')} --health`
            });
        } else {
            commands.push({
                description: 'Smoke test: CLI health',
                command: 'node src/index.js --health'
            });
        }
    } else if (projectKind === 'api') {
        commands.push({
            description: 'Smoke test: Start server and check health',
            command: '# Start server in background, curl /health, then stop'
        });
    }

    return commands;
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
    const runLog = [];
    const log = (msg) => { runLog.push(`[${new Date().toISOString()}] ${msg}`); };

    console.log(`\n${c.magenta}${c.bold}╔══════════════════════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.magenta}${c.bold}║            🎨 VIBE MODE - AI Agent Toolkit                   ║${c.reset}`);
    console.log(`${c.magenta}${c.bold}╚══════════════════════════════════════════════════════════════╝${c.reset}`);
    console.log(`\n${c.dim}Mô tả dự án → Nhận spec + tasks + security + deploy kit${c.reset}\n`);

    log('Vibe mode started');

    // Step 0: Classifier (before collecting answers)
    console.log(`${c.yellow}[0/9]${c.reset} Classifying project...`);
    const classify = generateClassify(options.description, options);
    log(`Classifier: kind=${classify.classification.project_kind}, lang=${classify.classification.language}, conf=${classify.confidence}`);

    // Display classification results
    console.log(`  ${c.cyan}Kind:${c.reset} ${classify.classification.project_kind}`);
    console.log(`  ${c.cyan}Language:${c.reset} ${classify.classification.language}`);
    console.log(`  ${c.cyan}Auth:${c.reset} ${classify.classification.needs_auth}`);
    console.log(`  ${c.cyan}DB:${c.reset} ${classify.classification.needs_db}`);
    console.log(`  ${c.cyan}Confidence:${c.reset} ${Math.round(classify.confidence * 100)}%`);
    if (classify.needs_confirmation) {
        console.log(`  ${c.yellow}⚠ Some fields need confirmation${c.reset}`);
    }
    console.log();

    // Step 1: Collect answers (interactive or non-interactive)
    // Pass classify results to inform question selection
    let answers;
    if (options.nonInteractive) {
        console.log(`${c.dim}[Non-interactive mode]${c.reset}\n`);
        answers = await getAnswersNonInteractive(options);
    } else {
        answers = await collectAnswers(options.description);
    }

    // Apply classifier overrides to answers
    if (classify.classification.project_kind !== 'unknown') {
        answers._projectType = classify.classification.project_kind;
    }
    if (classify.classification.language !== 'unknown') {
        answers._detectedLanguage = classify.classification.language;
    }
    if (classify.classification.needs_auth === 'none') {
        answers.auth = 'none';
    }
    if (classify.classification.needs_db === 'none') {
        answers.data_sensitivity = 'none';
    }

    log(`Answers collected: ${JSON.stringify(Object.keys(answers))}`);

    // Validate required fields
    if (!answers.goal && !answers.features) {
        console.error(`${c.yellow}⚠${c.reset} Missing required fields (goal, features).`);
        console.error(`  In non-interactive mode, provide answers via:`);
        console.error(`    --answers-json '{"goal":"...","features":"..."}'`);
        console.error(`    --answers-file answers.json`);
        console.error(`    --answers-stdin (pipe JSON to stdin)`);
        process.exit(1);
    }

    // Step 2: Generate run ID and create directory structure
    const slug = generateSlug(answers);
    const runId = options.runId || utils.generateRunId?.(slug) || (() => {
        const now = new Date();
        const d = now.toISOString().slice(0, 10).replace(/-/g, '');
        const t = now.toTimeString().slice(0, 5).replace(':', '');
        return `${d}_${t}_${slug}`;
    })();

    log(`Run ID: ${runId}`);

    // Create all required directories
    const runDir = options.path || path.join(REPO_ROOT, 'artifacts', 'runs', runId);
    const dirs = [
        runDir,
        path.join(runDir, '00_user_request'),
        path.join(runDir, '05_classify'),
        path.join(runDir, '10_intake'),
        path.join(runDir, '20_research'),
        path.join(runDir, '30_decisions'),
        path.join(runDir, '40_spec'),
        path.join(runDir, '60_verification'),
        path.join(runDir, 'deploy')
    ];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // Save initial user request
    const userRequestContent = `# User Request\n\n**Description:** ${options.description || '(interactive)'}\n\n**Answers:**\n${JSON.stringify(answers, null, 2)}\n`;
    fs.writeFileSync(path.join(runDir, '00_user_request', 'request.md'), userRequestContent);

    console.log(`\n${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}   Đang xử lý... Run ID: ${runId}${c.reset}`);
    console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    // Step 0b: Save classify.json
    console.log(`${c.yellow}[1/9]${c.reset} Saving classification...`);
    classify.run_id = runId;
    fs.writeFileSync(path.join(runDir, '05_classify', 'classify.json'), JSON.stringify(classify, null, 2));
    console.log(`  ${c.green}✓${c.reset} Saved: 05_classify/classify.json\n`);
    log('Classify saved');

    // Step 3: Generate intake
    console.log(`${c.yellow}[2/9]${c.reset} Thu thập yêu cầu...`);
    const intake = generateIntake(answers, runId);
    // Sync intake with classify decisions
    intake.constraints.auth = classify.classification.needs_auth === 'none' ? 'none' : intake.constraints.auth;
    intake.constraints.data_sensitivity = classify.classification.needs_db === 'none' ? 'none' : intake.constraints.data_sensitivity;
    fs.writeFileSync(path.join(runDir, '10_intake', 'intake.json'), JSON.stringify(intake, null, 2));
    console.log(`  ${c.green}✓${c.reset} Saved: 10_intake/intake.json\n`);
    log('Intake saved');

    // Step 4: Try research (best effort)
    console.log(`${c.yellow}[3/9]${c.reset} Nghiên cứu giải pháp...`);
    const research = await tryResearch(intake);
    const researchResult = {
        run_id: runId,
        timestamp: new Date().toISOString(),
        query: research.query || null,
        status: research.success ? 'ok' : 'degraded',
        repos: research.success ? research.repos.map(r => ({
            name: r.name,
            url: r.url,
            stars: r.stars,
            description: r.description,
            why_relevant: `${classify.classification.project_kind} project with ${r.stars} stars`,
            pattern_to_reuse: r.description || 'General architecture',
            relevance_score: Math.min(1, r.stars / 10000)
        })) : [],
        note: research.note
    };
    fs.writeFileSync(path.join(runDir, '20_research', 'research.shortlist.json'), JSON.stringify(researchResult, null, 2));
    if (research.success) {
        console.log(`  ${c.green}✓${c.reset} ${research.note}\n`);
    } else {
        console.log(`  ${c.yellow}⚠${c.reset} ${research.note} (status: degraded)\n`);
    }
    log(`Research: ${research.note}`);

    // Step 5: Generate decisions
    console.log(`${c.yellow}[4/9]${c.reset} Synthesizing decisions...`);
    const decisions = generateDecisions(classify, intake, research);
    fs.writeFileSync(path.join(runDir, '30_decisions', 'decisions.json'), JSON.stringify(decisions, null, 2));
    console.log(`  ${c.green}✓${c.reset} Saved: 30_decisions/decisions.json`);
    console.log(`  ${c.dim}Out of scope: ${decisions.out_of_scope.join(', ') || 'none'}${c.reset}\n`);
    log(`Decisions: out_of_scope=${decisions.out_of_scope.length}`);

    // Step 6: Generate spec (with out_of_scope from decisions)
    console.log(`${c.yellow}[5/9]${c.reset} Tạo specification...`);
    const researchNote = research.success
        ? `Repos tham khảo: ${research.repos.map(r => r.name).join(', ')}`
        : research.note;
    // Pass decisions to spec for out_of_scope
    const spec = generateSpec(intake, researchNote, decisions);
    fs.writeFileSync(path.join(runDir, '40_spec', 'spec.md'), spec);
    console.log(`  ${c.green}✓${c.reset} Saved: 40_spec/spec.md\n`);
    log('Spec saved');

    // Step 7: Generate tasks (lane-aware)
    console.log(`${c.yellow}[6/10]${c.reset} Chia nhỏ công việc...`);
    const tasks = generateTasks(intake, classify);
    fs.writeFileSync(path.join(runDir, '40_spec', 'task_breakdown.json'), JSON.stringify(tasks, null, 2));
    console.log(`  ${c.green}✓${c.reset} Saved: 40_spec/task_breakdown.json (${tasks.total_tasks} tasks)\n`);
    log(`Tasks: ${tasks.total_tasks}`);

    // Step 7: Generate DEFINITION_OF_DONE.md (Repo-wide DoD)
    console.log(`${c.yellow}[7/10]${c.reset} Tạo Definition of Done...`);
    const dodContent = generateDefinitionOfDone(classify, intake, decisions, tasks);
    fs.writeFileSync(path.join(runDir, '40_spec', 'DEFINITION_OF_DONE.md'), dodContent);
    console.log(`  ${c.green}✓${c.reset} Saved: 40_spec/DEFINITION_OF_DONE.md\n`);
    log('DoD generated');

    // Step 8: Security Review + Verification Report
    console.log(`${c.yellow}[8/10]${c.reset} Security review & verification...`);
    const securityReview = generateSecurityReview(intake);
    fs.writeFileSync(path.join(runDir, '60_verification', 'security_review.md'), securityReview);

    const verificationReport = generateVerificationReport(classify, intake, decisions, tasks);
    fs.writeFileSync(path.join(runDir, '60_verification', 'verification.report.json'), JSON.stringify(verificationReport, null, 2));

    console.log(`  ${c.green}✓${c.reset} Saved: 60_verification/security_review.md`);
    console.log(`  ${c.green}✓${c.reset} Saved: 60_verification/verification.report.json`);
    console.log(`  ${c.dim}Status: ${verificationReport.overall_status} (${verificationReport.summary.passed}/${verificationReport.summary.total_checks} checks passed)${c.reset}\n`);
    log(`Verification: ${verificationReport.overall_status}`);

    // Step 9: Deploy Kit (conditional based on project type and db setting)
    console.log(`${c.yellow}[9/10]${c.reset} Tạo deploy kit...`);
    const projectKind = classify.classification.project_kind;
    const needsDb = classify.classification.needs_db !== 'none';
    const deployTarget = classify.classification.deploy;

    // Only generate deploy kit for deployable projects
    if (projectKind === 'library') {
        console.log(`  ${c.dim}Skipped (library projects use package registry)${c.reset}\n`);
        fs.writeFileSync(path.join(runDir, 'deploy', 'README.md'), '# Deploy\n\nThis is a library project. Deploy via package registry (npm/pip/nuget).\n');
    } else if (deployTarget === 'none' || deployTarget === 'local') {
        console.log(`  ${c.dim}Skipped (deploy=${deployTarget})${c.reset}\n`);
        fs.writeFileSync(path.join(runDir, 'deploy', 'README.md'), `# Deploy\n\nDeploy target: ${deployTarget}\n\nNo deployment infrastructure generated.\n`);
    } else {
        // Generate deploy kit with proper conditionals
        const deployKit = generateDeployKit(intake, classify);
        const deployDir = path.join(runDir, 'deploy');

        if (deployKit.dockerfile) {
            fs.writeFileSync(path.join(deployDir, 'Dockerfile'), deployKit.dockerfile);
        }
        if (deployKit.dockerCompose) {
            fs.writeFileSync(path.join(deployDir, 'docker-compose.yml'), deployKit.dockerCompose);
        }
        fs.writeFileSync(path.join(deployDir, 'env.example'), deployKit.envExample);
        fs.writeFileSync(path.join(deployDir, 'DEPLOY.md'), deployKit.deployMd);
        console.log(`  ${c.green}✓${c.reset} Saved: deploy/\n`);
    }
    log('Deploy kit saved');

    // Step 10: Generate NEXT_STEPS (per-kind)
    console.log(`${c.yellow}[10/10]${c.reset} Tạo hướng dẫn...`);
    const nextSteps = generateNextSteps(intake, tasks, classify);
    fs.writeFileSync(path.join(runDir, '40_spec', 'NEXT_STEPS.md'), nextSteps);
    console.log(`  ${c.green}✓${c.reset} Saved: 40_spec/NEXT_STEPS.md\n`);

    // Save run.log
    log('Vibe mode completed');
    fs.writeFileSync(path.join(runDir, 'run.log'), runLog.join('\n'));

    // Generate run_summary.md
    const runSummary = `# Run Summary

**Run ID:** ${runId}
**Timestamp:** ${new Date().toISOString()}

## Classification
- **Project Kind:** ${classify.classification.project_kind}
- **Language:** ${classify.classification.language}
- **Auth:** ${classify.classification.needs_auth}
- **Database:** ${classify.classification.needs_db}
- **Confidence:** ${Math.round(classify.confidence * 100)}%

## Verification
- **Status:** ${verificationReport.overall_status}
- **Checks:** ${verificationReport.summary.passed}/${verificationReport.summary.total_checks} passed
${verificationReport.errors.length > 0 ? `- **Errors:** ${verificationReport.errors.join(', ')}` : ''}
${verificationReport.warnings.length > 0 ? `- **Warnings:** ${verificationReport.warnings.join(', ')}` : ''}

## Artifacts Generated
- 00_user_request/request.md
- 05_classify/classify.json
- 10_intake/intake.json
- 20_research/research.shortlist.json
- 30_decisions/decisions.json
- 40_spec/spec.md
- 40_spec/task_breakdown.json
- 40_spec/DEFINITION_OF_DONE.md
- 40_spec/NEXT_STEPS.md
- 60_verification/security_review.md
- 60_verification/verification.report.json
- deploy/
- run.log
- run_summary.md

## Next Steps
${verificationReport.recommendation}
`;
    fs.writeFileSync(path.join(runDir, 'run_summary.md'), runSummary);

    // Set this as latest run
    if (utils.setLatestRunId) {
        utils.setLatestRunId(runId);
    } else {
        const runsDir = options.path ? path.dirname(runDir) : path.join(REPO_ROOT, 'artifacts', 'runs');
        const latestFile = path.join(runsDir, '.latest');
        fs.writeFileSync(latestFile, runId, 'utf8');
    }

    // Summary (Non-coder friendly - show output path, no run_id)
    console.log(`${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.green}${c.bold}   ✅ HOÀN THÀNH!${c.reset}`);
    console.log(`${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    console.log(`${c.bold}📂 Kết quả:${c.reset} ${c.cyan}artifacts/runs/latest/${c.reset}\n`);

    // Show verification status
    if (verificationReport.overall_status === 'fail') {
        console.log(`${c.yellow}⚠ Verification failed:${c.reset}`);
        verificationReport.errors.forEach(e => console.log(`  - ${e}`));
        console.log();
        process.exit(1);  // Exit code 1 for gate/verification failure (DoD 3.3)
    }

    console.log(`${c.bold}Bước tiếp theo:${c.reset}`);
    console.log(`  Gõ vào IDE: ${c.cyan}Đọc file artifacts/runs/latest/40_spec/spec.md và bắt đầu implement${c.reset}\n`);

    return { runId, classify, intake, decisions, spec, tasks, verificationReport };
};

// Run
runVibe().catch(e => {
    console.error(`[ERROR] ${e.message || e}`);
    process.exit(2);  // Exit code 2 for runtime error (DoD 3.3)
});
