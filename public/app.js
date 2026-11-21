/**
 * ESP32 BLE Tour Guide & Editorial Showcase Client App
 * Phong cách Editorial Di Sản (Chuẩn giao diện 2Guide Hỏa Lò)
 */

let currentBeacons = [];
const mainAudioPlayer = document.getElementById('mainAudioPlayer');
const voiceAudioPlayer = document.getElementById('voiceAudioPlayer');
let eventSource = null;
let lastRenderedVoiceTime = 0;
let lastRenderedBeaconTime = 0;
let latencyTimerInterval = null;

// Hình ảnh minh họa chuẩn phong cách triển lãm di sản (nền sepia/monochrome nghệ thuật)
const ARTIFACT_IMAGES = {
  '001': 'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=700&q=80', // Trống Đồng / Cổ vật kim loại
  '002': 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=700&q=80', // Cây Bàng / Cây cổ thụ
  '003': 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=700&q=80', // Chuông đồng / Tháp chuông
  '004': 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=700&q=80'  // Bảo kiếm / Cổ vật hoàng gia
};

const ARTIFACT_BADGES = {
  '001': 'P0 • BẢO VẬT QUỐC GIA',
  '002': 'P0 • HIỆN VẬT LỊCH SỬ',
  '003': 'P1 • DI SẢN CỐ ĐÔ',
  '004': 'P0 • CỔ VẬT HOÀNG GIA'
};

document.addEventListener('DOMContentLoaded', () => {
  initServerInfo();
  loadBeacons();
  connectSSE();
  initVoiceForm();

  // Polling đồng bộ kép 1 giây / lần
  setInterval(syncServerState, 1000);
});

// 1. Khởi tạo IP LAN
async function initServerInfo() {
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    const primaryIp = data.primary_ip || window.location.hostname;
    const port = data.port || window.location.port;

    document.getElementById('navLanIp').innerText = `${primaryIp}:${port}`;
    document.getElementById('chipDeviceId').innerText = `ESP32 • HL-18`;

    document.getElementById('btnToggleLan').onclick = () => {
      const url = `http://${primaryIp}:${port}/api/ble-scan`;
      navigator.clipboard.writeText(url).then(() => {
        alert(`✓ Đã sao chép API Endpoint cho ESP32:\n${url}`);
      });
    };
  } catch (err) {}
}

// 2. Tải danh sách Beacons và Render thẻ
async function loadBeacons() {
  try {
    const res = await fetch('/api/beacons');
    const data = await res.json();
    currentBeacons = data.beacons || [];
    renderCards(currentBeacons);
  } catch (err) {
    console.error('Lỗi tải beacons:', err);
  }
}

