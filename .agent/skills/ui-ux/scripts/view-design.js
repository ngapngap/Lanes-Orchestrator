#!/usr/bin/env node
/**
 * View Design Script
 * Xem design system hiện tại
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../../../output/design');
const MASTER_FILE = path.join(OUTPUT_DIR, 'MASTER.md');
const PAGES_DIR = path.join(OUTPUT_DIR, 'pages');

// Parse args
const args = process.argv.slice(2);
const viewType = args.includes('--pages') ? 'pages' :
                 args.includes('--colors') ? 'colors' : 'master';

if (viewType === 'master') {
    if (fs.existsSync(MASTER_FILE)) {
        console.log(fs.readFileSync(MASTER_FILE, 'utf8'));
    } else {
        console.log('[!] No MASTER.md found. Run generate-design.js first.');
    }
} else if (viewType === 'pages') {
    if (fs.existsSync(PAGES_DIR)) {
        const pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.md'));
        if (pages.length === 0) {
            console.log('[!] No page specs found. Run create-page.js first.');
        } else {
            console.log('Page Specs:\n');
            pages.forEach(p => {
                console.log(`  - ${p.replace('.md', '')}`);
            });
            console.log('\nUse: node view-design.js --page [name] to view a specific page');
        }
    } else {
        console.log('[!] No pages directory found.');
    }
} else if (viewType === 'colors') {
    if (fs.existsSync(MASTER_FILE)) {
        const content = fs.readFileSync(MASTER_FILE, 'utf8');
        const colorSection = content.match(/## Color Palette[\s\S]*?(?=##|$)/);
        if (colorSection) {
            console.log(colorSection[0]);
        }
    } else {
        console.log('[!] No MASTER.md found.');
    }
}

// View specific page
const pageArg = args.indexOf('--page');
if (pageArg !== -1 && args[pageArg + 1]) {
    const pageName = args[pageArg + 1];
    const pageFile = path.join(PAGES_DIR, `${pageName}.md`);
    if (fs.existsSync(pageFile)) {
        console.log(fs.readFileSync(pageFile, 'utf8'));
    } else {
        console.log(`[!] Page "${pageName}" not found.`);
    }
}
