# GitHub Skill

## Overview
GitHub integration skill using `gh` CLI for repository operations.

## Requirements
- `gh` CLI installed and authenticated
- Or `GITHUB_TOKEN` environment variable

## Usage

```javascript
const { searchRepos, getRepoInfo, cloneRepo } = require('./scripts/github.js');

// Search repositories
const repos = await searchRepos('nodejs starter template', { limit: 10 });

// Get repository info
const info = await getRepoInfo('owner/repo');

// Clone repository
await cloneRepo('owner/repo', './local-path');
```

## Operations

### Search Repositories
```bash
node .agent/skills/github/scripts/github.js search "query" --limit 10 --language javascript
```

### Get Repository Info
```bash
node .agent/skills/github/scripts/github.js info owner/repo
```

### Clone Repository
```bash
node .agent/skills/github/scripts/github.js clone owner/repo ./path
```

### List Repository Contents
```bash
node .agent/skills/github/scripts/github.js contents owner/repo [path]
```

## Outputs

### Search Results
```json
{
  "repos": [
    {
      "full_name": "owner/repo",
      "description": "...",
      "stars": 1234,
      "license": "MIT",
      "language": "JavaScript",
      "updated_at": "2024-01-15"
    }
  ]
}
```

### Repository Info
```json
{
  "full_name": "owner/repo",
  "description": "...",
  "default_branch": "main",
  "license": "MIT",
  "stars": 1234,
  "forks": 56,
  "open_issues": 10,
  "topics": ["nodejs", "starter"]
}
```

## Integration
Used by `Architect` agent during Research phase to find and analyze candidate repositories.
