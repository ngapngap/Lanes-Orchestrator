/**
 * Run Agent Script - Autonomous Persistent PTY Bridge
 * Version: 3.1 (Shell-based with Auto-Response & Security Hardening)
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

const args = process.argv.slice(2);

// Parse arguments
const cwdIndex = args.indexOf('--cwd');
const cwd = cwdIndex !== -1 ? args[cwdIndex + 1] : process.cwd();

const debugInput = args.indexOf('--debug-input') !== -1;

const idIndex = args.indexOf('--id');
let agentId = idIndex !== -1 ? args[idIndex + 1] : null;

// Parse runId from environment or args
const runIdIndex = args.indexOf('--run-id');
let runId = runIdIndex !== -1 ? args[runIdIndex + 1] : (process.env.RUN_ID || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

// Validate and normalize agentId
if (!agentId) {
    console.error('[SYSTEM] Error: --id is required.');
    process.exit(1);
}

// Strict sanitization for agentId
agentId = agentId.toLowerCase();
if (!/^[a-z0-9_-]{1,32}$/.test(agentId) || agentId.includes('..') || agentId.includes('/') || agentId.includes('\\')) {
    console.error('[SYSTEM] Error: Invalid --id format. Must be ^[a-z0-9_-]{1,32}$ and no path traversal.');
    process.exit(1);
}

const autoYesIndex = args.indexOf('--auto-yes');
const autoYes = autoYesIndex !== -1;

// Sanitize runId to prevent path traversal
runId = runId.replace(/[\\/]/g, '_');
if (runId.includes('..')) {
    console.error('[SYSTEM] Error: Invalid RUN_ID.');
    process.exit(1);
}

// LOG_DIR should use cwd if provided, otherwise process.cwd()
const LOG_DIR = path.join(cwd, '.agent', 'logs', runId, agentId);

// Ensure LOG_DIR is within the expected path (relative to cwd)
const resolvedLogDir = path.resolve(LOG_DIR);
const expectedBaseDir = path.resolve(path.join(cwd, '.agent', 'logs'));
if (!resolvedLogDir.startsWith(expectedBaseDir)) {
    console.error('[SYSTEM] Error: Path traversal detected in log directory.');
    process.exit(1);
}

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

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
function getTimestamp() {
    return new Date().toISOString();
}

// Define log files for different channels
const logFiles = {
    rawSpecific: path.join(LOG_DIR, 'raw.log'),
    eventSpecific: path.join(LOG_DIR, 'events.log'),
    specific: path.join(LOG_DIR, 'output.log') // Keep for backward compatibility
};

const logStreams = {};

function getLogStream(filePath) {
    if (!logStreams[filePath]) {
        logStreams[filePath] = fs.createWriteStream(filePath, { flags: 'a' });
    }
    return logStreams[filePath];
}

function writeLog(filePath, message) {
    const stream = getLogStream(filePath);
    stream.write(message);
}

function logRaw(message, noNewline = false) {
    const timestamp = getTimestamp();
    const line = noNewline ? message : `[${timestamp}] ${message}\n`;
    try {
        writeLog(logFiles.rawSpecific, line);
    } catch (e) { }
    process.stdout.write(line);
}

function logEvent(eventType, message) {
    const timestamp = getTimestamp();
    const eventMessage = `[${timestamp}] EVENT: ${eventType} - ${message}\n`;
    try {
        writeLog(logFiles.eventSpecific, eventMessage);
    } catch (e) { }
    process.stdout.write(eventMessage);
}

function stripAnsi(str) {
    return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]* [ -/]*[@-~]|\].*?(?:\x07|\x1B\\))/g, '');
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
    // Initialize log files (async)
    const initLogs = [logFiles.specific, logFiles.rawSpecific, logFiles.eventSpecific].map(file =>
        fs.promises.writeFile(file, '').catch(() => {})
    );
    await Promise.all(initLogs);

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

    // Serialize all writes (stdin and auto-yes) via a shared promise queue
    let writeQueue = Promise.resolve();
    
    const redactSecrets = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/(password|secret|key|token|auth|api[_-]?key)["']?\s*[:=]\s*["']?([^"'\\s,]+)["']?/gi, (match, p1, p2) => {
            return match.replace(p2, '********');
        });
    };

    const enqueueWrite = (data, isAuto = false) => {
        writeQueue = writeQueue.then(async () => {
            const str = data.toString();
            const normalized = str.replace(/\n/g, '\r');
            
            if (debugInput) {
                const label = isAuto ? '[AUTO REPLY]' : '[BRIDGE ACTION]';
                log(`${label} Sending: ${JSON.stringify(redactSecrets(normalized))}`);
            }

            if (!isAuto) {
                // Auto-Escape reset if it looks like a new command starting with a character
                if (normalized.length > 1 && /^[a-zA-Z/]/.test(normalized)) {
                    ptyProcess.write('\x1b');
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            await writeThrottled(normalized);
        }).catch(err => {
            log(`[SYSTEM] Error in write queue: ${err.message}`);
        });
    };

    // Bridge stdin (from Antigravity/User)
    process.stdin.on('data', (data) => {
        enqueueWrite(data, false);
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
                            log(`[AUTO REPLY] Detected Yes/No prompt. Enqueueing "1\r"`);
                            logEvent('ACTION', 'auto-reply-sent');
                            buffer = ''; // Clear buffer
                            enqueueWrite('1\r', true);
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
