#!/usr/bin/env node
/**
 * Search GitHub Script
 * Tìm kiếm repos trên GitHub dựa trên intake hoặc custom query
 *
 * Outputs to: artifacts/runs/<run_id>/20_research/
 * Reads from: artifacts/runs/<run_id>/10_intake/intake.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

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
            const phases = { 'intake': '10_intake', 'research': '20_research' };
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
        readArtifact: (runId, phase, filename) => {
            const filePath = path.join(utils.getArtifactPath(runId, phase), filename);
            if (!fs.existsSync(filePath)) return null;
            const content = fs.readFileSync(filePath, 'utf8');
            return filename.endsWith('.json') ? JSON.parse(content) : content;
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
        if (args[i] === '--query' && args[i + 1]) options.query = args[++i];
        else if (args[i] === '--run-id' && args[i + 1]) options.runId = args[++i];
        else if (args[i] === '--limit' && args[i + 1]) options.limit = parseInt(args[++i]);
        else if (!args[i].startsWith('--') && !options.query) options.query = args[i];
    }
    return options;
};

const options = parseArgs();
const RUN_ID = options.runId || process.env.RUN_ID || utils.getLatestRunId();

if (!RUN_ID) {
    console.error('[ERROR] No RUN_ID specified. Use --run-id or set RUN_ID env var.');
    console.error('        Or run: npx aat init <project-name>');
    process.exit(1);
}

// GitHub API helper
const githubSearch = async (query, perPage = 10) => {
    const token = process.env.GITHUB_TOKEN || '';
    const searchPath = `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`;

    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: 'api.github.com',
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

// Extract keywords from intake
const extractKeywordsFromIntake = () => {
    const intake = utils.readArtifact(RUN_ID, 'intake', 'intake.json');
    if (!intake) {
        console.log('[!] No intake.json found. Using default search.');
        return null;
    }

    const keywords = [];

    // Project type
    if (intake.project?.type && intake.project.type !== 'TBD') {
        keywords.push(intake.project.type);
    }

    // MVP features as keywords
    if (intake.scope?.mvp_features) {
        intake.scope.mvp_features.slice(0, 3).forEach(f => {
            const words = f.toLowerCase().split(/\s+/).slice(0, 2);
            keywords.push(...words);
        });
    }

    return [...new Set(keywords)].filter(k => k && k !== 'tbd').slice(0, 5);
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
const runSearch = async () => {
    console.log('\n========================================');
    console.log('   GITHUB RESEARCH - Tìm repo mẫu');
    console.log('========================================\n');
    console.log(`Run ID: ${RUN_ID}`);

    let query = options.query;
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
        const result = await githubSearch(query, options.limit || 20);

        if (result.message) {
            console.log(`[ERROR] GitHub API: ${result.message}`);
            if (result.message.includes('rate limit')) {
                console.log('[TIP] Set GITHUB_TOKEN environment variable for higher limits');
            }
            return;
        }

        const repos = (result.items || []).map((repo, index) => {
            const score = parseFloat(calculateScore(repo, keywords));
            const repoText = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
            const matchedKeywords = keywords.filter(k => repoText.includes(k.toLowerCase()));

            return {
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
                relevance_score: score,
                why_relevant: matchedKeywords.length > 0
                    ? `Matches keywords: ${matchedKeywords.join(', ')}`
                    : 'Matched via general search query',
                pattern_to_reuse: repo.topics?.length > 0
                    ? `Reuse patterns from topics: ${repo.topics.slice(0, 3).join(', ')}`
                    : `Follow standard ${repo.language || 'project'} structure`,
                technologies: [repo.language, ...(repo.topics || []).slice(0, 5)].filter(Boolean),
                patterns_found: [],
                strengths: [],
                weaknesses: [],
                notes: ''
            };
        });

        // Sort by relevance
        repos.sort((a, b) => b.relevance_score - a.relevance_score);

        // Take top 10
        const shortlist = repos.slice(0, 10);

        // Print results
        console.log('TOP REPOS:\n');
        shortlist.forEach((repo, i) => {
            console.log(`${i + 1}. ${repo.name}`);
            console.log(`   Stars: ${repo.stars} | Score: ${repo.relevance_score}`);
            console.log(`   Why: ${repo.why_relevant}`);
            console.log(`   URL: ${repo.url}\n`);
        });

        // Build output
        const output = {
            version: '1.1',
            run_id: RUN_ID,
            status: result.items ? 'ok' : 'degraded',
            query: query,
            timestamp: new Date().toISOString(),
            keywords: keywords,
            total_found: result.total_count,
            repos: shortlist,
            summary: {
                total_repos_analyzed: result.items?.length || 0,
                shortlisted: shortlist.length,
                top_languages: [...new Set(shortlist.map(r => r.language))].slice(0, 5)
            }
        };

        // Save artifacts
        const shortlistPath = utils.writeArtifact(RUN_ID, 'research', 'research.shortlist.json', output);

        // Generate patterns.md
        const patternsContent = generatePatternsMarkdown(shortlist, keywords);
        const patternsPath = utils.writeArtifact(RUN_ID, 'research', 'research.patterns.md', patternsContent);

        console.log(`\n[OK] Saved to:`);
        console.log(`  - ${shortlistPath}`);
        console.log(`  - ${patternsPath}`);
        console.log('\nNext steps:');
        console.log(`  1. npx aat debate --run-id ${RUN_ID}`);
        console.log(`  2. npx aat spec --run-id ${RUN_ID}`);

    } catch (error) {
        console.error('[ERROR]', error.message);
    }
};

// Generate patterns markdown
const generatePatternsMarkdown = (repos, keywords) => {
    const languages = [...new Set(repos.map(r => r.language))].filter(l => l !== 'Unknown');
    const allTopics = repos.flatMap(r => r.topics);
    const topicCounts = {};
    allTopics.forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; });
    const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return `# Research Patterns

## Search Summary
- **Query**: ${keywords.join(' ')}
- **Results**: ${repos.length} repos shortlisted
- **Run ID**: ${RUN_ID}

## Common Languages
${languages.map(l => `- ${l}`).join('\n')}

## Popular Topics
${topTopics.map(([topic, count]) => `- ${topic} (${count})`).join('\n')}

## Top Repos by Relevance

${repos.slice(0, 5).map((r, i) => `### ${i + 1}. ${r.name}
- **Stars**: ${r.stars}
- **Language**: ${r.language}
- **License**: ${r.license}
- **Score**: ${r.relevance_score}
- **URL**: ${r.url}

${r.description}
`).join('\n')}

## Patterns Observed
- Most repos use ${languages[0] || 'TypeScript'}
- Common topics: ${topTopics.slice(0, 3).map(t => t[0]).join(', ')}
- Average stars: ${Math.round(repos.reduce((s, r) => s + r.stars, 0) / repos.length)}

---
*Generated by Research Skill | ${new Date().toISOString()}*
`;
};

runSearch();
