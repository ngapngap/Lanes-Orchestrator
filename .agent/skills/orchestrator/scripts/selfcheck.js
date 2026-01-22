const fs = require('fs');
const path = require('path');

console.log('--- Orchestrator Self-Check ---');

const files = [
    'scripts/run-agent.js',
    'scripts/watcher.js',
    'package.json'
];

let allOk = true;

files.forEach(f => {
    const p = path.join(__dirname, '..', f);
    if (fs.existsSync(p)) {
        console.log(`[OK] Found ${f}`);
    } else {
        console.error(`[ERROR] Missing ${f}`);
        allOk = false;
    }
});

try {
    require('node-pty');
    console.log('[OK] node-pty is loadable');
} catch (e) {
    console.log('[WARN] node-pty not found in global path (expected if not installed yet)');
}

if (allOk) {
    console.log('Self-check passed!');
    process.exit(0);
} else {
    console.error('Self-check failed!');
    process.exit(1);
}
