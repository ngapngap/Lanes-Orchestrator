#!/usr/bin/env node
/**
 * create-spec.js
 * Tạo specification file mới theo template
 *
 * Usage: node create-spec.js --name <spec-name> --type <spec-type>
 */

const fs = require('fs');
const path = require('path');

// Spec types và templates
const SPEC_TEMPLATES = {
  feature: {
    folder: 'specs/features',
    template: (name, title) => `# Feature: ${title}

## Mục tiêu
[Mô tả ngắn gọn mục đích của feature]

## User Stories
- As a [role], I want to [action] so that [benefit]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Design

### Components
- Component A: [mô tả]
- Component B: [mô tả]

### API Endpoints (nếu có)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/... | ... |

### Data Models
| Model | Fields | Description |
|-------|--------|-------------|
| ... | ... | ... |

## Edge Cases
1. **[Case 1]**: [cách xử lý]
2. **[Case 2]**: [cách xử lý]

## Dependencies
- Dependency 1
- Dependency 2

## Implementation Phases
1. **Phase 1**: [scope] - [priority]
2. **Phase 2**: [scope] - [priority]

## Testing Requirements
- Unit tests cho [components]
- Integration tests cho [flows]
- E2E tests cho [scenarios]

## Notes
[Ghi chú bổ sung]
`
  },

  architecture: {
    folder: 'specs/architecture/decisions',
    template: (name, title) => `# ADR: ${title}

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
[Mô tả vấn đề cần giải quyết và bối cảnh]

## Decision
[Quyết định được đưa ra]

## Consequences

### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Drawback 1]
- [Drawback 2]

## Alternatives Considered

### Option A: [Tên]
- Pros: [...]
- Cons: [...]

### Option B: [Tên]
- Pros: [...]
- Cons: [...]

## Related Decisions
- [Link to related ADR]

## References
- [Link to documentation/research]
`
  },

  api: {
    folder: 'specs/api',
    template: (name, title) => `# API: ${title}

## Tổng quan
[Mô tả API này làm gì]

## Base Path
\`\`\`
/api/v1/${name}
\`\`\`

## Authentication
- Required: Yes/No
- Method: Bearer Token / API Key / None

## Endpoints

### Create ${title}
\`\`\`
POST /api/v1/${name}
\`\`\`

**Request Headers**:
| Header | Value | Required |
|--------|-------|----------|
| Content-Type | application/json | Yes |
| Authorization | Bearer {token} | Yes |

**Request Body**:
\`\`\`json
{
  "field1": "string",
  "field2": 123
}
\`\`\`

**Response 201**:
\`\`\`json
{
  "id": "uuid",
  "field1": "string",
  "field2": 123,
  "createdAt": "2024-01-01T00:00:00Z"
}
\`\`\`

**Error Responses**:
| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized |
| 500 | Internal Server Error |

### Get ${title}
\`\`\`
GET /api/v1/${name}/:id
\`\`\`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Resource ID |

**Response 200**:
\`\`\`json
{
  "id": "uuid",
  "field1": "string",
  "field2": 123
}
\`\`\`

### List ${title}
\`\`\`
GET /api/v1/${name}
\`\`\`

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

**Response 200**:
\`\`\`json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
\`\`\`

## Rate Limiting
- Rate: 100 requests per minute
- Header: X-RateLimit-Remaining
`
  },

  data: {
    folder: 'specs/data',
    template: (name, title) => `# Data Model: ${title}

## Tổng quan
[Mô tả data model này đại diện cho gì]

## Schema

### Table: ${name}

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | gen_random_uuid() | Primary key |
| created_at | TIMESTAMP | No | now() | Creation time |
| updated_at | TIMESTAMP | No | now() | Last update time |
| | | | | |

### Indexes
| Name | Columns | Type | Description |
|------|---------|------|-------------|
| ${name}_pkey | id | PRIMARY | |
| | | | |

### Foreign Keys
| Column | References | On Delete | On Update |
|--------|------------|-----------|-----------|
| | | | |

## Relationships
- **Has Many**: [Related model]
- **Belongs To**: [Parent model]

## Validations
- field1: required, max 255 chars
- field2: required, positive integer

## Sample Data
\`\`\`json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "field1": "example",
  "field2": 100,
  "created_at": "2024-01-01T00:00:00Z"
}
\`\`\`

## Migration

### Up
\`\`\`sql
CREATE TABLE ${name} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
\`\`\`

### Down
\`\`\`sql
DROP TABLE IF EXISTS ${name};
\`\`\`

## Notes
[Ghi chú bổ sung về data model]
`
  }
};

// Parse arguments
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      result[key] = value;
      if (value !== true) i++;
    }
  }
  return result;
}

// Convert kebab-case to Title Case
function toTitleCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created: ${dirPath}`);
  }
}

// Main function
function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = args.cwd || process.cwd();
  const name = args.name;
  const type = args.type || 'feature';

  // Validate inputs
  if (!name) {
    console.error('❌ Error: --name is required');
    console.log('Usage: node create-spec.js --name <spec-name> --type <spec-type>');
    console.log('Types: feature, architecture, api, data');
    process.exit(1);
  }

  if (!SPEC_TEMPLATES[type]) {
    console.error(`❌ Error: Unknown type "${type}"`);
    console.log(`Available types: ${Object.keys(SPEC_TEMPLATES).join(', ')}`);
    process.exit(1);
  }

  const template = SPEC_TEMPLATES[type];
  const title = toTitleCase(name);
  const fileName = `${name}.md`;
  const filePath = path.join(projectRoot, template.folder, fileName);

  console.log(`\n🚀 Creating ${type} spec: ${title}\n`);

  // Check if file exists
  if (fs.existsSync(filePath)) {
    console.error(`❌ Error: Spec already exists at ${filePath}`);
    process.exit(1);
  }

  // Ensure directory exists
  ensureDir(path.join(projectRoot, template.folder));

  // Create spec file
  const content = template.template(name, title);
  fs.writeFileSync(filePath, content);
  console.log(`📄 Created: ${filePath}`);

  console.log(`\n✅ Spec created successfully!`);
  console.log(`\nNext steps:
1. Edit the spec at: ${filePath}
2. Fill in the details
3. Use /implement ${name} to implement
`);
}

main();
