# AI Agent Toolkit

Pipeline hoàn chỉnh cho vòng đời phát triển phần mềm, điều phối bởi AI agents.

## Tổng quan

Bộ kit cung cấp **agents + skills + artifact contracts + gates** để chạy quy trình:

```
Orchestrator → Ask(Intake) → Architect(Research + Debate + Spec) → Design? → Code → QA Gate → Debug/Security
```

---

## Installation

> **Chọn 1 trong 2 cách dưới đây:**

### Option 1: Use in YOUR project (recommended)

Nếu bạn muốn dùng toolkit trong repo có sẵn, **KHÔNG cần clone**:

```bash
cd /path/to/your-project

# Install as dev dependency
npm i -D ai-agent-toolkit

# Scaffold toolkit files into your repo
npx ai-agent-toolkit install

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Verify setup
npx ai-agent-toolkit selfcheck
```

**What `install` does:**

Tạo (hoặc update) các folders trong project của bạn:
- `agents/` - Agent definitions
- `.agent/skills/` - Skill scripts & manifests
- `.agent/lib/` - Shared utilities
- `.agent/mcp/` - MCP servers
- `schemas/` - JSON schemas
- `examples/` - Sample artifacts
- `docs/` - Documentation
- `artifacts/runs/` - Pipeline run outputs

### Option 2: Clone repo (for contributors)

Nếu bạn muốn contribute hoặc develop toolkit:

```bash
git clone https://github.com/ngapngap/AI-Agent-Toolkit.git
cd AI-Agent-Toolkit
npm install
cp .env.example .env
npx ai-agent-toolkit selfcheck
```

---

## Quick Start

### 1. Initialize a run

```bash
npx ai-agent-toolkit init my-project
```

Output:
```
✓ Initialized new run: 20260123_1430_my-project
  Run directory: artifacts/runs/20260123_1430_my-project/

Export run ID:
  export RUN_ID=20260123_1430_my-project
```

### 2. Run pipeline phases

```bash
# Thu thập requirements
npx ai-agent-toolkit intake --run-id 20260123_1430_my-project

# Research repos/patterns
npx ai-agent-toolkit research --run-id 20260123_1430_my-project

# Hoặc với query cụ thể
npx ai-agent-toolkit research --query "nodejs auth starter" --run-id 20260123_1430_my-project

# Generate spec + tasks
npx ai-agent-toolkit spec --run-id 20260123_1430_my-project

# Run QA gate
npx ai-agent-toolkit qa --run-id 20260123_1430_my-project
```

### 3. Check status

```bash
npx ai-agent-toolkit status 20260123_1430_my-project
```

---

## Run ID Flow

### Run ID là gì?

Run ID là unique identifier cho mỗi pipeline run, format: `YYYYMMDD_HHMM_<slug>`

Ví dụ: `20260123_1430_my-project`

### Tạo Run ID

```bash
npx ai-agent-toolkit init <project-slug>
```

Run ID được:
- Print ra console
- Dùng để tạo folder: `artifacts/runs/<run_id>/`

### Sử dụng Run ID

**Cách 1: Truyền qua --run-id**
```bash
npx ai-agent-toolkit intake --run-id 20260123_1430_my-project
```

**Cách 2: Set environment variable**
```bash
export RUN_ID=20260123_1430_my-project
npx ai-agent-toolkit intake
```

**Cách 3: Auto-detect latest run**
```bash
# Nếu không có --run-id và không có RUN_ID env,
# commands sẽ dùng latest run trong artifacts/runs/
npx ai-agent-toolkit status  # Shows latest run
```

### List all runs

```bash
npx ai-agent-toolkit list
```

---

## CLI Commands

```bash
# Pipeline phases
npx ai-agent-toolkit init <slug>                    # Initialize new run
npx ai-agent-toolkit intake --run-id <id>           # Requirements gathering
npx ai-agent-toolkit research --run-id <id>         # Search repos/patterns
npx ai-agent-toolkit research --query "..." --run-id <id>  # With custom query
npx ai-agent-toolkit debate --run-id <id>           # Council decision
npx ai-agent-toolkit spec --run-id <id>             # Generate specification
npx ai-agent-toolkit tasks --run-id <id>            # Generate task breakdown

# Quality
npx ai-agent-toolkit review --path src/ --run-id <id>  # Code review
npx ai-agent-toolkit test --run-id <id>                # Generate tests
npx ai-agent-toolkit qa --run-id <id>                  # QA gate

# Management
npx ai-agent-toolkit list                           # List all runs
npx ai-agent-toolkit status [run_id]                # Show run status
npx ai-agent-toolkit selfcheck                      # Validate environment
npx ai-agent-toolkit skills                         # List all skill commands
```

**Short form:** `npx aat <command>`

**Skill:command format:** `npx aat <skill>:<command>` (e.g., `npx aat code-review:review`)

---

## Environment Setup

### API Keys

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Required for brave-search skill
BRAVE_API_KEY=your_brave_api_key_here

