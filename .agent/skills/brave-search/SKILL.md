# Brave Search Skill

## Overview
Web search skill using Brave Search API for research phase.

## Requirements
- `BRAVE_API_KEY` environment variable

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
