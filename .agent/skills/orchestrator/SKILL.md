# Skill: Multi-Agent Orchestrator (Lanes Framework)

## Mô tả
Skill này biến Antigravity thành một **Manager** điều phối nhiều "Slave Agents" (như Claude Code) làm việc song song nhưng độc lập thông qua mô hình **Lanes**.

## Khung vận hành (The Lanes Philosophy)

Để tối ưu hóa tốc độ và tránh xung đột, Antigravity phải tuân thủ 4 nguyên tắc sau:

### 1. Phân làn (Lane Partitioning)
Chia dự án thành tối đa 4 luồng làm việc độc lập tùy theo quy mô:
- **UI Lane**: Chuyên trách Frontend, Components, CSS (`/ui`, `/components`).
- **API Lane**: Chuyên trách Backend, Endpoints, Auth (`/api`, `/server`).
- **Data Lane**: Chuyên trách DB Schema, Config, Environment (`/db`, `/config`).
- **QA Lane**: Chuyên trách Testing, Bug Reproducing, Docs (`/tests`).

### 2. Cách ly môi trường (Environment Isolation)
- Mỗi Lane chạy trong một PTY session riêng biệt với ID tương ứng (`--id [lane_name]`).
- Mỗi Lane nên hoạt động trên một thư mục làm việc riêng hoặc thư mục con riêng biệt để tránh ghi đè file của nhau.

### 3. Giao thức Trạng thái (Status Protocol)
Theo dõi "nhịp tim" của từng Lane thông qua `watcher.js [id]`. Các trạng thái chuẩn cần kiểm tra trong log:
- `STATUS: running` - Đang sửa file cụ thể.
- `STATUS: waiting` - Đang chờ người dùng xác nhận.
- `STATUS: blocked` - Gặp lỗi kỹ thuật hoặc sự cố logic.
- `STATUS: done` - Hoàn tất, tóm tắt các thay đổi.

### 4. Cổng hợp nhất (Integration Gate)
Mọi thay đổi từ các Lane phải được hợp nhất theo thứ tự:
1. UI/API/Data hoàn tất và bàn giao (Summary).
2. QA Lane thực hiện verify trên phiên bản tổng hợp.
3. Antigravity phê duyệt cuối trước khi chốt task.

## Lệnh thực thi

```powershell
# Khởi tạo một Lane (ví dụ: UI Lane)
node ".agent\skills\orchestrator\scripts\run-agent.js" --id ui_lane

# Giám sát real-time (Người dùng chạy)
node ".agent\skills\orchestrator\scripts\watcher.js" ui_lane
```

## Quy tắc Điều phối cho Antigravity
1. **Chỉ chia Lane khi cần**: Project nhỏ thì làm tuần tự. Chỉ bung Lanes khi có các mảng độc lập (UI + Backend + Test).
2. **Quản lý Quyền sở hữu file**: Chỉ định rõ Lane nào được quyền sửa file nào. File dùng chung (như shared types) phải giao cho 1 Lane chủ quản.
3. **Phản hồi tự động**: Bridge tự động nhấn "Yes" (1/Enter) cho các xác nhận tạo file, cài npm của Claude Code để Lane không bị treo.
