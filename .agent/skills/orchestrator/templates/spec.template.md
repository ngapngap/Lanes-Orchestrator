# {{PROJECT_NAME}} - Specification

> Tài liệu này mô tả chi tiết dự án để developer hoặc AI agent có thể implement.
> **Phiên bản:** 1.0 | **Ngày tạo:** {{TIMESTAMP}}

---

## 1. Tổng Quan

### Dự án là gì?
{{PROJECT_DESCRIPTION}}

### Ai sẽ dùng?
{{TARGET_USERS}}

### Mục tiêu chính
{{MAIN_GOALS}}

---

## 2. Tính Năng MVP (Bắt buộc có)

> Đây là các tính năng **phải có** trong phiên bản đầu tiên.

{{#each MVP_FEATURES}}
### {{@index}}. {{name}}

**Mô tả:** {{description}}

**User flow:**
{{#each steps}}
{{@index}}. {{this}}
{{/each}}

**Acceptance criteria:**
{{#each criteria}}
- [ ] {{this}}
{{/each}}

---
{{/each}}

## 3. Tính Năng Tương Lai (Không làm ngay)

> Những tính năng này sẽ làm SAU khi MVP hoàn thành.

{{#each FUTURE_FEATURES}}
- **{{name}}**: {{description}}
{{/each}}

---

## 4. Yêu Cầu Kỹ Thuật

### Nền tảng
- **Loại:** {{PLATFORM_TYPE}}
- **Responsive:** {{RESPONSIVE}}

### Authentication
- **Cần đăng nhập:** {{NEEDS_AUTH}}
- **Phương thức:** {{AUTH_METHODS}}

### Tech Stack (Đề xuất)
| Layer | Công nghệ | Lý do |
|-------|-----------|-------|
{{#each TECH_STACK}}
| {{layer}} | {{tech}} | {{reason}} |
{{/each}}

---

## 5. Data Models

> Các "đối tượng" chính trong hệ thống.

{{#each DATA_MODELS}}
### {{name}}

```
{{#each fields}}
{{name}}: {{type}} {{#if required}}(bắt buộc){{/if}}
{{/each}}
```

{{/each}}

---

## 6. API Endpoints (Nếu có backend)

{{#each API_ENDPOINTS}}
### {{method}} {{path}}
- **Mô tả:** {{description}}
- **Auth:** {{auth}}
- **Request:** {{request}}
- **Response:** {{response}}

{{/each}}

---

## 7. UI/UX Guidelines

### Màn hình chính
{{#each SCREENS}}
- **{{name}}**: {{description}}
{{/each}}

### Style Guide
- **Màu chính:** {{PRIMARY_COLOR}}
- **Font:** {{FONT}}
- **Tone:** {{TONE}}

---

## 8. Constraints & Giới Hạn

{{#each CONSTRAINTS}}
- **{{category}}**: {{description}}
{{/each}}

---

## 9. Glossary (Thuật ngữ)

| Thuật ngữ | Nghĩa |
|-----------|-------|
{{#each GLOSSARY}}
| {{term}} | {{definition}} |
{{/each}}

---

## 10. References

{{#if RESEARCH_REPOS}}
### Repos tham khảo
{{#each RESEARCH_REPOS}}
- [{{name}}]({{url}}) - {{stars}} stars - {{why}}
{{/each}}
{{/if}}

{{#if RESEARCH_NOTE}}
> **Lưu ý:** {{RESEARCH_NOTE}}
{{/if}}

---

## Checklist Trước Khi Code

- [ ] Đã hiểu mục tiêu dự án (Section 1)
- [ ] Đã hiểu MVP features (Section 2)
- [ ] Đã setup tech stack (Section 4)
- [ ] Đã tạo data models (Section 5)
- [ ] Đã implement API endpoints (Section 6)
- [ ] Đã hoàn thành UI (Section 7)

---

*Spec được tạo bởi AI Agent Toolkit*
*Run ID: {{RUN_ID}}*
