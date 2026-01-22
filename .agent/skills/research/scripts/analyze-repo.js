#!/usr/bin/env node
/**
 * Analyze Repo Script
 * Phân tích chi tiết một GitHub repo
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.resolve(__dirname, '../../../../output/research');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// GitHub API helper
const githubGet = async (path) => {
    const token = process.env.GITHUB_TOKEN || '';

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: path,
            method: 'GET',
            headers: {
                'User-Agent': 'AI-Agent-Toolkit-Research',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `token ${token}`;
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
};

// Analyze repo structure
const analyzeStructure = (tree) => {
    const patterns = [];
    const dirs = tree.filter(t => t.type === 'tree').map(t => t.path);
    const files = tree.filter(t => t.type === 'blob').map(t => t.path);

    // Check for common patterns
    if (dirs.includes('src')) patterns.push('src-based structure');
    if (dirs.includes('app')) patterns.push('app directory (Next.js 13+)');
    if (dirs.includes('pages')) patterns.push('pages-based routing');
    if (dirs.includes('components')) patterns.push('component-based architecture');
    if (dirs.includes('lib') || dirs.includes('utils')) patterns.push('utility/lib folder');
    if (dirs.includes('tests') || dirs.includes('__tests__')) patterns.push('test folder');
    if (dirs.includes('packages')) patterns.push('monorepo structure');
    if (dirs.includes('docker') || files.includes('Dockerfile')) patterns.push('Docker support');
    if (dirs.includes('prisma')) patterns.push('Prisma ORM');

    // Check for config files
    if (files.includes('tsconfig.json')) patterns.push('TypeScript');
    if (files.includes('tailwind.config.js') || files.includes('tailwind.config.ts')) patterns.push('Tailwind CSS');
    if (files.includes('next.config.js') || files.includes('next.config.mjs')) patterns.push('Next.js');
    if (files.includes('vite.config.ts')) patterns.push('Vite');
    if (files.includes('turbo.json')) patterns.push('Turborepo');
    if (files.includes('.eslintrc.json') || files.includes('eslint.config.js')) patterns.push('ESLint');
    if (files.includes('jest.config.js') || files.includes('vitest.config.ts')) patterns.push('Unit testing');
    if (files.includes('playwright.config.ts')) patterns.push('E2E testing (Playwright)');

    return patterns;
};

// Analyze dependencies
const analyzeDependencies = (packageJson) => {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const notable = [];

    const notablePackages = {
        'next': 'Next.js Framework',
        'react': 'React',
        '@tanstack/react-query': 'TanStack Query',
        'zustand': 'Zustand State Management',
        'zod': 'Zod Validation',
        'trpc': 'tRPC',
        '@trpc/server': 'tRPC Server',
        'prisma': 'Prisma ORM',
        '@prisma/client': 'Prisma Client',
        'drizzle-orm': 'Drizzle ORM',
        'tailwindcss': 'Tailwind CSS',
        '@radix-ui': 'Radix UI',
        'shadcn': 'shadcn/ui',
        'framer-motion': 'Framer Motion',
        'vitest': 'Vitest',
        'jest': 'Jest',
        'playwright': 'Playwright'
    };

    for (const [pkg, desc] of Object.entries(notablePackages)) {
        if (Object.keys(deps).some(d => d.includes(pkg))) {
            notable.push({ package: pkg, description: desc });
        }
    }

    return notable;
};

// Main analyze function
const analyzeRepo = async (repoName) => {
    console.log('\n========================================');
    console.log('   REPO ANALYSIS');
    console.log('========================================\n');
    console.log(`[INFO] Analyzing: ${repoName}\n`);

    try {
        // Get repo info
        const repo = await githubGet(`/repos/${repoName}`);
        if (repo.message) {
            console.log(`[ERROR] ${repo.message}`);
            return;
        }

        // Get repo tree
        const tree = await githubGet(`/repos/${repoName}/git/trees/${repo.default_branch}?recursive=1`);

        // Get package.json if exists
        let packageJson = null;
        try {
            const pkgContent = await githubGet(`/repos/${repoName}/contents/package.json`);
            if (pkgContent.content) {
                packageJson = JSON.parse(Buffer.from(pkgContent.content, 'base64').toString());
            }
        } catch (e) {
            // No package.json
        }

        // Analyze
        const patterns = analyzeStructure(tree.tree || []);
        const dependencies = packageJson ? analyzeDependencies(packageJson) : [];

        // Build report
        const analysis = {
            name: repo.full_name,
            url: repo.html_url,
            description: repo.description,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            license: repo.license?.spdx_id || 'Unknown',
            topics: repo.topics || [],
            default_branch: repo.default_branch,
            last_updated: repo.pushed_at,
            patterns_found: patterns,
            notable_dependencies: dependencies,
            folder_structure: (tree.tree || [])
                .filter(t => t.type === 'tree' && !t.path.includes('/'))
                .map(t => t.path),
            config_files: (tree.tree || [])
                .filter(t => t.type === 'blob' && !t.path.includes('/'))
                .map(t => t.path)
                .filter(f => f.includes('config') || f.startsWith('.') || f.includes('.json'))
        };

        // Print
        console.log('REPO INFO:');
        console.log(`  Name: ${analysis.name}`);
        console.log(`  Stars: ${analysis.stars} | Forks: ${analysis.forks}`);
        console.log(`  Language: ${analysis.language}`);
        console.log(`  License: ${analysis.license}`);
        console.log(`  Topics: ${analysis.topics.join(', ')}`);

        console.log('\nPATTERNS FOUND:');
        patterns.forEach(p => console.log(`  - ${p}`));

        console.log('\nFOLDER STRUCTURE:');
        analysis.folder_structure.forEach(f => console.log(`  /${f}`));

        if (dependencies.length > 0) {
            console.log('\nNOTABLE DEPENDENCIES:');
            dependencies.forEach(d => console.log(`  - ${d.package}: ${d.description}`));
        }

        // Save
        const outputFile = path.join(OUTPUT_DIR, `analysis-${repoName.replace('/', '-')}.json`);
        fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2), 'utf8');
        console.log(`\n[OK] Saved to: ${outputFile}`);

    } catch (error) {
        console.error('[ERROR]', error.message);
    }
};

// Parse args
const args = process.argv.slice(2);
let repoName = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) {
        repoName = args[i + 1];
    }
}

if (!repoName) {
    console.log('Usage: node analyze-repo.js --repo owner/repo-name');
    console.log('Example: node analyze-repo.js --repo vercel/next.js');
    process.exit(1);
}

analyzeRepo(repoName);