# Optional - for higher GitHub API rate limits
GITHUB_TOKEN=your_github_token_here
```

**Get API keys:**
- Brave Search: https://brave.com/search/api/
- GitHub Token: https://github.com/settings/tokens

### Verify setup

```bash
npx ai-agent-toolkit selfcheck
```

---

## MCP Integration (Claude Desktop)

MCP servers cho phép Claude Desktop trực tiếp gọi toolkit tools.

> **Note:** Khi dùng MCP, bạn cấu hình API keys trong Claude Desktop config thay vì `.env` của repo.

### Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/absolute/path/to/repo/.agent/mcp/servers/github-server.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here"
      }
    },
    "brave-search": {
      "command": "node",
      "args": ["/absolute/path/to/repo/.agent/mcp/servers/brave-server.js"],
      "env": {
        "BRAVE_API_KEY": "your_brave_api_key_here"
      }
    },
    "artifacts": {
      "command": "node",
      "args": ["/absolute/path/to/repo/.agent/mcp/servers/artifacts-server.js"]
    }
  }
}
```

### MCP Tools Available

| Server | Tools |
|--------|-------|
| github | `github_search_repos`, `github_repo_info`, `github_repo_contents`, `github_create_issue` |
| brave-search | `brave_web_search`, `brave_news_search` |
| artifacts | `artifacts_list_runs`, `artifacts_init_run`, `artifacts_get_status`, `artifacts_read`, `artifacts_write` |

---

## Project Structure

```
your-project/
├── AGENTS.md                    # Agent overview
├── RULES.md                     # Global rules
├── qa.md                        # QA profile
├── LICENSE_POLICY.md            # License policy
├── package.json                 # npm package
│
├── bin/                         # CLI
│   └── ai-agent-toolkit.js      # Main entrypoint
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
│   └── skills/                  # Skills (12 skills)
│       ├── intake/
│       ├── research/
│       ├── debate/
│       ├── spec-agent/
│       ├── code-review/
│       ├── test-generator/
│       └── ...
│
├── schemas/                     # JSON Schemas
├── examples/                    # Sample artifacts
├── docs/                        # Documentation
│
└── artifacts/runs/              # Pipeline runs
    └── <run_id>/
        ├── 00_user_request.md
        ├── 10_intake/
        ├── 20_research/
        ├── 30_debate/
        ├── 40_spec/
        ├── 45_design/
        ├── 50_implementation/
        └── 60_verification/
```

---

## Gates

| Gate | Check | Artifacts |
|------|-------|-----------|
| intake_ready | intake.json valid | 10_intake/ |
| reuse_gate_passed | shortlist + assessment valid | 20_research/ |
| debate_ready_for_spec | debate inputs valid | 30_debate/ |
| spec_ready | spec.md + DAG valid | 40_spec/ |
| lane_handoff_ready | handoff bundles complete | 50_implementation/ |
| qa_passed | report.json.status = pass | 60_verification/ |

## Lanes

| Lane | Responsibility |
|------|----------------|
| ui | Frontend, UI components |
| api | Backend, API endpoints |
| data | Database, migrations |
| qa | Testing, quality |
| security | Security, compliance |

## Agents (7 total)

| Agent | Phases | Description |
|-------|--------|-------------|
| Orchestrator | All | Main controller, routing |
| Ask | Intake | Requirements gathering |
| Architect | Research, Debate, Spec | Discovery + decision + specification |
| Design | Design | UI/UX handoff |
| Code | Implementation | Lane execution |
| QA Gate | Verification | Quality checks |
| Debug/Security | Debug | Issue resolution |

---

## IDE Integration

### VS Code

`.vscode/tasks.json`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "AAT: Init",
      "type": "shell",
      "command": "npx ai-agent-toolkit init ${input:projectName}"
    },
    {
      "label": "AAT: Status",
      "type": "shell",
      "command": "npx ai-agent-toolkit status"
    },
    {
      "label": "AAT: Review",
      "type": "shell",
      "command": "npx ai-agent-toolkit review --path ${workspaceFolder}/src"
    }
  ],
  "inputs": [
    {
      "id": "projectName",
      "type": "promptString",
      "description": "Project slug for run ID"
    }
  ]
}
```

### Cursor / Windsurf / Other AI IDEs

Copy `.agent/` folder và `AGENTS.md` to your project root.

---

## Advanced: Direct Script Execution

> **Không khuyến khích** - Chỉ dùng khi debug hoặc develop skills.

```bash
# Direct script execution (bypasses CLI)
node .agent/skills/intake/scripts/start-intake.js --run-id <id>
node .agent/skills/research/scripts/search-github.js --run-id <id>
node .agent/skills/qa-gate/scripts/run-gate.js --run-id <id>
```

---

## Documentation

- [AGENTS.md](AGENTS.md) - Full agent reference
- [RULES.md](RULES.md) - Lane và scope rules
- [qa.md](qa.md) - QA commands và criteria
- [LICENSE_POLICY.md](LICENSE_POLICY.md) - License allowlist/blocklist
- [docs/ORCHESTRATOR_ADAPTER.md](docs/ORCHESTRATOR_ADAPTER.md) - Adapter contract
- [docs/QA_TRIAGE.md](docs/QA_TRIAGE.md) - Triage protocol

## References

- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
