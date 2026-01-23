# AI Agent Toolkit

Pipeline hoàn chỉnh cho vòng đời phát triển phần mềm, điều phối bởi AI agents.

---

## Chọn Cách Dùng

### 🎨 Vibe Mode (Khuyến nghị cho người mới)

> Mô tả ý tưởng → Nhận spec + tasks + hướng dẫn. Không cần biết code.

```bash
npx aat vibe
```

Hoặc với mô tả sẵn:
```bash
npx aat vibe "app đặt lịch cho tiệm nail, khách đặt online"
```

**Vibe Mode sẽ:**
1. Hỏi bạn 6 câu đơn giản về dự án
2. Tự động chạy pipeline (intake → research → spec → tasks → security → deploy)
3. Xuất ra các file:
   - `spec.md` - Bản mô tả chi tiết cho developer/AI
   - `task_breakdown.json` - Danh sách việc cần làm
   - `security_review.md` - Đánh giá bảo mật + OWASP checklist
   - `deploy/` - Dockerfile, docker-compose.yml, DEPLOY.md
   - `NEXT_STEPS.md` - Hướng dẫn bước tiếp theo (dễ hiểu)

---

### ⚙️ Advanced Mode (Cho developer muốn kiểm soát)

> Chạy từng bước, debug, can thiệp khi cần.

```bash
# Khởi tạo run
npx aat init my-project

# Chạy từng phase
npx aat intake --run-id <id>
npx aat research --run-id <id>
npx aat spec --run-id <id>
npx aat qa --run-id <id>

# Kiểm tra trạng thái
npx aat status
```

---

## Installation

### Option 1: Dùng trong project có sẵn (Recommended)

```bash
cd /path/to/your-project

# Install
npm i -D ai-agent-toolkit

# Scaffold toolkit files
npx ai-agent-toolkit install

# Setup environment (optional, for research feature)
cp .env.example .env
# Edit .env with your API keys

# Verify
npx ai-agent-toolkit selfcheck
```

### Option 2: Clone repo (for contributors)

```bash
git clone https://github.com/ngapngap/AI-Agent-Toolkit.git
cd AI-Agent-Toolkit
npm install
cp .env.example .env
npx ai-agent-toolkit selfcheck
```

---

## Environment Setup (Optional)

> API keys chỉ cần cho research phase. Vibe mode vẫn chạy được nếu thiếu.

```bash
# .env
BRAVE_API_KEY=your_brave_api_key_here    # For web search
GITHUB_TOKEN=your_github_token_here       # For repo search (higher rate limit)
```

**Get API keys:**
- Brave Search: https://brave.com/search/api/
- GitHub Token: https://github.com/settings/tokens

---

## CLI Commands

### Vibe Mode
```bash
npx aat vibe                    # Interactive mode
npx aat vibe "mô tả dự án"      # With initial description
```

### Advanced Mode
```bash
# Pipeline phases
npx aat init <slug>             # Initialize new run
npx aat intake                  # Requirements gathering
npx aat research                # Search repos/patterns
npx aat debate                  # Council decision
npx aat spec                    # Generate specification
npx aat tasks                   # Generate task breakdown

# Quality
npx aat review --path src/      # Code review
npx aat test                    # Generate tests
npx aat qa                      # QA gate

# Management
npx aat list                    # List all runs
npx aat status [run_id]         # Show run status
npx aat selfcheck               # Validate environment
npx aat skills                  # List all skill commands
```

### Run ID

Run ID là unique identifier cho mỗi pipeline run: `YYYYMMDD_HHMM_<slug>`

```bash
# Specify run ID
npx aat intake --run-id 20260123_1430_my-project

# Or set environment variable
export RUN_ID=20260123_1430_my-project
npx aat intake

# Or auto-detect latest run
npx aat status  # Uses latest run
```

---

## Output Files

### Vibe Mode Output

| File | Mục đích | Ai cần đọc |
|------|----------|------------|
| `spec.md` | Bản mô tả chi tiết dự án | Developer, AI Agent |
| `task_breakdown.json` | Danh sách việc cần làm | Developer, PM |
| `security_review.md` | Đánh giá bảo mật, OWASP checklist | Developer, Security |
| `deploy/Dockerfile` | Docker build config | DevOps |
| `deploy/docker-compose.yml` | Container orchestration | DevOps |
| `deploy/DEPLOY.md` | Hướng dẫn deploy | DevOps, Developer |
| `deploy/env.example` | Environment variables template | Developer |
| `NEXT_STEPS.md` | Hướng dẫn bước tiếp theo | Bạn (non-technical) |

### Advanced Mode Output

```
artifacts/runs/<run_id>/
├── 10_intake/
│   ├── intake.json
│   └── intake.summary.md
├── 20_research/
│   ├── research.shortlist.json
│   └── research.patterns.md
├── 40_spec/
│   ├── spec.md
│   ├── task_breakdown.json
│   └── NEXT_STEPS.md
├── 60_verification/
│   ├── report.json
│   ├── summary.md
│   └── security_review.md
└── deploy/
    ├── Dockerfile
    ├── docker-compose.yml
    ├── env.example
    └── DEPLOY.md
```

---

## Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  VIBE MODE (1 command)                                              │
│  npx aat vibe                                                       │
│                                                                     │
│  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌──────────┐  │
│  │ Intake │ → │Research│ → │  Spec  │ → │Security│ → │  Deploy  │  │
│  │(6 Q&A) │   │(GitHub)│   │(spec.md)│   │(review)│   │  (kit)   │  │
│  └────────┘   └────────┘   └────────┘   └────────┘   └──────────┘  │
│                                  ↓                                  │
│                          NEXT_STEPS.md                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  ADVANCED MODE (step by step)                                       │
│                                                                     │
│  init → intake → research → debate → spec → tasks → qa              │
│                     ↓           ↓        ↓        ↓                 │
│               shortlist    decision   spec.md   report              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
your-project/
├── AGENTS.md                    # Agent overview
├── RULES.md                     # Global rules
├── package.json
│
├── bin/                         # CLI
│   └── ai-agent-toolkit.js
│
├── agents/                      # Agent definitions (7 agents)
│   ├── orchestrator.agent.md
│   ├── ask.agent.md
│   ├── architect.agent.md       # Research + Debate + Spec
│   ├── design.agent.md
│   ├── code.agent.md
│   ├── qa_gate.agent.md
│   └── debug_security.agent.md
│
├── .agent/
│   ├── lib/utils.js             # Artifact path utilities
│   ├── mcp/                     # MCP servers
│   └── skills/                  # Skills
│       ├── orchestrator/        # vibe, selfcheck, init, status
│       ├── intake/
│       ├── research/
│       ├── qa-gate/
│       └── ...
│
└── artifacts/runs/              # Pipeline runs
```

---

## MCP Integration (Claude Desktop)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/path/to/repo/.agent/mcp/servers/github-server.js"],
      "env": { "GITHUB_TOKEN": "your_token" }
    },
    "brave-search": {
      "command": "node",
      "args": ["/path/to/repo/.agent/mcp/servers/brave-server.js"],
      "env": { "BRAVE_API_KEY": "your_key" }
    },
    "artifacts": {
      "command": "node",
      "args": ["/path/to/repo/.agent/mcp/servers/artifacts-server.js"]
    }
  }
}
```

---

## Documentation

- [AGENTS.md](AGENTS.md) - Full agent reference
- [RULES.md](RULES.md) - Lane và scope rules
- [qa.md](qa.md) - QA commands và criteria
- [docs/](docs/) - Additional documentation

## References

- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
