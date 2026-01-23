# AI Agent Toolkit — AGENTS.md

## Overview

Pipeline hoàn chỉnh cho vòng đời phát triển phần mềm, điều phối bởi AI agents.

```
Orchestrator → Ask(Intake) → Architect(Research) → Debate → Architect(Spec) → Design? → Code → QA Gate → Debug/Security
```

## Agents

| Agent | File | Role | Skills |
|-------|------|------|--------|
| **Orchestrator** | `agents/orchestrator.agent.md` | Điều phối pipeline | orchestrator, debate |
| **Ask** | `agents/ask.agent.md` | Thu thập requirements | intake |
| **Architect** | `agents/architect.agent.md` | Research + Spec | research, brave-search, github, spec-agent |
| **Debate** | `agents/debate.agent.md` | Council decision | debate |
| **Spec** | `agents/spec.agent.md` | Task breakdown | spec-agent |
| **Design** | `agents/design.agent.md` | UI/UX handoff (optional) | ui-ux |
| **Code** | `agents/code.agent.md` | Implementation | (per language) |
| **QA Gate** | `agents/qa_gate.agent.md` | Verification | qa-gate |
| **Debug/Security** | `agents/debug_security.agent.md` | Root cause + Security | debug-security |

## Skills

| Skill | Path | Purpose |
|-------|------|---------|
| intake | `.agent/skills/intake/` | Requirements gathering |
| research | `.agent/skills/research/` | Repo/pattern discovery |
| brave-search | `.agent/skills/brave-search/` | Web search API |
| github | `.agent/skills/github/` | GitHub operations |
| debate | `.agent/skills/debate/` | Council debate |
| spec-agent | `.agent/skills/spec-agent/` | Spec + DAG generation |
| ui-ux | `.agent/skills/ui-ux/` | Design system |
| qa-gate | `.agent/skills/qa-gate/` | Verification |
| debug-security | `.agent/skills/debug-security/` | Debug + Security |
| orchestrator | `.agent/skills/orchestrator/` | Lane coordination |

## Gates

| Gate ID | Check | On Fail |
|---------|-------|---------|
| `intake_ready` | intake.json exists + valid | rerun Ask |
| `reuse_gate_passed` | shortlist + assessment exist | rerun Research |
| `debate_ready_for_spec` | debate.inputs_for_spec.json valid | rerun Debate |
| `spec_ready` | spec.md + task_breakdown.json valid | rerun Spec |
| `lane_handoff_ready` | handoff bundles complete | rerun Code |
| `qa_passed` | report.json.status = pass | route Debug → Spec |

## Lanes

| Lane | Responsibility |
|------|----------------|
| `ui` | Frontend, UI components |
| `api` | Backend, API endpoints |
| `data` | Database, migrations |
| `qa` | Testing, quality |
| `security` | Security, compliance |

## Pipeline Flow

```
User Request
    │
    ▼
┌───────────────────────────────────────────────────────────┐
│                     DISCOVERY PHASE                        │
│  Ask (Intake) ──► Architect (Research)                    │
│  (intake.json)   (shortlist.json, patterns.md)            │
└───────────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────────────────┐
│                     PLANNING PHASE                         │
│  Debate ──► Architect (Spec)  ──► Design (optional)       │
│  (decision.md)  (spec.md, DAG)   (handoff.md)             │
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
│  QA Gate ──► (if fail) ──► Debug/Security                 │
│  (report.json)            (debug_report.md)               │
└───────────────────────────────────────────────────────────┘
    │
    ▼
  COMPLETE
```

## Artifacts Layout

```
artifacts/runs/<run_id>/
├── 00_user_request.md
├── 10_intake/
│   ├── intake.json
│   └── intake.summary.md
├── 20_research/
│   ├── research.shortlist.json
│   ├── research.reuse_assessment.json
│   ├── research.patterns.md
│   └── research.onepager.md
├── 30_debate/
│   ├── debate.inputs_for_spec.json
│   └── debate.decision.md
├── 40_spec/
│   ├── spec.md
│   └── task_breakdown.json
├── 45_design/
│   └── handoff.md
├── 50_implementation/
│   └── handoff/<lane>/
├── 60_verification/
│   ├── report.json
│   ├── summary.md
│   ├── debug_report.md
│   └── security_review.md
```

## Quick Start

```bash
# 1. Thu thập Requirements
node .agent/skills/intake/scripts/start-intake.js

# 2. Research
node .agent/skills/research/scripts/search-github.js

# 3. Debate
node .agent/skills/debate/scripts/debate.js --input research.shortlist.json

# 4. Generate Spec
node .agent/skills/spec-agent/scripts/generate-spec.js --debate debate.inputs_for_spec.json

# 5. Run QA Gate
node .agent/skills/qa-gate/scripts/run-gate.js

# 6. Debug (if needed)
node .agent/skills/debug-security/scripts/debug.js --report report.json
```

## Documentation

- [RULES.md](RULES.md) - Global rules
- [qa.md](qa.md) - QA profile
- [LICENSE_POLICY.md](LICENSE_POLICY.md) - License policy
- [docs/ORCHESTRATOR_ADAPTER.md](docs/ORCHESTRATOR_ADAPTER.md) - Adapter contract
- [docs/QA_TRIAGE.md](docs/QA_TRIAGE.md) - Triage protocol

## References

- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
