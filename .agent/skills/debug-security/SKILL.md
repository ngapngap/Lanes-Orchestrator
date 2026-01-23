# Debug-Security Skill

## Overview
Debug root cause analysis and security review skill.

## Modes

### Debug Mode
- Triggered when QA Gate fails
- Performs root cause analysis
- Creates fix plan

### Security Mode
- Triggered by user request or security issues
- Runs security scans
- Reviews dependencies

## Usage

```bash
# Debug mode - analyze QA failures
node .agent/skills/debug-security/scripts/debug.js --report report.json

# Security mode - run security review
node .agent/skills/debug-security/scripts/security.js --path ./src

# Combined analysis
node .agent/skills/debug-security/scripts/analyze.js --mode all
```

## Debug Inputs
- `60_verification/report.json` - QA report with failures
- Test output logs
- Build error logs

## Security Inputs
- Source code paths
- Dependency manifests (package.json, requirements.txt)
- Configuration files

## Debug Outputs
- `60_verification/debug_report.md`

## Security Outputs
- `60_verification/security_review.md`

## Security Checks

| Check | Tool | Description |
|-------|------|-------------|
| Secret Scan | gitleaks | Find committed secrets |
| Dependency Audit | npm audit / pip-audit | CVE detection |
| SAST | (optional) | Static analysis |
| License Check | license-checker | License compliance |

## Commands

### Run Secret Scan
```bash
node .agent/skills/debug-security/scripts/security.js secret-scan
```

### Run Dependency Audit
```bash
node .agent/skills/debug-security/scripts/security.js dep-audit
```

### Generate Security Review
```bash
node .agent/skills/debug-security/scripts/security.js review --output security_review.md
```

## Integration
Used by `Debug/Security` agent when QA Gate fails or security review requested.
