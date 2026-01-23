# qa.md

## Overview
Quality assurance profile and verification commands.

## Profile

```
Type: node|python|web
Language: JavaScript/TypeScript
Framework: [varies by project]
```

## Commands

Execute in order. All must pass for QA Gate to pass.

### 1. Format Check
```bash
npm run format:check
# or: prettier --check .
```

### 2. Lint
```bash
npm run lint
# or: eslint . --ext .ts,.tsx,.js,.jsx
```

### 3. Type Check
```bash
npm run typecheck
# or: tsc --noEmit
```

### 4. Unit Tests
```bash
npm test
# or: jest --coverage
```

### 5. E2E Tests (Optional)
```bash
npm run test:e2e
# or: playwright test
```

## Pass Criteria

| Command | Exit Code | Coverage |
|---------|-----------|----------|
| format | 0 | - |
| lint | 0 | - |
| typecheck | 0 | - |
| test | 0 | >= 80% |
| e2e | 0 | - |

**Overall:** All commands must exit with code 0.

## Evidence Collection

### Required Artifacts
- `artifacts/runs/<run_id>/60_verification/report.json`
- `artifacts/runs/<run_id>/60_verification/summary.md`

### Optional Artifacts
- `artifacts/runs/<run_id>/60_verification/logs/` - Command outputs
- `artifacts/runs/<run_id>/60_verification/coverage/` - Coverage reports

## Iteration Rules

### Max Reruns
- QA Gate: 2 reruns max
- Debug cycle: 2 reruns max

### Escalation
After max reruns exceeded:
1. Escalate to Spec for design review
2. If scope issue → Escalate to Debate
3. If fundamental → Escalate to User

## Execution Modes

### fast_build
Minimum checks for quick iteration:
1. Schema validation
2. Lint (warnings allowed)
3. Smoke tests only

### standard_pipeline
Full verification:
1. All commands in order
2. Coverage thresholds enforced
3. E2E if configured

## Profile Templates

### Node.js Project
```json
{
  "profile": "node",
  "commands": {
    "format": "prettier --check .",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "e2e": "playwright test"
  }
}
```

### Python Project
```json
{
  "profile": "python",
  "commands": {
    "format": "black --check .",
    "lint": "ruff .",
    "typecheck": "mypy .",
    "test": "pytest",
    "e2e": "pytest tests/e2e"
  }
}
```
