# Brave Search Skill

## Overview
Web search skill using Brave Search API for research phase.

## Requirements

### Environment Variable (Required)
```bash
BRAVE_API_KEY=your_brave_api_key_here
```

**Get your API key at:** https://brave.com/search/api/

### Setup
1. Copy `.env.example` to `.env` in repo root
2. Set `BRAVE_API_KEY` in `.env`
3. Run `node .agent/skills/orchestrator/scripts/selfcheck.js` to verify

## Fallback Behavior

When `BRAVE_API_KEY` is not set:
- Script returns mock results with warning
- Pipeline can continue using GitHub search as alternative
- Manual input also accepted

## Usage

```javascript
const { braveSearch } = require('./scripts/search.js');

const results = await braveSearch({
  query: 'best Node.js starter template 2024',
  count: 10
});
```

## Inputs
- `query` - Search query string
- `count` - Number of results (default: 10)
- `freshness` - Time filter: `day`, `week`, `month`, `year`

## Outputs
```json
{
  "results": [
    {
      "title": "...",
      "url": "...",
      "description": "...",
      "age": "2 days ago"
    }
  ],
  "query": "...",
  "total": 100
}
```

## Integration
Used by `Architect` agent during Research phase to find patterns and solutions.

## Fallback
If Brave API unavailable, falls back to `web_fetch` + summarize.

## Commands

```bash
# Search and output results
node .agent/skills/brave-search/scripts/search.js --query "your query" --count 10

# Search with freshness filter
node .agent/skills/brave-search/scripts/search.js --query "latest trends" --freshness week
```
