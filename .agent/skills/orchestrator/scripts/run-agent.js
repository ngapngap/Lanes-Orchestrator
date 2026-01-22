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
const rawAgentId = idIndex !== -1 ? args[idIndex + 1] : null;
const agentId = rawAgentId ? rawAgentId.replace(/[^a-zA-Z0-9_-]/g, '') : null; // Sanitize ID to prevent path traversal

const autoYesIndex = args.indexOf('--auto-yes');
const autoYes = autoYesIndex !== -1;

// Simple whitelist/blacklist for auto-yes functionality
const autoYesWhitelist = [
    /do you want to.*(?:create|proceed|allow|fetch|make|edit|run|execute)/i,
    /\?.*❯/i,
    /(?:choose option|enter index|enter text).*[:?]/i
];
const autoYesBlacklist = [
    /password/i,
    /confirm deletion/i,
    /are you sure you want to delete/i
];

// Enhanced logging with separate channels and timestamp
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

function getTimestamp() {
    return new Date().toISOString();
}

function rotateLogFile(filePath) {
    const backupPath = filePath + '.1';
    if (fs.existsSync(filePath)) {
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath); // Remove old backup
        }
        fs.renameSync(filePath, backupPath); // Rename current to backup
    }
}

function checkAndRotateLog(filePath) {
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_LOG_SIZE) {
            rotateLogFile(filePath);
        }
    }
}

function writeLog(filePath, message) {
    checkAndRotateLog(filePath);
    fs.appendFileSync(filePath, message);
}

function logRaw(message, noNewline = false) {
    const timestamp = getTimestamp();
    const line = noNewline ? message : `[${timestamp}] ${message}\n`;
    try {
        writeLog(logFiles.rawSpecific, line);
        writeLog(logFiles.rawCombined, line);
    } catch (e) { }
    process.stdout.write(line);
}

function logEvent(eventType, message) {
    const timestamp = getTimestamp();
    const eventMessage = `[${timestamp}] EVENT: ${eventType} - ${message}\n`;
    try {
        writeLog(logFiles.eventSpecific, eventMessage);
        writeLog(logFiles.eventCombined, eventMessage);
    } catch (e) { }
    process.stdout.write(eventMessage);
}

// Define log files for different channels
const logFiles = {
    rawSpecific: path.join(LOG_DIR, agentId ? `${agentId}_raw.log` : 'agent_raw.log'),
    rawCombined: path.join(LOG_DIR, 'combined_raw.log'),
    eventSpecific: path.join(LOG_DIR, agentId ? `${agentId}_events.log` : 'agent_events.log'),
    eventCombined: path.join(LOG_DIR, 'combined_events.log'),
    specific: path.join(LOG_DIR, agentId ? `${agentId}_output.log` : 'agent_output.log'), // Keep for backward compatibility
    combined: path.join(LOG_DIR, 'combined_output.log') // Keep for backward compatibility
};

function stripAnsi(str) {
    return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\].*?(?:\x07|\x1B\\))/g, '');
}

function log(message, noNewline = false) {
    // Log both raw and event depending on message type
    if (message.includes('STATUS:') || message.includes('[SYSTEM]') || message.includes('[AUTO REPLY]') || message.includes('[BRIDGE ACTION]')) {
        // Extract status for event logging
        if (message.includes('STATUS:')) {
            const statusMatch = message.match(/STATUS:\s*(\w+)/);
            if (statusMatch) {
                logEvent('STATUS', statusMatch[1]);
            }
        }
        logRaw(message, noNewline);
    } else {
        logRaw(message, noNewline);
    }
}

// Shell selection
const shell = process.platform === 'win32' ? (process.env.COMSPEC || 'cmd.exe') : (process.env.SHELL || '/bin/bash');

async function runAgent() {
    try { fs.writeFileSync(logFiles.specific, ''); } catch (e) { }
    try { fs.writeFileSync(logFiles.rawSpecific, ''); } catch (e) { }
    try { fs.writeFileSync(logFiles.eventSpecific, ''); } catch (e) { }

    log(`\n====================================================================\n`);
    log(`[AUTONOMOUS PTY BRIDGE] STARTING SHELL: ${shell}\n`);
    log(`CWD: ${cwd}\n`);
    logEvent('STATUS', 'running');
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

        // 1. Auto-yes functionality - only enabled with --auto-yes flag
        if (autoYes) {
            // Check against blacklist first (higher priority)
            let blacklisted = false;
            for (const blacklistPattern of autoYesBlacklist) {
                if (blacklistPattern.test(buffer)) {
                    blacklisted = true;
                    break;
                }
            }
            
            if (!blacklisted) {
                // Check against whitelist
                for (const whitelistPattern of autoYesWhitelist) {
                    if (whitelistPattern.test(buffer)) {
                        if (buffer.includes('> 1. Yes') || buffer.includes('1. Yes')) {
                            log(`[AUTO REPLY] Detected Yes/No prompt. Sending "1\\r"`);
                            logEvent('ACTION', 'auto-reply-sent');
                            buffer = ''; // Clear buffer
                            await writeThrottled('1\r');
                            break; // Exit whitelist loop after responding
                        }
                    }
                }
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
        logEvent('STATUS', 'exited');
        log(`\n[SYSTEM] Shell Exited (code: ${exitCode})\n`);
        process.exit(exitCode);
    });

    // Heartbeat - Periodic status update for monitoring
    setInterval(() => {
        logEvent('HEARTBEAT', 'active');
    }, 60000); // Every 1 minute
}

runAgent();
