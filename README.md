# AI Agent Toolkit

Pipeline hoàn chỉnh cho vòng đời phát triển phần mềm, điều phối bởi AI agents.

## Tổng quan

Toolkit này cung cấp 6 skills và 10 agent configurations để tự động hóa quy trình phát triển từ ý tưởng đến sản phẩm.

## Skills có sẵn

| Skill | Mô tả | Link |
|-------|-------|------|
| **intake** | Thu thập requirements từ user | [SKILL.md](.agent/skills/intake/SKILL.md) |
| **research** | Tìm repo mẫu trên GitHub | [SKILL.md](.agent/skills/research/SKILL.md) |
| **spec-kit-creator** | Tạo specifications theo SDD | [SKILL.md](.agent/skills/spec-kit-creator/SKILL.md) |
| **orchestrator** | Điều phối lanes song song | [SKILL.md](.agent/skills/orchestrator/SKILL.md) |
| **ui-ux** | Thiết kế UI/UX design system | [SKILL.md](.agent/skills/ui-ux/SKILL.md) |
| **qa-gate** | Verify code quality | [SKILL.md](.agent/skills/qa-gate/SKILL.md) |

## Quick Start

### 1. Thu thập Requirements
```bash
node .agent/skills/intake/scripts/start-intake.js
```

### 2. Tìm kiếm Repo mẫu
```bash
node .agent/skills/research/scripts/search-github.js
```

### 3. Tạo Design System
```bash
node .agent/skills/ui-ux/scripts/generate-design.js
```

### 4. Verify Code Quality
```bash
node .agent/skills/qa-gate/scripts/run-gate.js
```

### 5. Orchestrator (Lanes)
```bash
# Khởi tạo một Lane
node .agent/skills/orchestrator/scripts/run-agent.js --id ui_lane --cwd .

# Giám sát Lane
node .agent/skills/orchestrator/scripts/watcher.js --lane ui_lane
```

### 6. Spec-Kit Creator
```bash
# Khởi tạo Spec-Kit cho project
node .agent/skills/spec-kit-creator/scripts/init-speckit.js --ai claude

# Tạo feature spec mới
node .agent/skills/spec-kit-creator/scripts/create-spec.js --name user-auth --type feature
```

## Agents

Xem [AGENTS.md](AGENTS.md) để hiểu về các agent configurations và workflows.

## Workflows

| Workflow | Khi nào dùng |
|----------|--------------|
| [Quick Flow](.agent/workflows/quick-flow.md) | Bug fixes, small changes |
| [Full Pipeline](.agent/workflows/full-pipeline.md) | New features, products |
| [Enterprise](.agent/workflows/enterprise.md) | Compliance-heavy systems |

## Pipeline Flow

```
Intake → Research → Spec → Design? → Build (Lanes) → Verify → Complete
```

## Output

Tất cả outputs được lưu trong thư mục `output/`:
- `output/intake/` - Requirements
- `output/research/` - Patterns và recommendations
- `output/design/` - Design system
- `output/verification/` - QA reports
