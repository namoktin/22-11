# 🏛️ ESP32 BLE Beacon Tour Guide & Dialogue Server

Hệ thống máy chủ điều hướng và cấp phát kịch bản hội thoại tự động cho vi điều khiển **ESP32** dựa trên công nghệ định vị cự ly gần **Bluetooth Low Energy (BLE / iBeacon)**.

---

## 🌟 Kiến Trúc Hoạt Động Của Hệ Thống

```
 [Các Thẻ BLE / iBeacon]
 (Gắn tại các Hiện Vật / Gian Phòng)
         ))) Sóng BLE (((
                |
                v
  +---------------------------+
  |    Vi Điều Khiển ESP32    |
  |  - Quét sóng BLE Beacons  |
  |  - Chọn Beacon gần nhất   |
  +-------------+-------------+
                |
                | (1) HTTP POST JSON { beacon_mac, rssi }
                v
  +---------------------------+
  |  MÁY CHỦ SERVER (Node.js) |
  |  - Đối soát CSDL Beacon   |
  |  - Lọc ngưỡng RSSI cự ly  |
  |  - Chống spam / Cooldown  |
  |  - Cấp kịch bản hội thoại |
  +-------------+-------------+
                |
                | (2) Trả về JSON { status, dialogue, audio_url }
                v
  +---------------------------+
  |    Vi Điều Khiển ESP32    |
  |  - In lời thoại ra Serial |
  |  - Stream âm thanh MP3    |
  +-------------+-------------+
                |
                v I2S Digital Audio
  +---------------------------+
  | Module DAC I2S PCM5102A   |
  +-------------+-------------+
                | Analog Audio
                v
  +---------------------------+
  | Mạch Amply MAX97220 & Loa |
  +---------------------------+
```

---

## 🚀 Khởi Động Nhanh Server (1 Click)

1. **Khởi chạy Server**:
   - Double-click vào file `start.bat` trong thư mục `esp32-ble-server`, hoặc mở Terminal chạy:
     ```bash
     cd esp32-ble-server
     node server.js
     ```
2. **Mở Web Dashboard**:
   - Truy cập: `http://localhost:5000`
   - Giao diện Web hiển thị ngay địa chỉ IP LAN máy tính của bạn (ví dụ: `http://192.168.1.15:5000/api/ble-scan`).
   - Có sẵn nút **"📋 Copy API"** để bạn copy dán vào code ESP32.

---

## 📡 Chi Tiết API Trao Đổi Với ESP32

### 1. API Gửi Tín Hiệu Quét BLE (Từ ESP32 lên Server)
- **Phương thức**: `POST`
- **Đường dẫn**: `http://<IP_LAN>:5000/api/ble-scan` (hoặc `/api/beacon-trigger`)
- **Headers**: `Content-Type: application/json`
- **Body gửi lên**:
  ```json
  {
    "device_id": "ESP32_GUIDE_01",
    "beacon_mac": "AA:BB:CC:DD:EE:01",
    "rssi": -65
  }
  ```

### 2. Payload Server Trả Xuống Cho ESP32
Khi tín hiệu hợp lệ và vượt ngưỡng cự ly, Server sẽ trả về mã `200 OK`:
```json
{
  "status": "success",
  "action": "PLAY_AUDIO",
  "device_id": "ESP32_GUIDE_01",
  "beacon_id": "beacon_01",
  "beacon_mac": "AA:BB:CC:DD:EE:01",
  "artifact_name": "Trống Đồng Đông Sơn",
  "location": "Khu Trưng Bày Thời Đại Kim Khí - Gian Số 1",
  "dialogue": {
    "speaker": "Thuyết Minh Viên Lịch Sử",
    "text": "Chào mừng quý khách đến với khu vực Trống đồng Đông Sơn. Đây là bảo vật quốc gia kiệt xuất...",
    "short_cue": "Trống đồng Đông Sơn - Thời đại các Vua Hùng dựng nước.",
    "emotion": "Trang nghiêm, tự hào",
    "action_hint": "Quý khách vui lòng quan sát kỹ các họa tiết khắc chìm trên tang trống."
  },
  "audio": {
    "filename": "trong_dong_dong_son.mp3",
    "url": "http://192.168.1.15:5000/audio/trong_dong_dong_son.mp3",
    "type": "audio/mpeg"
  },
  "cooldown_seconds": 40
}
```

