# Skill: Spec-Kit Creator

## Mô tả
Skill này tạo cấu trúc **Spec-Kit** chuẩn theo phương pháp **Spec-Driven Development (SDD)** của GitHub. SDD là phương pháp phát triển phần mềm nhấn mạnh việc viết đặc tả rõ ràng trước khi triển khai code.

## Khi nào sử dụng
- Khởi tạo dự án mới với cấu trúc specs
- Tạo feature specification cho tính năng mới
- Lập kế hoạch triển khai (implementation plan)
- Phân chia tasks cho nhiều agents làm việc song song
- Quản lý constitution/rules cho AI agents

## Các AI Agents được hỗ trợ

| Agent | Thư mục | Định dạng | CLI Tool |
|-------|---------|-----------|----------|
| **Claude Code** | `.claude/commands/` | Markdown | `claude` |
| **Gemini CLI** | `.gemini/commands/` | TOML | `gemini` |
| **GitHub Copilot** | `.github/agents/` | Markdown | N/A (IDE) |
| **Cursor** | `.cursor/commands/` | Markdown | `cursor-agent` |
| **Qwen Code** | `.qwen/commands/` | TOML | `qwen` |
| **opencode** | `.opencode/command/` | Markdown | `opencode` |
| **Codex CLI** | `.codex/commands/` | Markdown | `codex` |
| **Windsurf** | `.windsurf/workflows/` | Markdown | N/A (IDE) |
| **Amazon Q** | `.amazonq/prompts/` | Markdown | `q` |
| **Amp** | `.agents/commands/` | Markdown | `amp` |

## Cấu trúc Spec-Kit chuẩn

```
project/
├── specs/
│   ├── features/           # Feature specifications
│   │   ├── feature-name.md
│   │   └── ...
│   ├── architecture/       # Kiến trúc tổng quan
│   │   ├── overview.md
│   │   └── decisions/      # Architecture Decision Records (ADR)
│   ├── api/                # API specifications
│   │   └── endpoints.md
│   └── data/               # Data models & schemas
│       └── models.md
├── .claude/                # Claude Code commands
│   └── commands/
│       ├── implement.md    # Triển khai từ spec
│       ├── review.md       # Review code theo spec
│       └── test.md         # Tạo tests từ spec
├── .github/
│   └── agents/             # Copilot agents
│       └── spec-agent.md
└── AGENTS.md               # Hướng dẫn cho AI agents
```

## Quy tắc SDD (Spec-Driven Development)

### 1. Spec trước, Code sau
- Mọi feature phải có spec trước khi code
- Spec định nghĩa rõ: mục tiêu, acceptance criteria, edge cases
- Code implementation phải tuân theo spec

### 2. Template Feature Spec

```markdown
# Feature: [Tên feature]

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
- `POST /api/endpoint` - [mô tả]

### Data Models
- Model: [fields]

## Edge Cases
1. [Case 1]: [cách xử lý]
2. [Case 2]: [cách xử lý]

## Dependencies
- Dependency 1
- Dependency 2

## Implementation Phases
1. Phase 1: [scope]
2. Phase 2: [scope]
```

### 3. Command File Formats

#### Markdown Format (Claude, Cursor, Copilot...)
```markdown
---
description: "Mô tả command"
---

Nội dung command với placeholders:
- $ARGUMENTS: Tham số từ người dùng
- {SCRIPT}: Script template
```

#### TOML Format (Gemini, Qwen)
```toml
description = "Mô tả command"

prompt = """
Nội dung command với placeholders:
- {{args}}: Tham số từ người dùng
- {SCRIPT}: Script template
"""
```

## Lệnh thực thi

### Khởi tạo Spec-Kit cho project mới
```bash
node ".agent/skills/spec-kit-creator/scripts/init-speckit.js" --ai claude
```

### Tạo feature spec mới
```bash
node ".agent/skills/spec-kit-creator/scripts/create-spec.js" --name "feature-name" --type feature
```

### Tạo command file cho agent
```bash
node ".agent/skills/spec-kit-creator/scripts/create-command.js" --agent claude --name "command-name"
```

## Quy tắc quan trọng

### 1. Sử dụng CLI Tool Name làm key
**QUAN TRỌNG**: Luôn dùng tên thực thi CLI làm dictionary key.

**SAI:**
```python
AGENT_CONFIG = {
    "cursor": { ... }  # Tên viết tắt không khớp
}
```

**ĐÚNG:**
```python
AGENT_CONFIG = {
    "cursor-agent": { ... }  # Khớp với executable thực tế
}
```

### 2. Agent Categories
**CLI-Based**: claude, gemini, cursor-agent, qwen, opencode, q, codebuddy, qoder, amp, shai
**IDE-Based**: GitHub Copilot, Windsurf, IBM Bob

### 3. Argument Patterns
- **Markdown/prompt-based**: `$ARGUMENTS`
- **TOML-based**: `{{args}}`
- **Script placeholders**: `{SCRIPT}`
- **Agent placeholders**: `__AGENT__`

## Tích hợp với Orchestrator

Skill này có thể kết hợp với **Orchestrator** để phân chia specs cho các lanes:

1. **UI Lane**: Specs liên quan đến frontend components
2. **API Lane**: Specs liên quan đến backend endpoints
3. **Data Lane**: Specs liên quan đến database schemas
4. **QA Lane**: Specs liên quan đến test cases

### Workflow đề xuất
1. Tạo spec tổng quan cho feature
2. Chia nhỏ thành sub-specs cho từng lane
3. Khởi động các lanes với spec tương ứng
4. Merge kết quả theo Integration Gate

## Tham khảo
- [GitHub Spec-Kit](https://github.com/github/spec-kit)
- [AGENTS.md Guide](https://github.com/github/spec-kit/blob/main/AGENTS.md)
