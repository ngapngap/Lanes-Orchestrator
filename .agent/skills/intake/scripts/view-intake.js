#!/usr/bin/env node
/**
 * View Intake Script
 * Xem nội dung intake hiện tại
 */

const fs = require('fs');
const path = require('path');

const INTAKE_FILE = path.resolve(__dirname, '../../../../output/intake/intake.md');

if (fs.existsSync(INTAKE_FILE)) {
    const content = fs.readFileSync(INTAKE_FILE, 'utf8');
    console.log(content);
} else {
    console.log('[!] No intake found. Run start-intake.js first.');
    console.log(`Expected location: ${INTAKE_FILE}`);
}
