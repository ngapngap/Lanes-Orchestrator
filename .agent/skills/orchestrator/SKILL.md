# Skill: Multi-Agent Orchestrator (Lanes Framework)

## Mô tả
Skill này biến Antigravity thành một **Manager** điều phối nhiều "Slave Agents" (như Claude Code) làm việc song song nhưng độc lập thông qua mô hình **Lanes**.

## Khung vận hành (The Lanes Philosophy)

Để tối ưu hóa tốc độ và tránh xung đột, Antigravity phải tuân thủ 4 nguyên tắc sau:

### 1. Phân làn (Lane Partitioning)
Chia dự án thành tối đa 4 luồng làm việc độc lập tùy theo quy mô và gán quyền sở hữu file rõ ràng (P1):
- **UI Lane**: Chuyên trách Frontend, Components, CSS (`/ui`, `/components`, `/public/assets`).
- **API Lane**: Chuyên trách Backend, Endpoints, Auth (`/api`, `/server`, `/functions`).
- **Data Lane**: Chuyên trách DB Schema, Config, Environment (`/db`, `/config`, `/.env.example`, `/scripts/migrations`).
- **QA Lane**: Chuyên trách Testing, Bug Reproducing, Docs (`/tests`, `/docs`, `/playwright`).

**Bản đồ quyền sở hữu (Lane Ownership Map - P1, bắt buộc)**
- UI Lane sở hữu toàn bộ code UI và style. Không Lane khác tự ý sửa component/layout.
- API Lane sở hữu toàn bộ handler/backend. Không Lane khác tự ý đổi contract API.
- Data Lane sở hữu schema, seed, config, secrets template. File dùng chung như `shared/types.ts` hoặc `config/shared.ts` mặc định thuộc Data Lane trừ khi tái phân công bằng văn bản. Lane khác chỉ được đề xuất thay đổi qua handoff/PR.
- QA Lane sở hữu test, fixture, repro script, doc QA. Lane khác không tự ý chỉnh test trừ khi đã được giao.
- Mọi file dùng chung phải có **một** Lane chủ quản duy nhất; mọi thay đổi từ Lane khác phải thông qua handoff và được chủ quản phê duyệt.

### 2. Cách ly môi trường (Environment Isolation - P1)
- Mỗi Lane chạy trong một PTY session riêng biệt với ID tương ứng (`--id [lane_name]`).
- Khuyến nghị tách workspace: ưu tiên **git worktree** cho từng Lane với convention `lanes/<lane_name>` (ví dụ: `git worktree add lanes/ui main`, `git worktree add lanes/api main`). Nếu không dùng worktree, tạo thư mục copy riêng `lanes/ui`, `lanes/api`, `lanes/data`, `lanes/qa` và chỉ commit/PR từ workspace của Lane đó.
- Không chia sẻ cùng một working tree cho nhiều Lane. Cấm sửa file của Lane khác trong workspace của mình; mọi thay đổi liên-Lane phải qua handoff.

### 3. Giao thức Trạng thái (Status Protocol)
Theo dõi "nhịp tim" của từng Lane thông qua `watcher.js [id] events`. Hệ thống tự động ghi nhận `HEARTBEAT` mỗi phút. Các trạng thái chuẩn cần in ra log để Manager theo dõi:
- `STATUS: running` - Đang thực hiện tác vụ hoặc sửa file.
- `STATUS: waiting` - Đang chờ người dùng xác nhận (PTY Bridge sẽ tự trả lời nếu có `--auto-yes`).
- `STATUS: blocked` - Gặp lỗi kỹ thuật, xung đột file hoặc sự cố logic cần can thiệp.
- `STATUS: done` - Hoàn tất tác vụ, sẵn sàng bàn giao (handoff).

**Lưu ý về Logging:**
- Log được tách thành 3 kênh: `*_output.log` (tổng hợp), `*_raw.log` (transcript có timestamp), và `*_events.log` (chỉ chứa status/events).
- Sử dụng `node watcher.js [id] events` để xem dòng trạng thái sạch sẽ.

### 4. Cổng hợp nhất (Integration Gate - P1)
- Thứ tự hợp nhất: UI/API/Data hoàn tất và bàn giao; QA verify trên phiên bản tổng hợp; Antigravity phê duyệt cuối trước khi chốt task.
- Gói bàn giao bắt buộc (handoff bundle - P1) từ mỗi Lane phải bao gồm:
  1. **Summary** ngắn gọn phạm vi và mục tiêu thay đổi.
  2. **Danh sách file đã đổi** (đường dẫn và Lane chủ quản từng file; nếu chạm file Lane khác, phải nêu rõ lý do và đã xin phép).
  3. **Diff/Patch**: đính kèm patch hoặc trích dẫn `git diff`/`git show` đủ để áp dụng; tối thiểu có `--stat` và phần patch chính.
  4. **Lệnh đã chạy**: build/test/lint/migration (ghi rõ pass/fail, log tóm tắt).
  5. **Rủi ro và follow-up**: ảnh hưởng backward compatibility, migration pending, nợ test, cấu hình cần cập nhật.
- QA Lane chỉ verify sau khi bundle hợp lệ; Antigravity chỉ phê duyệt khi đã có bundle và xác nhận của QA (nếu liên quan).

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
