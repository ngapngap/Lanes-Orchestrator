# AutoFix Rules (Vibe Mode)

> Nguyên tắc AutoFix đảm bảo dự án hoàn thành đúng đặc tả, không scope creep.

---

## 1. AutoFix chỉ sửa để hoàn thành đúng đặc tả

**Khi nào chạy AutoFix:**
- QA fail
- Build fail
- Deploy fail

**AutoFix được phép:**
- Sửa lỗi implementation
- Sửa cấu hình (config, env)
- Sửa test (miễn bám acceptance criteria)
- Sửa Docker/deploy kit

**AutoFix KHÔNG được phép:**
- Thêm tính năng mới
- Đổi luồng nghiệp vụ
- Đổi scope
- Đổi tech stack (trừ khi đặc tả cho phép)

---

## 2. Đặc tả là nguồn chân lý (Scope Lock)

### Files KHÔNG được tự ý thay đổi:

| File | Vai trò |
|------|---------|
| `10_intake/intake.json` | Goal, scope, constraints |
| `40_spec/spec.md` | Scope, Non-goals, Acceptance criteria |
| `30_debate/debate.inputs_for_spec.json` | Decision pack |

### Files ĐƯỢC phép thay đổi:

| File | Vai trò |
|------|---------|
| `50_implementation/**` | Code triển khai |
| `60_verification/**` | Test, QA config |
| `deploy/**` | Docker, deploy kit |

---

## 3. Triage trước khi sửa

Mỗi lần fail, phân loại trước:

### ✅ Fixable within spec

```
- Implementation bug
- Missing config
- Test mismatch (test sai, không phải spec sai)
- Docker/deploy issue
- Dependency issue
```

→ **Action:** Auto-fix và chạy lại QA (tối đa 2 vòng)

### ❌ Not fixable within spec

```
- Mơ hồ yêu cầu (ambiguous requirement)
- Scope mismatch (code không match spec)
- Architecture infeasible (kiến trúc không khả thi)
- Security blocker (lỗ hổng không thể fix trong scope)
- External dependency unavailable
```

→ **Action:** Dừng auto-fix, tạo Change Request

---

## 4. Change Request khi cần thay đổi đặc tả

Khi xác định "không thể hoàn thành với đặc tả hiện tại":

### Tạo Change Request với nội dung:

```markdown
## Change Request

**Lỗi chặn hoàn thành:**
[Mô tả lỗi cụ thể]

**Vì sao không thể fix trong scope hiện tại:**
[Giải thích technical]

**Đề xuất thay đổi:**
- Option A: [Mô tả]
- Option B: [Mô tả]

**Tác động:**
- Scope: [Thêm/bớt tính năng gì]
- Timeline: [Ảnh hưởng thời gian]
- Security: [Rủi ro nếu có]
```

### Hỏi user rõ ràng:

```
⚠️ Cần thay đổi đặc tả để tiếp tục.

[Nội dung Change Request]

Bạn có đồng ý thay đổi theo đề xuất không? (A/B/Không)
```

---

## 5. Flow sau khi user đồng ý

### Nếu user đồng ý:

1. **Update intake.json** (version bump)
   ```json
   {
     "version": "1.1",
     "change_requests": [
       {
         "id": "CR-001",
         "approved_at": "2024-01-23T12:00:00Z",
         "change": "Thêm OAuth vì email verification không khả thi"
       }
     ]
   }
   ```

2. **Regenerate toàn bộ:**
   - `30_debate/debate.inputs_for_spec.json`
   - `40_spec/spec.md`
   - `40_spec/task_breakdown.json`
   - `40_spec/NEXT_STEPS.md`

3. **Tiếp tục triển khai + QA + auto-fix**

### Nếu user không đồng ý:

1. **Dừng, không thay đổi đặc tả**

2. **Đưa ra lựa chọn khác:**
   - Giảm scope (bỏ tính năng)
   - Đổi constraint (thay tech/approach)
   - Phương án workaround

---

## Triage Decision Tree

```
QA/Build/Deploy Fail
        │
        ▼
┌───────────────────┐
│ Phân loại lỗi     │
└───────────────────┘
        │
        ├─── Fixable within spec? ───► YES ───► AutoFix
        │                                          │
        │                                          ▼
        │                                   Chạy lại QA
        │                                          │
        │                                          ├─── Pass ───► Done
        │                                          │
        │                                          └─── Fail (lần 2) ─┐
        │                                                              │
        └─── NO ─────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────┐
                        │ Tạo Change Request│
                        └───────────────────┘
                                    │
                                    ▼
                        ┌───────────────────┐
                        │ Hỏi user đồng ý?  │
                        └───────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
            User đồng ý                     User không đồng ý
                    │                               │
                    ▼                               ▼
            Update spec                     Đưa lựa chọn khác
            Regenerate                      hoặc dừng
            Tiếp tục
```

---

## Implementation Notes

### Trong QA Gate script:

```javascript
const triageFailure = (error, spec) => {
  // Check if fixable within spec
  const fixablePatterns = [
    /TypeError|ReferenceError/,      // Implementation bug
    /Cannot find module/,             // Missing dependency
    /ENOENT|ECONNREFUSED/,           // Config issue
    /docker|container/i,              // Docker issue
  ];

  const notFixablePatterns = [
    /scope|requirement|specification/, // Scope mismatch
    /security|vulnerability/i,         // Security blocker
    /architecture|design/i,            // Architecture issue
  ];

  if (fixablePatterns.some(p => p.test(error))) {
    return { fixable: true, category: 'implementation' };
  }

  if (notFixablePatterns.some(p => p.test(error))) {
    return { fixable: false, category: 'spec_change_required' };
  }

  return { fixable: false, category: 'unknown' };
};
```

### AutoFix max retries:

```javascript
const AUTOFIX_MAX_RETRIES = 2;
```

---

*Tài liệu này là reference cho tất cả agents và scripts trong AI Agent Toolkit.*
