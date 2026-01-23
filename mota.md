# MASTER: Skill bundle + agents chuẩn (Intake BMAD + Research + Spec Kit + Orchestrator + UI/UX + QA Gate)

# MASTER — Skill bundle agents kit (canonical)

Bản này được viết lại từ logs cũ: có project structure, agent list, skill list, mapping, workflow, và system prompts templates.

## MASTER (đọc phần này để triển khai)

- Open MASTER_CANONICAL.md
# MASTER — Skill Bundle Agents Kit (Intake / Research / Debate / Spec / Lanes / UI-UX / QA)

Mục tiêu của file này: **một tài liệu duy nhất** để người khác đọc và **triển khai được pipeline agentic-SDLC** (trong IDE/Clawdbot) mà không cần mò lại patch rời rạc.

---

## 0) Project Overview

### 0.1 Kit này là gì?
Bộ “skill bundle agents kit” là 1 chuẩn **agents + skills + artifact contracts + gates** để chạy quy trình:

**Orchestrator → Ask(Intake) → Architect(Research + Reuse gate) → Debate → Architect(Spec) → (Design UI/UX optional) → Code → QA Gate → Debug/Security**

### 0.2 Non-goals
- Không ép framework/ngôn ngữ.
- Không thay thế quy trình CI của repo; kit chỉ chuẩn hoá **contracts + gates + prompts**.

### 0.3 Thuật ngữ
- **run_id**: định danh 1 lần chạy; toàn bộ artifact nằm dưới `artifacts/runs/<run_id>/...`
- **artifact**: file đầu ra chuẩn hoá (json/md) có thể kiểm tra.
- **gate**: điều kiện pass/fail để đi bước tiếp.
- **lane**: nhóm trách nhiệm tách song song: `ui | api | data | qa | security`.

---

## 1) Repo Structure (canonical)

> Đây là cấu trúc tối thiểu để “build được”. Skills có thể là copy/symlink/submodule, nhưng **paths + outputs** phải khớp.

```text
repo-root/
  AGENTS.md
  RULES.md
  qa.md
  LICENSE_POLICY.md

  agents/
    orchestrator.agent.md
    ask.agent.md
    architect.agent.md
    debate.agent.md              # (optional) hoặc gộp vào orchestrator
    spec.agent.md                # (optional) hoặc gộp vào architect
    design.agent.md              # optional
    code.agent.md
    qa_gate.agent.md
    debug_security.agent.md

  skills/
    intake/
    research/
    brave-search/
    github/
    debate/
    spec-agent/
    ui-ux/
    qa-gate/
    debug-security/

  schemas/
    intake.schema.json
    research.shortlist.schema.json
    search.reuse_assessment.schema.json
    debate.inputs_for_spec.schema.json
    task_breakdown.schema.json
    verification.report.schema.json

  examples/
    intake.example.json
    research.shortlist.example.json
    research.reuse_assessment.example.json
    debate.inputs_for_spec.example.json
    task_breakdown.example.json
    verification.report.example.json

  docs/
    ORCHESTRATOR_ADAPTER.md
    QA_TRIAGE.md

  artifacts/
    runs/<run_id>/...
```

### RUN_ID
- Format khuyến nghị: `YYYYMMDD_HHMM_<slug>`

---

## 2) Run Artifacts Layout (per run)

```text
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
    handoff.md                 # optional
  50_implementation/
    handoff/<lane>/...
  60_verification/
    report.json
    summary.md
    debug_report.md            # optional
    security_review.md         # optional
```

---

## 3) Agents (roles + I/O contract)

### 3.1 Orchestrator (primary)
- Trách nhiệm: điều phối pipeline, enforce gates, route lanes, quyết định rerun/escalate.
- Inputs: `00_user_request.md` + toàn bộ artifacts trước đó.
- Outputs: trạng thái + quyết định bước tiếp theo.

### 3.2 Ask (Intake)
- Trách nhiệm: hỏi tối đa 8 câu, khoá scope.
- Output bắt buộc:
  - `10_intake/intake.json`
  - `10_intake/intake.summary.md`

### 3.3 Architect (Research)
- Trách nhiệm: shortlist candidate reuse + patterns + onepager.
- Outputs bắt buộc:
  - `20_research/research.shortlist.json`
  - `20_research/research.reuse_assessment.json`
  - `20_research/research.patterns.md`
  - `20_research/research.onepager.md`

