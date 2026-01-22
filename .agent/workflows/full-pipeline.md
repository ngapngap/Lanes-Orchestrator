# Full Pipeline Workflow

## Overview
Quy trình đầy đủ từ ý tưởng đến sản phẩm hoàn chỉnh.

## Khi nào sử dụng
- Dự án mới từ đầu
- Product-level development
- Cần đầy đủ documentation

## Phases

### Phase 1: Discovery
```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1: DISCOVERY                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   User Request                                              │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────┐                                          │
│   │   INTAKE    │──────► output/intake/intake.md           │
│   │   AGENT     │                                          │
│   └─────────────┘                                          │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────┐                                          │
│   │  RESEARCH   │──────► output/research/shortlist.json    │
│   │   AGENT     │        output/research/patterns.md       │
│   └─────────────┘                                          │
│                                                             │
│   Checkpoint: Requirements clear? Patterns identified?      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Duration**: Variable based on complexity
**Deliverables**:
- `intake.md` - Structured requirements
- `shortlist.json` - Reference repos
- `patterns.md` - Recommended approaches

### Phase 2: Planning
```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 2: PLANNING                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                                          │
│   │    SPEC     │──────► specs/features/*.md               │
│   │   AGENT     │        specs/task_breakdown.json         │
│   └─────────────┘                                          │
│        │                                                    │
│        ▼ (if UI needed)                                    │
│   ┌─────────────┐                                          │
│   │   UI/UX     │──────► output/design/MASTER.md           │
│   │   AGENT     │        output/design/pages/*.md          │
│   └─────────────┘                                          │
│                                                             │
│   Checkpoint: Specs complete? Design system ready?          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Duration**: Variable based on features count
**Deliverables**:
- Feature specifications
- Task breakdown
- Design system (if applicable)

### Phase 3: Build
```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 3: BUILD                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│            ┌─────────────┐                                 │
│            │   MANAGER   │                                 │
│            │  (Orchestrator)                               │
│            └──────┬──────┘                                 │
│                   │                                         │
│     ┌─────────────┼─────────────┐                          │
│     │             │             │                          │
│     ▼             ▼             ▼                          │
│ ┌───────┐    ┌───────┐    ┌───────┐                       │
│ │  UI   │    │  API  │    │ DATA  │                       │
│ │ Lane  │    │ Lane  │    │ Lane  │                       │
│ └───┬───┘    └───┬───┘    └───┬───┘                       │
│     │            │            │                            │
│     ▼            ▼            ▼                            │
│  handoff      handoff      handoff                         │
│  bundle       bundle       bundle                          │
│                                                             │
│   Checkpoint: All lanes completed? Handoffs received?       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Duration**: Variable based on scope
**Deliverables**:
- Implemented features
- Handoff bundles from each lane

### Phase 4: Verify
```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 4: VERIFY                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                                          │
│   │  VERIFIER   │──────► output/verification/report.json   │
│   │   AGENT     │        output/verification/tests.md      │
│   └─────────────┘                                          │
│        │                                                    │
│        ├── PASS ─────► Proceed to Deliver                  │
│        │                                                    │
│        └── FAIL ─────► Return to Build (fix issues)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Deliverables**:
- Verification report
- Test results

### Phase 5: Deliver
```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 5: DELIVER                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                                          │
│   │   MANAGER   │                                          │
│   │  Decision   │                                          │
│   └──────┬──────┘                                          │
│          │                                                  │
│    ┌─────┴─────┐                                           │
│    ▼           ▼                                            │
│  MERGE      DOCUMENT                                        │
│  CODE       CHANGES                                         │
│                                                             │
│   Output: Merged code, documentation, release notes         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Flow Control

### Go/No-Go Checkpoints

| Checkpoint | Criteria | Action if Fail |
|------------|----------|----------------|
| After Discovery | Requirements clear, patterns found | Loop back to Intake |
| After Planning | Specs complete, tasks defined | Clarify with user |
| After Build | All lanes complete, handoffs received | Continue building |
| After Verify | All checks pass | Fix issues, re-verify |

### Escalation Triggers

| Trigger | Action |
|---------|--------|
| Missing requirements | Ask user via Manager |
| Architecture conflict | Present options to user |
| Verification fail | Report issues, request direction |
| Scope change | Re-enter Discovery phase |

## Example Run

```
[USER] Build a blog platform with user auth and comments

[MANAGER] Starting Full Pipeline...

[INTAKE AGENT] Gathering requirements...
  - Project type: Web App
  - Scale: MVP
  - Features: Auth, Blog posts, Comments
  - Output: intake.md ✓

[RESEARCH AGENT] Searching for patterns...
  - Found: 8 relevant repos
  - Recommended: Next.js + Prisma
  - Output: patterns.md ✓

[SPEC AGENT] Creating specifications...
  - Features: 4 specs created
  - Tasks: 12 tasks defined
  - Output: task_breakdown.json ✓

[UI/UX AGENT] Generating design...
  - Style: Minimal
  - Palette: SaaS Blue
  - Output: MASTER.md ✓

[MANAGER] Spawning lanes...

[UI LANE] Implementing components...
  - Components: 15 created
  - Handoff: ✓

[API LANE] Implementing endpoints...
  - Endpoints: 8 created
  - Handoff: ✓

[DATA LANE] Setting up database...
  - Models: 4 created
  - Handoff: ✓

[VERIFIER] Running checks...
  - Tests: 45/45 pass
  - Lint: 0 errors
  - Build: Pass
  - Output: report.json ✓

[MANAGER] All checks passed. Ready for merge.

[COMPLETE] Blog platform MVP ready!
```

## Commands

```bash
# Start full pipeline
node ".agent/workflows/run-pipeline.js" --workflow full

# Resume from specific phase
node ".agent/workflows/run-pipeline.js" --resume planning

# View pipeline status
node ".agent/workflows/status.js"
```
