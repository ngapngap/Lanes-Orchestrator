# Sample Run

This is a sample run folder demonstrating the artifacts structure.

**Run ID:** `sample_run`

## Structure

```
sample_run/
├── 00_user_request.md          # User's initial request
├── 10_intake/
│   ├── intake.json             # Structured requirements
│   └── intake.summary.md       # Human-readable summary
├── 20_research/
│   ├── research.shortlist.json
│   ├── research.reuse_assessment.json
│   ├── research.patterns.md
│   └── research.onepager.md
├── 30_debate/
│   ├── debate.inputs_for_spec.json
│   └── debate.decision.md
├── 40_spec/
│   ├── spec.md
│   └── task_breakdown.json
├── 45_design/
│   └── handoff.md              # (optional)
├── 50_implementation/
│   └── handoff/
│       ├── ui/
│       ├── api/
│       ├── data/
│       ├── qa/
│       └── security/
└── 60_verification/
    ├── report.json
    ├── summary.md
    └── logs/
```

## Usage

Copy this structure when creating a new run:
```bash
cp -r artifacts/runs/sample_run artifacts/runs/$(date +%Y%m%d_%H%M)_my-project
```
