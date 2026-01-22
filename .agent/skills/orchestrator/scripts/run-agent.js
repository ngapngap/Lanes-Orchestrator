/**
 * Run Agent Script - Autonomous Persistent PTY Bridge
 * Version: 3.0 (Shell-based with Auto-Response)
 */

const fs = require('fs');
const path = require('path');
let pty;

try {
    pty = require('node-pty');
} catch (e) {
    console.error('[SYSTEM] node-pty not found.');
    process.exit(1);
}

const LOG_DIR = path.join(__dirname, '..');
const args = process.argv.slice(2);

// Parse arguments
const cwdIndex = args.indexOf('--cwd');
const cwd = cwdIndex !== -1 ? args[cwdIndex + 1] : process.cwd();

const idIndex = args.indexOf('--id');
const agentId = idIndex !== -1 ? args[idIndex + 1] : null;

const logFiles = {
    specific: path.join(LOG_DIR, agentId ? `${agentId}_output.log` : 'agent_output.log'),
    combined: path.join(LOG_DIR, 'combined_output.log')
};

function stripAnsi(str) {
    return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?(?:\x07|\x1B\\))/g, '');
}

function log(message, noNewline = false) {
    const line = noNewline ? message : `${message}\n`;
    try {
        fs.appendFileSync(logFiles.specific, line);
        fs.appendFileSync(logFiles.combined, line);
    } catch (e) { }
    process.stdout.write(line);
}

// Shell selection
const shell = process.platform === 'win32' ? (process.env.COMSPEC || 'cmd.exe') : (process.env.SHELL || '/bin/bash');

async function runAgent() {
    try { fs.writeFileSync(logFiles.specific, ''); } catch (e) { }

    log(`\n====================================================================\n`);
    log(`[AUTONOMOUS PTY BRIDGE] STARTING SHELL: ${shell}\n`);
    log(`CWD: ${cwd}\n`);
    log(`====================================================================\n`);

    const ptyProcess = pty.spawn(shell, process.platform === 'win32' ? [] : ['-l'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: cwd,
        env: { ...process.env, FORCE_COLOR: '1', TERM: 'xterm-256color' }
    });

    let buffer = '';

    const writeThrottled = async (str) => {
        for (const char of str) {
            ptyProcess.write(char);
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    };

    // Bridge stdin (from Antigravity/User)
    process.stdin.on('data', async (data) => {
        const str = data.toString();
        const normalized = str.replace(/\n/g, '\r');
        log(`[BRIDGE ACTION] Incoming: ${JSON.stringify(normalized)}`);

        // Auto-Escape reset if it looks like a new command starting with a character
        if (normalized.length > 1 && /^[a-zA-Z/]/.test(normalized)) {
            ptyProcess.write('\x1b');
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        await writeThrottled(normalized);
    });

    ptyProcess.onData(async (data) => {
        const cleanData = stripAnsi(data);
        log(cleanData, true);
        buffer += cleanData;

        // --- Autonomous Response Logic ---

        // 1. Detect Claude Code's Yes/No prompt (flexible with spaces and ANSI)
        const lowerBuf = buffer.toLowerCase();
        if (
            /do you want to.*(?:create|proceed|allow|fetch|make|edit|run|execute)/i.test(lowerBuf) ||
            /\?.*❯/i.test(lowerBuf) ||
            /(?:choose option|enter index|enter text).*[:?]/i.test(lowerBuf)
        ) {
            if (buffer.includes('> 1. Yes') || buffer.includes('1. Yes')) {
                log(`[AUTO REPLY] Detected Yes/No prompt. Sending "1\\r"`);
                buffer = ''; // Clear buffer
                await writeThrottled('1\r');
            }
        }

        // 2. Detect Claude Code's "Done" state (back to prompt)
        // Note: This is tricky in shell because shell prompt also appears.
        // We look for the characteristic Claude TUI bottom bar or certain keywords.
        if (buffer.includes('Esc to cancel') && buffer.includes('Tab to add')) {
            // Still in a sub-menu or waiting?
        }

        // Keep buffer size manageable
        if (buffer.length > 5000) buffer = buffer.slice(-2000);
    });

    ptyProcess.onExit(({ exitCode }) => {
        log(`\n[SYSTEM] Shell Exited (code: ${exitCode})\n`);
        process.exit(exitCode);
    });
}

runAgent();
