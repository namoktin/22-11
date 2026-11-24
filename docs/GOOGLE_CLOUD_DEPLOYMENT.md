# 🚀 HƯỚNG DẪN TRIỂN KHAI SMART MUSEUM GUIDE LÊN GOOGLE CLOUD PLATFORM (GCP)

Dự án **Smart Museum Guide** gồm Backend Node.js, Engine AI RAG In-Process, Audio Streaming và kết nối phần cứng ESP32. Trên Google Cloud, có **2 phương án chuẩn nhất**:

---

## 🧭 SO SÁNH 2 PHƯƠNG ÁN

| Tiêu chí | Phương Án 1: Compute Engine (VM Linux) ⭐ **Khuyên Dùng** | Phương Án 2: Google Cloud Run (Serverless) |
|---|---|---|
| **Độ phù hợp IoT ESP32** | **Cực cao** (Có IP tĩnh công khai cố định, kết nối trực tiếp, độ trễ thấp) | Khá (Cần ESP32 hỗ trợ HTTPS TLS đầy đủ) |
| **Lưu trữ dữ liệu** | **Vĩnh viễn trên ổ cứng SSD** (file âm thanh .wav, lịch sử auto-learning không bao giờ mất) | Tạm thời (Ephemeral container RAM/Disk) |
| **Quản trị tiến trình** | Chạy 24/7 bằng **PM2** (tự khởi động lại nếu crash/reboot) | Serverless (tự co giãn container theo request) |
| **Vùng máy chủ (Region)** | Chọn **Singapore (`asia-southeast1`)** $\rightarrow$ Độ trễ về VN chỉ **15 - 30ms** | Chọn Singapore (`asia-southeast1`) |
| **Chi phí** | Miễn phí Free Tier (e2-micro) hoặc ~\$7 - \$12/tháng (e2-small) | Miễn phí 2 triệu request/tháng đầu tiên |

---

## 📌 PHƯƠNG ÁN 1: TRIỂN KHAI LÊN GOOGLE COMPUTE ENGINE (VM)
*(Dễ nhất, ổn định nhất cho phần cứng ESP32 và hoạt động giống 100% như trên máy local)*

