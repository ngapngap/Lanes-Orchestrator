#!/usr/bin/env node
/**
 * Vibe Mode Orchestrator
 *
 * One-command pipeline for non-technical users.
 * Asks 5 questions → runs full pipeline → outputs spec + tasks + next steps
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Find repo root
const REPO_ROOT = (() => {
    let dir = __dirname;
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'AGENTS.md'))) return dir;
        dir = path.dirname(dir);
    }
    return process.cwd();
})();

// Import utils
let utils;
try {
    utils = require(path.join(REPO_ROOT, '.agent/lib/utils.js'));
} catch (e) {
    utils = {
        generateRunId: (slug) => {
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
            return `${dateStr}_${timeStr}_${slug}`;
        },
        getArtifactPath: (runId, phase) => {
            const phases = {
                'intake': '10_intake',
                'research': '20_research',
                'debate': '30_debate',
                'spec': '40_spec',
                'implementation': '50_implementation',
                'verification': '60_verification'
            };
            return path.join(REPO_ROOT, 'artifacts', 'runs', runId, phases[phase] || phase);
        },
        writeArtifact: (runId, phase, filename, content) => {
            const phasePath = utils.getArtifactPath(runId, phase);
            if (!fs.existsSync(phasePath)) {
                fs.mkdirSync(phasePath, { recursive: true });
            }
            const filePath = path.join(phasePath, filename);
            const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
            fs.writeFileSync(filePath, data, 'utf8');
            return filePath;
        }
    };
}

// Colors
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Parse args
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = { description: null };

    // Join all non-flag args as description
    const descParts = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--run-id' && args[i + 1]) {
            options.runId = args[++i];
        } else if (!args[i].startsWith('--')) {
            descParts.push(args[i]);
        }
    }
    if (descParts.length > 0) {
        options.description = descParts.join(' ');
    }
    return options;
};

// Readline helper
const createRL = () => readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (rl, question) => new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
});

// The 6 vibe questions (enhanced for production-ready output)
const VIBE_QUESTIONS = [
    {
        id: 'goal',
        question: '1. Mục tiêu chính là gì và ai sẽ dùng?',
        example: 'VD: App đặt lịch cho tiệm nail, khách hàng dùng để đặt lịch online',
        required: true
    },
    {
        id: 'features',
        question: '2. MVP cần 3-7 chức năng nào? (liệt kê, cách nhau bằng dấu phẩy)',
        example: 'VD: đăng ký, đăng nhập, xem dịch vụ, đặt lịch, nhận thông báo',
        required: true
    },
    {
        id: 'platform',
        question: '3. Nền tảng: web, mobile app, hay cả hai?',
        example: 'VD: web responsive (xem được trên điện thoại)',
        default: 'web responsive'
    },
    {
        id: 'auth',
        question: '4. Cần đăng nhập không? (Google/email/số điện thoại/không cần)',
        example: 'VD: đăng nhập bằng số điện thoại',
        default: 'email'
    },
    {
        id: 'data_sensitivity',
        question: '5. Dữ liệu nhạy cảm? (thông tin cá nhân/thanh toán/y tế/không có)',
        example: 'VD: có thông tin cá nhân khách hàng, không có thanh toán',
        default: 'thông tin cá nhân cơ bản'
    },
    {
        id: 'deploy',
        question: '6. Deploy ở đâu? (Vercel/Docker/VPS/chưa biết)',
        example: 'VD: Vercel (free), hoặc Docker trên VPS',
        default: 'Docker'
    }
];

// Collect answers
const collectAnswers = async (initialDescription) => {
    const rl = createRL();
    const answers = {};

    console.log(`\n${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}${c.bold}   VIBE MODE - Mô tả dự án của bạn${c.reset}`);
    console.log(`${c.cyan}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    if (initialDescription) {
        console.log(`${c.dim}Mô tả ban đầu: ${initialDescription}${c.reset}\n`);
        answers.initial = initialDescription;
    }

    console.log(`${c.dim}Trả lời 6 câu hỏi sau (Enter để dùng mặc định):${c.reset}\n`);

    for (const q of VIBE_QUESTIONS) {
        console.log(`${c.yellow}${q.question}${c.reset}`);
        console.log(`${c.dim}${q.example}${c.reset}`);

        const answer = await ask(rl, `${c.green}> ${c.reset}`);
        answers[q.id] = answer || q.default || '';
        console.log();
    }

    rl.close();
    return answers;
};

// Generate project slug from answers
const generateSlug = (answers) => {
    const text = answers.goal || answers.initial || 'project';
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .slice(0, 3)
        .join('-')
        .slice(0, 30) || 'vibe-project';
};

// Parse features from comma-separated string
const parseFeatures = (featuresStr) => {
    return featuresStr
        .split(/[,;]/)
        .map(f => f.trim())
        .filter(f => f.length > 0)
        .map((name, i) => ({
            id: `F${i + 1}`,
            name,
            priority: i < 3 ? 'P0' : 'P1',
            description: name,
            steps: [`User thực hiện ${name}`],
            criteria: [`${name} hoạt động đúng`]
        }));
};

// Determine tech stack based on platform
const determineTechStack = (platform, auth) => {
    const stack = [];

    if (platform.includes('web')) {
        stack.push({ layer: 'Frontend', tech: 'Next.js + React', reason: 'Phổ biến, dễ deploy' });
        stack.push({ layer: 'Styling', tech: 'Tailwind CSS', reason: 'Nhanh, responsive' });
    }
    if (platform.includes('mobile') || platform.includes('app')) {
        stack.push({ layer: 'Mobile', tech: 'React Native', reason: 'Code 1 lần, chạy iOS + Android' });
    }

    stack.push({ layer: 'Database', tech: 'PostgreSQL + Prisma', reason: 'Ổn định, dễ dùng' });

    if (auth && auth !== 'không' && auth !== 'không cần') {
        stack.push({ layer: 'Auth', tech: 'NextAuth.js', reason: 'Hỗ trợ nhiều provider' });
    }

    stack.push({ layer: 'Hosting', tech: 'Vercel', reason: 'Free tier tốt, dễ deploy' });

    return stack;
};

// Generate intake from answers
const generateIntake = (answers, runId) => {
    const features = parseFeatures(answers.features);

    return {
        version: '1.0',
        run_id: runId,
        timestamp: new Date().toISOString(),
        mode: 'vibe',
        project: {
            name: generateSlug(answers).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: answers.platform || 'web',
            description: answers.goal || answers.initial || ''
        },
        target_users: {
            primary: answers.goal?.split(',')[0] || 'End users',
            secondary: ''
        },
        scope: {
            mvp_features: features.filter(f => f.priority === 'P0').map(f => f.name),
            future_features: features.filter(f => f.priority === 'P1').map(f => f.name),
            out_of_scope: []
        },
        constraints: {
            auth: answers.auth || 'email',
            platform: answers.platform || 'web responsive',
            data_sensitivity: answers.data_sensitivity || 'unknown',
            deploy: answers.deploy || 'Docker'
        },
        _raw_answers: answers
    };
};

// Generate spec from intake
const generateSpec = (intake, researchNote) => {
    const features = parseFeatures(intake._raw_answers?.features || '');
    const techStack = determineTechStack(
        intake.constraints?.platform || 'web',
        intake.constraints?.auth
    );

    const template = fs.readFileSync(
        path.join(__dirname, 'templates/spec.template.md'),
        'utf8'
    );

    // Simple template replacement (not full handlebars)
    let spec = `# ${intake.project.name} - Specification

> Tài liệu này mô tả chi tiết dự án để developer hoặc AI agent có thể implement.
> **Phiên bản:** 1.0 | **Ngày tạo:** ${new Date().toISOString()}

---

## 1. Tổng Quan

### Dự án là gì?
${intake.project.description}

### Ai sẽ dùng?
${intake.target_users.primary}

### Mục tiêu chính
Xây dựng ${intake.project.type} với các tính năng: ${intake.scope.mvp_features.join(', ')}

---

## 2. Tính Năng MVP (Bắt buộc có)

> Đây là các tính năng **phải có** trong phiên bản đầu tiên.

${features.filter(f => f.priority === 'P0').map((f, i) => `
### ${i + 1}. ${f.name}

**Mô tả:** ${f.description}

**User flow:**
1. User truy cập tính năng ${f.name}
2. User thực hiện action
3. Hệ thống xử lý và phản hồi

**Acceptance criteria:**
- [ ] Tính năng ${f.name} hoạt động đúng
- [ ] UI/UX thân thiện
- [ ] Không có lỗi critical
`).join('\n---\n')}

---

## 3. Tính Năng Tương Lai (Không làm ngay)

${features.filter(f => f.priority === 'P1').map(f => `- **${f.name}**: Sẽ implement sau MVP`).join('\n')}

---

## 4. Yêu Cầu Kỹ Thuật

### Nền tảng
- **Loại:** ${intake.constraints.platform}
- **Responsive:** Có

### Authentication
- **Cần đăng nhập:** ${intake.constraints.auth !== 'không' && intake.constraints.auth !== 'không cần' ? 'Có' : 'Không'}
- **Phương thức:** ${intake.constraints.auth}

### Tech Stack (Đề xuất)

| Layer | Công nghệ | Lý do |
|-------|-----------|-------|
${techStack.map(t => `| ${t.layer} | ${t.tech} | ${t.reason} |`).join('\n')}

---

## 5. Constraints & Giới Hạn

${intake.constraints.special ? `- **Yêu cầu đặc biệt:** ${intake.constraints.special}` : '- Không có yêu cầu đặc biệt'}

---

${researchNote ? `## 6. Research Notes

> ${researchNote}

---` : ''}

## Checklist Trước Khi Code

- [ ] Đã hiểu mục tiêu dự án (Section 1)
- [ ] Đã hiểu MVP features (Section 2)
- [ ] Đã setup tech stack (Section 4)
- [ ] Đã hoàn thành UI
- [ ] Đã test các tính năng chính

---

*Spec được tạo bởi AI Agent Toolkit - Vibe Mode*
*Run ID: ${intake.run_id}*
`;

    return spec;
};

// Generate task breakdown
const generateTasks = (intake) => {
    const features = parseFeatures(intake._raw_answers?.features || '');
    const tasks = [];
    let taskId = 1;

    // Setup tasks
    tasks.push({
        id: `T${taskId++}`,
        name: 'Project Setup',
        description: 'Khởi tạo project với tech stack đề xuất',
        priority: 'P0',
        lane: 'setup',
        estimated_hours: 2,
        dependencies: [],
        status: 'pending'
    });

    // Auth task if needed
    if (intake.constraints?.auth && intake.constraints.auth !== 'không' && intake.constraints.auth !== 'không cần') {
        tasks.push({
            id: `T${taskId++}`,
            name: 'Authentication Setup',
            description: `Implement đăng nhập bằng ${intake.constraints.auth}`,
            priority: 'P0',
            lane: 'api',
            estimated_hours: 4,
            dependencies: ['T1'],
            status: 'pending'
        });
    }

    // Feature tasks
    features.forEach((f, i) => {
        tasks.push({
            id: `T${taskId++}`,
            name: f.name,
            description: `Implement tính năng: ${f.name}`,
            priority: f.priority,
            lane: 'ui',
            estimated_hours: f.priority === 'P0' ? 4 : 2,
            dependencies: taskId > 3 ? [`T${taskId - 2}`] : ['T1'],
            status: 'pending'
        });
    });

    // Testing task
    tasks.push({
        id: `T${taskId++}`,
        name: 'Testing & QA',
        description: 'Test tất cả tính năng, fix bugs',
        priority: 'P0',
        lane: 'qa',
        estimated_hours: 4,
        dependencies: tasks.filter(t => t.priority === 'P0').map(t => t.id),
        status: 'pending'
    });

    // Deploy task
    tasks.push({
        id: `T${taskId++}`,
        name: 'Deploy MVP',
        description: 'Deploy lên production',
        priority: 'P0',
        lane: 'devops',
        estimated_hours: 2,
        dependencies: [`T${taskId - 2}`],
        status: 'pending'
    });

    return {
        version: '1.0',
        run_id: intake.run_id,
        timestamp: new Date().toISOString(),
        total_tasks: tasks.length,
        estimated_total_hours: tasks.reduce((sum, t) => sum + t.estimated_hours, 0),
        tasks,
        lanes: ['setup', 'api', 'ui', 'qa', 'devops', 'security']
    };
};

// Generate Security Review (Layer C)
const generateSecurityReview = (intake) => {
    const dataSensitivity = intake.constraints?.data_sensitivity || 'unknown';
    const hasAuth = intake.constraints?.auth && intake.constraints.auth !== 'không';
    const hasPII = dataSensitivity.includes('cá nhân') || dataSensitivity.includes('personal');
    const hasPayment = dataSensitivity.includes('thanh toán') || dataSensitivity.includes('payment');
    const hasHealth = dataSensitivity.includes('y tế') || dataSensitivity.includes('health');

    const threats = [];
    const mitigations = [];
    const tasks = [];

    // Authentication threats
    if (hasAuth) {
        threats.push('Brute force attacks on login');
        threats.push('Session hijacking');
        mitigations.push('Rate limiting on auth endpoints');
        mitigations.push('Secure session management (httpOnly, secure cookies)');
        tasks.push({ name: 'Implement rate limiting', priority: 'P0', lane: 'security' });
        tasks.push({ name: 'Configure secure session cookies', priority: 'P0', lane: 'security' });
    }

    // PII threats
    if (hasPII) {
        threats.push('Data breach exposing personal information');
        threats.push('Unauthorized access to user data');
        mitigations.push('Encrypt PII at rest and in transit');
        mitigations.push('Implement role-based access control');
        tasks.push({ name: 'Add data encryption for PII fields', priority: 'P0', lane: 'security' });
        tasks.push({ name: 'Implement RBAC for data access', priority: 'P1', lane: 'security' });
    }

    // Payment threats
    if (hasPayment) {
        threats.push('Payment fraud');
        threats.push('Credit card data theft');
        mitigations.push('Use PCI-compliant payment provider (Stripe, PayPal)');
        mitigations.push('Never store raw card numbers');
        tasks.push({ name: 'Integrate PCI-compliant payment gateway', priority: 'P0', lane: 'security' });
    }

    // Health data threats
    if (hasHealth) {
        threats.push('HIPAA/health data compliance violations');
        mitigations.push('Implement audit logging');
        mitigations.push('Consider HIPAA compliance requirements');
        tasks.push({ name: 'Add audit logging for health data access', priority: 'P0', lane: 'security' });
    }

    // OWASP baseline
    const owaspChecklist = [
        { item: 'SQL Injection', check: 'Use parameterized queries/ORM', status: 'pending' },
        { item: 'XSS', check: 'Sanitize user input, use Content-Security-Policy', status: 'pending' },
        { item: 'CSRF', check: 'Use CSRF tokens for state-changing requests', status: 'pending' },
        { item: 'Broken Auth', check: 'Implement proper session management', status: hasAuth ? 'pending' : 'n/a' },
        { item: 'Sensitive Data Exposure', check: 'Use HTTPS, encrypt at rest', status: 'pending' },
        { item: 'Security Misconfiguration', check: 'Review default configs, disable debug in prod', status: 'pending' },
        { item: 'Components with Vulnerabilities', check: 'Run npm audit, keep deps updated', status: 'pending' }
    ];

    return `# Security Review - ${intake.project.name}

## Data Classification

| Category | Has Data | Sensitivity Level |
|----------|----------|-------------------|
| Personal Information (PII) | ${hasPII ? 'Yes' : 'No'} | ${hasPII ? 'High' : 'Low'} |
| Payment Data | ${hasPayment ? 'Yes' : 'No'} | ${hasPayment ? 'Critical' : 'N/A'} |
| Health Data | ${hasHealth ? 'Yes' : 'No'} | ${hasHealth ? 'Critical' : 'N/A'} |
| Authentication | ${hasAuth ? 'Yes' : 'No'} | ${hasAuth ? 'High' : 'Low'} |

## Threat Model

### Identified Threats
${threats.length > 0 ? threats.map((t, i) => `${i + 1}. ${t}`).join('\n') : '- No critical threats identified based on data classification'}

### Mitigations
${mitigations.length > 0 ? mitigations.map((m, i) => `${i + 1}. ${m}`).join('\n') : '- Standard security practices recommended'}

## OWASP Top 10 Checklist

| Vulnerability | Mitigation | Status |
|---------------|------------|--------|
${owaspChecklist.map(c => `| ${c.item} | ${c.check} | ${c.status} |`).join('\n')}

## Secret Handling

- [ ] Use environment variables for secrets (never commit to git)
- [ ] Create .env.example with placeholder values
- [ ] Add .env to .gitignore
- [ ] Document required secrets in DEPLOY.md

## Security Tasks (Add to DAG)

${tasks.length > 0 ? tasks.map((t, i) => `${i + 1}. **${t.name}** (${t.priority}, lane: ${t.lane})`).join('\n') : 'No additional security tasks required for MVP'}

---

*Generated by AI Agent Toolkit - Security Review*
*Run ID: ${intake.run_id}*
`;
};

// Generate Deploy Kit (Layer C)
const generateDeployKit = (intake) => {
    const projectName = generateSlug(intake._raw_answers).replace(/-/g, '_');
    const deployTarget = intake.constraints?.deploy || 'Docker';
    const platform = intake.constraints?.platform || 'web';
    const hasAuth = intake.constraints?.auth && intake.constraints.auth !== 'không';

    const dockerfile = `# Dockerfile for ${intake.project.name}
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "start"]
`;

    const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
${hasAuth ? '      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}\n      - NEXTAUTH_URL=${NEXTAUTH_URL}' : ''}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=\${DB_USER:-postgres}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-postgres}
      - POSTGRES_DB=\${DB_NAME:-${projectName}}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
`;

    const envExample = `# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${projectName}
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=${projectName}

${hasAuth ? `# Authentication
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars
NEXTAUTH_URL=http://localhost:3000
` : ''}
# API Keys (optional)
# BRAVE_API_KEY=
# GITHUB_TOKEN=

# App Config
NODE_ENV=development
PORT=3000
`;

    const deployMd = `# Deploy Guide - ${intake.project.name}

## Quick Start (Docker)

### 1. Prerequisites
- Docker & Docker Compose installed
- Git

### 2. Clone & Configure

\`\`\`bash
git clone <your-repo-url>
cd ${generateSlug(intake._raw_answers)}

# Copy environment file
cp env.example .env

# Edit .env with your values
nano .env
\`\`\`

### 3. Build & Run

\`\`\`bash
# Build and start
docker-compose up -d --build

# Check logs
docker-compose logs -f app

# App will be available at http://localhost:3000
\`\`\`

### 4. Database Migration

\`\`\`bash
# Run migrations
docker-compose exec app npx prisma migrate deploy

# Seed data (if available)
docker-compose exec app npx prisma db seed
\`\`\`

---

## Production Deploy

### Option A: VPS (DigitalOcean, Linode, etc.)

1. SSH into server
2. Install Docker & Docker Compose
3. Clone repo
4. Configure .env with production values
5. Run \`docker-compose -f docker-compose.prod.yml up -d\`
6. Setup reverse proxy (nginx/Caddy)
7. Configure SSL (Let's Encrypt)

### Option B: Vercel (Recommended for Next.js)

1. Push to GitHub
2. Connect repo to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

---

## Monitoring

\`\`\`bash
# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Restart
docker-compose restart

# Stop
docker-compose down
\`\`\`

## Backup

\`\`\`bash
# Backup database
docker-compose exec db pg_dump -U postgres ${projectName} > backup.sql

# Restore
docker-compose exec -T db psql -U postgres ${projectName} < backup.sql
\`\`\`

---

*Generated by AI Agent Toolkit*
*Run ID: ${intake.run_id}*
`;

    return {
        dockerfile,
        dockerCompose,
        envExample,
        deployMd
    };
};

// Generate NEXT_STEPS.md (Non-coder friendly - NO technical terms)
const generateNextSteps = (intake, tasks) => {
    const totalHours = tasks.estimated_total_hours;
    const projectName = intake.project.name;
    const costVND = Math.ceil(totalHours * 500000); // ~500k VND/hour estimate
    const costUSD = Math.ceil(totalHours * 25);

    return `# ${projectName} - Hướng Dẫn Tiếp Theo

## ✅ Bạn đã hoàn thành bước mô tả!

Chúng tôi đã tạo xong **bản thiết kế chi tiết** cho dự án của bạn.
Bây giờ bạn cần chọn cách để biến thiết kế thành app thực tế.

---

## 🚀 Cách 1: Dùng AI tạo app (NHANH NHẤT)

**Thời gian:** 5-30 phút | **Chi phí:** Miễn phí hoặc ~$20/tháng

### Bước làm:

1. **Mở trang web:** Vào một trong các trang sau:
   - [lovable.dev](https://lovable.dev) - Tạo app web đẹp
   - [bolt.new](https://bolt.new) - Tạo app nhanh
   - [v0.dev](https://v0.dev) - Tạo giao diện đẹp

2. **Đăng nhập** bằng Google hoặc email

3. **Mở file spec.md** trong thư mục này (dùng Notepad hoặc bất kỳ app đọc văn bản)

4. **Copy toàn bộ nội dung** (Ctrl+A rồi Ctrl+C)

5. **Paste vào ô chat** của trang web (Ctrl+V)

6. **Nhấn Enter** và đợi 2-5 phút

7. **App của bạn sẽ xuất hiện!** Bạn có thể xem trước và chỉnh sửa ngay trên trang.

---

## 💼 Cách 2: Thuê người làm

**Thời gian:** 1-4 tuần | **Chi phí:** ${(costVND/1000000).toFixed(1)}-${(costVND*2/1000000).toFixed(1)} triệu VND (~$${costUSD}-$${costUSD*2})

### Bước làm:

1. **Copy tin nhắn mẫu này:**

---

Chào anh/chị,

Em cần làm ${projectName}. Em đã có bản thiết kế chi tiết (file đính kèm).

Yêu cầu chính:
${intake.scope.mvp_features.slice(0, 5).map(f => `- ${f}`).join('\n')}

Anh/chị xem và báo giá + thời gian giúp em nhé.

Cảm ơn!

---

2. **Đính kèm file:** spec.md (trong thư mục này)

3. **Gửi đến developer qua:**
   - [Freelancer.vn](https://freelancer.vn) - Developer Việt Nam
   - [TopDev.vn](https://topdev.vn) - Việt Nam
   - [Upwork.com](https://upwork.com) - Quốc tế

4. **So sánh 2-3 báo giá** rồi chọn người phù hợp

### Mẹo chọn developer:
- Xem review/đánh giá của khách trước
- Hỏi họ đã làm app tương tự chưa
- Yêu cầu họ cho xem app mẫu đã làm

---

## 🎓 Cách 3: Nhờ bạn bè/người quen

Nếu bạn có bạn bè biết lập trình:

1. Gửi họ file **spec.md**
2. Nói: "Bạn xem giúp mình có làm được không, mất bao lâu?"
3. File spec.md có đủ thông tin để họ hiểu và làm

---

## ❓ Câu Hỏi Thường Gặp

**Mình không hiểu file spec.md?**
→ Không sao! Bạn không cần hiểu. Chỉ cần copy và gửi cho AI hoặc developer.

**Làm sao biết họ làm đúng?**
→ So sánh app thực tế với danh sách tính năng bạn đã mô tả ban đầu.

**Muốn thay đổi yêu cầu?**
→ Có thể. Nhưng nên hoàn thành bản đầu tiên trước, rồi mới thêm tính năng.

**Cần hỗ trợ thêm?**
→ Hỏi ChatGPT: "Tôi có file spec này, giúp tôi tìm developer" và đính kèm file spec.md

---

## 📁 Các File Trong Thư Mục Này

| File | Bạn cần làm gì |
|------|----------------|
| **spec.md** | Copy và gửi cho AI/developer |
| NEXT_STEPS.md | File này - hướng dẫn cho bạn |
| _(các file khác)_ | Không cần quan tâm - dành cho developer |

---

*Chúc bạn thành công với dự án ${projectName}!*
`;
};

// Try to run research (best effort)
const tryResearch = async (intake) => {
    if (!process.env.BRAVE_API_KEY && !process.env.GITHUB_TOKEN) {
        return { success: false, note: 'Research bỏ qua (thiếu BRAVE_API_KEY và GITHUB_TOKEN)' };
    }

    // Try GitHub search
    const https = require('https');
    const keywords = intake.scope.mvp_features.slice(0, 3).join(' ');
    const query = `${intake.project.type} ${keywords} stars:>100`;

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`,
            headers: {
                'User-Agent': 'AI-Agent-Toolkit-Vibe',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        if (process.env.GITHUB_TOKEN) {
            options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.items && result.items.length > 0) {
                        const repos = result.items.slice(0, 3).map(r => ({
                            name: r.full_name,
                            url: r.html_url,
                            stars: r.stargazers_count,
                            description: r.description
                        }));
                        resolve({
                            success: true,
                            repos,
                            note: `Tìm thấy ${repos.length} repos tham khảo`
                        });
                    } else {
                        resolve({ success: false, note: 'Không tìm thấy repo tham khảo' });
                    }
                } catch (e) {
                    resolve({ success: false, note: 'Lỗi parse response' });
                }
            });
        });

        req.on('error', () => resolve({ success: false, note: 'Lỗi kết nối GitHub' }));
        req.setTimeout(5000, () => {
            req.destroy();
            resolve({ success: false, note: 'Timeout khi search GitHub' });
        });
        req.end();
    });
};

// Main vibe function
const runVibe = async () => {
    const options = parseArgs();

    console.log(`\n${c.magenta}${c.bold}╔══════════════════════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.magenta}${c.bold}║            🎨 VIBE MODE - AI Agent Toolkit                   ║${c.reset}`);
    console.log(`${c.magenta}${c.bold}╚══════════════════════════════════════════════════════════════╝${c.reset}`);
    console.log(`\n${c.dim}Mô tả dự án → Nhận spec + tasks + security + deploy kit${c.reset}\n`);

    // Step 1: Collect answers
    const answers = await collectAnswers(options.description);

    // Step 2: Generate run ID
    const slug = generateSlug(answers);
    const runId = options.runId || utils.generateRunId?.(slug) || (() => {
        const now = new Date();
        const d = now.toISOString().slice(0, 10).replace(/-/g, '');
        const t = now.toTimeString().slice(0, 5).replace(':', '');
        return `${d}_${t}_${slug}`;
    })();

    console.log(`\n${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.cyan}   Đang xử lý... Run ID: ${runId}${c.reset}`);
    console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    // Step 3: Generate intake
    console.log(`${c.yellow}[1/7]${c.reset} Thu thập yêu cầu...`);
    const intake = generateIntake(answers, runId);
    const intakePath = utils.writeArtifact(runId, 'intake', 'intake.json', intake);
    console.log(`  ${c.green}✓${c.reset} Saved: ${intakePath}\n`);

    // Step 4: Try research (best effort)
    console.log(`${c.yellow}[2/7]${c.reset} Nghiên cứu giải pháp...`);
    const research = await tryResearch(intake);
    if (research.success) {
        utils.writeArtifact(runId, 'research', 'research.shortlist.json', {
            run_id: runId,
            repos: research.repos,
            note: research.note
        });
        console.log(`  ${c.green}✓${c.reset} ${research.note}\n`);
    } else {
        console.log(`  ${c.yellow}⚠${c.reset} ${research.note}\n`);
    }

    // Step 5: Generate spec
    console.log(`${c.yellow}[3/7]${c.reset} Tạo specification...`);
    const researchNote = research.success
        ? `Repos tham khảo: ${research.repos.map(r => r.name).join(', ')}`
        : research.note;
    const spec = generateSpec(intake, researchNote);
    const specPath = utils.writeArtifact(runId, 'spec', 'spec.md', spec);
    console.log(`  ${c.green}✓${c.reset} Saved: ${specPath}\n`);

    // Step 6: Generate tasks
    console.log(`${c.yellow}[4/7]${c.reset} Chia nhỏ công việc...`);
    const tasks = generateTasks(intake);
    const tasksPath = utils.writeArtifact(runId, 'spec', 'task_breakdown.json', tasks);
    console.log(`  ${c.green}✓${c.reset} Saved: ${tasksPath}\n`);

    // Step 7: Security Review (Layer C)
    console.log(`${c.yellow}[5/7]${c.reset} Security review...`);
    const securityReview = generateSecurityReview(intake);
    const securityPath = utils.writeArtifact(runId, 'verification', 'security_review.md', securityReview);
    console.log(`  ${c.green}✓${c.reset} Saved: ${securityPath}\n`);

    // Step 8: Deploy Kit (Layer C)
    console.log(`${c.yellow}[6/7]${c.reset} Tạo deploy kit...`);
    const deployKit = generateDeployKit(intake);

    // Create deploy directory
    const deployDir = path.join(REPO_ROOT, 'artifacts', 'runs', runId, 'deploy');
    if (!fs.existsSync(deployDir)) {
        fs.mkdirSync(deployDir, { recursive: true });
    }

    fs.writeFileSync(path.join(deployDir, 'Dockerfile'), deployKit.dockerfile);
    fs.writeFileSync(path.join(deployDir, 'docker-compose.yml'), deployKit.dockerCompose);
    fs.writeFileSync(path.join(deployDir, 'env.example'), deployKit.envExample);
    fs.writeFileSync(path.join(deployDir, 'DEPLOY.md'), deployKit.deployMd);
    console.log(`  ${c.green}✓${c.reset} Saved: ${deployDir}/\n`);

    // Step 9: Generate NEXT_STEPS
    console.log(`${c.yellow}[7/7]${c.reset} Tạo hướng dẫn...`);
    const nextSteps = generateNextSteps(intake, tasks);
    const nextStepsPath = utils.writeArtifact(runId, 'spec', 'NEXT_STEPS.md', nextSteps);
    console.log(`  ${c.green}✓${c.reset} Saved: ${nextStepsPath}\n`);

    // Summary (Non-coder friendly - only show 2 essential files)
    console.log(`${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.green}${c.bold}   ✅ HOÀN THÀNH!${c.reset}`);
    console.log(`${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    console.log(`${c.bold}Bạn chỉ cần quan tâm 2 file:${c.reset}\n`);
    console.log(`  ${c.cyan}1. NEXT_STEPS.md${c.reset}  → Đọc file này để biết bước tiếp theo`);
    console.log(`  ${c.cyan}2. spec.md${c.reset}        → Gửi file này cho AI hoặc developer\n`);

    console.log(`${c.dim}(Các file khác trong thư mục là dành cho developer, bạn không cần mở)${c.reset}\n`);

    console.log(`${c.bold}Mở file NEXT_STEPS.md ngay bây giờ!${c.reset}\n`);

    return { runId, intake, spec, tasks, securityReview, deployKit };
};

// Run
runVibe().catch(console.error);
