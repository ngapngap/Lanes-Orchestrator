day la pipline hoàn chỉnh cho 1 vòng đời dự án bao gồm các skill
1. hỏi dap voi user de hieu ro noi dung https://github.com/bmad-code-org/BMAD-METHOD ( khong can lam chi tiet nhu bmad)
2. research noi dung: tim cac repo mau tren GitHub truoc, tranh mat thoi gian trien khai 
3. spec-kit-creator ( da lam) : tao spec kit chuan tu 1 va 2
4. orchestrator: dieu phoi agent thuc hien
5. thiet ke UI-UX: thiet ke ui ux neu can thiet https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
6. qa-gate / verifier
• Agent làm: chạy test/lint/build/typecheck, tạo report chuẩn
• Output: verification/report.json, verification/tests.md
Optional (thêm sau nếu thấy thiếu)

7. repo-bootstrap: tạo skeleton repo/CI/conventions nhanh
8. packager/delivery: release notes, deploy checklist, migration notes

2) Bộ agent chuẩn (ai làm gì, dùng skill nào)

Mình khuyên 1 “Manager” + các “Specialist” cố định:

A) Manager Agent (đầu não)

• Nhiệm vụ: điều phối pipeline, quyết định gọi skill nào, checkpoint/go-no-go
• Dùng skill: orchestrator (để chạy lanes), đọc output từ intake/spec/research
• Quy tắc: không làm research sâu, không viết spec chi tiết, chỉ tổng hợp/ra quyết định
B) Intake Agent

• Dùng skill: intake
• Output: intake chuẩn để tránh spec đoán mò
C) Research Agent

• Dùng skill: research
• Output: shortlist/patterns để spec-kit “copy/modify” thay vì nghĩ từ đầu
D) Spec Agent

• Dùng skill: spec-kit
• Output: task_breakdown.json là “hợp đồng” cho orchestrator
E) UI/UX Agent (conditional)

• Dùng skill: ui-ux
• Trigger: user yêu cầu UI/UX hoặc spec có UI complexity cao
F) Lane Agents (chạy song song)

• UI Lane Agent → dùng orchestrator (spawn PTY) + tuân design/ + spec/
• API Lane Agent → orchestrator
• Data Lane Agent → orchestrator
• QA Lane Agent → orchestrator + có thể gọi qa-gate ở cuối
G) Verifier Agent

• Dùng skill: qa-gate
• Chỉ làm verify + report, không sửa feature (tránh bias)

3) Quy trình chuẩn (để tự động hóa được)

1. Intake Agent chạy → tạo intake.md
2. Research Agent chạy → tạo research/shortlist.json + patterns.md
3. Spec Agent chạy → tạo spec/task_breakdown.json + acceptance criteria
4. (Nếu cần) UI/UX Agent chạy → tạo design/handoff.md
5. Manager gọi orchestrator → spawn 2–4 lane agents theo task_breakdown.json
6. Mỗi lane xuất handoff bundle (summary + patch + changed_files + notes)
7. Verifier (qa-gate) chạy → report pass/fail
8. Manager quyết định: merge/retry/rollback + gửi kết quả cho user

4) “Rule of thumb” để biết gọi skill nào

• User mới đưa ý tưởng mơ hồ → intake
• User đưa yêu cầu nhưng chưa rõ làm thế nào nhanh → research
• Đã chốt hướng làm → spec-kit
• Có UI phức tạp/đòi đẹp/đòi prototype → ui-ux
• Bắt đầu triển khai song song → orchestrator
• Trước khi bàn giao/merge → qa-gate
• Trước khi ship → packager (optional)