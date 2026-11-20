"""
Module sinh file WAV 16kHz Mono từ Text siêu tốc cho ESP32 Voice Assistant
"""
import sys
import os
import asyncio
import time
import subprocess
import edge_tts

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(CURRENT_DIR)
AUDIO_DIR = os.path.join(PROJECT_DIR, 'audio')

VOICE = "vi-VN-HoaiMyNeural"

async def text_to_wav(text: str, output_wav: str):
    temp_mp3 = output_wav + ".tmp.mp3"
    try:
        t0 = time.time()
        # 1. Sinh MP3 từ edge-tts
        communicate = edge_tts.Communicate(text, VOICE)
        await communicate.save(temp_mp3)
        t_tts = time.time() - t0

        # 2. Dùng ffmpeg convert tức thì sang PCM 16-bit 16kHz Mono WAV
        cmd = [
            "ffmpeg", "-y", "-i", temp_mp3,
            "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
            output_wav
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        if os.path.exists(temp_mp3):
            os.remove(temp_mp3)

        return True
    except Exception as e:
        print(f"Error in TTS: {e}", file=sys.stderr)
        return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python voice_tts_fast.py <text> <output_filename>")
        sys.exit(1)

    input_text = sys.argv[1]
    out_filename = sys.argv[2]
    out_path = os.path.join(AUDIO_DIR, out_filename)

    success = asyncio.run(text_to_wav(input_text, out_path))
    if success:
        print(f"OK:{out_filename}")
        sys.exit(0)
    else:
        sys.exit(1)
