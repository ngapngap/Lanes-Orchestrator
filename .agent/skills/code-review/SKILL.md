# Code Review Skill

## Description
Automated code review with security, quality, and standards compliance checks.

## Triggers
- `review code`
- `code review`
- `/review`
- Post-implementation lane completion

## Usage

```bash
# Review specific files
npx ai-agent-toolkit review --files src/api/*.js

# Review PR changes
npx ai-agent-toolkit review --pr

# Review entire implementation
npx ai-agent-toolkit review --run-id <run_id>
```

## Review Categories

### 1. Security Review
- SQL injection vulnerabilities
- XSS vulnerabilities
- Command injection
- Hardcoded credentials
- Insecure dependencies
- OWASP Top 10 compliance

### 2. Code Quality
- Code complexity (cyclomatic)
- Function length limits
- DRY violations
- Dead code detection
- Naming conventions
- Comment quality

### 3. Standards Compliance
- ESLint/Prettier rules
- TypeScript strict mode
- Project conventions
- API design standards
- Error handling patterns

### 4. Performance
- N+1 query detection
- Memory leaks
- Inefficient algorithms
- Bundle size impact
- Unnecessary re-renders (React)

### 5. Test Coverage
- Unit test coverage %
- Edge cases covered
- Mocking patterns
- Integration test presence

## Output Format

### Summary
```json
{
  "review_id": "rev_20250123_1430",
  "files_reviewed": 15,
  "issues": {
    "critical": 2,
    "major": 5,
    "minor": 12,
    "info": 8
  },
  "passed": false,
  "blocking_issues": ["SEC-001", "PERF-003"]
}
```

### Issues File
`60_verification/review.issues.json`

```json
{
  "issues": [
    {
      "id": "SEC-001",
      "severity": "critical",
      "category": "security",
      "file": "src/api/auth.js",
      "line": 45,
      "rule": "no-sql-injection",
      "message": "Potential SQL injection vulnerability",
      "suggestion": "Use parameterized queries instead of string concatenation",
      "code_snippet": "const query = `SELECT * FROM users WHERE id = ${userId}`"
    }
  ]
}
```

### Human-Readable Report
`60_verification/review.md`

## Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| **critical** | Security vulnerabilities, data loss risk | Block merge |
| **major** | Significant bugs, performance issues | Require fix |
| **minor** | Code style, minor improvements | Recommended |
| **info** | Suggestions, best practices | Optional |

## Integration

### Pre-commit Hook
```bash
#!/bin/bash
npx ai-agent-toolkit review --staged
```

### CI/CD Pipeline
```yaml
review:
  script:
    - npx ai-agent-toolkit review --pr
  rules:
    - if: $CI_MERGE_REQUEST_ID
```

### VS Code Task
```json
{
  "label": "Code Review",
  "type": "shell",
  "command": "npx ai-agent-toolkit review --files ${file}"
}
```

## Configuration

`.agent/config/review.config.json`

```json
{
  "severity_threshold": "major",
  "categories": {
    "security": true,
    "quality": true,
    "performance": true,
    "standards": true,
    "tests": true
  },
  "ignore_patterns": [
    "**/*.test.js",
    "**/node_modules/**",
    "**/dist/**"
  ],
  "custom_rules": [
    {
      "id": "PROJ-001",
      "pattern": "console\\.log",
      "message": "Remove console.log before merge",
      "severity": "minor"
    }
  ]
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Has blocking issues (critical/major) |
| 2 | Configuration error |
| 3 | File not found |
