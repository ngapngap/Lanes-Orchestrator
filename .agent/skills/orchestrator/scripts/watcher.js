/**
 * Agent Output Watcher (Multi-agent support)
 * Người dùng chạy để xem real-time output từ agent cụ thể
 * 
 * Usage: 
 *   node watcher.js              # Xem tất cả agents
 *   node watcher.js claude        # Chỉ xem Claude
 *   node watcher.js opencode      # Chỉ xem OpenCode
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..');
const POLL_INTERVAL = 200;

// Parse agent filter from args
const agentFilter = process.argv[2] || 'all';

// Get log file based on agent
function getLogFile(agent) {
    if (agent === 'all') {
        return path.join(LOG_DIR, 'combined_output.log');
    }
    return path.join(LOG_DIR, `${agent}_output.log`);
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
    claude: colors.cyan,
    opencode: colors.magenta
};

function printHeader(agent) {
    console.clear();
    const agentLabel = agent === 'all' ? 'TẤT CẢ AGENTS' : agent.toUpperCase();
    const color = agent === 'all' ? colors.blue : (agentColors[agent] || colors.blue);
    console.log(`
${colors.bright}${color}╔══════════════════════════════════════════════════════════════╗
║           🤖 LANES FRAMEWORK - ${agentLabel.padEnd(20)}     ║
╠══════════════════════════════════════════════════════════════╣
║  Đang theo dõi output...                                     ║
║  Nhấn Ctrl+C để thoát                                        ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);
}

function formatLine(line) {
    if (line.includes('[CLAUDE]')) {
        return `${agentColors.claude}${line}${colors.reset}`;
    }
    if (line.includes('[OPENCODE]')) {
        return `${agentColors.opencode}${line}${colors.reset}`;
    }
    if (line.includes('SUCCESS')) {
        return `${colors.green}${line}${colors.reset}`;
    }
    if (line.includes('ERROR') || line.includes('FAILED')) {
        return `${colors.red}${line}${colors.reset}`;
    }
    if (line.includes('====') || line.includes('----')) {
        return `${colors.dim}${line}${colors.reset}`;
    }
    return line;
}

function watchLog(logFile) {
    printHeader(agentFilter);

    // Create log file if not exists
    if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '', 'utf8');
        console.log(`${colors.yellow}[Đang chờ output từ ${agentFilter}...]${colors.reset}\n`);
    }

    let lastSize = 0;

    try {
        const stats = fs.statSync(logFile);
        lastSize = stats.size;

        if (lastSize > 0) {
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            const recent = lines.slice(-30);
            recent.forEach(line => console.log(formatLine(line)));
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
                lastSize = 0; // File was reset/overwritten
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
                        console.log(formatLine(trimmed));
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

    console.log(`${colors.green}✓ Watcher [${agentFilter}] đang chạy${colors.reset}\n`);
}

// Run
const logFile = getLogFile(agentFilter);
watchLog(logFile);
