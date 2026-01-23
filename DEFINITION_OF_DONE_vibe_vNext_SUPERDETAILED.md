# DoD vNext (SUPER DETAILED) — AI-Agent-Toolkit `aat vibe`

> Owner: Nam
> 
> Mục tiêu: sửa **1 lần** để `aat vibe` trở thành pipeline tổng quát, không còn “web+email auth+postgres” mặc định, và có regression tests bắt lỗi.
> 
> Tài liệu này là **acceptance spec + implementation plan**: nói rõ *file nào sửa*, *sửa gì*, *schema nào đổi*, *test nào thêm*, *exit code/gates nào fail*, và *ví dụ output chuẩn*.

---

## 0) Current-state diagnosis (để tránh sửa sai chỗ)

### 0.1 `orchestrator/scripts/vibe.js` hiện đang hardcode
- `VIBE_QUESTIONS` mặc định:
  - `platform` default: **"web responsive"**
  - `auth` default: **"email"**
  - `deploy` default: **"Docker"**
- `generateIntake()` đổ các default này vào `intake.json` kể cả khi prompt nói `no auth/no db`.
- `determineTechStack()` luôn add `Database: PostgreSQL + Prisma`.
- `generateSpec()` mô tả chung chung; nếu `features` trống thì MVP rỗng.

### 0.2 `research/scripts/search-github.js`
- Khi không có query, nó lấy keyword từ `intake.project.type` + 1–3 từ đầu của `mvp_features`.
- Vì intake đang bị default “web responsive” + features trống ⇒ keyword rơi về fallback `['react','typescript','template']` ⇒ ra bootstrap/pure-css…

### 0.3 Kết luận
- Nếu không thay đổi cách tạo `intake.json` + không có classify + không có “no-auth/no-db override”, thì research/spec/tasks/ deploy sẽ luôn lệch.

---

## 1) Definition of Done — absolute gates (nếu fail thì run phải exit 1)

Pipeline `aat vibe` được coi là đạt chuẩn khi, với **mọi prompt**, các gates sau PASS:

### Gate G1 — Prompt-negation fidelity
- Nếu prompt chứa `no auth|no authentication|without auth` ⇒ **intake.constraints.auth MUST be `none`**, spec MUST NOT mention login/NextAuth, env.example MUST NOT contain NEXTAUTH vars.
- Nếu prompt chứa `no db|no database|without database|no persistence` ⇒ **intake.constraints.db MUST be `none`**, spec MUST NOT propose Postgres/Prisma, docker-compose MUST NOT include db.

### Gate G2 — Kind/Language correctness
- Nếu prompt chứa signals rõ ràng:
  - CLI: `cli|command-line|terminal|flag|--help|argparse|click|typer`
  - API: `endpoint|rest|http|fastapi|flask|express|gin|chi`
  - Library: `package|library|sdk|export|function`
  - Data: `csv|etl|pipeline|transform`
  - Desktop: `tkinter|wpf|winforms`
  - Mobile: `flutter|android|ios`

thì `classify.project_kind` MUST khớp, và spec MUST thuộc đúng loại (không được tự nhảy về web).

### Gate G3 — MVP not empty
- `intake.scope.mvp_features.length >= 2` (hoặc với library: `>= 2 exports`)
- `spec.md` phải có section MVP và ít nhất 2 mục.

### Gate G4 — Tasks implementable
- `task_breakdown.json.tasks[].name` và `description` không được rỗng.
- `total_tasks` đúng bằng `tasks.length`.

### Gate G5 — Research relevance
- Nếu `project_kind != web` thì `research.shortlist.json.repos[].name/url/description` MUST liên quan domain đó.
  - Ví dụ python CLI: shortlist phải có ít nhất 1 repo hoặc keyword thuộc `click|typer|argparse|python-cli`.
  - C# console: phải có `System.CommandLine|dotnet console args`.
- Nếu research degraded (rate limit), file vẫn phải tồn tại và ghi `status: degraded` + reason.

### Gate G6 — Deploy kit consistency
- Nếu `deploy=local` ⇒ `deploy/` không được yêu cầu Docker Compose.
- Nếu `deploy=docker` và `db=none` ⇒ docker-compose không có service db.

---

## 2) Required new artifacts & file layout

Mỗi run MUST có:

