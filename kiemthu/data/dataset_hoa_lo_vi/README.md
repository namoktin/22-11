# Bộ Dữ Liệu Huấn Luyện & Tri Thức Đầy Đủ AI Nhà Tù Hỏa Lò (Tiếng Việt)

Gói dữ liệu được xây dựng và chuẩn hóa toàn diện bằng **Tiếng Việt** từ kho tư liệu gốc, hệ thống Golden Facts P0, kết quả kiểm định AI `2Guide` (`Bao_cao_doi_chieu_danh_gia_AI_2Guide_Hoa_Lo.xlsx`) và trọn bộ **1.000 câu hỏi + 1.000 câu trả lời chuẩn** (`HL-001`..`HL-1000`), chia thành các file nhỏ gọn có phân loại rõ ràng để nạp trực tiếp vào RAG, Vector DB, `hoa_lo_groq_skill` hoặc Fine-tune LLM.

## Cấu Trúc 6 Thư Mục Phân Loại

1. **`01_tri_thuc_theo_phan_khu/` (`14` file JSON — `Z01`..`Z14`)**:
   - Mỗi phân khu là một file riêng gồm `Atomic Fact Cards` đã kiểm chứng, thông tin nhân vật lịch sử, tông giọng khuyến nghị theo vùng cảm xúc, danh mục hiện vật và quy tắc chống ảo giác riêng của khu đó (bao gồm xử lý triệt để 2 điểm mù `Z10` Kỷ vật và `Z13` Khu chức năng).
2. **`02_chuyen_nho_va_giai_ma_hieu_nham/` (`3` file JSON)**:
   - `golden_facts_p0.json`: Các sự kiện cốt lõi và luật chặn lỗi sử học P0.
   - `chuyen_nho_it_biet.json`: 28 mẩu chuyện nhỏ, chi tiết hậu trường ngoài biển nhãn (*áo len Đỗ Nhuận – Phạm Thị Vân – Hoàng Văn Thụ, khóa Busan, mực nước cơm – thuốc đỏ, bếp ăn giao liên...*).
   - `giai_ma_nham_lan_thuong_gap.json`: 12 cặp giải mã lầm tưởng phổ biến kèm mẫu chỉnh khéo lịch sự.
3. **`03_go_roi_tu_khoa_va_chong_loi/` (`3` file JSON)**:
   - `disambiguation_matrix.json`: Ma trận gỡ rối các cụm từ dễ kéo nhầm phân khu (*cây bàng/trà bàng, vượt ngục 1932/1945/1951, cơm tù/bếp phi công Mỹ, túi tote/kho lưu trữ...*).
   - `anti_patterns_va_guardrails.json`: 6 luật `AP-01..AP-06`, quy trình *Graceful Fallback* khi thiếu thông số vi mô và ranh giới từ chối thật sự.
   - `mau_test_ca_kho_audit.json`: Tập ca lỗi thực tế từ kiểm định `2Guide` kèm đáp án chuẩn để kiểm thử hồi quy.
4. **`04_hoi_dap_theo_phan_khu/` (`14` file JSONL — `QA_Z01`..`QA_Z14`)**:
   - Toàn bộ **1.000 cặp Hỏi–Đáp Tiếng Việt hoàn chỉnh** (`HL-001..HL-500` Bộ 1 + `HL-501..HL-1000` Bộ 2 vừa hoàn thiện đáp án chuẩn), chia nhỏ theo 14 khu tham quan.
5. **`05_hoi_dap_theo_loai_cau_hoi/` (`7` file JSONL — `QT01`..`QT07`)**:
   - Cùng 1.000 cặp Hỏi–Đáp chia chéo theo **7 nhóm mục đích câu hỏi** của du khách, kèm nhãn `question_form` (`yes_no`, `choice_ab`, `open_fact`).
6. **`06_du_lieu_huan_luyen_sft/` (`5` file JSONL ChatML)**:
   - `sft_train_nhom1_thuoc_dia_va_giam_giu_Z01_Z05.jsonl`, `sft_train_nhom2_vuot_nguc_va_chien_si_Z06_Z10.jsonl`, `sft_train_nhom3_khang_chien_my_va_bao_ton_Z11_Z14.jsonl` (tổng `900` mẫu train chia theo 3 giai đoạn/nhóm chủ đề), cùng `sft_validation.jsonl` (`100` mẫu phân tầng đều 14 khu) và `sft_adversarial_edge_cases.jsonl` (`36` ca bẫy sử học, chống từ chối sai, thiếu số đo và từ chối ngoài phạm vi).
