# Research Skill

Tìm kiếm và phân tích repo mẫu trên GitHub.

## Quick Start

```bash
# Search từ intake context
node ".agent/skills/research/scripts/search-github.js"

# Phân tích repo cụ thể
node ".agent/skills/research/scripts/analyze-repo.js" --repo owner/repo-name
```

## Output

- `output/research/shortlist.json` - Top repos với scoring
- `output/research/patterns.md` - Patterns và recommendations

## Integration

Nhận input từ:
- **Intake Skill** - Keywords và requirements

Cung cấp output cho:
- **Spec-Kit Skill** - Architecture decisions

## Xem chi tiết

Đọc [SKILL.md](./SKILL.md) để hiểu workflow đầy đủ.