```
artifacts/runs/<run_id>/
  00_user_request.md
  05_classify/classify.json
  10_intake/intake.json
  20_research/research.shortlist.json
  30_decisions/decisions.json
  40_spec/spec.md
  40_spec/task_breakdown.json
  40_spec/NEXT_STEPS.md
  60_verification/security_review.md
  60_verification/verification.report.json
  deploy/...
  run_summary.md
  run.log
```

Implementation note: `utils.writeArtifact()` already exists; reuse it.

---

## 3) CLI contract (exact)

### 3.1 `aat vibe` arguments
Must support:

- `aat vibe "<prompt>"` non-interactive
- `aat vibe` interactive (TTY)

### 3.2 New flags (must implement)
Add to `orchestrator/scripts/vibe.js` parseArgs:

- `--kind <cli|api|web|library|data|desktop|mobile|unknown>`
- `--language <python|node|go|csharp|java|rust|unknown>`
- `--auth <none|email|oauth|phone|custom>`
- `--db <none|sqlite|postgres|mysql|...>`
- `--deploy <local|docker|vercel|vps|none>`
- `--no-auth` (shorthand = `--auth none`)
- `--no-db` (shorthand = `--db none`)
- `--fast` (skip research deep + security deep, but still produce required files)

### 3.3 Exit codes
- `0`: all gates pass
- `1`: any gate fails (validation)
- `2`: runtime error

---

## 4) Implementation plan (file-by-file)

### 4.1 Add new classifier module

**Create file**: `.agent/skills/orchestrator/scripts/classify.js`

Responsibilities:
- Input: `prompt` string + optional overrides.
- Output artifact: `05_classify/classify.json`.

Required heuristics (minimum):

1) Detect language:
- python: `python|fastapi|flask|typer|click|pip|poetry`
- node: `node|npm|yarn|pnpm|express|next.js|react`
- csharp: `c#|csharp|\.net|dotnet|asp.net`
- go: `golang|go |gin|chi|fiber`

2) Detect kind:
- cli: `cli|command-line|terminal|--[a-z]|flag|argparse|click|typer|System.CommandLine`
- api: `endpoint|rest|http|server|fastapi|flask|express|gin|chi|grpc`
- web: `web app|website|next.js|react|page|frontend`
- library: `package|library|sdk|export|api client`
- data: `csv|etl|pipeline|transform|cleaning|report`
- desktop: `tkinter|wpf|winforms|electron`
- mobile: `flutter|android|ios|react native`

3) Detect negations:
- auth none: `no auth|no authentication|without auth|public endpoints|no login`
- db none: `no db|no database|without database|no persistence|in-memory only`

4) Defaults when unknown:
- auth: `none`
- db: `none`
- deploy: `local`

Output schema:

```json
{
  "version": "1.0",
  "run_id": "...",
  "timestamp": "...",
  "prompt": "...",
  "project_kind": "cli",
  "language": "python",
  "constraints": {"auth": "none", "db": "none", "deploy": "local"},
  "confidence": {"project_kind": 0.8, "language": 0.9, "auth": 1, "db": 1, "deploy": 0.6},
  "signals": ["cli", "--health", "python"],
  "overrides": {"kind": null, "language": null, "auth": null, "db": null, "deploy": null}
}
```

### 4.2 Modify `orchestrator/scripts/vibe.js`

#### 4.2.1 Remove hardcoded web defaults
Update `VIBE_QUESTIONS`:
- platform question must become **project kind** question OR be conditional.
- defaults must be:
  - kind/platform: `unknown` (not web)
  - auth default: `none` (not email)
  - deploy default: `local` (not docker)

#### 4.2.2 Non-interactive mode must NOT fabricate answers
Current `getAnswersNonInteractive()` fills defaults from VIBE_QUESTIONS. Change behavior:
- If non-interactive and user only supplies `description`:
  - answers should be: `{ initial: desc, goal: desc }` and the rest left blank.
  - rely on classifier + safe defaults.

#### 4.2.3 Pipeline order
In `main()` (or equivalent) enforce order:
1) Write `00_user_request.md`
2) Run `classify` ⇒ save `05_classify/classify.json`
3) Generate intake using:
   - prompt
   - classifier
   - minimal Q&A (interactive: max 3; non-interactive: none)
