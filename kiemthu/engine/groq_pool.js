/**
 * =========================================================================================
 * ⚡ SHARED GROQ MODEL POOL & ADAPTIVE RATE-LIMIT GUARD (24,000 TPM / 3,000 RPD)
 * Dùng chung giữa server.js (Translator / Beacon) & smart_ai_server.js (RAG Reasoning)
 * để tránh gọi đè lên model đang dính HTTP 429 hoặc sắp cạn TPM.
 * =========================================================================================
 */

const GROQ_MODELS_REASONING = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b'
];

const GROQ_MODELS_LIGHT = [
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b'
];

function parseResetDurationMs(raw) {
  if (!raw) return 0;
  const s = String(raw).trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(s)) {
    return Math.ceil(parseFloat(s) * 1000);
  }
  let totalMs = 0;
  const minMatch = s.match(/(\d+(?:\.\d+)?)m(?!s)/);
  const secMatch = s.match(/(\d+(?:\.\d+)?)s/);
  const msMatch = s.match(/(\d+(?:\.\d+)?)ms/);
  if (minMatch) totalMs += parseFloat(minMatch[1]) * 60000;
  if (secMatch) totalMs += parseFloat(secMatch[1]) * 1000;
  if (msMatch) totalMs += parseFloat(msMatch[1]);
  return Math.ceil(totalMs);
}

