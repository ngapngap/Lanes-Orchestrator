# LICENSE_POLICY.md

## Overview
License policy for dependency and repo reuse decisions.

## License Categories

### Allowlist (Safe to Use)
| License | Usage |
|---------|-------|
| MIT | Any use |
| Apache-2.0 | Any use |
| BSD-2-Clause | Any use |
| BSD-3-Clause | Any use |
| ISC | Any use |
| CC0-1.0 | Any use |
| Unlicense | Any use |

### Blocklist (Do Not Use)
| License | Reason |
|---------|--------|
| GPL-3.0 | Copyleft - viral |
| GPL-2.0 | Copyleft - viral |
| AGPL-3.0 | Strong copyleft |
| SSPL | Not OSI approved |
| Commons Clause | Commercial restrictions |

### Review Required
| License | Action |
|---------|--------|
| LGPL-3.0 | Legal review needed |
| LGPL-2.1 | Legal review needed |
| MPL-2.0 | File-level copyleft |
| CC-BY-4.0 | Attribution required |
| CC-BY-SA-4.0 | Share-alike |
| EPL-2.0 | Legal review |
| Unknown | Must identify before use |

## Policy Application

### For Dependencies (npm, pip, etc.)
1. Check license of direct dependency
2. Allowlist → Proceed
3. Blocklist → Find alternative
4. Review Required → Escalate to User

### For Repo Reuse
1. Check LICENSE file
2. Check individual file headers
3. Verify consistent licensing
4. Document in `research.reuse_assessment.json`

## Reuse Assessment Status

```json
{
  "license_check": {
    "license": "MIT",
    "policy": "allowlist",
    "status": "allowed"
  }
}
```

### Status Values
| Value | Meaning |
|-------|---------|
| `allowed` | Safe to proceed |
| `blocked` | Cannot use, find alternative |
| `unknown_requires_approval` | Escalate to user |

## Compliance Checks

### Before Reuse
- [ ] License file exists
- [ ] License is on allowlist
- [ ] No conflicting file headers
- [ ] Dependencies also checked

### Documentation Required
- License name in shortlist
- License status in reuse_assessment
- Any attribution requirements noted

## Attribution Requirements

For licenses requiring attribution (Apache-2.0, MIT, BSD):
1. Keep original LICENSE/NOTICE files
2. Include attribution in project README
3. Maintain copyright headers

## Escalation

### When to Escalate
- License not recognized
- Mixed licenses in repo
- Commercial use restrictions unclear
- Patent clauses need review

### Escalation Path
1. Flag in `license_check.status = "unknown_requires_approval"`
2. QA Gate routes to User
3. User makes final decision
4. Document decision in Debate artifacts