Nếu thiết bị đang trong thời gian Cooldown (tránh lặp lại câu thoại khi người dùng đứng yên một chỗ):
```json
{
  "status": "cooldown",
  "action": "NONE",
  "reason": "COOLDOWN_ACTIVE",
  "remaining_seconds": 25,
  "message": "Hiện vật đang phát hoặc vừa phát xong."
}
```

---

## 🛠️ Hướng Dẫn Cài Đặt Cho ESP32 (Arduino IDE)

### 1. Cài đặt thư viện cần thiết:
Vào **Sketch** -> **Include Library** -> **Manage Libraries...** và cài đặt 2 thư viện:
1. `ESP32-audioI2S` (Tác giả: *schreibfaul1 / Wolle*).
2. `ArduinoJson` (Tác giả: *Benoit Blanchon*).

### 2. Sơ đồ nối dây phần cứng:
| Chân ESP32 | Chân Module DAC PCM5102A | Chân Mạch Amply MAX97220 | Ghi chú |
| :--- | :--- | :--- | :--- |
| **GPIO 26** | **BCK** (Bit Clock) | - | Xung nhịp bit I2S |
| **GPIO 25** | **LCK** (Word Select) | - | Chọn kênh Trái/Phải |
| **GPIO 22** | **DIN** (Data In) | - | Dữ liệu âm thanh I2S |
| **GPIO 21** | - | **SHDN / EN** | Kích hoạt mở âm thanh |
| **VIN (5V/3.3V)** | **VCC** | **VDD** | Nguồn nuôi mạch |
| **GND** | **GND / SCK / FMT** | **GND** | Nối chung Mass (SCK nối GND để DAC tự tạo PLL) |
| - | **L-OUT** | **INL** | Ngõ vào kênh Trái của MAX97220 |
| - | **R-OUT** | **INR** | Ngõ vào kênh Phải của MAX97220 |

### 3. Nạp Code:
1. Mở file: `esp32_firmware/esp32_ble_dialogue.ino`
2. Điền tên Wi-Fi và Mật khẩu:
   ```cpp
   const char* WIFI_SSID     = "TEN_WIFI_CUA_BAN";
   const char* WIFI_PASSWORD = "MAT_KHAU_WIFI";
   const char* SERVER_URL    = "http://192.168.1.15:5000/api/ble-scan"; // Thay bằng IP của Server
   ```
3. Nạp code vào ESP32 và mở **Serial Monitor (Baudrate 115200)**.

---

## 📂 Cấu Trúc Dự Án

```
esp32-ble-server/
├── audio/                   # Nơi chứa các file MP3 thuyết minh tiếng Việt chuẩn hóa
│   ├── trong_dong_dong_son.mp3
│   ├── cay_bang_hoa_lo.mp3
│   ├── dai_hong_chung.mp3
│   ├── bao_kiem_hoang_gia.mp3
│   └── sample.mp3
├── data/
│   └── beacons.json         # Cơ sở dữ liệu Beacon, cự ly và kịch bản hội thoại
├── esp32_firmware/
│   └── esp32_ble_dialogue.ino # Mã nguồn hoàn chỉnh cho ESP32 nạp bằng Arduino IDE
├── public/                  # Giao diện Web Dashboard thời gian thực
│   ├── index.html           # Bảng điều khiển & Trình giả lập ESP32 Simulator
│   ├── style.css            # Giao diện Glassmorphism di sản văn hóa
│   └── app.js               # Logic điều khiển, realtime log polling
├── scripts/
│   └── generate_audio.py    # Tool tự động sinh audio thuyết minh từ văn bản tiếng Việt
├── package.json
├── server.js                # Máy chủ Node.js REST API & Audio Streaming Server
├── start.bat                # Phím tắt 1-click khởi chạy hệ thống
└── README.md
```
