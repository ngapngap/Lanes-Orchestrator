#!/usr/bin/env node
/**
 * init-speckit.js
 * Khởi tạo cấu trúc Spec-Kit cho project
 *
 * Usage: node init-speckit.js --ai <agent>
 */

const fs = require('fs');
const path = require('path');

// Agent configurations - sử dụng CLI tool name làm key
const AGENT_CONFIG = {
  'claude': {
    name: 'Claude Code',
    folder: '.claude/commands/',
    format: 'markdown',
    installUrl: 'https://docs.anthropic.com/claude-code'
  },
  'gemini': {
    name: 'Gemini CLI',
    folder: '.gemini/commands/',
    format: 'toml',
    installUrl: 'https://github.com/google-gemini/gemini-cli'
  },
  'copilot': {
    name: 'GitHub Copilot',
    folder: '.github/agents/',
    format: 'markdown',
    installUrl: null // IDE-based
  },
  'cursor-agent': {
    name: 'Cursor',
    folder: '.cursor/commands/',
    format: 'markdown',
    installUrl: 'https://cursor.sh'
  },
  'qwen': {
    name: 'Qwen Code',
    folder: '.qwen/commands/',
    format: 'toml',
    installUrl: 'https://github.com/QwenLM/qwen-code'
  },
  'opencode': {
    name: 'opencode',
    folder: '.opencode/command/',
    format: 'markdown',
    installUrl: 'https://github.com/opencode-ai/opencode'
  },
  'codex': {
    name: 'Codex CLI',
    folder: '.codex/commands/',
    format: 'markdown',
    installUrl: 'https://github.com/openai/codex'
  },
  'windsurf': {
    name: 'Windsurf',
    folder: '.windsurf/workflows/',
    format: 'markdown',
    installUrl: null // IDE-based
  },
  'q': {
    name: 'Amazon Q Developer',
    folder: '.amazonq/prompts/',
    format: 'markdown',
    installUrl: 'https://aws.amazon.com/q/developer/'
  },
  'amp': {
    name: 'Amp',
    folder: '.agents/commands/',
    format: 'markdown',
    installUrl: 'https://github.com/amp-ai/amp'
  }
};

// Cấu trúc specs chuẩn
const SPEC_STRUCTURE = {
  'specs/features/.gitkeep': '',
  'specs/architecture/overview.md': `# Architecture Overview

## Mục tiêu
[Mô tả mục tiêu kiến trúc tổng quan của dự án]

## Các thành phần chính
- **Component A**: [mô tả]
- **Component B**: [mô tả]

## Nguyên tắc thiết kế
1. [Nguyên tắc 1]
2. [Nguyên tắc 2]

## Diagram
\`\`\`
[Thêm diagram kiến trúc ở đây]
\`\`\`
`,
  'specs/architecture/decisions/.gitkeep': '',
  'specs/api/endpoints.md': `# API Endpoints

## Tổng quan
[Mô tả tổng quan về API]

## Base URL
\`\`\`
/api/v1
\`\`\`

## Authentication
[Mô tả phương thức xác thực]

## Endpoints

### [Resource Name]

#### GET /resource
**Mô tả**: [mô tả]

**Request**:
\`\`\`json
{}
\`\`\`

**Response**:
\`\`\`json
{
  "data": []
}
\`\`\`
`,
  'specs/data/models.md': `# Data Models

## Tổng quan
[Mô tả tổng quan về data models]

## Models

### User
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | String | User email |
| created_at | DateTime | Creation timestamp |

### [Other Model]
| Field | Type | Description |
|-------|------|-------------|
| | | |
`
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

// Tạo thư mục nếu chưa tồn tại
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created: ${dirPath}`);
  }
}

// Tạo file nếu chưa tồn tại
function ensureFile(filePath, content) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    console.log(`📄 Created: ${filePath}`);
  } else {
    console.log(`⏭️  Skipped (exists): ${filePath}`);
  }
}

// Tạo AGENTS.md
function createAgentsMd(projectRoot, agent) {
  const agentConfig = AGENT_CONFIG[agent];
  const content = `# AGENTS.md

## Về dự án này
[Mô tả ngắn gọn về dự án]

## Phương pháp phát triển
Dự án này sử dụng **Spec-Driven Development (SDD)** - viết specifications trước khi triển khai code.

## Cấu trúc specs
- \`specs/features/\` - Feature specifications
- \`specs/architecture/\` - Kiến trúc và ADRs
- \`specs/api/\` - API specifications
- \`specs/data/\` - Data models

## AI Agent mặc định
- **${agentConfig.name}**
- Command folder: \`${agentConfig.folder}\`
${agentConfig.installUrl ? `- Install: ${agentConfig.installUrl}` : '- IDE-based (không cần CLI)'}

## Quy tắc cho AI Agents
1. **Đọc spec trước**: Luôn đọc spec liên quan trước khi code
2. **Tuân thủ spec**: Code phải đáp ứng acceptance criteria trong spec
3. **Báo cáo vấn đề**: Nếu spec không rõ ràng hoặc có vấn đề, báo cáo trước khi code
4. **Không tự ý thêm feature**: Chỉ implement những gì có trong spec

## Commands có sẵn
- \`/implement\` - Triển khai code từ spec
- \`/review\` - Review code theo spec
- \`/test\` - Tạo tests từ spec
`;
  ensureFile(path.join(projectRoot, 'AGENTS.md'), content);
}