4) Research query built from classify/intake
5) Decisions
6) Spec
7) Tasks
8) Verification (gates)
9) Deploy kit
10) NEXT_STEPS
11) run_summary

#### 4.2.4 Replace `generateIntake()` with new shape
Must write `10_intake/intake.json` with fields:

```json
{
  "version":"1.1",
  "run_id":"...",
  "timestamp":"...",
  "mode":"vibe",
  "project": {"name":"...", "kind":"cli", "language":"python", "description":"..."},
  "scope": {"mvp_features":["..."], "future_features":[], "out_of_scope":["auth","database"]},
  "constraints": {"auth":"none","db":"none","deploy":"local"},
  "assumptions": ["No auth because prompt says no authentication"],
  "open_questions": [],
  "_raw": {"prompt":"...", "answers":{...}}
}
```

Important: `project.kind` must not be “web responsive” for non-web prompts.

#### 4.2.5 MVP extraction rules (must implement)
Implement `extractMvpFromPrompt(prompt, classify)`:
- CLI:
  - detect commands/flags: regex for `--[a-z-]+`, keywords `command`, `subcommand`
  - if prompt mentions endpoints, treat as API not CLI.
- API:
  - detect `/path` occurrences and verbs `GET/POST`.
- Web:
  - detect pages/routes.
- Library:
  - detect “functions/classes” list.

If extraction yields <2 items:
- create 2 generic but correct MVP items based on kind:
  - CLI: `--help`, core command
  - API: `/health`, core endpoint
  - Library: core function + basic test

#### 4.2.6 Tech stack selection must be conditional
Replace `determineTechStack()`:
- For `cli python`: suggest `python 3.11+`, `argparse` (stdlib) or `typer`.
- For `api python`: `fastapi`.
- For `web`: `next.js`.
- **Database layer must only appear if db != none**.
- Auth layer must only appear if auth != none.

#### 4.2.7 Spec generator must be kind-aware
Replace `generateSpec()` to render different templates per kind:
- CLI template must include usage examples + exit codes.
- API template must include endpoints + response examples.
- Library template must include exported API + examples.

#### 4.2.8 Task generator must be kind-aware
Replace `generateTasks()`:
- Always include: Setup, Implement MVP, Tests, Packaging/Run.
- Include Auth task only if `auth != none`.
- Include DB task only if `db != none`.
- Ensure dependencies are valid and do not self-reference.

#### 4.2.9 Add decisions.json
Add generation of `30_decisions/decisions.json` from classify + intake + research.
Must include `stack_selected`, `why`, `constraints_final`, `out_of_scope`, `risks`.

#### 4.2.10 Add verification report + enforce gates
Implement `verifyRun()` that reads classify/intake/spec/tasks/deploy and outputs:
`60_verification/verification.report.json` and returns pass/fail.

Gate checks must include:
- mismatch kind
- no-auth but spec mentions login
- no-db but deploy has db
- MVP empty
- tasks empty names

On fail ⇒ print summary + exit 1.

### 4.3 Modify `research/scripts/search-github.js`

#### 4.3.1 Build query from classify.json first
If `05_classify/classify.json` exists, query MUST include:
- kind keyword + language keyword.
Examples:
- python cli: `python cli typer click argparse`
- csharp console: `dotnet console System.CommandLine`
- go api: `go http server chi gin health endpoint`
- library ts: `typescript library boilerplate vitest`

#### 4.3.2 Output format upgrade
Update output file `research.shortlist.json` to include:
- `status`: `ok|degraded`
- `repos[]`: must include `why_relevant`, `pattern_to_reuse`, `relevance_score`

Even if only GitHub search, you can generate `why_relevant` heuristically using match keywords.

### 4.4 Modify deploy kit generation
Wherever deploy files are generated in `vibe.js`:
- If deploy=local ⇒ create `deploy/DEPLOY.md` with local run instructions; Dockerfile optional.
- If deploy=docker and db=none ⇒ compose without db.
- If deploy=docker and db != none ⇒ include db service.

Also `deploy/env.example` must only include relevant env vars:
- auth none ⇒ no NEXTAUTH_*
- db none ⇒ no DATABASE_URL

---

## 5) Schemas (exact changes)

### 5.1 Add new schema `schemas/classify.schema.json`
- Validate `project_kind`, `language`, `constraints.auth/db/deploy`.

