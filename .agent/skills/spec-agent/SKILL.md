# Spec Agent Skill

## Overview
Transform debate decisions into actionable specifications and task DAG.

## Usage

```bash
# Generate spec from debate inputs
node .agent/skills/spec-agent/scripts/generate-spec.js --debate debate.inputs_for_spec.json --intake intake.json

# Generate task breakdown DAG
node .agent/skills/spec-agent/scripts/generate-tasks.js --debate debate.inputs_for_spec.json --output task_breakdown.json
```

## Inputs
- `30_debate/debate.inputs_for_spec.json`
- `10_intake/intake.json` (for constraints reference)

## Outputs
- `40_spec/spec.md` - Full specification document
- `40_spec/task_breakdown.json` - DAG of tasks

## spec.md Structure

```markdown
# spec.md

## Context
[Project context from intake]

## Scope
- MVP: [items from intake.mvp_scope]
- Non-goals: [items from intake.non_goals]

## Decisions (from debate)
- Recommended approach: [chosen_option]
- Reference repos: [if reuse path]
- Key decisions: [from debate.decision]

## Plan & Milestones
[Milestone breakdown]

## Tasks by lane
[Grouped by owner_lane]

## Verification
See qa.md

## Open questions
- Blocking: [must resolve before proceeding]
- Non-blocking: [can resolve during implementation]
```

## Task DAG Rules

1. Every task has unique `node_id`
2. `depends_on` references valid node_ids
3. No cycles in DAG
4. Each task has `owner_lane`
5. Each task has `validation_cmd`

## Validation

```bash
# Validate task_breakdown.json against schema
node .agent/skills/spec-agent/scripts/validate.js --file task_breakdown.json
```
