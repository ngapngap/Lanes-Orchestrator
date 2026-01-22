/**
 * Agent Output Watcher (Multi-agent support)
 * Người dùng chạy để xem real-time output từ agent cụ thể
 * 
 * Usage: 
 *   node watcher.js              # Xem tất cả agents (output mặc định)
 *   node watcher.js ui_lane      # Chỉ xem UI Lane
 *   node watcher.js all events   # Xem tất cả events log
 *   node watcher.js ui_lane raw  # Xem raw log của UI Lane
 */

const fs = require('fs');
const path = require('path');

const BASE_LOG_DIR = path.join(process.cwd(), '.agent', 'logs');
const POLL_INTERVAL = 100;

const args = process.argv.slice(2);
const noClear = args.includes('--no-clear');

// Find latest run if not specified
function getLatestRunId() {
    if (!fs.existsSync(BASE_LOG_DIR)) return null;
    const runs = fs.readdirSync(BASE_LOG_DIR).sort().reverse();
    return runs.length > 0 ? runs[0] : null;
}

// Explicit argument parsing
const runIdIdx = args.indexOf('--run-id');
let runId = runIdIdx !== -1 ? args[runIdIdx + 1] : getLatestRunId();

const laneIdx = args.indexOf('--lane');
let agentFilter = laneIdx !== -1 ? args[laneIdx + 1] : (args.find(a => !a.startsWith('--') && !['raw', 'events'].includes(a)) || 'ui_lane');

const logType = args.find(a => a === 'raw' || a === 'events') || 'default';

// Sanitize inputs
function sanitizePathPart(part) {
    if (!part) return part;
    // Allow alphanumeric, underscores, hyphens, and dots (but no double dots)
    // Reject path separators
    if (part.includes('..') || part.includes('/') || part.includes('\\')) {
        throw new Error(`Invalid path part: ${part}`);
    }
    if (!/^[a-z0-9._-]+$/i.test(part)) {
        throw new Error(`Invalid characters in path part: ${part}`);
    }
    return part;
}

try {
    runId = sanitizePathPart(runId);
    agentFilter = sanitizePathPart(agentFilter);
} catch (e) {
    console.error(`\x1b[31mError: ${e.message}\x1b[0m`);
    process.exit(1);
}

// Get log file based on agent and type
function getLogFile(run, agent, type) {
    if (!run) return null;
    const suffix = type === 'raw' ? 'raw.log' : (type === 'events' ? 'events.log' : 'output.log');
    const logPath = path.join(BASE_LOG_DIR, run, agent, suffix);
    
    // Final safety check
    const resolvedPath = path.resolve(logPath);
    if (!resolvedPath.startsWith(path.resolve(BASE_LOG_DIR))) {
        throw new Error('Security Error: Path traversal detected');
    }
    return logPath;
}

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const agentColors = {
    ui_lane: colors.cyan,
    api_lane: colors.magenta,
    data_lane: colors.yellow,
    qa_lane: colors.green
};

function printHeader(agent, type) {
    if (!noClear) console.clear();
    const agentLabel = agent.toUpperCase();
    const typeLabel = type.toUpperCase();
    const color = agent === 'all' ? colors.blue : (agentColors[agent] || colors.blue);
    console.log(`
${colors.bright}${color}╔══════════════════════════════════════════════════════════════╗
║           🤖 LANES FRAMEWORK - ${agentLabel.padEnd(20)}     ║
║           📂 LOG TYPE: ${typeLabel.padEnd(25)}     ║
╠══════════════════════════════════════════════════════════════╣
║  Đang theo dõi output...                                     ║
║  Nhấn Ctrl+C để thoát                                        ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);
}

function formatLine(line, type) {
    // Highlight events
    if (type === 'events' || line.includes('EVENT:')) {
        if (line.includes('STATUS - running')) return `${colors.green}${line}${colors.reset}`;
        if (line.includes('STATUS - waiting')) return `${colors.yellow}${line}${colors.reset}`;
        if (line.includes('STATUS - blocked')) return `${colors.red}${line}${colors.reset}`;
        if (line.includes('STATUS - done')) return `${colors.bright}${colors.green}${line}${colors.reset}`;
        return `${colors.cyan}${line}${colors.reset}`;
    }

    // Standard formatting
    if (line.includes('SUCCESS')) return `${colors.green}${line}${colors.reset}`;
    if (line.includes('ERROR') || line.includes('FAILED')) return `${colors.red}${line}${colors.reset}`;
    if (line.includes('====') || line.includes('----')) return `${colors.dim}${line}${colors.reset}`;
    
    // Lane specific coloring if in combined view
    for (const [lane, color] of Object.entries(agentColors)) {
        if (line.includes(lane.toUpperCase())) return `${color}${line}${colors.reset}`;
    }

    return line;
}

function watchLog(logFile, type) {
    if (!logFile) {
        console.error(`${colors.red}Error: Không tìm thấy thư mục log.${colors.reset}`);
        process.exit(1);
    }
    printHeader(agentFilter, type);

    // Ensure directory exists
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    // Create log file if not exists
    if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '', 'utf8');
        console.log(`${colors.yellow}[Đang chờ output từ ${agentFilter} (${type})...]${colors.reset}\n`);
    }

    let lastSize = 0;

    const showInitial = () => {
        try {
            const stats = fs.statSync(logFile);
            lastSize = stats.size;

            if (lastSize > 0) {
                const content = fs.readFileSync(logFile, 'utf8');
                const lines = content.split('\n').filter(l => l.trim());
                const recent = lines.slice(-30);
                recent.forEach(line => console.log(formatLine(line, type)));
                console.log(`\n${colors.dim}--- Đang theo dõi real-time ---${colors.reset}\n`);
            }
        } catch (e) {
            lastSize = 0;
        }
    };

    showInitial();

    const readNewContent = () => {
        try {
            if (!fs.existsSync(logFile)) return;
            const stats = fs.statSync(logFile);

            if (stats.size < lastSize) {
                lastSize = 0;
            }

            if (stats.size > lastSize) {
                const fd = fs.openSync(logFile, 'r');
                const newBytes = stats.size - lastSize;
                const buffer = Buffer.alloc(newBytes);
                fs.readSync(fd, buffer, 0, newBytes, lastSize);
                fs.closeSync(fd);

                const newContent = buffer.toString('utf8');
                const lines = newContent.split('\n');

                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed) {
                        console.log(formatLine(trimmed, type));
                    }
                });

                lastSize = stats.size;
            }
        } catch (e) {}
    };

    // Use fs.watch if available, fallback to polling
    let watcher;
    try {
        watcher = fs.watch(logFile, (event) => {
            if (event === 'change') {
                readNewContent();
            }
        });
        console.log(`${colors.green}✓ Watcher (fs.watch) [${agentFilter}] đang chạy${colors.reset}\n`);
    } catch (e) {
        const intervalId = setInterval(readNewContent, POLL_INTERVAL);
        watcher = { close: () => clearInterval(intervalId) };
        console.log(`${colors.green}✓ Watcher (polling) [${agentFilter}] đang chạy${colors.reset}\n`);
    }

    process.on('SIGINT', () => {
        watcher.close();
        console.log(`\n${colors.yellow}👋 Đã dừng watcher. Tạm biệt!${colors.reset}`);
        process.exit(0);
    });
}

// Run
try {
    const logFile = getLogFile(runId, agentFilter, logType);
    watchLog(logFile, logType);
} catch (e) {
    console.error(`\x1b[31mError: ${e.message}\x1b[0m`);
    process.exit(1);
}
