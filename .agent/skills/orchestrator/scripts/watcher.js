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

const LOG_DIR = path.join(__dirname, '..');
const POLL_INTERVAL = 200;

// Parse agent filter and log type from args
const agentFilter = process.argv[2] || 'all';
const logType = process.argv[3] || 'default'; // 'default', 'raw', 'events'

// Get log file based on agent and type
function getLogFile(agent, type) {
    const suffix = type === 'raw' ? '_raw.log' : (type === 'events' ? '_events.log' : '_output.log');
    if (agent === 'all') {
        return path.join(LOG_DIR, `combined${suffix}`);
    }
    return path.join(LOG_DIR, `${agent}${suffix}`);
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
    console.clear();
    const agentLabel = agent === 'all' ? 'TẤT CẢ AGENTS' : agent.toUpperCase();
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
    printHeader(agentFilter, type);

    // Create log file if not exists
    if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '', 'utf8');
        console.log(`${colors.yellow}[Đang chờ output từ ${agentFilter} (${type})...]${colors.reset}\n`);
    }

    let lastSize = 0;

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

    // Polling loop
    const poll = () => {
        try {
            if (!fs.existsSync(logFile)) return;

            const stats = fs.statSync(logFile);

            if (stats.size < lastSize) {
                lastSize = 0; // File was reset/overwritten (rotation)
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
        } catch (e) {
            // Ignore
        }
    };

    const intervalId = setInterval(poll, POLL_INTERVAL);

    process.on('SIGINT', () => {
        clearInterval(intervalId);
        console.log(`\n${colors.yellow}👋 Đã dừng watcher. Tạm biệt!${colors.reset}`);
        process.exit(0);
    });

    console.log(`${colors.green}✓ Watcher [${agentFilter} - ${type}] đang chạy${colors.reset}\n`);
}

// Run
const logFile = getLogFile(agentFilter, logType);
watchLog(logFile, logType);
