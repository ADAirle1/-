// ドット先生 v2 Web — 语音合成模块
// 桌面端：Web Speech API（浏览器内置日语语音）
// 移动端：Google Translate TTS（真人语音质量，远超 Web Speech API）

const _isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

const TTS = {
  speaking: false,
  // 桌面端 Web Speech API 参数（移动端走 Google TTS，不走这些参数）
  rate: 0.75,
  pitch: 1.05,
  volume: 1.0,
};

// ── 移动端：Google Translate TTS ──────────────────
// 非官方接口，返回高质量 MP3 音频，真人感远超 Web Speech API
// 单次请求最长约 200 字符，超长文本自动分句播放

const GTTS_MAX_CHUNK = 180; // 略低于上限，留余量

/**
 * 用 Google Translate TTS 朗读文本（移动端专用）
 * 支持长文本自动分块顺序播放
 * @param {string} text - 日语文本
 * @returns {Promise<void>}
 */
async function speakTextGoogle(text) {
  if (!text) return;

  // 按句号、换行或逗号拆分，确保每块不超过 GTTS_MAX_CHUNK
  const chunks = splitTextForTTS(text, GTTS_MAX_CHUNK);

  for (const chunk of chunks) {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q='
      + encodeURIComponent(chunk);

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      if (blob.size < 500) throw new Error('Response too small, likely empty audio');

      const audioUrl = URL.createObjectURL(blob);
      await playAudioBlob(audioUrl);
      URL.revokeObjectURL(audioUrl);
    } catch (e) {
      console.warn('Google TTS 获取失败，回退到 Web Speech API:', e.message);
      // 失败时回退到浏览器内置语音
      await speakTextWebSpeech(chunk);
    }
  }
}

/**
 * 将文本按语义边界拆分，每块不超过 maxLen 字符
 */
function splitTextForTTS(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const result = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      result.push(remaining);
      break;
    }

    // 在 maxLen 范围内寻找最佳切割点
    let cutAt = maxLen;
    // 优先找句号（日语/中文句号）
    const period = remaining.lastIndexOf('。', maxLen);
    // 其次找逗号
    const comma = remaining.lastIndexOf('、', maxLen);
    // 再次找空格
    const space = remaining.lastIndexOf(' ', maxLen);

    if (period > maxLen * 0.5) cutAt = period + 1;
    else if (comma > maxLen * 0.5) cutAt = comma + 1;
    else if (space > maxLen * 0.5) cutAt = space + 1;

    result.push(remaining.substring(0, cutAt).trim());
    remaining = remaining.substring(cutAt).trim();
  }

  return result.filter(c => c.length > 0);
}

/**
 * 播放 Blob URL 音频
 */
function playAudioBlob(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Audio playback failed'));
    audio.play().catch(reject);
  });
}

// ── 桌面端：Web Speech API ─────────────────────────

/**
 * 用浏览器内置 Web Speech API 朗读文本（桌面端专用 + 移动端回退）
 * @param {string} text - 日语文本
 * @returns {Promise<void>}
 */
async function speakTextWebSpeech(text) {
  return new Promise((resolve, reject) => {
    if (typeof speechSynthesis === 'undefined') {
      reject(new Error('Web Speech API 不可用'));
      return;
    }

    TTS.speaking = true;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    utter.rate = TTS.rate;
    utter.pitch = TTS.pitch;
    utter.volume = TTS.volume;

    // 语音选择策略
    const voices = speechSynthesis.getVoices();
    let jaVoice = null;

    if (_isMobile) {
      // 移动端回退：优先非 Google 本地语音
      jaVoice = voices.find(v => v.lang === 'ja-JP' && v.localService && !v.name.includes('Google'));
      if (!jaVoice) jaVoice = voices.find(v => v.lang === 'ja-JP' && !v.localService);
      if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja'));
    } else {
      // 桌面端：优先 Microsoft 或 Google 日语声音
      jaVoice = voices.find(v => v.lang === 'ja-JP' && (v.name.includes('Google') || v.name.includes('Microsoft')));
      if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja') && v.localService);
      if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja'));
    }

    if (jaVoice) utter.voice = jaVoice;

    utter.onend = () => { TTS.speaking = false; resolve(); };
    utter.onerror = (e) => { TTS.speaking = false; reject(e); };

    speechSynthesis.speak(utter);
  });
}

// ── 统一入口 ──────────────────────────────────────

/**
 * 朗读日语文本（自动选最优方案）
 * - 移动端：Google Translate TTS（真人语音）
 * - 桌面端：Web Speech API
 * @param {string} text - 要朗读的日语文本
 * @returns {Promise<void>}
 */
async function speakText(text) {
  if (TTS.speaking) {
    speechSynthesis.cancel();
    TTS.speaking = false;
    await new Promise(r => setTimeout(r, 100));
  }

  TTS.speaking = true;
  try {
    if (_isMobile) {
      await speakTextGoogle(text);
    } else {
      await speakTextWebSpeech(text);
    }
  } finally {
    TTS.speaking = false;
  }
}
