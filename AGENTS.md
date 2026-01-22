# AI Agent Toolkit - Pipeline cho Vòng đời Dự án

## Tổng quan

Đây là một **pipeline hoàn chỉnh** cho vòng đời phát triển phần mềm, được điều phối bởi AI agents. Pipeline bao gồm 6 skills chính và 10 agent configurations.

## Quick Start

### 1. Thu thập Requirements
```bash
node ".agent/skills/intake/scripts/start-intake.js"
```

### 2. Tìm kiếm Repo mẫu
```bash
node ".agent/skills/research/scripts/search-github.js"
```

### 3. Tạo Design System
```bash
node ".agent/skills/ui-ux/scripts/generate-design.js"
```

### 4. Verify Code Quality
```bash
node ".agent/skills/qa-gate/scripts/run-gate.js"
```

## Cấu trúc Dự án

```
.agent/
├── skills/                    # Các skills
│   ├── intake/               # Thu thập requirements
│   ├── research/             # Tìm repo mẫu
│   ├── spec-kit-creator/     # Tạo specifications
│   ├── orchestrator/         # Điều phối lanes
│   ├── ui-ux/                # Thiết kế UI/UX
│   └── qa-gate/              # Verify code quality
│
├── agents/                    # Agent configurations
│   ├── manager.md            # Điều phối pipeline
│   ├── intake-agent.md       # Thu thập requirements
│   ├── research-agent.md     # Tìm patterns
│   ├── spec-agent.md         # Tạo specs
│   ├── ui-ux-agent.md        # Thiết kế
│   ├── verifier-agent.md     # Verify
│   └── lane-agents/          # Các lane agents
│       ├── ui-lane.md
│       ├── api-lane.md
│       ├── data-lane.md
│       └── qa-lane.md
│
└── workflows/                 # Quy trình làm việc
    ├── full-pipeline.md      # Đầy đủ
    ├── quick-flow.md         # Nhanh
    └── enterprise.md         # Doanh nghiệp
```

## Skills

| Skill | Mô tả | Status |
|-------|-------|--------|
| **intake** | Thu thập requirements từ user | ✅ |
| **research** | Tìm repo mẫu trên GitHub | ✅ |
| **spec-kit-creator** | Tạo specifications | ✅ |
| **orchestrator** | Điều phối lanes | ✅ |
| **ui-ux** | Thiết kế UI/UX | ✅ |
| **qa-gate** | Verify code quality | ✅ |

## Agents

| Agent | Nhiệm vụ | Skills Used |
|-------|----------|-------------|
| **Manager** | Điều phối pipeline | orchestrator |
| **Intake** | Thu thập requirements | intake |
| **Research** | Tìm patterns | research |
| **Spec** | Tạo specifications | spec-kit-creator |
| **UI/UX** | Thiết kế giao diện | ui-ux |
| **Verifier** | Verify code | qa-gate |
| **Lane Agents** | Triển khai code | orchestrator |

## Pipeline Flow

```
User Request
    │
    ▼
┌───────────────────────────────────────────────────────────┐
│                     DISCOVERY PHASE                        │
│  Intake Agent ──► Research Agent                          │
│  (intake.md)      (patterns.md)                           │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────┐
│                     PLANNING PHASE                         │
│  Spec Agent ──► UI/UX Agent (optional)                    │
│  (specs/)       (design/MASTER.md)                        │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────┐
│                      BUILD PHASE                           │
│            ┌─────────┬─────────┬─────────┐               │
│            │ UI Lane │API Lane │Data Lane│               │
│            └─────────┴─────────┴─────────┘               │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────┐
│                     VERIFY PHASE                           │
│  Verifier Agent ──► report.json                           │
└───────────────────────────────────────────────────────────┘
    │
    ▼
  COMPLETE
```

## Workflows

| Workflow | Khi nào dùng | Thời gian |
|----------|--------------|-----------|
| **Quick Flow** | Bug fixes, small changes | < 1 giờ |
| **Full Pipeline** | New features, products | 1-4 tuần |
| **Enterprise** | Compliance-heavy systems | 8-20 tuần |

## Output Structure

```
output/
├── intake/
│   └── intake.md              # Requirements document
├── research/
│   ├── shortlist.json         # Top repos
│   └── patterns.md            # Recommendations
├── design/
│   ├── MASTER.md              # Design system
│   ├── pages/*.md             # Page specs
│   └── handoff.md             # Developer handoff
└── verification/
    ├── report.json            # QA report
    └── tests.md               # Human-readable report
```

## Rule of Thumb

| Tình huống | Skill cần gọi |
|------------|---------------|
| User đưa ý tưởng mơ hồ | `intake` |
| Chưa rõ cách làm | `research` |
| Đã chốt hướng | `spec-kit` |
| Có UI phức tạp | `ui-ux` |
| Triển khai song song | `orchestrator` |
| Trước khi merge | `qa-gate` |

## Tham khảo

- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) - AI-driven development framework
- [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) - Design intelligence
