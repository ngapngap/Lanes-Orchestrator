# Quick Flow Workflow

## Overview
Quy trình nhanh cho bug fixes, small features, và minor changes.

## Khi nào sử dụng
- Bug fixes
- Small features (< 1 day work)
- Minor UI changes
- Documentation updates
- Dependency updates

## Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    QUICK FLOW                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   User Request                                              │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────┐                                          │
│   │   MANAGER   │  Quick assessment:                       │
│   │  (Assess)   │  - Is it really quick?                   │
│   └──────┬──────┘  - Which lane?                           │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │   SINGLE    │  Direct implementation                   │
│   │    LANE     │  (UI or API or Data)                     │
│   └──────┬──────┘                                          │
│          │                                                  │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │  VERIFIER   │  Quick verify                            │
│   │  (Minimal)  │  (tests + build only)                    │
│   └──────┬──────┘                                          │
│          │                                                  │
│          ▼                                                  │
│       COMPLETE                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Phases

### Phase 1: Quick Assessment

Manager đánh giá nhanh:

| Question | If Yes | If No |
|----------|--------|-------|
| Single file change? | Quick Flow | Consider Full |
| Clear requirements? | Proceed | Ask user |
| Tests exist? | Run them | Consider adding |
| Affects multiple areas? | Switch to Full | Proceed |

### Phase 2: Direct Implementation

Chọn **một** lane phù hợp:

| Change Type | Lane |
|-------------|------|
| UI tweak | UI Lane |
| API fix | API Lane |
| Config change | Data Lane |
| Test fix | QA Lane |

### Phase 3: Minimal Verify

Chỉ chạy:
- Existing tests (không viết thêm)
- Build
- Quick lint

## Example Runs

### Bug Fix Example
```
[USER] Fix login button not working on mobile

[MANAGER] Quick Flow: UI Lane

[UI LANE]
  - Found issue: touch handler missing
  - Fixed in Button.tsx
  - Tested on responsive

[VERIFIER]
  - Tests: Pass
  - Build: Pass

[COMPLETE] Fixed in 5 minutes
```

### Small Feature Example
```
[USER] Add "Remember Me" checkbox to login

[MANAGER] Quick Flow: UI Lane (+ API touch)

[UI LANE]
  - Added checkbox component
  - Updated login form

[API LANE]
  - Modified session duration logic

[VERIFIER]
  - Tests: Pass
  - Build: Pass

[COMPLETE] Done in 15 minutes
```

### Dependency Update Example
```
[USER] Update Next.js to v14

[MANAGER] Quick Flow: Data Lane

[DATA LANE]
  - Updated package.json
  - Ran npm install
  - Fixed breaking changes

[VERIFIER]
  - Tests: Pass (2 needed fix)
  - Build: Pass

[COMPLETE] Updated with minor fixes
```

## Decision Matrix

### Use Quick Flow When:

| Condition | Check |
|-----------|-------|
| Scope is clear | ✓ |
| Change is isolated | ✓ |
| No new architecture | ✓ |
| Existing tests cover it | ✓ |
| Single lane sufficient | ✓ |

### Upgrade to Full Pipeline When:

| Condition | Action |
|-----------|--------|
| Scope unclear | → Discovery phase |
| Multiple lanes needed | → Full pipeline |
| New feature design | → Planning phase |
| Major refactoring | → Full pipeline |

## Time Expectations

| Task Type | Expected Time |
|-----------|---------------|
| Typo fix | < 5 minutes |
| Small UI fix | 5-15 minutes |
| Bug fix | 15-30 minutes |
| Small feature | 30-60 minutes |

If exceeds 1 hour → Consider upgrading to Full Pipeline

## Commands

```bash
# Start quick flow
node ".agent/workflows/run-pipeline.js" --workflow quick

# Specify lane directly
node ".agent/workflows/run-pipeline.js" --workflow quick --lane ui
```

## Checklist Before Merge

- [ ] Change works as expected
- [ ] Existing tests pass
- [ ] Build succeeds
- [ ] No console errors
- [ ] Visually verified (if UI)
