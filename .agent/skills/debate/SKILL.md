# Debate Skill

## Overview
Council-style debate skill for decision making with multiple perspectives.

## Modes

### IDE Mode (Single Model)
One model plays multiple roles sequentially.

### Runner Mode (Multi-Model)
Multiple models participate as different council members.

## Council Roles

| Role | Responsibility |
|------|----------------|
| **Architect A** | Propose practical, proven solution |
| **Architect B** | Propose alternative approach |
| **Critic C** | Identify weaknesses and gaps |
| **Devil's Advocate D** | Challenge assumptions |
| **Lead** | Moderate discussion and make final decision |

## Scoring Rubric

| Criterion | Weight | Description |
|-----------|--------|-------------|
| constraint_compliance | 0.30 | Fits within project constraints |
| practicality | 0.25 | Can be implemented effectively |
| risk_awareness | 0.25 | Risks identified and mitigated |
| clarity | 0.20 | Clear and understandable |

## Usage

```bash
# Run debate in IDE mode (single model)
node .agent/skills/debate/scripts/debate.js --mode ide --input research.shortlist.json

# Run debate with config file
node .agent/skills/debate/scripts/debate.js --config debate-config.json
```

## Inputs
- `20_research/research.shortlist.json`
- `20_research/research.reuse_assessment.json`
- `20_research/research.patterns.md`

## Outputs
- `30_debate/debate.inputs_for_spec.json`
- `30_debate/debate.decision.md`

## Output Schema

See `schemas/debate.inputs_for_spec.schema.json`

## Decision Lock
- Once decision is locked, changes require re-running Debate
- Prevents silent scope changes during implementation
