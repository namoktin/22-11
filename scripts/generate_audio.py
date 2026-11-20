"""
Script tổng hợp âm thanh tiếng Việt với Fallback kép:
1. Thử dùng edge-tts (giọng đọc AI tự nhiên chất lượng cao)
2. Nếu mạng chập chờn/rate limit, tự động fallback sang gTTS (Google Text-To-Speech)
3. Nếu offline hoàn toàn, tự động copy file mẫu sample.mp3
"""

import json
import os
import time
import asyncio
import shutil
import edge_tts
from gtts import gTTS

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(CURRENT_DIR)
DATA_FILE = os.path.join(PROJECT_DIR, 'data', 'beacons.json')
AUDIO_DIR = os.path.join(PROJECT_DIR, 'audio')
FALLBACK_SOURCE = os.path.join(PROJECT_DIR, '..', 'esp32-audio-server', 'audio', 'sample.mp3')

VOICE = "vi-VN-HoaiMyNeural"

async def synthesize_edge(text: str, output_path: str) -> bool:
    try:
        communicate = edge_tts.Communicate(text, VOICE)
        await communicate.save(output_path)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            return True
    except Exception as e:
        print(f"   [edge-tts notice] {e}")
    return False

def synthesize_gtts(text: str, output_path: str) -> bool:
    try:
        tts = gTTS(text=text, lang='vi', slow=False)
        tts.save(output_path)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            return True
    except Exception as e:
        print(f"   [gTTS notice] {e}")
    return False

async def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        beacons = json.load(f)

    print("==================================================")
    print("      TỔNG HỢP ÂM THANH TIẾNG VIỆT CHO ESP32       ")
    print("==================================================")

    for item in beacons:
        filename = item.get('audio_file')
        dialogue = item.get('dialogue', {})
        text = dialogue.get('text', '')
        output_path = os.path.join(AUDIO_DIR, filename)

        if os.path.exists(output_path) and os.path.getsize(output_path) > 5000:
            print(f"✓ Đã sẵn sàng: {filename} ({os.path.getsize(output_path)} bytes)")
            continue

        print(f"-> Đang xử lý: {filename} ...")
        success = False
        # Thử edge-tts với retry
        for attempt in range(2):
            if await synthesize_edge(text, output_path):
                print(f"  ✓ Sinh thành công bằng edge-tts: {filename}")
                success = True
                break
            time.sleep(1)

        # Fallback sang gTTS nếu edge-tts chưa được
        if not success:
            print(f"  ℹ Đang chuyển sang Google TTS cho {filename}...")
            if synthesize_gtts(text, output_path):
                print(f"  ✓ Sinh thành công bằng gTTS: {filename}")
                success = True

        # Fallback cuối: copy sample.mp3
        if not success:
            if os.path.exists(FALLBACK_SOURCE):
                shutil.copyfile(FALLBACK_SOURCE, output_path)
                print(f"  ⚠ Fallback: Đã copy từ sample.mp3 sang {filename}")
            else:
                print(f"  ❌ Không thể tạo file: {filename}")

        time.sleep(0.5)

    print("\n✓ Hoàn tất chuẩn bị tài nguyên âm thanh!")

if __name__ == '__main__':
    asyncio.run(main())