### 3.4 Debate (Decision)
- Trách nhiệm: chốt decision + seed_task_outline theo lane.
- Outputs bắt buộc:
  - `30_debate/debate.decision.md`
  - `30_debate/debate.inputs_for_spec.json`

### 3.5 Architect (Spec)
- Trách nhiệm: viết `spec.md` + DAG `task_breakdown.json` dựa trên debate inputs.
- Outputs bắt buộc:
  - `40_spec/spec.md`
  - `40_spec/task_breakdown.json`

### 3.6 Design (UI/UX) — optional
- Trách nhiệm: handoff flows/states/components cho UI.
- Output:
  - `45_design/handoff.md`

### 3.7 Code (Implement)
- Trách nhiệm: implement theo `task_breakdown.json` + `spec.md` + `RULES.md`.
- Output:
  - code changes
  - nếu lanes: `50_implementation/handoff/<lane>/*`

### 3.8 QA Gate
- Trách nhiệm: chạy qa.md, ghi evidence.
- Output bắt buộc:
  - `60_verification/report.json`
  - `60_verification/summary.md`

### 3.9 Debug/Security
- Trách nhiệm: root-cause + fix plan khi QA fail; security review khi trigger.
- Output (tuỳ case):
  - `60_verification/debug_report.md`
  - `60_verification/security_review.md`

---

## 4) Skills (list + purpose)

- `skills/intake`: tạo intake.json theo template.
- `skills/research`: reuse-first research + shortlist + reuse_assessment.
- `skills/brave-search`: web search (requires `BRAVE_API_KEY`).
- `skills/github`: gh CLI / GitHub API.
- `skills/debate`: council debate (IDE-friendly hoặc runner multi-model).
- `skills/spec-agent`: biến debate inputs thành spec + DAG.
- `skills/ui-ux`: tạo UI/UX handoff.
- `skills/qa-gate`: chạy qa.md và tạo verification report.
- `skills/debug-security`: debug/security outputs + feed-back tasks.

---

## 5) Mapping: Agent ↔ Skills (canonical)

- Orchestrator → điều phối, gọi Debate skill, enforce gates.
- Ask → skills/intake.
- Architect(Research) 
→ skills/research (+ brave-search, github, web_fetch/summarize fallback).
- Debate → skills/debate.
- Architect(Spec) → skills/spec-agent.
- Design → skills/ui-ux.
- QA Gate → skills/qa-gate.
- Debug/Security → skills/debug-security.

---

## 6) Workflow + Gates (step-by-step)

### Gate 1 — Intake ready
- `10_intake/intake.json` validate schema.

### Gate 2 — Reuse-first passed
- Có `research.shortlist.json` + `research.reuse_assessment.json`.
- License policy pass.

### Gate 3 — Debate ready for spec
- Có `30_debate/debate.inputs_for_spec.json`.

### Gate 4 — Spec ready
- Có `40_spec/spec.md` + `40_spec/task_breakdown.json` validate schema.

### Gate 5 — Lane handoff ready
- Có handoff bundle tối thiểu cho lane cần thiết.

### Gate 6 — QA passed
- `60_verification/report.json.status = pass`.

---

## 7) Lanes (parallel execution) + handoff bundle

### 7.1 Lane ids
`ui | api | data | qa | security`

### 7.2 Handoff bundle tối thiểu (P0)
Mỗi lane khi “done” phải xuất:
- `README.md`
- `acceptance.md`
- `interfaces.md`
- `data_schema.md`
- `env.example`
- `test_plan.md`

### 7.3 Cross-lane rule (P0)
Không được đổi interface cross-lane “im lặng”. Nếu thay đổi:
- update `interfaces.md` / contract
- notify lane liên quan trong handoff

---

## 8) System Prompts (templates)

> Mục tiêu: copy/paste để tạo `agents/*.agent.md`.

### 8.1 Orchestrator — system prompt
```text
You are Orchestrator (active). You control the project end-to-end.

Pipeline (must follow):
Ask(Intake) → Architect(Research) → Debate → Architect(Spec) → (Design optional) → Code → QA Gate → (Debug/Security if needed)

Rules:
- Do not skip gates.
- Enforce artifacts exist at the correct paths.
- Ask 0–3 clarifying questions max.
- Always output: current step, next step, missing artifacts, and a concise summary.
```

