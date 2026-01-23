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

// The 5 vibe questions
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
        id: 'constraints',
        question: '5. Yêu cầu đặc biệt? (thời gian, ngân sách, bảo mật, ngôn ngữ)',
        example: 'VD: cần xong trong 2 tuần, tiếng Việt, bảo mật thông tin khách',
        default: 'không có yêu cầu đặc biệt'
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

    console.log(`${c.dim}Trả lời 5 câu hỏi sau (Enter để dùng mặc định):${c.reset}\n`);

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
            special: answers.constraints || ''
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
        lanes: ['setup', 'api', 'ui', 'qa', 'devops']
    };
};

// Generate NEXT_STEPS.md
const generateNextSteps = (intake, tasks) => {
    const totalHours = tasks.estimated_total_hours;
    const techStack = determineTechStack(
        intake.constraints?.platform || 'web',
        intake.constraints?.auth
    );

    return `# Bước Tiếp Theo - ${intake.project.name}

> Tài liệu này hướng dẫn bạn các bước cần làm sau khi có spec.
> Không cần biết code - chỉ cần làm theo từng bước.

---

## Tình Trạng Hiện Tại

| Giai đoạn | Trạng thái |
|-----------|------------|
| Thu thập yêu cầu | ✅ Hoàn thành |
| Nghiên cứu giải pháp | ${process.env.BRAVE_API_KEY ? '✅ Hoàn thành' : '⚠️ Bỏ qua (thiếu API key)'} |
| Tạo specification | ✅ Hoàn thành |
| Chia nhỏ công việc | ✅ Hoàn thành |

---

## Bạn Có 3 Lựa Chọn

### Lựa Chọn 1: Tự Code (Miễn phí)

Nếu bạn biết code hoặc có bạn bè biết code:

1. **Mở file \`spec.md\`** - Đây là "bản vẽ" chi tiết của dự án
2. **Mở file \`task_breakdown.json\`** - Đây là danh sách việc cần làm
3. **Bắt đầu từ task có \`priority: "P0"\`** - Đây là việc quan trọng nhất
4. **Hoàn thành từng task** theo thứ tự

**Thời gian ước tính:** ${Math.ceil(totalHours / 8)} - ${Math.ceil(totalHours / 4)} ngày làm việc

---

### Lựa Chọn 2: Dùng AI Code Agent (Khuyến nghị)

Dùng Claude Code, Cursor, hoặc Windsurf để code tự động:

\`\`\`bash
# Bước 1: Copy spec vào project mới
mkdir ${generateSlug(intake._raw_answers)}
cd ${generateSlug(intake._raw_answers)}
cp path/to/spec.md ./SPEC.md

# Bước 2: Mở trong AI IDE và paste prompt này:
\`\`\`

**Prompt để paste vào AI:**
\`\`\`
Đọc file SPEC.md và implement theo đúng spec.
Bắt đầu từ task P0, hoàn thành rồi chuyển sang P1.
Sau mỗi task, chạy test để đảm bảo không lỗi.
\`\`\`

**Thời gian ước tính:** ${Math.ceil(totalHours / 16)} - ${Math.ceil(totalHours / 8)} ngày

---

### Lựa Chọn 3: Thuê Developer

Gửi file \`spec.md\` cho developer hoặc agency:

1. **Upload spec.md** lên Google Drive/Dropbox
2. **Gửi link** cho developer kèm message:
   > "Đây là spec chi tiết cho dự án. Vui lòng báo giá và timeline."
3. **So sánh báo giá** từ 2-3 developer

**Nơi tìm developer:**
- Upwork.com (quốc tế)
- Freelancer.vn (Việt Nam)
- TopDev.vn (Việt Nam)

**Giá tham khảo:** $${Math.ceil(totalHours * 30)} - $${Math.ceil(totalHours * 50)} USD (tùy vùng)

---

## Các File Quan Trọng

| File | Mục đích | Ai cần đọc |
|------|----------|------------|
| \`spec.md\` | Mô tả chi tiết dự án | Developer, AI Agent |
| \`task_breakdown.json\` | Danh sách việc cần làm | Developer, PM |
| \`intake.json\` | Yêu cầu gốc của bạn | Tham khảo |

---

## Câu Hỏi Thường Gặp

**Q: Tôi không hiểu spec.md?**
A: Không sao, bạn không cần hiểu hết. Chỉ cần gửi cho developer hoặc AI agent.

**Q: Làm sao biết developer làm đúng?**
A: So sánh kết quả với phần "MVP Features" trong spec.md.

**Q: Có thể thay đổi yêu cầu không?**
A: Có, nhưng nên hoàn thành MVP trước rồi mới thêm tính năng.

**Q: Cần hỗ trợ thêm?**
A: Chạy lại \`npx aat vibe\` với mô tả mới.

---

## Thông Tin Kỹ Thuật (Cho Developer)

- **Run ID:** ${intake.run_id}
- **Spec Location:** \`artifacts/runs/${intake.run_id}/40_spec/spec.md\`
- **Tasks Location:** \`artifacts/runs/${intake.run_id}/40_spec/task_breakdown.json\`
- **Tech Stack đề xuất:** ${techStack.map(t => t.tech).join(', ')}

---

*Tạo bởi AI Agent Toolkit - Vibe Mode | ${new Date().toISOString()}*
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
    console.log(`\n${c.dim}Mô tả dự án → Nhận spec + tasks + hướng dẫn${c.reset}\n`);

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
    console.log(`${c.yellow}[1/4]${c.reset} Thu thập yêu cầu...`);
    const intake = generateIntake(answers, runId);
    const intakePath = utils.writeArtifact(runId, 'intake', 'intake.json', intake);
    console.log(`  ${c.green}✓${c.reset} Saved: ${intakePath}\n`);

    // Step 4: Try research (best effort)
    console.log(`${c.yellow}[2/4]${c.reset} Nghiên cứu giải pháp...`);
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
    console.log(`${c.yellow}[3/4]${c.reset} Tạo specification...`);
    const researchNote = research.success
        ? `Repos tham khảo: ${research.repos.map(r => r.name).join(', ')}`
        : research.note;
    const spec = generateSpec(intake, researchNote);
    const specPath = utils.writeArtifact(runId, 'spec', 'spec.md', spec);
    console.log(`  ${c.green}✓${c.reset} Saved: ${specPath}\n`);

    // Step 6: Generate tasks
    console.log(`${c.yellow}[4/4]${c.reset} Chia nhỏ công việc...`);
    const tasks = generateTasks(intake);
    const tasksPath = utils.writeArtifact(runId, 'spec', 'task_breakdown.json', tasks);
    console.log(`  ${c.green}✓${c.reset} Saved: ${tasksPath}\n`);

    // Step 7: Generate NEXT_STEPS
    const nextSteps = generateNextSteps(intake, tasks);
    const nextStepsPath = utils.writeArtifact(runId, 'spec', 'NEXT_STEPS.md', nextSteps);

    // Summary
    console.log(`${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.green}${c.bold}   ✅ HOÀN THÀNH!${c.reset}`);
    console.log(`${c.green}${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

    console.log(`${c.bold}Các file đã tạo:${c.reset}`);
    console.log(`  📄 ${specPath}`);
    console.log(`  📋 ${tasksPath}`);
    console.log(`  📖 ${nextStepsPath}\n`);

    console.log(`${c.bold}Bước tiếp theo:${c.reset}`);
    console.log(`  1. Đọc file ${c.cyan}NEXT_STEPS.md${c.reset} để biết cách tiến hành`);
    console.log(`  2. Gửi file ${c.cyan}spec.md${c.reset} cho developer hoặc AI agent\n`);

    console.log(`${c.dim}Xem chi tiết: npx aat status ${runId}${c.reset}\n`);

    return { runId, intake, spec, tasks };
};

// Run
runVibe().catch(console.error);
