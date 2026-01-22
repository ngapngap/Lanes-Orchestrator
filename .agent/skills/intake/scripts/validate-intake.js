#!/usr/bin/env node
/**
 * Validate Intake Script
 * Kiểm tra intake đã đầy đủ chưa
 */

const fs = require('fs');
const path = require('path');

const INTAKE_FILE = path.resolve(__dirname, '../../../../output/intake/intake.md');

const REQUIRED_SECTIONS = [
    'Project Overview',
    'Target Users',
    'Features',
    'Constraints'
];

const validateIntake = () => {
    if (!fs.existsSync(INTAKE_FILE)) {
        console.log('[FAIL] No intake file found');
        return false;
    }

    const content = fs.readFileSync(INTAKE_FILE, 'utf8');
    const issues = [];

    // Check required sections
    REQUIRED_SECTIONS.forEach(section => {
        if (!content.includes(`## ${section}`)) {
            issues.push(`Missing section: ${section}`);
        }
    });

    // Check for TBD
    const tbdCount = (content.match(/TBD/g) || []).length;
    if (tbdCount > 5) {
        issues.push(`Too many TBD entries (${tbdCount}). Please fill in more details.`);
    }

    // Check must-have features
    if (!content.includes('### Must-Have (P0)') ||
        content.includes('### Must-Have (P0)\n- TBD')) {
        issues.push('Must-have features not defined');
    }

    // Report
    console.log('\n========================================');
    console.log('   INTAKE VALIDATION REPORT');
    console.log('========================================\n');

    if (issues.length === 0) {
        console.log('[PASS] Intake is complete and ready for next phase');
        console.log('\nNext steps:');
        console.log('  1. Run research skill to find similar repos');
        console.log('  2. Run spec-kit to create specifications');
        return true;
    } else {
        console.log('[FAIL] Intake needs more information:\n');
        issues.forEach((issue, i) => {
            console.log(`  ${i + 1}. ${issue}`);
        });
        console.log('\nRun start-intake.js to complete missing information.');
        return false;
    }
};

const result = validateIntake();
process.exit(result ? 0 : 1);