function renderCards(beacons) {
  const grid = document.getElementById('exhibitGrid');
  grid.innerHTML = '';

  document.getElementById('exhibitCounter').innerText = `${beacons.length} hiện vật đang hoạt động`;

  beacons.forEach(b => {
    const card = document.createElement('article');
    card.className = 'exhibit-card';
    card.id = `card_${b.code}`;
    card.setAttribute('data-code', b.code);

    const badgeText = ARTIFACT_BADGES[b.code] || `P0 • HIỆN VẬT ${b.code}`;
    const imgUrl = ARTIFACT_IMAGES[b.code] || 'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=700&q=80';

    card.innerHTML = `
      <div class="card-media-wrap">
        <img src="${imgUrl}" alt="${b.artifact_name}" class="card-image" loading="lazy">
        <span class="card-badge-pill">${badgeText}</span>
        <span class="card-beacon-code">MÃ ${b.code}</span>
      </div>
      <div class="card-body">
        <h3 class="card-artifact-title">${b.artifact_name}</h3>
        <div class="card-location">📍 ${b.location || 'Khu trưng bày di tích'} • MAC: ${b.mac}</div>
        <div class="card-dialogue-box">
          <b style="color: var(--accent-terra);">${b.dialogue?.speaker || 'Thuyết Minh'}:</b><br>
          "${b.dialogue?.text || ''}"
        </div>
        <div class="card-actions-row">
          <button class="btn-card-trigger" onclick="triggerCode('${b.code}')">
            ⚡ Nhận Tín Hiệu (Mã ${b.code})
          </button>
          <button class="btn-card-edit" onclick="openEditModal('${b.code}')" title="Sửa mã hoặc kịch bản">
            ✏ Sửa Mã
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// 3. Tìm kiếm hiện vật
function handleSearch(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderCards(currentBeacons);
    return;
  }
  const filtered = currentBeacons.filter(b => 
    b.artifact_name.toLowerCase().includes(q) ||
    b.code.toLowerCase().includes(q) ||
    (b.location && b.location.toLowerCase().includes(q)) ||
    (b.dialogue?.text && b.dialogue.text.toLowerCase().includes(q))
  );
  renderCards(filtered);
}

// 4. Kết nối Realtime SSE
function connectSSE() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/api/events');

  eventSource.addEventListener('VOICE_PROCESSING', (e) => {
    try {
      const data = JSON.parse(e.data);
      handleVoiceProcessingStart(data);
    } catch (err) {}
  });

  eventSource.addEventListener('BEACON_TRIGGERED', (e) => {
    try {
      const data = JSON.parse(e.data);
      handleBeaconTrigger(data);
    } catch (err) {}
  });

  eventSource.addEventListener('VOICE_RESPONSE', (e) => {
    try {
      const data = JSON.parse(e.data);
      handleVoiceResponse(data);
    } catch (err) {}
  });

  eventSource.addEventListener('VOICE_CHUNK_READY', (e) => {
    try {
      const data = JSON.parse(e.data);
      handleVoiceChunkReady(data);
    } catch (err) {}
  });

  eventSource.addEventListener('BEACONS_UPDATED', (e) => {
    try {
      const data = JSON.parse(e.data);
      currentBeacons = data.beacons;
      renderCards(currentBeacons);
    } catch (err) {}
  });

  eventSource.addEventListener('LANGUAGE_CHANGED', (e) => {
    try {
      const data = JSON.parse(e.data);
      const sel = document.getElementById('languageLockSelect');
      if (sel && data.locked_language && sel.value !== data.locked_language) {
        sel.value = data.locked_language;
      }
    } catch (err) {}
  });
}

// 5. Đồng bộ kép Polling /api/state mỗi giây
async function syncServerState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const state = await res.json();

    if (state.isVoiceProcessing) {
      handleVoiceProcessingStart({ question: state.voiceProcessingQuestion });
    }

    if (state.latestVoice && state.latestVoice.timestamp > lastRenderedVoiceTime) {
      lastRenderedVoiceTime = state.latestVoice.timestamp;
      handleVoiceResponse(state.latestVoice);
    }

    if (state.latestBeacon && state.latestBeacon.timestamp > lastRenderedBeaconTime) {
      lastRenderedBeaconTime = state.latestBeacon.timestamp;
      handleBeaconTrigger(state.latestBeacon);
    }
  } catch (e) {}
}

function handleVoiceProcessingStart(data) {
  if (latencyTimerInterval) clearInterval(latencyTimerInterval);
  const startTime = Date.now();
  const numElem = document.getElementById('latencyMs');
  const evalElem = document.getElementById('latencyEval');

  evalElem.innerText = '⏳ Đang đo thời gian... (Đang gọi KiemThu AI)';
  evalElem.style.background = '#F7EDE8';
  evalElem.style.color = '#8D3B1B';

  latencyTimerInterval = setInterval(() => {
    numElem.innerText = Date.now() - startTime;
  }, 40);
}

function handleBeaconTrigger(data) {
  const code = data.code;
  document.querySelectorAll('.exhibit-card').forEach(c => c.classList.remove('active'));

  const targetCard = document.getElementById(`card_${code}`);
  if (targetCard) {
    targetCard.classList.add('active');
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const audioUrl = data.audio?.wav_url || data.audio?.url;
  if (audioUrl) {
    mainAudioPlayer.src = audioUrl;
    mainAudioPlayer.play().catch(e => console.log('Autoplay audio notice:', e));
  }
}

async function triggerCode(code) {
  try {
    const res = await fetch('/api/ble-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, device_id: 'LOCAL_DASHBOARD' })
    });
    const data = await res.json();
    handleBeaconTrigger(data);
  } catch (err) {
    alert('Lỗi kích hoạt: ' + err.message);
  }
}

// 6. Xử lý Voice Query & Đo Độ Trễ
function initVoiceForm() {
  const langSelect = document.getElementById('languageLockSelect');
  if (langSelect) {
    fetch('/api/language').then(r => r.json()).then(d => {
      if (d && d.locked_language) langSelect.value = d.locked_language;
    }).catch(() => {});

    langSelect.onchange = async () => {
      try {
        await fetch('/api/language', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: langSelect.value })
        });
      } catch (e) {}
    };
  }

  document.getElementById('btnSendVoiceQuestion').onclick = async () => {
    const code = document.getElementById('voiceCodeSelect').value;
    const question = document.getElementById('voiceQuestionInput').value.trim();
    const lockedLang = langSelect ? langSelect.value : 'vi';

    if (!question) {
      alert('Vui lòng nhập câu hỏi!');
      return;
    }

    const btn = document.getElementById('btnSendVoiceQuestion');
    btn.innerText = '⏳ Đang hỏi AI...';
    btn.disabled = true;

    const tEnd = Date.now();
    handleVoiceProcessingStart({ question });

    try {
      const res = await fetch('/api/hub/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Language': lockedLang
        },
        body: JSON.stringify({
          device_id: 'LOCAL_DASHBOARD',
          code: code,
          language: lockedLang,
          voice_text: question,
          end_speech_time: tEnd
        })
      });
      const data = await res.json();
      handleVoiceResponse(data);
    } catch (err) {
      alert('Lỗi gửi câu hỏi: ' + err.message);
    } finally {
      btn.innerText = '💬 Gửi Text';
      btn.disabled = false;
    }
  };

  // NÚT BẤM NÓI THU ÂM VÀ GỬI FILE .WAV (CHUẨN PCM 16KHZ MONO NHƯ ESP32)
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  const btnMic = document.getElementById('btnRecordMicWav');
  const btnPick = document.getElementById('btnPickWavFile');
  const fileInput = document.getElementById('wavFileInput');

  if (btnPick && fileInput) {
    btnPick.onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      fileInput.value = '';
      await uploadWavFileToServer(file, file.type || 'audio/wav');
    };
  }

  if (btnMic) {
    btnMic.onclick = async () => {
      if (!isRecording) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('Trình duyệt chặn Microphone trên HTTP không bảo mật. Hãy mở qua http://localhost:5000 hoặc https:// (Pinggy), hoặc dùng nút "📁 Chọn File .WAV".');
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioChunks = [];
          mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
          mediaRecorder.onstop = async () => {
            const rawMime = mediaRecorder.mimeType || 'audio/webm';
            const rawBlob = new Blob(audioChunks, { type: rawMime });
            stream.getTracks().forEach(t => t.stop());
            try {
              const wavBlob = await convertBlobToPcm16kWav(rawBlob);
              await uploadWavFileToServer(wavBlob, 'audio/wav');
            } catch (convErr) {
              console.warn('Chuyển PCM WAV fallback sang raw:', convErr);
              await uploadWavFileToServer(rawBlob, rawMime);
            }
          };
          mediaRecorder.start();
          isRecording = true;
          btnMic.innerText = '⏹ Bấm Để Dừng & Gửi .WAV!';
          btnMic.style.background = '#DC2626';
        } catch (err) {
          alert('Không thể mở Microphone: ' + err.message);
        }
      } else {
        mediaRecorder.stop();
        isRecording = false;
        btnMic.innerText = '🎙️ Bấm Nói (Gửi File .WAV)';
        btnMic.style.background = '#991B1B';
      }
    };
  }
}

async function convertBlobToPcm16kWav(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arrayBuf = await blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    const srcData = audioBuf.getChannelData(0);
    const srcRate = audioBuf.sampleRate;
    const dstRate = 16000;
    const ratio = srcRate / dstRate;
    const dstLen = Math.max(1, Math.floor(srcData.length / ratio));
    const samples = new Int16Array(dstLen);
    for (let i = 0; i < dstLen; i++) {
      const idx = Math.min(srcData.length - 1, Math.floor(i * ratio));
      const s = Math.max(-1, Math.min(1, srcData[idx]));
      samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const wavBuf = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(wavBuf);
    const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, dstRate, true);
    view.setUint32(28, dstRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) view.setInt16(offset, samples[i], true);
    return new Blob([wavBuf], { type: 'audio/wav' });
  } finally {
    ctx.close().catch(() => {});
  }
}

async function uploadWavFileToServer(blob, contentType = 'audio/wav') {
  const code = document.getElementById('voiceCodeSelect').value;
  const langSelect = document.getElementById('languageLockSelect');
  const lockedLang = langSelect ? langSelect.value : 'vi';
  const tEnd = Date.now();
  handleVoiceProcessingStart({ question: 'Đang chuyển file .WAV lên Whisper STT...' });

  try {
    const res = await fetch(`/api/hub/ask?code=${encodeURIComponent(code)}&lang=${encodeURIComponent(lockedLang)}`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType || 'audio/wav',
        'X-Artifact-Code': code,
        'X-Language': lockedLang,
        'X-Device-Id': 'BROWSER_MIC_DASHBOARD',
        'X-End-Speech-Time': tEnd.toString()
      },
      body: blob
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    handleVoiceResponse(data);
  } catch (err) {
    if (latencyTimerInterval) { clearInterval(latencyTimerInterval); latencyTimerInterval = null; }
    alert('Lỗi gửi file .WAV: ' + err.message);
  }
}

let currentVoiceChunks = [];
let currentVoiceChunkIndex = 0;

function handleVoiceResponse(data) {
  if (latencyTimerInterval) {
    clearInterval(latencyTimerInterval);
    latencyTimerInterval = null;
  }

  const ms = data.latency_measurement?.time_to_first_sound_ms || 0;
  document.getElementById('latencyMs').innerText = ms;

  const evalElem = document.getElementById('latencyEval');
  if (ms < 1000) {
    evalElem.innerText = `⚡ TIẾNG ĐẦU TIÊN VỀ TAI NGHE: ${ms}ms (< 1s - Siêu Tốc!)`;
    evalElem.style.background = '#EBFDF2';
    evalElem.style.color = '#15803D';
  } else {
    evalElem.innerText = `✓ Đã nhận tín hiệu (${ms}ms)`;
    evalElem.style.background = '#F7EDE8';
    evalElem.style.color = '#8D3B1B';
  }

  const bd = data.latency_measurement?.breakdown || {};
  document.getElementById('bdUpload').innerText = `${bd.upload_and_stt_ms || 0} ms`;
  document.getElementById('bdAi').innerText = `${bd.ai_thinking_ms || 0} ms`;
  document.getElementById('bdTts').innerText = `${bd.first_chunk_wav_ms || bd.tts_wav_synthesis_ms || 0} ms (Đoạn 1)`;

  const replyBox = document.getElementById('voiceReplyBox');
  replyBox.style.display = 'block';
  document.getElementById('erbSource').innerText = `🧠 ${data.ai_source || 'KiemThu AI'}`;
  document.getElementById('erbTimeTag').innerText = `⚡ ${ms} ms (< 1s)`;
  const qPrompt = data.transcribed_question ? `🗣️ Câu hỏi nhận dạng từ file .WAV: "${data.transcribed_question}"\n\n` : '';
  document.getElementById('voiceReplyText').innerText = qPrompt + data.reply_text;

  // Danh sách các chunks âm thanh
  currentVoiceChunks = data.chunks && data.chunks.length > 0 
    ? data.chunks 
    : [{ index: 1, text: data.spoken_audio_text || data.reply_text, status: 'ready', wav_url: data.audio_wav_url }];
  currentVoiceChunkIndex = 0;

  renderChunkProgressUI(currentVoiceChunks);

  if (data.audio_wav_url) {
    playVoiceChunk(0);
  }
}

function renderChunkProgressUI(chunks) {
  let container = document.getElementById('voiceChunksContainer');
  if (!container) {
    const parent = document.querySelector('.erb-audio-row');
    if (parent) {
      container = document.createElement('div');
      container.id = 'voiceChunksContainer';
      container.className = 'chunks-timeline-wrap';
      parent.parentNode.insertBefore(container, parent);
    }
  }
  if (!container) return;

  container.innerHTML = `
    <div style="font-size: 11px; font-weight: 800; color: var(--accent-terra); text-transform: uppercase; margin-bottom: 8px;">
      ⚡ TIẾN TRÌNH ÂM THANH ĐẨY DẦN LÊN TAI NGHE (<1s):
    </div>
    <div class="chunks-badges-row" style="display: flex; gap: 8px; flex-wrap: wrap;">
      ${chunks.map((c, i) => {
        const isReady = c.status === 'ready';
        const isPlaying = i === currentVoiceChunkIndex;
        const bg = isPlaying ? '#15803D' : (isReady ? '#EBFDF2' : '#FFFBEB');
        const color = isPlaying ? '#FFFFFF' : (isReady ? '#15803D' : '#B45309');
        const border = isPlaying ? '#15803D' : (isReady ? '#86EFAC' : '#FDE68A');
        const label = isPlaying ? '▶ Đang phát' : (isReady ? '✓ Sẵn sàng' : '⏳ Đang đẩy lên...');
        return `
          <div style="background: ${bg}; color: ${color}; border: 1px solid ${border}; border-radius: 9999px; padding: 4px 12px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
            <span>Đoạn ${c.index}: ${label}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function playVoiceChunk(index) {
  if (index >= currentVoiceChunks.length) {
    renderChunkProgressUI(currentVoiceChunks);
    return;
  }
  currentVoiceChunkIndex = index;
  const chunk = currentVoiceChunks[index];
  renderChunkProgressUI(currentVoiceChunks);

  voiceAudioPlayer.src = chunk.wav_url;
  voiceAudioPlayer.play().catch(e => console.log('Autoplay block:', e));

  voiceAudioPlayer.onended = () => {
    const nextIdx = index + 1;
    if (nextIdx < currentVoiceChunks.length) {
      if (currentVoiceChunks[nextIdx].status === 'ready') {
        playVoiceChunk(nextIdx);
      } else {
        console.log(`⏳ Đang chờ Chunk ${nextIdx + 1} nạp xong...`);
      }
    } else {
      currentVoiceChunkIndex = -1;
      renderChunkProgressUI(currentVoiceChunks);
    }
  };
}

function handleVoiceChunkReady(chunkData) {
  const existing = currentVoiceChunks.find(c => c.index === chunkData.chunk_index);
  if (existing) {
    existing.status = 'ready';
    existing.wav_url = chunkData.wav_url;
  } else {
    currentVoiceChunks.push({
      index: chunkData.chunk_index,
      text: chunkData.text,
      status: 'ready',
      wav_url: chunkData.wav_url
    });
  }
  renderChunkProgressUI(currentVoiceChunks);

  // Nếu audio vừa phát xong và đang dừng ở chunk trước, tự động phát tiếp chunk mới này!
  if (voiceAudioPlayer.paused && currentVoiceChunkIndex === chunkData.chunk_index - 2) {
    playVoiceChunk(chunkData.chunk_index - 1);
  }
}

// 7. Modal Sửa Mã
function openEditModal(code) {
  const item = currentBeacons.find(b => b.code === code);
  if (!item) return;

  document.getElementById('editTargetId').value = item.id;
  document.getElementById('editCode').value = item.code;
  document.getElementById('editMac').value = item.mac;
  document.getElementById('editName').value = item.artifact_name;
  document.getElementById('editSpeaker').value = item.dialogue?.speaker || 'Thuyết Minh';
  document.getElementById('editText').value = item.dialogue?.text || '';

  document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
}

document.getElementById('editForm').onsubmit = async (e) => {
  e.preventDefault();
  const body = {
    id: document.getElementById('editTargetId').value,
    new_code: document.getElementById('editCode').value.trim(),
    mac: document.getElementById('editMac').value.trim(),
    artifact_name: document.getElementById('editName').value.trim(),
    speaker: document.getElementById('editSpeaker').value.trim(),
    text: document.getElementById('editText').value.trim()
  };

  try {
    const res = await fetch('/api/beacons/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      closeEditModal();
      await loadBeacons();
    }
  } catch (err) {
    alert('Lỗi cập nhật: ' + err.message);
  }
};