### 5.2 Update `schemas/intake.schema.json`
- Add `project.kind`, `project.language`.
- Add `constraints.db`.
- Add `assumptions` (array string), `open_questions`.
- Keep backward compatibility by allowing old fields but prefer new.

### 5.3 Update `schemas/research.shortlist.schema.json`
- Add `status`, and per repo add `why_relevant`, `pattern_to_reuse`, `relevance_score`.

### 5.4 Update `schemas/verification.report.schema.json`
- Add `gates[]` with `{id, pass, message, details?}`.

---

## 6) Regression tests (super specific)

### 6.1 Add folder `scripts/regression/`
Files:
- `prompts.json` (exact prompts)
- `run-prompts.js` (runner)
- `assertions.js` (assert helpers)

### 6.2 `prompts.json` (minimum 12, exact strings)
Include at least:

1) Python CLI:
"Build a Python command-line app with a --health flag that prints OK and exits 0. No database. No authentication."

2) C# Console:
"Build a .NET 8 C# console app: --health prints OK exit 0, --hello <name>. No auth, no db."

3) Go API:
"Build a Go HTTP API with GET /health returning {status:ok}. No database."

4) FastAPI:
"Build a FastAPI service with GET /health and GET /hello?name=. No auth. No database."

5) Next.js minimal:
"Build a Next.js app with / and /api/health returning OK. No auth, no db."

6) TS library:
"Create a TypeScript library exporting retry() with exponential backoff and jitter. Provide tests."

7) Python library:
"Create a Python package textutils with functions slugify and truncate, with unit tests."

8) ETL:
"Build a Python script that reads CSV, validates schema, outputs cleaned CSV and a JSON error report."

9) Desktop:
"Build a Tkinter desktop app with a counter button and a Health menu that shows OK."

10) Mobile:
"Build a Flutter app with a counter screen and a Health screen. No backend."

11) Auth required:
"Build a web app that requires login (email+password) and a protected dashboard. Use SQLite."

12) DB required (explicit):
"Build an API with CRUD for todos stored in PostgreSQL. Authentication not required."

### 6.3 Assertions (must)
For each run:
- load `classify.json`, `intake.json`, `spec.md`, `research.shortlist.json`, `task_breakdown.json`, `deploy/*`, `verification.report.json`.
- assert:
  - kind/language expected for at least 8/12 prompts (some may be unknown acceptable)
  - no-auth prompts ⇒ intake.constraints.auth==none and spec does not mention login
  - no-db prompts ⇒ no db service in docker-compose and spec doesn’t propose postgres
  - research relevance: at least one repo contains expected keyword set
  - tasks have non-empty names
  - verification gates all pass

Runner should exit non-zero if any assertion fails.

---

## 7) Example outputs (to copy/paste as golden)

### 7.1 Golden: Python CLI no auth/no db
`classify.json` should be:

```json
{
  "version":"1.0",
  "project_kind":"cli",
  "language":"python",
  "constraints":{"auth":"none","db":"none","deploy":"local"},
  "signals":["python","command-line","--health","no authentication","no database"]
}
```

`intake.json` MVP examples:

```json
{
  "scope": {
    "mvp_features": [
      "CLI prints Hello World",
      "--health prints OK and exits 0",
      "--help shows usage"
    ],
    "out_of_scope": ["auth","database"]
  },
  "constraints": {"auth":"none","db":"none","deploy":"local"}
}
```

Spec must include:
- Usage:
  - `python -m app --health` ⇒ OK
  - exit code 0

Research must contain at least one of `typer|click|argparse`.

---

## 8) One-time migration & compatibility

- Keep older fields in schemas for 1 version but mark deprecated.
- `selfcheck` must be updated to check new schema files exist.

---

## 9) Work breakdown (commit plan)

1) Commit A: add classify.js + schema + artifact writing
2) Commit B: refactor vibe.js intake generation + remove defaults + MVP extraction
3) Commit C: refactor research query to use classify
4) Commit D: decisions.json + verification gates + exit codes
5) Commit E: deploy kit conditional + env.example correctness
6) Commit F: regression suite + CI hook

DoD achieved only when regression suite passes.

---

## 10) Audit Log: Phase 1 (Vibe vNext) Compliance Check

Dưới đây là kết quả kiểm tra sự tuân thủ (Compliance) đối với bộ quy chuẩn DoD vNext sau khi rà soát mã nguồn.