// Tạo default commands cho agent
function createDefaultCommands(projectRoot, agent) {
  const agentConfig = AGENT_CONFIG[agent];
  const commandDir = path.join(projectRoot, agentConfig.folder);

  if (agentConfig.format === 'markdown') {
    // Implement command
    ensureFile(path.join(commandDir, 'implement.md'), `---
description: "Triển khai code từ feature specification"
---

# Implement từ Spec

Đọc feature spec được chỉ định và triển khai code theo đúng acceptance criteria.

## Spec cần implement
$ARGUMENTS

## Quy trình
1. Đọc và hiểu spec
2. Xác định các components cần tạo/sửa
3. Implement từng phần theo thứ tự
4. Kiểm tra acceptance criteria
5. Báo cáo kết quả

## Lưu ý
- Không thêm feature ngoài spec
- Tuân thủ coding conventions của project
- Viết code clean và có comments khi cần
`);

    // Review command
    ensureFile(path.join(commandDir, 'review.md'), `---
description: "Review code theo feature specification"
---

# Review Code theo Spec

Review code để đảm bảo tuân thủ spec đã định nghĩa.

## Spec cần review
$ARGUMENTS

## Checklist review
1. [ ] Code đáp ứng tất cả acceptance criteria
2. [ ] Xử lý đúng các edge cases trong spec
3. [ ] Không có feature ngoài spec
4. [ ] Code quality đạt chuẩn
5. [ ] Tests cover các scenarios trong spec
`);

    // Test command
    ensureFile(path.join(commandDir, 'test.md'), `---
description: "Tạo tests từ feature specification"
---

# Tạo Tests từ Spec

Tạo test cases dựa trên acceptance criteria và edge cases trong spec.

## Spec cần tạo tests
$ARGUMENTS

## Loại tests cần tạo
1. Unit tests cho từng component
2. Integration tests cho flows
3. Edge case tests

## Template test
- Describe block = Feature name
- It block = Acceptance criterion
- Test edge cases riêng
`);

  } else if (agentConfig.format === 'toml') {
    // TOML format cho Gemini/Qwen
    ensureFile(path.join(commandDir, 'implement.toml'), `description = "Triển khai code từ feature specification"

prompt = """
# Implement từ Spec

Đọc feature spec được chỉ định và triển khai code theo đúng acceptance criteria.

## Spec cần implement
{{args}}

## Quy trình
1. Đọc và hiểu spec
2. Xác định các components cần tạo/sửa
3. Implement từng phần theo thứ tự
4. Kiểm tra acceptance criteria
5. Báo cáo kết quả
"""
`);
  }
}

// Main function
function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = args.cwd || process.cwd();
  const agent = args.ai || 'claude';

  console.log('🚀 Initializing Spec-Kit structure...\n');
  console.log(`📍 Project root: ${projectRoot}`);
  console.log(`🤖 Default agent: ${agent}\n`);

  // Validate agent
  if (!AGENT_CONFIG[agent]) {
    console.error(`❌ Unknown agent: ${agent}`);
    console.log(`Available agents: ${Object.keys(AGENT_CONFIG).join(', ')}`);
    process.exit(1);
  }

  // Tạo cấu trúc specs
  console.log('📂 Creating specs structure...');
  for (const [relativePath, content] of Object.entries(SPEC_STRUCTURE)) {
    ensureFile(path.join(projectRoot, relativePath), content);
  }

  // Tạo AGENTS.md
  console.log('\n📋 Creating AGENTS.md...');
  createAgentsMd(projectRoot, agent);

  // Tạo agent commands
  console.log('\n🤖 Creating agent commands...');
  createDefaultCommands(projectRoot, agent);

  console.log('\n✅ Spec-Kit initialized successfully!');
  console.log(`\nNext steps:
1. Edit AGENTS.md to describe your project
2. Create feature specs in specs/features/
3. Use /${agent} implement <spec> to implement features
`);
}

main();
