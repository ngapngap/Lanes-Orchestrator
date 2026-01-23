# Artifacts Folder

This folder contains all run artifacts organized by `run_id`.

## Structure

```
artifacts/
└── runs/
    └── <run_id>/
        ├── 00_user_request.md
        ├── 10_intake/
        ├── 20_research/
        ├── 30_debate/
        ├── 40_spec/
        ├── 45_design/
        ├── 50_implementation/
        └── 60_verification/
```

## Run ID Format

Recommended format: `YYYYMMDD_HHMM_<slug>`

Examples:
- `20260123_1430_user-auth`
- `20260124_0900_dashboard-feature`

## Creating a New Run

```bash
# Generate run ID
RUN_ID=$(date +%Y%m%d_%H%M)_my-project

# Create folder structure
mkdir -p artifacts/runs/$RUN_ID/{10_intake,20_research,30_debate,40_spec,45_design,50_implementation/handoff/{ui,api,data,qa,security},60_verification/logs}

# Start with user request
echo "# User Request\n\n## Project\n...\n" > artifacts/runs/$RUN_ID/00_user_request.md
```

## Sample Run

See `sample_run/` for a template structure.