### 10.1 Checklist: Absolute Gates
- [x] **Gate G1 (Prompt-negation)**: **PASS**. Logic triệt tiêu auth/db trong `vibe.js` hoạt động tốt.
- [x] **Gate G2 (Kind/Lang Correctness)**: **PASS**. Classifier nhận diện chính xác qua Regex.
- [ ] **Gate G3 (MVP Size >= 2)**: 🔴 **FAIL**. `vibe.js:1763` vẫn chấp nhận 1 item (chỉ check rỗng).
- [x] **Gate G4 (Tasks implementable)**: **PASS**. Task breakdown đầy đủ lane và description.
- [x] **Gate G5 (Research relevance)**: **PASS**. Query được tối ưu theo Project Kind thay vì fallback.
- [x] **Gate G6 (Deploy kit consistency)**: **PASS**. Docker compose respect `db=none`.

### 10.2 Checklist: Technical Standards
- [ ] **Versioning**: 🔴 **FAIL**. `intake.json` vẫn ở version `1.0` (vibe.js:809). Kỳ vọng `1.1`.
- [ ] **Schema Compliance**: 🔴 **FAIL**. Thiếu field `project.kind` trong output intake.
- [ ] **CLI Exit Codes**: 🔴 **FAIL**. Gate failure trả về `exit(2)` (vibe.js:2333). Kỳ vọng `exit(1)`.
- [ ] **Schemas**: 🟡 **PARTIAL**. Đã có file schema nhưng chưa được đưa vào `selfcheck.js` (line 73).
- [ ] **Standalone Tools**: 🔴 **FAIL**. `search-github.js` chưa đồng bộ logic `why_relevant` như trong `vibe.js`.

### 10.3 Checklist: GitHub Cleanliness
- [ ] **Artifacts**: 🔴 **FAIL**. Thư mục `artifacts/runs/` chưa được ignore trong `.gitignore`.
- [ ] **OS Garbage**: 🔴 **FAIL**. File `nul` vẫn tồn tại ở root.

---

## 11) Definition of Done: Phase 2 (Verify & Fix Loop)

Các tiêu chí bắt buộc để hoàn thành hệ thống "Tự chứng thực và tự sửa lỗi" (Self-healing).

### 11.1 Artifact: The DoD Contract
- [ ] **Automatic Generation**: File `40_spec/DEFINITION_OF_DONE.md` phải được sinh ra tự động sau mỗi run `vibe`.
- [ ] **Metadata**: Chứa YAML Frontmatter hợp lệ (`run_id`, `project_kind`, `language`, `constraints`).
- [ ] **Deliverables Integrity**: Danh sách file/folder vật lý bắt buộc theo stack (vd: Python CLI phải có `src/`).
- [ ] **Verification Commands**: Danh sách lệnh shell (`npm test`, `pytest`, `curl`) để máy tự thực thi verify.
- [ ] **Anti-Drift rules**: Danh sách các trạng thái cấm (vd: `no-auth` thì không được có `auth` vars).

### 11.2 System: The Loop Engine
- [ ] **Command `aat verify`**: Thực thi toàn bộ checklist trong DoD.md và sinh report JSON chuẩn.
- [ ] **Command `aat loop`**: Vòng lặp `verify -> fix -> verify` tự động cho đến khi PASS hoặc hết lượt.
- [ ] **Context Injection**: Lệnh `fix` phải nhận report từ bước `verify` để sửa lỗi chính xác.

---

## 12) Kết luận đánh giá (Final Verdict)

| Module | Trạng thái | Ghi chú |
|--------|------------|---------|
| **Vibe (Planning)** | 🟡 85% | Cần fix versioning, exit codes và đồng bộ field `kind`. |
| **Verify (Check)** | 🔴 10% | Mới có khung báo cáo tĩnh, thiếu engine thực thi lệnh shell. |
| **Fix Loop (Healing)** | 🔴 0% | Chưa triển khai. |

**Nhận xét cuối:** Dự án đã hoàn thành xuất sắc khâu "Vẽ thiết kế" (Planning). Tuy nhiên, để đạt trình độ Agentic hoàn chỉnh, cần tập trung dứt điểm Technical Debt ở Mục 10 trước khi xây dựng "Hệ thống tự sửa lỗi" ở Mục 11.
