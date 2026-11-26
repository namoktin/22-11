# Thư Mục Tự Nạp Tri Thức AI (Plug-and-Play Auto-Brain)

Bạn chỉ cần **thả bất kỳ file tài liệu nào** vào thư mục này (`kiemthu/data/custom/`) — **không cần sửa code, không cần đặt tên cố định, không cần khởi động lại server**!

## Định dạng file hỗ trợ tự động đọc
1. **Văn bản thuyết minh dài (`.txt`, `.md`)**:
   - Có thể là cả một tài liệu dài nhiều trang về toàn bộ Di tích hoặc bất kỳ bảo tàng/hiện vật mới nào.
   - Dùng tiêu đề Markdown (`# Tên di tích`, `## Khu vực A`, `### Hiện vật B`) để AI tự cắt thành từng thẻ tri thức `350–550` ký tự chính xác nhất.
2. **Đoạn hội thoại mẫu (`.txt`, `.md`)**:
   - Viết dạng `Khách: ...` / `HDV: ...` (hoặc `Hỏi: ...` / `Đáp: ...`, `Q: ...` / `A: ...`) → AI tự bóc thành từng cặp Hỏi–Đáp.
3. **JSON / JSONL / CSV (`.json`, `.jsonl`, `.csv`)**:
   - Hỗ trợ cả mảng Q&A (`question`/`answer`), ChatML (`messages`), hồ sơ phân khu (`atomic_fact_cards`), chuyện nhỏ (`stories`), giải mã lầm tưởng (`myth_busters`), hoặc bảng CSV (`question,answer`).

## Cơ chế tự động cập nhật nóng (Auto-Reload)
- Khi bạn thêm, sửa hoặc xóa file trong thư mục này, hệ thống tự động phát hiện thay đổi trong vòng vài giây (tối đa 12 giây trên Linux VM), lập lại chỉ mục vector ngữ nghĩa và xóa cache âm thanh cũ ngay lập tức.
- Kiểm tra số lượng tri thức đã nạp tại `GET /api/health` → trường `kb_stats.customDocs` & `kb_stats.customFiles`.
- Hoặc gọi chủ động qua Admin API: `POST /api/admin/kb/reload` hoặc `POST /api/admin/kb/ingest-text`.
