# Orchestrator Skill

Skill này cung cấp khả năng chạy các agent trong một PTY (Pseudo-Terminal) độc lập, hỗ trợ tự động hóa phản hồi và giám sát log thời gian thực.

## Cách chạy

Sử dụng `run-agent.js` để khởi chạy một agent:

```bash
node .agent/skills/orchestrator/scripts/run-agent.js --id <lane_id> --cwd <working_directory> [--auto-yes] [--debug-input]
```

### Tham số:
- `--id`: (Bắt buộc) Định danh cho lane (vd: `ui_lane`, `api_lane`, `data_lane`, `qa_lane`). Phải khớp với regex `^[a-z0-9_-]{1,32}$`.
- `--cwd`: (Bắt buộc) Thư mục làm việc của agent.
- `--auto-yes`: Tự động trả lời "Yes" cho các prompt phổ biến.
- `--debug-input`: Log các dữ liệu đầu vào từ stdin (đã được ẩn thông tin nhạy cảm).

## Giám sát Log

Sử dụng `watcher.js` để xem log của agent (ưu tiên cờ `--run-id` và `--lane`):

```bash
node .agent/skills/orchestrator/scripts/watcher.js --run-id <run_id> --lane <lane_id> [--type <log_type>] [--no-clear]
```

### Ví dụ:
- Xem lane mặc định (`ui_lane`) của lần chạy mới nhất: `node .agent/skills/orchestrator/scripts/watcher.js`
- Chỉ định run và lane: `node .agent/skills/orchestrator/scripts/watcher.js --run-id 20240101_120000 --lane ui_lane`
- Xem events log: `node .agent/skills/orchestrator/scripts/watcher.js --run-id 20240101_120000 --lane ui_lane --type events`
- Không xóa màn hình: `node .agent/skills/orchestrator/scripts/watcher.js --run-id 20240101_120000 --lane ui_lane --no-clear`

## Cấu trúc Log
Logs được lưu tại: `.agent/logs/<run_id>/<lane_id>/`
- `output.log`: Output tiêu chuẩn.
- `raw.log`: Toàn bộ dữ liệu thô từ PTY.
- `events.log`: Các sự kiện hệ thống (STATUS, HEARTBEAT, ACTION).

## Quy ước ID (4 Lanes)
1. `ui_lane`: Các tác vụ liên quan đến giao diện người dùng.
2. `api_lane`: Các tác vụ liên quan đến API và Backend.
3. `data_lane`: Các tác vụ liên quan đến Database và xử lý dữ liệu.
4. `qa_lane`: Các tác vụ kiểm thử và đảm bảo chất lượng.
