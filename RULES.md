# RULES.md

## Overview
Global rules that all agents and lanes must follow.

## Lanes

### Lane IDs (P0)
| Lane | Responsibility |
|------|----------------|
| `ui` | Frontend, UI components, client-side logic |
| `api` | Backend, API endpoints, server-side logic |
| `data` | Database, migrations, data models |
| `qa` | Testing, quality assurance |
| `security` | Security measures, audits, compliance |

## Scope Control

### Rule 1: No Silent Scope Changes
No lane may change scope/architecture without routing back to Orchestrator/Architect.

### Rule 2: Interface Contracts
Cross-lane interfaces must be documented in `interfaces.md`. Any change requires:
1. Update `interfaces.md` in affected lanes
2. Notify dependent lanes in handoff
3. Escalate to Orchestrator if breaking change

### Rule 3: Decision Lock
Once `debate.inputs_for_spec.json.decision_lock.locked = true`:
- Changes require re-running Debate phase
- Update Spec accordingly
- No silent assumption changes

## Handoff Requirements

### Minimum Bundle (P0)
Each lane MUST produce:
```
50_implementation/handoff/<lane>/
├── README.md           # Overview
├── acceptance.md       # Acceptance criteria
├── interfaces.md       # API contracts
├── data_schema.md      # Data models
├── env.example         # Environment variables
└── test_plan.md        # Testing strategy
```

## Coding Standards

### General
- No hardcoded secrets (use env variables)
- All code must pass lint/typecheck
- Unit tests required for business logic
- Document public APIs

### Security
- Input validation required
- SQL injection prevention
- XSS prevention for web apps
- Secrets in `.env` (never committed)

## Git Workflow

### Branch Naming
- `feature/<task-id>-<description>`
- `fix/<task-id>-<description>`
- `hotfix/<description>`

### Commit Messages
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Escalation Paths

| Situation | Escalate To |
|-----------|-------------|
| Scope creep detected | Orchestrator |
| Interface conflict | Architect |
| Decision disagreement | Debate |
| QA fail 2+ times | Spec |
| Security/License issue | User |
