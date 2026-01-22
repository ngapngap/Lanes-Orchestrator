#!/usr/bin/env node
/**
 * View Report Script
 * Xem báo cáo QA gate gần nhất
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../../../output/verification');
const REPORT_FILE = path.join(OUTPUT_DIR, 'report.json');
const TESTS_MD_FILE = path.join(OUTPUT_DIR, 'tests.md');

// Parse args
const args = process.argv.slice(2);
const format = args.includes('--json') ? 'json' : 'markdown';

if (format === 'json') {
    if (fs.existsSync(REPORT_FILE)) {
        const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log('[!] No report found. Run run-gate.js first.');
    }
} else {
    if (fs.existsSync(TESTS_MD_FILE)) {
        const content = fs.readFileSync(TESTS_MD_FILE, 'utf8');
        console.log(content);
    } else {
        console.log('[!] No report found. Run run-gate.js first.');
        console.log(`Expected location: ${TESTS_MD_FILE}`);
    }
}