### 8.2 Ask (Intake) — system prompt
```text
You are Ask (Intake). Ask at most 8 questions. Do NOT propose architecture.

You must output:
- artifacts/runs/<run_id>/10_intake/intake.json
- artifacts/runs/<run_id>/10_intake/intake.summary.md
```

### 8.3 Architect (Research + Spec) — system prompt
```text
You are Architect.

Research:
- Use brave-search + github + fallback web_fetch/summarize.
- Output shortlist + reuse_assessment + patterns + onepager.

Spec:
- Use debate.inputs_for_spec.json as decision authority.
- Output spec.md + task_breakdown.json with a real DAG (depends_on) and owner_lane.
```

### 8.4 QA Gate — system prompt
```text
You are QA Gate.
- Run qa.md commands in order.
- Always output report.json + summary.md (even when failing early).
```

### 8.5 Debug/Security — system prompt
```text
You are Debug/Security.
- Trigger: QA fail or user request.
- Output debug_report.md and/or security_review.md.
- Provide a fix plan that feeds back into tasks.
```

---

## 9) Templates bắt buộc để “triển khai được”

### 9.1 Intake questions (8 câu)
1) Goal?
2) Users?
3) Current workflow?
4) Success metrics?
5) MVP scope (3–7 items)?
6) Non-goals?
7) Constraints (stack/time/budget/security)?
8) Risks + open questions?

### 9.2 spec.md template (P0)
```md
# spec.md

## Context

## Scope
- MVP:
- Non-goals:

## Decisions (from debate)
- Recommended approach:
- Reference repos:
- Key decisions:

## Plan & Milestones

## Tasks by lane

## Verification
See qa.md

## Open questions
- Blocking:
- Non-blocking:
```

### 9.3 RULES.md template (P0)
```md
# RULES.md

## Lanes
ui, api, data, qa, security

## Scope control
No lane may change scope/architecture without routing back to Orchestrator/Architect.

## Handoff required
handoff/<lane>/{README.md,acceptance.md,interfaces.md,data_schema.md,env.example,test_plan.md}
```

### 9.4 qa.md template (P0)
```md
# qa.md

## Profile
node|python|web

## Commands
1) format: ...
2) lint: ...
3) typecheck: ...
4) test: ...
5) e2e (optional): ...

## Pass criteria
All commands exit 0.

## Evidence
- artifacts/runs/<run_id>/60_verification/report.json
- logs paths

## Iteration rule
Max 2 reruns, then escalate to Spec.
```

---

## 10) Appendices

- Orchestrator Adapter Contract: `docs/ORCHESTRATOR_ADAPTER.md`
- QA triage protocol: `docs/QA_TRIAGE.md`
- Full schemas/examples: `schemas/*`, `examples/*`
# Orchestrator Adapter Contract v0.1 (P0)

Mục tiêu: định nghĩa **điểm nối (adapter)** để một hệ Orchestrator (ví dụ Lanes-Orchestrator) có thể:
- tạo run folder chuẩn,
- gọi đúng agent/skill theo từng step,
- kiểm tra gate (schema + exit criteria),
- route qua lane owners (ui/api/data/qa/security),
- và thu thập evidence (QA/Debug/Security) theo output contract.

> Triết lý: **Orchestrator không cần hiểu nội dung spec**, chỉ cần hiểu **artifacts + gates + state machine**.

---

## 1) Scope

Adapter này không quy định:
- model/provider cụ thể
- prompt chi tiết
- CI vendor (GitHub Actions, GitLab, v.v.)

Adapter này quy định:
- **filesystem layout** + naming
- **artifact pointers** (file paths)
- **gating interface** (pass/fail + reasons)
- **handoff bundle** per lane
- **triage routing** khi QA fail

---

## 2) Required folder layout (must exist per run)

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
  30_debate/
    debate.inputs_for_spec.json
    debate.decision.md
  40_spec/
    spec.md
    task_breakdown.json
  50_implementation/
    handoff/<lane>/...
  60_verification/
    report.json
    summary.md
    debug_report.md           # optional
    security_review.md        # optional
