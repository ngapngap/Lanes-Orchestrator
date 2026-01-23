# QA Gate — Report Schema + Triage Protocol (P0)

## Overview

Biến QA Gate thành một **bước deterministic**: chạy gì, ghi gì, fail thì route đi đâu.

---

## 1. Report Contract (Single Source of Truth)

### Required File
```
artifacts/runs/<run_id>/60_verification/report.json
```

### Schema Validation
```
schemas/verification.report.schema.json
```

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | `pass\|fail` | Overall result |
| `commands[]` | array | Commands executed with exit codes |
| `evidence` | object | Artifacts và links chứng minh |
| `summary.highlights[]` | array | Điều quan trọng nhất |
| `summary.top_failures[]` | array | Top lỗi gây fail |

**Rule:** QA agent MUST write `report.json` kể cả khi fail sớm.

---

## 2. Execution Modes

### 2.1 fast_build (Minimum Viable QA)

Bắt buộc:
1. Schema validation (all required artifacts)
2. Lint/typecheck nếu có
3. Smoke/unit tests tối thiểu

### 2.2 standard_pipeline

Tuân theo `qa.md` đầy đủ:
1. Format check
2. Lint
3. Type check
4. Unit tests
5. E2E tests (if configured)

---

## 3. Triage Protocol

### 3.1 Counters

| Counter | Description |
|---------|-------------|
| `qa_rerun_count` | Số lần rerun QA cho cùng run_id |
| `debug_rerun_count` | Số lần rerun Debug/Security |

### 3.2 Routing Rules

#### A) Fail do Schema Validation
- **Ví dụ:** Thiếu file, JSON invalid, schema mismatch
- **Action:** `rerun_step` = step tạo artifact (Intake/Research/Debate/Spec)
- **Note:** Không vào Debug (chưa có đầu vào hợp lệ)

#### B) Fail do Test/Lint/Typecheck/Build
- **Action:** Route sang `Debug` để fix nhanh + update tests
- **After Debug:** Rerun QA

#### C) Fail Lặp Lại (qa_rerun_count >= 2)
- **Dấu hiệu:** Test fail vì spec thiếu cases, interface sai, requirement không rõ
- **Actions:**
  - `escalate_to_spec` nếu lỗi thuộc thiết kế/requirements
  - `escalate_to_debate` nếu có tranh chấp hướng đi / tradeoff chưa chốt

#### D) Security/Licensing Gate Fail
- **Action:** Route `Security` lane
- **Escalate:** Nếu `license_check.status = unknown_requires_approval` hoặc phát hiện secret leak → `escalate_to_user`

---

## 4. Triage Decision Tree

```
QA Gate Result
    │
    ├─ PASS → Proceed to next step
    │
    └─ FAIL
        │
        ├─ Schema validation fail?
        │   └─ YES → rerun_step (artifact generator)
        │
        ├─ Test/Lint/Build fail?
        │   └─ YES → Route to Debug agent
        │            │
        │            └─ After fix → Rerun QA
        │                            │
        │                            ├─ qa_rerun_count < 2?
        │                            │   └─ YES → Continue debug cycle
        │                            │
        │                            └─ qa_rerun_count >= 2?
        │                                └─ Analyze failure type
        │                                    │
        │                                    ├─ Design/requirement issue?
        │                                    │   └─ escalate_to_spec
        │                                    │
        │                                    └─ Decision conflict?
        │                                        └─ escalate_to_debate
        │
        └─ Security/License fail?
            └─ YES → Route to Security agent
                     │
                     ├─ Fixable? → Fix and rerun
                     │
                     └─ Needs approval? → escalate_to_user
```

---

## 5. Debug Output (Recommended)

Khi QA fail và route Debug/Security:

### debug_report.md

```markdown
# Debug Report

## Failure Summary
[Brief description]

## Root Cause Analysis
### Issue 1
- Symptom: [what failed]
- Root cause: [why]
- Evidence: [logs/traces]

## Fix Plan
### Fix 1
- Files: [list]
- Changes: [description]
- Tests to add: [list]

## New Tasks
- [ ] [task description]
```

### security_review.md

```markdown
# Security Review

## Scan Results
- Secret scan: pass/fail
- Dependency audit: pass/fail

## Findings
### [Severity] [Name]
- Location: [file:line]
- Remediation: [how to fix]
```

---

## 6. Integration with Orchestrator

### Event Flow

```
Orchestrator
    │
    ├─ Run QA Gate
    │   └─ qa-gate skill executes qa.md
    │
    ├─ Read report.json
    │   └─ evaluate_gate('qa_passed', runRoot)
    │
    ├─ If PASS
    │   └─ proceed to Complete
    │
    └─ If FAIL
        └─ Apply triage routing rules
            │
            ├─ rerun_step → Re-execute failed step
            ├─ route_debug → Invoke debug_security agent
            ├─ escalate_to_spec → Jump back to Spec phase
            ├─ escalate_to_debate → Jump back to Debate phase
            └─ escalate_to_user → Notify human
```

---

## 7. Evidence Requirements

### Minimum Evidence (P0)
- `report.json` - Always required
- `summary.md` - Human readable

### Optional Evidence
- `logs/<command>.txt` - Raw command output
- `coverage/lcov.info` - Coverage data
- `debug_report.md` - If debug cycle triggered
- `security_review.md` - If security review triggered
