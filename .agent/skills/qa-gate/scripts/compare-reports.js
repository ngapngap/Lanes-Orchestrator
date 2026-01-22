#!/usr/bin/env node
/**
 * Compare Reports Script
 * So sánh 2 lần chạy QA gate
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../../../output/verification');
const REPORT_FILE = path.join(OUTPUT_DIR, 'report.json');
const HISTORY_FILE = path.join(OUTPUT_DIR, 'history.json');

// Load history
const loadHistory = () => {
    if (fs.existsSync(HISTORY_FILE)) {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
    return [];
};

// Save current report to history
const saveToHistory = (report) => {
    const history = loadHistory();
    history.unshift({
        timestamp: report.timestamp,
        overall_status: report.overall_status,
        summary: report.summary
    });
    // Keep last 10
    const trimmed = history.slice(0, 10);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
};

// Compare function
const compare = () => {
    const history = loadHistory();

    if (history.length < 2) {
        console.log('[!] Not enough history to compare. Run QA gate at least twice.');
        return;
    }

    const current = history[0];
    const previous = history[1];

    console.log('\n========================================');
    console.log('   QA GATE COMPARISON');
    console.log('========================================\n');

    console.log('CURRENT vs PREVIOUS\n');

    console.log(`Status: ${current.overall_status.toUpperCase()} vs ${previous.overall_status.toUpperCase()}`);

    const passedDiff = current.summary.passed - previous.summary.passed;
    const failedDiff = current.summary.failed - previous.summary.failed;

    console.log(`Passed: ${current.summary.passed} (${passedDiff >= 0 ? '+' : ''}${passedDiff})`);
    console.log(`Failed: ${current.summary.failed} (${failedDiff >= 0 ? '+' : ''}${failedDiff})`);

    if (current.overall_status === 'pass' && previous.overall_status !== 'pass') {
        console.log('\n[IMPROVEMENT] Status improved to PASS!');
    } else if (current.overall_status !== 'pass' && previous.overall_status === 'pass') {
        console.log('\n[REGRESSION] Status regressed from PASS!');
    }

    console.log(`\nCurrent: ${current.timestamp}`);
    console.log(`Previous: ${previous.timestamp}`);
};

// If current report exists, add to history
if (fs.existsSync(REPORT_FILE)) {
    const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
    const history = loadHistory();

    // Only add if timestamp is different
    if (!history.length || history[0].timestamp !== report.timestamp) {
        saveToHistory(report);
    }
}

compare();
