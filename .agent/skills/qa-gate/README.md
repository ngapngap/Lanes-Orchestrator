# QA-Gate Skill

Verify code quality trước khi merge/bàn giao.

## Quick Start

```bash
# Run full QA gate
node ".agent/skills/qa-gate/scripts/run-gate.js"

# View last report
node ".agent/skills/qa-gate/scripts/view-report.js"
```

## Checks Performed

1. **Tests** - Unit, Integration, E2E
2. **Lint** - ESLint, Biome, Prettier
3. **TypeCheck** - TypeScript compiler
4. **Build** - Production build
5. **Security** - npm audit

## Output

- `output/verification/report.json` - Structured report
- `output/verification/tests.md` - Human-readable report

## Policies

- **strict** - For production (100% tests pass)
- **standard** - For development (90% tests pass)
- **lenient** - For prototypes (build only)

## Xem chi tiết

Đọc [SKILL.md](./SKILL.md) để hiểu workflow đầy đủ.
