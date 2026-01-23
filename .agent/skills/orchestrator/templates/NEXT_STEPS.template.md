# Bước Tiếp Theo - {{PROJECT_NAME}}

> Tài liệu này hướng dẫn bạn các bước cần làm sau khi có spec.
> Không cần biết code - chỉ cần làm theo từng bước.

---

## Tình Trạng Hiện Tại

| Giai đoạn | Trạng thái |
|-----------|------------|
| Thu thập yêu cầu | ✅ Hoàn thành |
| Nghiên cứu giải pháp | {{RESEARCH_STATUS}} |
| Tạo specification | ✅ Hoàn thành |
| Chia nhỏ công việc | ✅ Hoàn thành |

---

## Bạn Có 3 Lựa Chọn

### Lựa Chọn 1: Tự Code (Miễn phí)

Nếu bạn biết code hoặc có bạn bè biết code:

1. **Mở file `spec.md`** - Đây là "bản vẽ" chi tiết của dự án
2. **Mở file `task_breakdown.json`** - Đây là danh sách việc cần làm
3. **Bắt đầu từ task có `priority: "P0"`** - Đây là việc quan trọng nhất
4. **Hoàn thành từng task** theo thứ tự

**Thời gian ước tính:** {{ESTIMATED_TIME_SELF}}

---

### Lựa Chọn 2: Dùng AI Code Agent (Khuyến nghị)

Dùng Claude Code, Cursor, hoặc Windsurf để code tự động:

```bash
# Bước 1: Copy spec vào project mới
mkdir {{PROJECT_SLUG}}
cd {{PROJECT_SLUG}}
cp path/to/spec.md ./SPEC.md

# Bước 2: Mở trong AI IDE và paste prompt này:
```

**Prompt để paste vào AI:**
```
Đọc file SPEC.md và implement theo đúng spec.
Bắt đầu từ task P0, hoàn thành rồi chuyển sang P1.
Sau mỗi task, chạy test để đảm bảo không lỗi.
```

**Thời gian ước tính:** {{ESTIMATED_TIME_AI}}

---

### Lựa Chọn 3: Thuê Developer

Gửi file `spec.md` cho developer hoặc agency:

1. **Upload spec.md** lên Google Drive/Dropbox
2. **Gửi link** cho developer kèm message:
   > "Đây là spec chi tiết cho dự án. Vui lòng báo giá và timeline."
3. **So sánh báo giá** từ 2-3 developer

**Nơi tìm developer:**
- Upwork.com (quốc tế)
- Freelancer.vn (Việt Nam)
- TopDev.vn (Việt Nam)

**Giá tham khảo:** {{ESTIMATED_COST}}

---

## Các File Quan Trọng

| File | Mục đích | Ai cần đọc |
|------|----------|------------|
| `spec.md` | Mô tả chi tiết dự án | Developer, AI Agent |
| `task_breakdown.json` | Danh sách việc cần làm | Developer, PM |
| `intake.json` | Yêu cầu gốc của bạn | Tham khảo |

---

## Câu Hỏi Thường Gặp

**Q: Tôi không hiểu spec.md?**
A: Không sao, bạn không cần hiểu hết. Chỉ cần gửi cho developer hoặc AI agent.

**Q: Làm sao biết developer làm đúng?**
A: So sánh kết quả với phần "MVP Features" trong spec.md.

**Q: Có thể thay đổi yêu cầu không?**
A: Có, nhưng nên hoàn thành MVP trước rồi mới thêm tính năng.

**Q: Cần hỗ trợ thêm?**
A: Chạy lại `npx aat vibe` với mô tả mới, hoặc liên hệ developer.

---

## Thông Tin Kỹ Thuật (Cho Developer)

- **Run ID:** {{RUN_ID}}
- **Spec Location:** `artifacts/runs/{{RUN_ID}}/40_spec/spec.md`
- **Tasks Location:** `artifacts/runs/{{RUN_ID}}/40_spec/task_breakdown.json`
- **Tech Stack đề xuất:** {{TECH_STACK}}

---

*Tạo bởi AI Agent Toolkit | {{TIMESTAMP}}*
