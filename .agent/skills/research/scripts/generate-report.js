#!/usr/bin/env node
/**
 * Generate Report Script
 * Tổng hợp research thành patterns.md
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../../../output/research');
const SHORTLIST_FILE = path.join(OUTPUT_DIR, 'shortlist.json');
const PATTERNS_FILE = path.join(OUTPUT_DIR, 'patterns.md');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load all analysis files
const loadAnalyses = () => {
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('analysis-'));
    return files.map(f => {
        try {
            return JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8'));
        } catch (e) {
            return null;
        }
    }).filter(Boolean);
};

// Generate patterns report
const generateReport = () => {
    console.log('\n========================================');
    console.log('   GENERATING PATTERNS REPORT');
    console.log('========================================\n');

    // Load shortlist
    let shortlist = { repos: [], keywords: [] };
    if (fs.existsSync(SHORTLIST_FILE)) {
        shortlist = JSON.parse(fs.readFileSync(SHORTLIST_FILE, 'utf8'));
    }

    // Load analyses
    const analyses = loadAnalyses();

    // Aggregate patterns
    const allPatterns = {};
    const allDeps = {};

    analyses.forEach(a => {
        (a.patterns_found || []).forEach(p => {
            allPatterns[p] = (allPatterns[p] || 0) + 1;
        });
        (a.notable_dependencies || []).forEach(d => {
            allDeps[d.package] = {
                description: d.description,
                count: (allDeps[d.package]?.count || 0) + 1
            };
        });
    });

    // Sort by frequency
    const topPatterns = Object.entries(allPatterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const topDeps = Object.entries(allDeps)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 15);

    // Generate markdown
    const timestamp = new Date().toISOString();
    const report = `# Research Patterns Report

## Context
- **Search Keywords**: ${shortlist.keywords?.join(', ') || 'N/A'}
- **Search Date**: ${timestamp}
- **Repos in Shortlist**: ${shortlist.repos?.length || 0}
- **Repos Analyzed (Deep)**: ${analyses.length}

---

## Top Repos

${shortlist.repos?.slice(0, 5).map((r, i) => `### ${i + 1}. [${r.name}](${r.url})
- **Stars**: ${r.stars} | **Score**: ${r.relevance_score}
- **Language**: ${r.language}
- **Description**: ${r.description}
- **Technologies**: ${r.technologies?.join(', ') || 'N/A'}
`).join('\n') || 'No repos found'}

---

## Common Patterns Found

| Pattern | Frequency | Notes |
|---------|-----------|-------|
${topPatterns.map(([pattern, count]) => `| ${pattern} | ${count}/${analyses.length} repos | Common practice |`).join('\n') || '| No patterns found | - | - |'}

---

## Recommended Technology Stack

Based on analysis of ${analyses.length} repos:

### Frontend
| Technology | Usage | Recommendation |
|------------|-------|----------------|
${topDeps.filter(([pkg]) => ['react', 'next', 'vue', 'svelte', 'tailwindcss'].some(t => pkg.includes(t)))
    .map(([pkg, data]) => `| ${pkg} | ${data.count} repos | ${data.description} |`).join('\n') || '| TBD | - | - |'}

### Backend / Data
| Technology | Usage | Recommendation |
|------------|-------|----------------|
${topDeps.filter(([pkg]) => ['prisma', 'drizzle', 'trpc', 'zod'].some(t => pkg.includes(t)))
    .map(([pkg, data]) => `| ${pkg} | ${data.count} repos | ${data.description} |`).join('\n') || '| TBD | - | - |'}

### Testing
| Technology | Usage | Recommendation |
|------------|-------|----------------|
${topDeps.filter(([pkg]) => ['vitest', 'jest', 'playwright', 'cypress'].some(t => pkg.includes(t)))
    .map(([pkg, data]) => `| ${pkg} | ${data.count} repos | ${data.description} |`).join('\n') || '| TBD | - | - |'}

---

## Folder Structure Recommendation

Based on common patterns:

\`\`\`
project/
├── src/               # Source code
│   ├── app/           # App router (Next.js 13+)
│   ├── components/    # Reusable UI components
│   ├── lib/           # Utilities and helpers
│   ├── services/      # Business logic / API calls
│   └── types/         # TypeScript types
├── prisma/            # Database schema (if using Prisma)
├── public/            # Static assets
├── tests/             # Test files
└── docs/              # Documentation
\`\`\`

---

## Notable Dependencies

| Package | Description | Used In |
|---------|-------------|---------|
${topDeps.map(([pkg, data]) => `| ${pkg} | ${data.description} | ${data.count} repos |`).join('\n') || '| No deps found | - | - |'}

---

## Anti-patterns to Avoid

Based on research:

1. **Overly complex folder structures** - Keep it simple, flat when possible
2. **Missing TypeScript** - Most quality repos use TypeScript
3. **No testing** - Include at least basic tests
4. **Outdated dependencies** - Keep dependencies updated
5. **Missing documentation** - README and inline comments matter

---

## Next Steps

1. [ ] Clone reference repo for deeper study
2. [ ] Adapt recommended patterns for project
3. [ ] Create specs based on this research
4. [ ] Set up project with recommended stack

---

*Generated by Research Skill | ${timestamp}*
`;

    fs.writeFileSync(PATTERNS_FILE, report, 'utf8');
    console.log(`[OK] Report saved to: ${PATTERNS_FILE}`);
    console.log('\nReport includes:');
    console.log(`  - ${shortlist.repos?.length || 0} repos in shortlist`);
    console.log(`  - ${analyses.length} deep analyses`);
    console.log(`  - ${topPatterns.length} common patterns`);
    console.log(`  - ${topDeps.length} notable dependencies`);
};

generateReport();