### BƯỚC 1: TẠO MÁY ẢO LINUX TRÊN GOOGLE CLOUD CONSOLE
1. Đăng nhập vào [Google Cloud Console](https://console.cloud.google.com/).
2. Vào menu góc trái $\rightarrow$ **Compute Engine** $\rightarrow$ **VM instances**.
3. Nhấn **Create Instance** (Tạo phiên bản máy ảo):
   * **Name**: `smart-museum-server`
   * **Region**: `asia-southeast1 (Singapore)` *(bắt buộc để ping về Việt Nam nhanh nhất)*
   * **Machine configuration**:
     * Series: `E2`
     * Machine type: `e2-small` (2 vCPU, 2 GB RAM) hoặc `e2-micro` (Free Tier)
   * **Boot disk**:
     * Nhấn **Change** $\rightarrow$ Chọn OS: **Ubuntu**, Version: **Ubuntu 22.04 LTS**, Size: **20 GB SSD** $\rightarrow$ Nhấn **Select**.
   * **Firewall** (Tường lửa):
     * ✅ Tích chọn **Allow HTTP traffic**
     * ✅ Tích chọn **Allow HTTPS traffic**
4. Nhấn **Create** và chờ 30 giây để máy ảo khởi động.

---

### BƯỚC 2: MỞ CỔNG TƯỜNG LỬA (PORT 5000 & 80/443)
1. Trong GCP Console, tìm kiếm ô trên cùng: **VPC network** $\rightarrow$ chọn **Firewall**.
2. Nhấn **Create Firewall Rule**:
   * **Name**: `allow-smart-museum-ports`
   * **Targets**: `All instances in the network`
   * **Source IPv4 ranges**: `0.0.0.0/0`
   * **Protocols and ports**:
     * Tích chọn **TCP** và điền: `5000, 80, 443`
3. Nhấn **Create**.

---

### BƯỚC 3: GÁN ĐỊA CHỈ IP TĨNH (STATIC EXTERNAL IP)
*(Để IP server không bị đổi khi khởi động lại, ESP32 không bị mất kết nối)*
1. Vào **VPC network** $\rightarrow$ **IP addresses**.
2. Tìm dòng IP của máy ảo vừa tạo $\rightarrow$ Nhấn vào dấu 3 chấm $\rightarrow$ Chọn **Promote to static IP address** $\rightarrow$ Đặt tên: `museum-static-ip` $\rightarrow$ Nhấn **Reserve**.
3. Ghi lại địa chỉ **External IP** này (Ví dụ: `34.143.xxx.xxx`).

---

### BƯỚC 4: KẾT NỐI SSH VÀO MÁY ẢO
1. Quay lại trang **VM instances**, tại dòng máy ảo `smart-museum-server`, nhấn nút **SSH**.
2. Một cửa sổ dòng lệnh màu đen của máy ảo Ubuntu sẽ hiện ra ngay trên trình duyệt.

---

### BƯỚC 5: CÀI ĐẶT MÔI TRƯỜNG TỰ ĐỘNG BẰNG 1 LỆNH
Dán lệnh sau vào cửa sổ SSH và nhấn Enter:

```bash
# 1. Cập nhật hệ điều hành & cài đặt công cụ cần thiết
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git build-essential ffmpeg

# 2. Cài đặt Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Cài đặt PM2 (Quản lý tiến trình chạy 24/7 vĩnh viễn)
sudo npm install -g pm2

# 4. Kiểm tra phiên bản
node -v && npm -v && pm2 -v
```

---

### BƯỚC 6: ĐƯA DỰ ÁN LÊN MÁY ẢO
Bạn có thể clone từ GitHub của bạn hoặc tải trực tiếp thư mục `esp32-ble-server`:

```bash
# Clone dự án (hoặc tải thư mục lên qua nút "Upload file" ở góc phải cửa sổ SSH)
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git /home/$USER/smart-museum
cd /home/$USER/smart-museum/esp32-ble-server

# Cài đặt thư viện dependencies
npm install --production
```

---

### BƯỚC 7: TẠO FILE CẤU HÌNH `.env`
Tạo file `.env` trên máy ảo:

```bash
nano .env
```
Dán cấu hình sau vào:

```env
PORT=5000
NODE_ENV=production
KIEMTHU_IN_PROCESS=true
TRUST_PROXY=true
GROQ_API_KEY=gsk_your_groq_api_key_here
ADMIN_API_KEY=admin_secret_key_museum_2026
REQUIRE_DEVICE_AUTH=false
```
*(Bấm `Ctrl + O` $\rightarrow$ `Enter` để lưu, `Ctrl + X` để thoát).*

---

### BƯỚC 8: CHẠY SERVER BẰNG PM2 (HOẠT ĐỘNG 24/7)

```bash
# Chạy server với PM2
pm2 start server.js --name "smart-museum"

# Lưu trạng thái để tự khởi động lại khi máy ảo reboot
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER

# Kiểm tra log server
pm2 logs smart-museum --lines 50
```

Bây giờ bạn có thể mở trình duyệt trên máy tính và gõ:
`http://[IP_MÁY_ẢO_CỦA_BẠN]:5000`
Giao diện **Nhà Tù Hỏa Lò - Bản Đồ Di Tích** sẽ xuất hiện ngay lập tức!

---

### BƯỚC 9: CẬP NHẬT FIRMWARE ESP32
Mở file `esp32_firmware/esp32_ble_dialogue.ino` trên máy tính của bạn và cập nhật:

```c
// Đổi từ localhost/IP mạng LAN sang IP tĩnh của Google Cloud:
#define SERVER_BASE "http://34.143.xxx.xxx:5000"
```
Nạp lại code cho ESP32 $\rightarrow$ ESP32 sẽ gửi tín hiệu BLE và nhận diện giọng nói trực tiếp lên Google Cloud!

---

## ☁️ PHƯƠNG ÁN 2: TRIỂN KHAI LÊN GOOGLE CLOUD RUN (DOCKER)
*(Dành cho ai muốn có ngay đường link HTTPS chính thức miễn phí của Google)*

### BƯỚC 1: CÀI ĐẶT GOOGLE CLOUD SDK (GCLOUD CLI) TRÊN MÁY TÍNH
1. Tải và cài đặt [Google Cloud CLI cho Windows](https://cloud.google.com/sdk/docs/install).
2. Mở PowerShell và đăng nhập:
```powershell
gcloud auth login
gcloud config set project [ID_PROJECT_CỦA_BẠN]
```

### BƯỚC 2: BUILD VÀ DEPLOY TRỰC TIẾP LÊN CLOUD RUN
Tại thư mục `c:\Users\Nam\Desktop\tp\esp32-ble-server`:

```powershell
gcloud run deploy esp32-museum-guide `
  --source . `
  --region asia-southeast1 `
  --platform managed `
  --allow-unauthenticated `
  --memory 2Gi `
  --cpu 2 `
  --timeout 300 `
  --set-env-vars "NODE_ENV=production,KIEMTHU_IN_PROCESS=true,TRUST_PROXY=true,PORT=8080,GROQ_API_KEY=your_key_here,ADMIN_API_KEY=your_admin_key"
```

Google Cloud sẽ tự động:
1. Đọc file `Dockerfile` đã được cấu hình sẵn trong dự án.
2. Build container image bằng Cloud Build.
3. Cấp một tên miền HTTPS chính chủ của Google:
   `https://esp32-museum-guide-xxxx-as.a.run.app`

Điền URL HTTPS này vào firmware ESP32 và trình duyệt là chạy hoàn tất!
