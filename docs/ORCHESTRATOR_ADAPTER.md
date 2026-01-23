# Orchestrator Adapter Contract v0.1 (P0)

## Overview

Định nghĩa **điểm nối (adapter)** để một hệ Orchestrator có thể:
- Tạo run folder chuẩn
- Gọi đúng agent/skill theo từng step
- Kiểm tra gate (schema + exit criteria)
- Route qua lane owners (ui/api/data/qa/security)
- Thu thập evidence (QA/Debug/Security) theo output contract

> **Triết lý:** Orchestrator không cần hiểu nội dung spec, chỉ cần hiểu **artifacts + gates + state machine**.

---

## 1. Scope

### Adapter KHÔNG quy định
- Model/provider cụ thể
- Prompt chi tiết
- CI vendor (GitHub Actions, GitLab, etc.)

### Adapter QUY ĐỊNH
- **Filesystem layout** + naming
- **Artifact pointers** (file paths)
- **Gating interface** (pass/fail + reasons)
- **Handoff bundle** per lane
- **Triage routing** khi QA fail

---

## 2. Required Folder Layout (per run)

Orchestrator MUST create:

```
artifacts/runs/<run_id>/
  00_user_request.md
  10_intake/
    intake.json
    intake.summary.md
  20_research/
    research.shortlist.json
    research.reuse_assessment.json
    research.patterns.md
    research.onepager.md
  30_debate/
    debate.inputs_for_spec.json
    debate.decision.md
  40_spec/
    spec.md
    task_breakdown.json
  45_design/
    handoff.md                    # optional
  50_implementation/
    handoff/<lane>/...
  60_verification/
    report.json
    summary.md
    debug_report.md               # optional
    security_review.md            # optional
```

### RUN_ID Format
- Recommended: `YYYYMMDD_HHMM_<slug>`
- Example: `20260123_1430_user-auth`

---

## 3. Artifacts are the API (Pointers)

Orchestrator tương tác qua **đường dẫn** và **schema**:

| Artifact | Path | Schema |
|----------|------|--------|
| Intake | `10_intake/intake.json` | `schemas/intake.schema.json` |
| Shortlist | `20_research/research.shortlist.json` | `schemas/research.shortlist.schema.json` |
| Reuse Assessment | `20_research/research.reuse_assessment.json` | `schemas/search.reuse_assessment.schema.json` |
| Debate Inputs | `30_debate/debate.inputs_for_spec.json` | `schemas/debate.inputs_for_spec.schema.json` |
| Task Breakdown | `40_spec/task_breakdown.json` | `schemas/task_breakdown.schema.json` |
| QA Report | `60_verification/report.json` | `schemas/verification.report.schema.json` |

**Rule:** Orchestrator MUST NOT move forward nếu schema validation fail.

---

## 4. Gate Evaluation Interface

### Primitive

```typescript
interface GateResult {
  status: 'pass' | 'fail';
  reasons: string[];
  blocking_files: string[];
  next_action: 'proceed' | 'rerun_step' | 'escalate_to_spec' | 'escalate_to_debate' | 'escalate_to_user';
}

function evaluate_gate(gate_id: string, run_root: string): GateResult;
```

### Gate IDs

| Gate ID | Check |
|---------|-------|
| `intake_ready` | intake.json exists và valid schema |
| `reuse_gate_passed` | shortlist + reuse_assessment exist, license allowed |
| `debate_ready_for_spec` | debate.inputs_for_spec.json exists và valid |
| `spec_ready` | spec.md + task_breakdown.json exist và valid |
| `lane_handoff_ready` | Minimum handoff bundle per required lane |
| `qa_passed` | report.json.status = "pass" |

---

## 5. Lane Routing

### Lane IDs (P0)
`ui | api | data | qa | security`

### Routing Flow
1. Orchestrator reads `40_spec/task_breakdown.json`
2. Group tasks by `owner_lane`
3. Create handoff bundle per lane:
   ```
   50_implementation/handoff/<lane>/
   ├── README.md
   ├── acceptance.md
   ├── interfaces.md
   ├── data_schema.md
   ├── env.example
   └── test_plan.md
   ```

---

## 6. Versioning & Compatibility

- Schema files version theo nội dung
- Breaking change → bump `$id` hoặc suffix `*.v2.schema.json`
- Orchestrator SHOULD record versions trong `provenance`

---

## 7. Failure Semantics

| Failure Type | Action |
|--------------|--------|
| Schema fail | `rerun_step` (không qua bước sau) |
| QA fail | Route qua triage (xem QA_TRIAGE.md) |
| Unknown license | `escalate_to_user` |
| Security critical | `escalate_to_user` |

---

## 8. Implementation Notes

### Minimal Orchestrator Loop

```javascript
async function runPipeline(userRequest) {
  const runId = generateRunId();
  const runRoot = `artifacts/runs/${runId}`;

  // Step 1: Intake
  await runAgent('ask', { runRoot, input: userRequest });
  if (!evaluateGate('intake_ready', runRoot).status === 'pass') {
    return rerunStep('ask');
  }

  // Step 2: Research
  await runAgent('architect', { runRoot, phase: 'research' });
  if (!evaluateGate('reuse_gate_passed', runRoot).status === 'pass') {
    return handleFailure('research');
  }

  // Step 3: Debate
  await runAgent('debate', { runRoot });
  // ... continue pipeline
}
```

### Execution Modes

| Mode | Description |
|------|-------------|
| `fast_build` | Skip optional steps, minimal QA |
| `standard_pipeline` | Full pipeline with all gates |
