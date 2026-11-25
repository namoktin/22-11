# Bộ Dữ Liệu Chuẩn Fine-Tuning AI Hướng Dẫn Viên Hỏa Lò (ChatML JSONL)

Thư mục này chứa bộ dữ liệu đã được **gộp sạch, khử trùng lặp và chuẩn hóa** từ toàn bộ nguồn tri thức xác thực của dự án, sẵn sàng dùng ngay cho **LoRA / QLoRA / Unsloth / HuggingFace TRL / OpenAI / Groq Fine-Tuning**.

## Thống kê bộ dữ liệu
- **Tổng số mẫu sạch duy nhất**: `2049` hội thoại
- **Tập huấn luyện (`train.jsonl`)**: `1844` mẫu (~90%)
- **Tập đánh giá (`val.jsonl`)**: `205` mẫu (~10%)
- **Định dạng chuẩn**: JSON Lines (`.jsonl`), mỗi dòng có cấu trúc:
  ```json
  {"messages":[{"role":"system","content":"..."},{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}
  ```

## Nguồn dữ liệu đã gộp
- `500_cau_hoi_chuan_lich_su.json`: **500** mẫu
- `2.csv`: **500** mẫu
- `1000_cau_hoi_hoa_lo.json`: **1000** mẫu
- `verified_service_knowledge.json`: **16** mẫu
- `beacons.json`: **4** mẫu
- `expanded_heritage_knowledge.json`: **22** mẫu
- `docent_95_gold_oos`: **7** mẫu

## Cách tái tạo lại bộ dữ liệu khi cập nhật tri thức mới
```bash
node scripts/export_finetune_dataset.js
```

## Lưu ý về dữ liệu thô bổ sung
Ngoài bộ `.jsonl` sạch này, toàn bộ dữ liệu gốc & bộ đề kiểm thử mở rộng (gồm cả bộ **10.000 câu hỏi Hỏa Lò** JSON/CSV/XLSX và **3 bộ đề test 1.000 câu**) đều được đồng bộ đầy đủ tại `kiemthu/data/`.
