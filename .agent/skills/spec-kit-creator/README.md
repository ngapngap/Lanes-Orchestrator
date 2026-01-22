# Spec-Kit Creator Skill

Skill này cung cấp khả năng khởi tạo và quản lý cấu trúc **Spec-Kit** theo phương pháp **Spec-Driven Development (SDD)**.

## Tổng quan

Spec-Driven Development là phương pháp phát triển phần mềm nhấn mạnh việc viết đặc tả rõ ràng trước khi triển khai code. Skill này giúp:

1. **Khởi tạo project** với cấu trúc specs chuẩn
2. **Tạo feature specifications** theo template
3. **Tạo command files** cho các AI agents khác nhau
4. **Quản lý constitution/rules** cho AI agents

## Cách sử dụng

### Khởi tạo Spec-Kit

```bash
node .agent/skills/spec-kit-creator/scripts/init-speckit.js --ai claude
```

Tham số:
- `--ai`: Agent mặc định (claude, gemini, copilot, cursor-agent, qwen, opencode, codex, windsurf, q)

### Tạo Feature Spec

```bash
node .agent/skills/spec-kit-creator/scripts/create-spec.js --name "user-authentication" --type feature
```

Tham số:
- `--name`: Tên feature (kebab-case)
- `--type`: Loại spec (feature, architecture, api, data)

### Tạo Command File

```bash
node .agent/skills/spec-kit-creator/scripts/create-command.js --agent claude --name "implement"
```

Tham số:
- `--agent`: Agent target (claude, gemini, copilot, cursor-agent, qwen, opencode, codex, windsurf, q, amp)
- `--name`: Tên command

## Cấu trúc thư mục

```
.agent/skills/spec-kit-creator/
├── SKILL.md          # Đặc tả chi tiết skill
├── README.md         # Tài liệu này
└── scripts/
    ├── init-speckit.js      # Script khởi tạo
    ├── create-spec.js       # Script tạo spec
    └── create-command.js    # Script tạo command
```

## Agents được hỗ trợ

| Agent | Thư mục | Định dạng |
|-------|---------|-----------|
| Claude Code | `.claude/commands/` | Markdown |
| Gemini CLI | `.gemini/commands/` | TOML |
| GitHub Copilot | `.github/agents/` | Markdown |
| Cursor | `.cursor/commands/` | Markdown |
| Qwen Code | `.qwen/commands/` | TOML |
| opencode | `.opencode/command/` | Markdown |
| Codex CLI | `.codex/commands/` | Markdown |
| Windsurf | `.windsurf/workflows/` | Markdown |
| Amazon Q | `.amazonq/prompts/` | Markdown |
| Amp | `.agents/commands/` | Markdown |

## Tài liệu chi tiết

Xem [SKILL.md](./SKILL.md) để biết thêm chi tiết về:
- Template feature spec
- Quy tắc SDD
- Command file formats
- Tích hợp với Orchestrator