class GroqModelPool {
  constructor() {
    this.states = new Map(); // model -> { hardCooldownUntil, softBusyUntil, remainingTokens, resetAt, consecutive429 }
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  getState(model) {
    if (!this.states.has(model)) {
      this.states.set(model, {
        hardCooldownUntil: 0,
        softBusyUntil: 0,
        remainingTokens: null,
        resetAt: 0,
        consecutive429: 0
      });
    }
    const st = this.states.get(model);
    if (st.resetAt && Date.now() >= st.resetAt) {
      st.remainingTokens = null;
      st.softBusyUntil = 0;
      st.resetAt = 0;
    }
    return st;
  }

  cleanup() {
    const now = Date.now();
    for (const st of this.states.values()) {
      if (st.hardCooldownUntil && now >= st.hardCooldownUntil) {
        st.hardCooldownUntil = 0;
        st.consecutive429 = 0;
      }
      if (st.resetAt && now >= st.resetAt) {
        st.remainingTokens = null;
        st.softBusyUntil = 0;
        st.resetAt = 0;
      }
    }
  }

  areAllCoolingDown(models = GROQ_MODELS_REASONING) {
    const now = Date.now();
    return models.every(m => now < this.getState(m).hardCooldownUntil);
  }

  pickAvailableModels(preferredOrder = GROQ_MODELS_REASONING, minHeadroomTokens = 850) {
    const now = Date.now();
    const fresh = [];
    const softBusy = [];

    for (let i = 0; i < preferredOrder.length; i++) {
      const model = preferredOrder[i];
      const st = this.getState(model);
      if (now < st.hardCooldownUntil) continue;
      if (now < st.softBusyUntil || (st.remainingTokens !== null && st.remainingTokens < minHeadroomTokens)) {
        softBusy.push({ model, idx: i, rem: st.remainingTokens ?? 0 });
      } else {
        fresh.push({ model, idx: i, rem: st.remainingTokens ?? 8000 });
      }
    }

    // Nếu model ưu tiên đầu chỉ còn ít token (< 2000) trong khi model khác còn dồi dào (> 4500),
    // chủ động xoay tua sớm để tránh chạm trần 429 trên một model duy nhất!
    fresh.sort((a, b) => {
      const aLow = a.rem < 2000 ? 1 : 0;
      const bLow = b.rem < 2000 ? 1 : 0;
      if (aLow !== bLow) return aLow - bLow;
      return a.idx - b.idx;
    });

    softBusy.sort((a, b) => b.rem - a.rem);
    return [...fresh.map(x => x.model), ...softBusy.map(x => x.model)];
  }

  updateFromResponse(model, res) {
    const now = Date.now();
    const st = this.getState(model);
    const remTokRaw = res.headers.get('x-ratelimit-remaining-tokens');
    const remTok = remTokRaw !== null ? parseInt(remTokRaw, 10) : null;
    const resetTokMs = parseResetDurationMs(res.headers.get('x-ratelimit-reset-tokens'));
    const retryAfterSec = parseInt(res.headers.get('retry-after') || '0', 10);
    const retryAfterMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 0;

    if (Number.isFinite(remTok)) {
      st.remainingTokens = remTok;
    }
    if (resetTokMs > 0) {
      st.resetAt = now + resetTokMs;
    }

    if (res.status === 429) {
      st.consecutive429 = Math.min((st.consecutive429 || 0) + 1, 5);
      const baseWait = Math.max(retryAfterMs, resetTokMs, 6000);
      const waitMs = Math.min(Math.max(baseWait, 5000), 60000);
      st.hardCooldownUntil = now + waitMs;
      st.remainingTokens = 0;
      return { isRateLimited: true, waitMs };
    }

    if (res.ok) {
      st.consecutive429 = 0;
      st.hardCooldownUntil = 0;
      if (Number.isFinite(remTok) && remTok < 900) {
        st.softBusyUntil = now + Math.min(Math.max(resetTokMs || 4000, 2500), 15000);
      }
    }
    return { isRateLimited: false, waitMs: 0 };
  }

  async callGroqChat({
    apiKey,
    messages,
    mode = 'reasoning',
    preferredModels = null,
    temperature = 0.7,
    top_p = 0.92,
    max_tokens = 240,
    presence_penalty = 0.2,
    frequency_penalty = 0.15,
    timeoutMs = 3800,
    minHeadroomTokens = 750,
    onAttempt = null,
    onRateLimit = null,
    onUsage = null
  }) {
    if (!apiKey) return null;
    const baseOrder = preferredModels || (mode === 'light' ? GROQ_MODELS_LIGHT : GROQ_MODELS_REASONING);
    const candidates = this.pickAvailableModels(baseOrder, minHeadroomTokens);
    if (candidates.length === 0) {
      return null;
    }

    for (const model of candidates) {
      let timer = null;
      try {
        if (typeof onAttempt === 'function') onAttempt(model);
        const controller = new AbortController();
        timer = setTimeout(() => controller.abort(), timeoutMs);

        const isGptOss = model.startsWith('openai/gpt-oss');
        const bodyObj = { model, messages, temperature, top_p };
        if (isGptOss) {
          bodyObj.reasoning_effort = 'low';
          bodyObj.max_completion_tokens = Math.max(320, max_tokens + 120);
        } else {
          bodyObj.max_tokens = max_tokens;
          if (typeof presence_penalty === 'number') bodyObj.presence_penalty = presence_penalty;
          if (typeof frequency_penalty === 'number') bodyObj.frequency_penalty = frequency_penalty;
        }

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          },
          body: JSON.stringify(bodyObj),
          signal: controller.signal
        });
        clearTimeout(timer);
        timer = null;

        const rlInfo = this.updateFromResponse(model, res);
        if (rlInfo.isRateLimited) {
          if (typeof onRateLimit === 'function') onRateLimit(model, rlInfo.waitMs);
          console.warn(`⚡ [Groq Failover] ${model} chạm trần 429 (nghỉ ${Math.round(rlInfo.waitMs / 1000)}s) -> chuyển model kế tiếp...`);
          continue;
        }

        if (res.ok) {
          const data = await res.json();
          const rawContent = data.choices?.[0]?.message?.content || '';
          const content = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          if (data.usage && typeof onUsage === 'function') {
            onUsage(data.usage, model);
          }
          if (content) {
            return { content, model, usage: data.usage || null };
          }
        }
      } catch (e) {
        if (timer) clearTimeout(timer);
        if (e.name === 'AbortError') {
          console.warn(`⚡ [Groq Engine:${model}] Timeout sau ${timeoutMs}ms, chuyển model kế tiếp...`);
        } else {
          console.warn(`[Groq Engine:${model}] Lỗi gọi API:`, e.message);
        }
      }
    }
    return null;
  }
}

module.exports = {
  groqPool: new GroqModelPool(),
  GroqModelPool,
  GROQ_MODELS_REASONING,
  GROQ_MODELS_LIGHT,
  parseResetDurationMs
};
