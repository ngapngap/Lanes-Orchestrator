# AI Agent Toolkit

Pipeline hoàn chỉnh cho vòng đời phát triển phần mềm, điều phối bởi AI agents.

## Tổng quan

Bộ kit cung cấp **agents + skills + artifact contracts + gates** để chạy quy trình:

```
Orchestrator → Ask(Intake) → Architect(Research) → Debate → Architect(Spec) → Design? → Code → QA Gate → Debug/Security
```

## Cấu trúc Repo

```
repo-root/
├── AGENTS.md                    # Agent overview
├── RULES.md                     # Global rules
├── qa.md                        # QA profile
├── LICENSE_POLICY.md            # License policy
│
├── agents/                      # Agent definitions
│   ├── orchestrator.agent.md
│   ├── ask.agent.md
│   ├── architect.agent.md
│   ├── debate.agent.md
│   ├── spec.agent.md
│   ├── design.agent.md
│   ├── code.agent.md
│   ├── qa_gate.agent.md
│   └── debug_security.agent.md
│
├── .agent/skills/               # Skills
│   ├── intake/
│   ├── research/
│   ├── brave-search/
│   ├── github/
│   ├── debate/
│   ├── spec-agent/
│   ├── ui-ux/
│   ├── qa-gate/
│   ├── debug-security/
│   └── orchestrator/
│
├── schemas/                     # JSON Schemas
│   ├── intake.schema.json
│   ├── research.shortlist.schema.json
│   ├── search.reuse_assessment.schema.json
│   ├── debate.inputs_for_spec.schema.json
│   ├── task_breakdown.schema.json
│   └── verification.report.schema.json
│
├── examples/                    # Sample artifacts
│   ├── intake.example.json
│   ├── research.shortlist.example.json
│   ├── research.reuse_assessment.example.json
│   ├── debate.inputs_for_spec.example.json
│   ├── task_breakdown.example.json
│   └── verification.report.example.json
│
├── docs/                        # Documentation
│   ├── ORCHESTRATOR_ADAPTER.md
│   └── QA_TRIAGE.md
│
└── artifacts/                   # Run artifacts
    └── runs/<run_id>/
```

## Quick Start

### 1. Thu thập Requirements
```bash
node .agent/skills/intake/scripts/start-intake.js
```

### 2. Research Repo mẫu
```bash
node .agent/skills/research/scripts/search-github.js
```

### 3. Debate (Council Decision)
```bash
node .agent/skills/debate/scripts/debate.js --input research.shortlist.json
```

### 4. Generate Spec + Tasks
```bash
node .agent/skills/spec-agent/scripts/generate-spec.js --debate debate.inputs_for_spec.json
node .agent/skills/spec-agent/scripts/generate-tasks.js --debate debate.inputs_for_spec.json
```

### 5. Run QA Gate
```bash
node .agent/skills/qa-gate/scripts/run-gate.js
```

### 6. Debug (nếu cần)
```bash
node .agent/skills/debug-security/scripts/debug.js --report report.json
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
