#!/usr/bin/env node
/**
 * Search GitHub Script
 * Tìm kiếm repos trên GitHub dựa trên intake hoặc custom query
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.resolve(__dirname, '../../../../output/research');
const INTAKE_FILE = path.resolve(__dirname, '../../../../output/intake/intake.md');
const SHORTLIST_FILE = path.join(OUTPUT_DIR, 'shortlist.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// GitHub API helper
const githubSearch = async (query, options = {}) => {
    const token = process.env.GITHUB_TOKEN || '';
    const baseUrl = 'api.github.com';
    const searchPath = `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${options.perPage || 10}`;

    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: baseUrl,
            path: searchPath,
            method: 'GET',
            headers: {
                'User-Agent': 'AI-Agent-Toolkit-Research',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        if (token) {
            reqOptions.headers['Authorization'] = `token ${token}`;
        }

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
};

// Extract keywords from intake
const extractKeywordsFromIntake = () => {
    if (!fs.existsSync(INTAKE_FILE)) {
        console.log('[!] No intake file found. Using default search.');
        return null;
    }

    const content = fs.readFileSync(INTAKE_FILE, 'utf8');
    const keywords = [];

    // Extract project type
    const typeMatch = content.match(/\*\*Type\*\*:\s*(.+)/);
    if (typeMatch) keywords.push(typeMatch[1].trim());

    // Extract tech stack
    const techMatch = content.match(/\*\*Tech Stack\*\*:\s*(.+)/);
    if (techMatch && techMatch[1] !== 'TBD') {
        keywords.push(...techMatch[1].split(/[,\/]/).map(t => t.trim()));
    }

    // Extract from features
    const featureMatches = content.match(/^\d+\.\s+(.+)$/gm);
    if (featureMatches) {
        featureMatches.slice(0, 3).forEach(f => {
            const feature = f.replace(/^\d+\.\s+/, '').toLowerCase();
            if (!feature.includes('tbd')) keywords.push(feature);
        });
    }

    return keywords.filter(k => k && k !== 'TBD').slice(0, 5);
};

// Calculate relevance score
const calculateScore = (repo, keywords = []) => {
    let score = 0;

    // Stars (normalized)
    score += Math.min(repo.stargazers_count / 10000, 1) * 0.2;

    // Recent activity
    const lastUpdate = new Date(repo.pushed_at);
    const monthsAgo = (Date.now() - lastUpdate) / (1000 * 60 * 60 * 24 * 30);
    score += Math.max(0, 1 - monthsAgo / 12) * 0.25;

    // Has description
    if (repo.description) score += 0.1;

    // Has homepage/docs
    if (repo.homepage) score += 0.1;

    // Keywords match
    const repoText = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
    const matches = keywords.filter(k => repoText.includes(k.toLowerCase())).length;
    score += (matches / Math.max(keywords.length, 1)) * 0.15;

    // License (MIT, Apache preferred)
    if (repo.license?.spdx_id === 'MIT' || repo.license?.spdx_id === 'Apache-2.0') {
        score += 0.1;
    }

    return Math.min(score, 1).toFixed(2);
};

// Main search function
const runSearch = async (customQuery) => {
    console.log('\n========================================');
    console.log('   GITHUB RESEARCH - Tìm repo mẫu');
    console.log('========================================\n');

    let query = customQuery;
    let keywords = [];

    if (!query) {
        keywords = extractKeywordsFromIntake() || ['react', 'typescript', 'template'];
        query = keywords.join(' ') + ' stars:>100';
        console.log(`[INFO] Using keywords from intake: ${keywords.join(', ')}`);
    } else {
        keywords = query.split(' ').filter(w => !w.includes(':'));
    }

    console.log(`[SEARCH] Query: ${query}\n`);

    try {
        const result = await githubSearch(query, { perPage: 20 });

        if (result.message) {
            console.log(`[ERROR] GitHub API: ${result.message}`);
            if (result.message.includes('rate limit')) {
                console.log('[TIP] Set GITHUB_TOKEN environment variable for higher limits');
            }
            return;
        }

        const repos = (result.items || []).map((repo, index) => ({
            rank: index + 1,
            name: repo.full_name,
            url: repo.html_url,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            last_updated: repo.pushed_at.split('T')[0],
            description: repo.description || '',
            language: repo.language || 'Unknown',
            license: repo.license?.spdx_id || 'Unknown',
            topics: repo.topics || [],
            relevance_score: parseFloat(calculateScore(repo, keywords)),
            technologies: [repo.language, ...(repo.topics || []).slice(0, 5)].filter(Boolean),
            patterns_found: [],
            strengths: [],
            weaknesses: [],
            notes: ''
        }));

        // Sort by relevance
        repos.sort((a, b) => b.relevance_score - a.relevance_score);

        // Take top 10
        const shortlist = repos.slice(0, 10);

        // Print results
        console.log('TOP REPOS:\n');
        shortlist.forEach((repo, i) => {
            console.log(`${i + 1}. ${repo.name}`);
            console.log(`   Stars: ${repo.stars} | Score: ${repo.relevance_score}`);
            console.log(`   ${repo.description.slice(0, 80)}...`);
            console.log(`   URL: ${repo.url}\n`);
        });

        // Save to file
        const output = {
            query: query,
            timestamp: new Date().toISOString(),
            intake_source: fs.existsSync(INTAKE_FILE) ? 'output/intake/intake.md' : null,
            keywords: keywords,
            total_found: result.total_count,
            repos: shortlist,
            summary: {
                total_repos_analyzed: result.items?.length || 0,
                shortlisted: shortlist.length,
                top_languages: [...new Set(shortlist.map(r => r.language))].slice(0, 5)
            }
        };

        fs.writeFileSync(SHORTLIST_FILE, JSON.stringify(output, null, 2), 'utf8');
        console.log(`\n[OK] Saved to: ${SHORTLIST_FILE}`);
        console.log('\nNext steps:');
        console.log('  1. Run analyze-repo.js on top results');
        console.log('  2. Run generate-report.js to create patterns.md');

    } catch (error) {
        console.error('[ERROR]', error.message);
    }
};

// Parse args
const args = process.argv.slice(2);
let customQuery = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--query' && args[i + 1]) {
        customQuery = args[i + 1];
    }
}

runSearch(customQuery);