```

Nếu execution_mode = `fast_build` thì Orchestrator vẫn phải tạo đủ tree, nhưng có thể cho phép skip một số file optional (được ghi rõ trong report).

---

## 3) Artifacts are the API (pointers)

Orchestrator tương tác qua **đường dẫn** (path) và **schema**:

- Intake: `10_intake/intake.json` (validate: `schemas/intake.schema.json`)
- Reuse assessment: `20_research/research.reuse_assessment.json` (validate: `schemas/research.reuse_assessment.schema.json`)
- Debate inputs: `30_debate/debate.inputs_for_spec.json` (validate: `schemas/debate.inputs_for_spec.schema.json`)
- DAG: `40_spec/task_breakdown.json` (validate: `schemas/task_breakdown.schema.json`)
- QA report: `60_verification/report.json` (validate: `schemas/verification.report.schema.json`)

**Rule:** Orchestrator MUST NOT move forward nếu schema validation fail.

---

## 4) Gate evaluation interface

Adapter cần 1 primitive:

### `evaluate_gate(gate_id, run_root) -> GateResult`

- `gate_id`:
  - `intake_ready`
  - `reuse_gate_passed`
  - `debate_ready_for_spec`
  - `spec_ready`
  - `lane_handoff_ready`
  - `qa_passed`

- `GateResult` (logical schema):
  - `status`: `pass | fail`
  - `reasons[]`: danh sách ngắn gọn (string)
  - `blocking_files[]`: file paths cần sửa
  - `next_action`: `proceed | rerun_step | escalate_to_spec | escalate_to_debate | escalate_to_user`

> Implementation có thể là CLI, script, hoặc builtin trong Orchestrator; nhưng output phải map được theo structure trên.

---

## 5) Lane routing

Lane ids chuẩn (P0): `ui | api | data | qa | security`

Orchestrator đọc `40_spec/task_breakdown.json`:
- mỗi task có `owner_lane`
- Orchestrator group tasks theo lane và tạo:
  - `50_implementation/handoff/<lane>/` bundle

**Minimum bundle per lane** (P0):
- `README.md`
- `acceptance.md`
- `interfaces.md`
- `data_schema.md`
- `env.example`
- `test_plan.md`

---

## 6) Versioning & compatibility

- Schema files version theo nội dung; nếu có breaking change, bump `$id` hoặc thêm suffix `*.v2.schema.json`.
- Orchestrator SHOULD record versions trong `provenance` của mỗi artifact.

---

## 7) Failure semantics

- Schema fail → **rerun step hiện tại** (không qua bước sau).
- QA fail → route qua triage protocol (xem `docs/QA_TRIAGE.md`).
- Unknown license / security critical → `next_action=escalate_to_user`.
# QA Gate — Report Schema + Triage Protocol (P0)

Mục tiêu: biến QA Gate thành một **bước deterministic**: chạy gì, ghi gì, fail thì route đi đâu.

---

## 1) Report contract (single source of truth)

File bắt buộc:
- `artifacts/runs/<run_id>/60_verification/report.json`

Validate bằng:
- `schemas/verification.report.schema.json`

Ý nghĩa field chính:
- `status`: `pass|fail`
- `commands[]`: command đã chạy + exit_code + (optional) logs_path
- `evidence`: danh sách artifacts/links chứng minh
- `summary.highlights[]`: điều quan trọng nhất
- `summary.top_failures[]`: top lỗi gây fail

**Rule:** QA agent MUST write `report.json` kể cả khi fail sớm (schema fail/lint fail).

---

## 2) Execution modes

### 2.1 fast_build (minimum viable QA)
Bắt buộc:
1) Schema validation (all required artifacts)
2) Lint/typecheck nếu có
3) Smoke/unit tests tối thiểu

### 2.2 standard_pipeline
Tuân theo `qa.md` (đầy đủ)

---

## 3) Triage protocol (max reruns + escalation)

Orchestrator/QA Gate áp dụng quy tắc rerun và escalation thống nhất.

### 3.1 Counters
- `qa_rerun_count`: số lần rerun QA cho cùng một run_id.
- `debug_rerun_count`: số lần rerun Debug/Security.

### 3.2 Routing rules

**A) Fail do schema validation**
- Ví dụ: thiếu file, JSON invalid, schema mismatch
- Action: `rerun_step` = step tạo artifact (Intake/Research/Debate/Spec)
- Không vào Debug (vì chưa có đầu vào hợp lệ)

**B) Fail do test/lint/typecheck/build**
- Action: route sang `Debug` để fix nhanh + update tests
- Sau Debug → rerun QA

**C) Fail lặp lại lần 2 (qa_rerun_count >= 2) hoặc fail dạng “assumption/scope mismatch”**
- Dấu hiệu: test fail vì spec thiếu cases, interface sai, requirement không rõ
- Action:
  - `escalate_to_spec` nếu lỗi thuộc thiết kế/requirements
  - `escalate_to_debate` nếu có tranh chấp hướng đi / tradeoff chưa chốt

**D) Security/Licensing gate fail**
- Action: route `Security` lane
- Nếu `license_check.status = unknown_requires_approval` hoặc phát hiện secret leak → `escalate_to_user`

---

## 4) Minimal debug output (recommended)

Khi QA fail và route Debug/Security, nên ghi thêm:
- `60_verification/debug_report.md` (root cause + fix + regression plan)
- hoặc `60_verification/security_review.md`

Nhưng `report.json` vẫn là bắt buộc.
debate.inputs_for_spec.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://clawd.bot/schemas/debate.inputs_for_spec.schema.json",
  "title": "debate.inputs_for_spec.json",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "options",
    "scoring_rubric",
    "decision",
    "rejected_options",
    "seed_task_outline",
    "assumptions",
    "open_questions",
    "non_goals",
    "decision_lock",
    "provenance"
  ],
  "properties": {
    "options": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "summary", "pros", "cons", "estimated_cost", "risks"],
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "summary": { "type": "string", "minLength": 1 },
          "pros": { "type": "array", "items": { "type": "string" } },
          "cons": { "type": "array", "items": { "type": "string" } },
          "estimated_cost": { "type": "string" },
          "risks": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "scoring_rubric": {
      "type": "object",
      "additionalProperties": false,
      "required": ["criteria", "weights"],
      "properties": {
        "criteria": { "type": "array", "items": { "type": "string" } },
        "weights": { "type": "object" }
      }
    },
    "decision": {
      "type": "object",
      "additionalProperties": false,
      "required": ["chosen_option_id", "tie_break_reason"],
      "properties": {
        "chosen_option_id": { "type": "string", "minLength": 1 },
        "tie_break_reason": { "type": "string" }
      }
    },
    "rejected_options": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProper{
  "options": [
    {
      "id": "opt_reuse_template",
      "summary": "Reuse an existing starter repo and customize.",
      "pros": ["Fast delivery", "Battle-tested structure"],
      "cons": ["Inherits template constraints"],
      "estimated_cost": "S-M",
      "risks": ["License mismatch", "Hidden tech debt"]
    }
  ],
  "scoring_rubric": {
    "criteria": ["constraint_compliance", "practicality", "risk_awareness", "clarity"],
    "weights": {"constraint_compliance": 0.3, "practicality": 0.25, "risk_awareness": 0.25, "clarity": 0.2}
  },
  "decision": {"chosen_option_id": "opt_reuse_template", "tie_break_reason": "Best time-to-value"},
  "rejected_options": [{"id": "opt_build_from_scratch", "why": "Too slow for current deadline"}],
  "disagreements": [],
  "seed_task_outline": [
    {"owner_lane": "api", "title": "Bootstrap repo + run baseline tests", "acceptance": ["CI green"]},
    {"owner_lane": "security", "title": "Run gitleaks + dependency audit", "acceptance": ["No secrets", "No high CVEs"]}
  ],
  "assumptions": ["We can fork and modify"],
  "open_questions": ["Do we need multi-tenant?"],
  "non_goals": ["Perfect design system"],
  "decision_lock": {"locked": true, "change_request_process": "Change requires rerun Debate + update Spec"},
  "provenance": {"mode": "ide", "participants": ["A","B","C","D","Lead"], "model_versions": {}, "timestamp": "2026-01-22T00:00:00Z"}
}
intake.example.json
{
  "goal": "Ship a deployable kit pipeline skeleton.",
  "users": ["Nam", "team"],
  "success_metrics": ["CI green", "Can run pipeline end-to-end"],
  "mvp_scope": ["Contracts + gates", "One sample run"],
  "non_goals": ["Perfect UI"],
  "constraints": ["No hardcoded secrets", "Deployable doc"],
  "risks": ["Orchestrator adapter unclear"],
  "open_questions": ["CI environment?"],
  "sizing": "M",
  "execution_mode": "standard_pipeline"
}
research.reuse_assessment.example.json
{
  "recommended_path": "reuse",
  "shortlisted_repo": {"repo_url": "https://github.com/example/starter", "commit_or_tag": "v1.2.3"},
  "license_check": {"license": "MIT", "policy": "allowlist", "status": "allowed"},
  "baseline_verification": {"required": true, "cmds": ["npm test"], "status": "pass", "notes": "All good"},
  "security_baseline": {"secret_scan": "pass", "dependency_audit": "pass", "sbom": "skipped"},
  "risks": ["Template assumes Postgres 14"],
  "provenance": {"timestamp": "2026-01-22T00:00:00Z", "commit_hash": "<git-commit>"}
}
research.shortlist.example.json
{
  "problem_summary": "Build a small internal tool with auth + CRUD + dashboard.",
  "recommended_path": "reuse",
  "rationale": "Found a mature starter template matching stack and constraints.",
  "baseline_verification": {
    "required": true,
    "cmds": ["git clone <repo>", "cd <repo>", "npm i", "npm test"]
  },
  "candidates": [
    {
      "repo_url": "https://github.com/example/starter",
      "commit_or_tag": "v1.2.3",
      "license": "MIT",
      "activity_score": 0.8,
      "fit_score": 0.85,
      "security_notes": "No obvious secrets; run gitleaks + npm audit.",
      "reuse_candidate": true,
      "bootstrap_steps": ["npm i", "npm test"],
      "baseline_verification": {"required": true, "cmds": ["npm test"]},
      "effort_estimate": "M",
      "risks": ["Template may assume Postgres version >= 14"]
    }
  ],
  "assumptions": ["We can use Node 20"],
  "open_questions": ["SSO required?"] ,
  "provenance": {
    "timestamp": "2026-01-22T00:00:00Z",
    "mode": "standard_pipeline",
    "model_versions": {"research": "namdm-proxy/gpt-5.2"},
    "commit_hash": "<git-commit>"
  }
}
task_breakdown.example.json{
  "milestones": [
    {"id": "M0", "title": "Foundation", "exit_criteria": ["CI green"], "tasks": ["api-001", "security-001"]}
  ],
  "tasks": [
    {
      "node_id": "api-001",
      "title": "Bootstrap repo + health endpoint",
      "owner_lane": "api",
      "depends_on": [],
      "parallel_group": "foundation",
      "inputs": ["artifacts/runs/<run_id>/10_intake/intake.json"],
      "artifact_out": ["artifacts/runs/<run_id>/50_implementation/handoff/api/README.md"],
      "exit_criteria": ["GET /health returns 200"],
      "validation_cmd": ["npm test"],
      "rollback_plan": "Revert commit if baseline fails"
    },
    {
      "node_id": "security-001",
      "title": "Secret scan + dependency audit",
      "owner_lane": "security",
      "depends_on": [],
      "parallel_group": "foundation",
      "inputs": ["."] ,
      "artifact_out": ["artifacts/runs/<run_id>/60_verification/security_review.md"],
      "exit_criteria": ["No secrets committed", "No critical CVEs"],
      "validation_cmd": ["gitleaks detect --no-git"],
      "rollback_plan": "Block release until mitigated"
    }
  ],
  "provenance": {"timestamp": "2026-01-22T00:00:00Z", "commit_hash": "<git-commit>"}
}
verification.report.example.json
{
  "run_id": "20260122_2200_master-v22",
  "status": "fail",
  "commands": [
    {"name": "schema-validate", "cmd": "python -m jsonschema ...", "exit_code": 0, "duration_ms": 1200},
    {"name": "tests", "cmd": "pytest -q", "exit_code": 1, "duration_ms": 22000, "logs_path": "artifacts/runs/<run_id>/60_verification/logs/pytest.txt"}
  ],
  "evidence": {
    "artifacts": ["artifacts/runs/<run_id>/60_verification/logs/pytest.txt"],
    "links": []
  },
  "summary": {
    "highlights": ["Schema validation passed"],
    "top_failures": ["pytest failed: ImportError ..."]
  },
  "provenance": {"timestamp": "2026-01-22T00:00:00Z", "ci": "github-actions", "commit_hash": "<git-commit>"}
}
