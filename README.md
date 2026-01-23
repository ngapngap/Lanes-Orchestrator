# AI Agent Toolkit

Pipeline hoàn chỉnh cho vòng đời phát triển phần mềm, điều phối bởi AI agents.

## Tổng quan

Bộ kit cung cấp **agents + skills + artifact contracts + gates** để chạy quy trình:

```
Orchestrator → Ask(Intake) → Architect(Research + Debate + Spec) → Design? → Code → QA Gate → Debug/Security
```

## Installation

```bash
# Clone repo
git clone https://github.com/ngapngap/AI-Agent-Toolkit.git
cd AI-Agent-Toolkit

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Run self-check
npx ai-agent-toolkit selfcheck
```

## CLI Commands

```bash
# Initialize new run
npx ai-agent-toolkit init my-project

# Phases
npx ai-agent-toolkit intake         # Thu thập requirements
npx ai-agent-toolkit research       # Research repos/patterns
npx ai-agent-toolkit debate         # Council decision
npx ai-agent-toolkit spec           # Generate spec + tasks

# Quality
npx ai-agent-toolkit review         # Code review
npx ai-agent-toolkit test           # Generate tests
npx ai-agent-toolkit qa             # QA gate

# Management
npx ai-agent-toolkit list           # List runs
npx ai-agent-toolkit status         # Run status
npx ai-agent-toolkit selfcheck      # Validate environment
```

Short form: `npx aat <command>` hoặc `npm run <command>`

## Cấu trúc Repo

```
repo-root/
├── AGENTS.md                    # Agent overview
├── RULES.md                     # Global rules
├── qa.md                        # QA profile
├── LICENSE_POLICY.md            # License policy
├── package.json                 # npm package
│
├── bin/                         # CLI
│   └── ai-agent-toolkit.js      # Main entrypoint
│
├── agents/                      # Agent definitions (6 agents)
│   ├── orchestrator.agent.md
│   ├── ask.agent.md
│   ├── architect.agent.md       # Merged: Research + Debate + Spec
│   ├── design.agent.md
│   ├── code.agent.md
│   ├── qa_gate.agent.md
│   └── debug_security.agent.md
│
├── .agent/
│   ├── lib/                     # Shared utilities
│   │   └── utils.js             # Artifact path helpers
│   │
│   ├── mcp/                     # MCP Servers
│   │   ├── config.json          # MCP configuration
│   │   └── servers/
│   │       ├── github-server.js
│   │       ├── brave-server.js
│   │       └── artifacts-server.js
│   │
│   └── skills/                  # Skills (12 skills)
│       ├── intake/
│       ├── research/
│       ├── brave-search/
│       ├── github/
│       ├── debate/
│       ├── spec-agent/
│       ├── ui-ux/
│       ├── qa-gate/
│       ├── debug-security/
│       ├── orchestrator/
│       ├── code-review/         # NEW
│       └── test-generator/      # NEW
│
├── schemas/                     # JSON Schemas
│   ├── intake.schema.json
│   ├── research.shortlist.schema.json
│   ├── research.reuse_assessment.schema.json
│   ├── debate.inputs_for_spec.schema.json
│   ├── task_breakdown.schema.json
│   └── verification.report.schema.json
│
├── examples/                    # Sample artifacts
│
├── docs/                        # Documentation
│
└── artifacts/                   # Run artifacts
    └── runs/<run_id>/
        ├── 00_user_request.md
        ├── 10_intake/
        ├── 20_research/
        ├── 30_debate/
        ├── 40_spec/
        ├── 45_design/
        ├── 50_implementation/
        └── 60_verification/
```

## Environment Setup

### 1. Copy environment file
```bash
cp .env.example .env
```

### 2. Configure API keys

Edit `.env` and set your keys:

```bash
# Required for brave-search skill
BRAVE_API_KEY=your_brave_api_key_here

# Optional - for higher GitHub API rate limits
GITHUB_TOKEN=your_github_token_here
```

**Get API keys:**
- Brave Search: https://brave.com/search/api/
- GitHub Token: https://github.com/settings/tokens

### 3. Run self-check
```bash
npx ai-agent-toolkit selfcheck
```

---

## MCP Integration

Toolkit provides MCP servers for Claude Desktop integration:

### Configuration

Add to Claude Desktop `claude_desktop_config.json`:

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

### MCP Tools Available

| Server | Tools |
|--------|-------|
| github | `github_search_repos`, `github_repo_info`, `github_repo_contents`, `github_create_issue` |
| brave-search | `brave_web_search`, `brave_news_search` |
| artifacts | `artifacts_list_runs`, `artifacts_init_run`, `artifacts_get_status`, `artifacts_read`, `artifacts_write` |

---

## Quick Start (Script Mode)

### 1. Thu thập Requirements
```bash
npx ai-agent-toolkit intake
# hoặc
node .agent/skills/intake/scripts/start-intake.js
```

### 2. Research Repo mẫu
```bash
npx ai-agent-toolkit research "nodejs auth"
```

### 3. Generate Spec + Tasks
```bash
npx ai-agent-toolkit spec
```

### 4. Code Review
```bash
npx ai-agent-toolkit review --path src/
```

### 5. Generate Tests
```bash
npx ai-agent-toolkit test --run-id <run_id>
```

### 6. Run QA Gate
```bash
npx ai-agent-toolkit qa
```

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

## Agents (6 total)

| Agent | Phases | Description |
|-------|--------|-------------|
| Orchestrator | All | Main controller, routing |
| Ask | Intake | Requirements gathering |
| Architect | Research, Debate, Spec | Discovery + decision + specification |
| Design | Design | UI/UX handoff |
| Code | Implementation | Lane execution |
| QA Gate | Verification | Quality checks |
| Debug/Security | Debug | Issue resolution |

## Documentation

- [AGENTS.md](AGENTS.md) - Full agent reference
- [RULES.md](RULES.md) - Lane và scope rules
- [qa.md](qa.md) - QA commands và criteria
- [LICENSE_POLICY.md](LICENSE_POLICY.md) - License allowlist/blocklist
- [docs/ORCHESTRATOR_ADAPTER.md](docs/ORCHESTRATOR_ADAPTER.md) - Adapter contract
- [docs/QA_TRIAGE.md](docs/QA_TRIAGE.md) - Triage protocol

## IDE Integration

### VS Code
```json
{
  "tasks": [
    {
      "label": "AAT: Review",
      "type": "shell",
      "command": "npx ai-agent-toolkit review --path ${workspaceFolder}/src"
    }
  ]
}
```

### Cursor / Windsurf
Copy `.agent/` folder and `AGENTS.md` to your project root.

## References

- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
