// ドット先生 v2 Web — 语音合成模块
// Web Speech API（浏览器内置日语语音）
// 优化：更大音量、更清晰发音

const TTS = {
  speaking: false,
  rate: 0.75,    // 更慢 = 更清晰（默认 0.85 → 0.75）
  pitch: 1.05,   // 微调音高，更自然（默认 1.1 → 1.05）
  volume: 1.0,   // 最大音量
};

/**
 * 朗读日语文本
 * @param {string} text - 要朗读的日语文本
 * @returns {Promise<void>}
 */
async function speakText(text) {
  if (TTS.speaking) {
    speechSynthesis.cancel();
    TTS.speaking = false;
    await new Promise(r => setTimeout(r, 100)); // 更长等待确保取消完成
  }

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
    utter.volume = TTS.volume;  // 最大音量

    // 尝试找日语声音（优先选择高质量声音）
    const voices = speechSynthesis.getVoices();
    // 优先选 Microsoft 或 Google 的日语声音（通常更清晰）
    let jaVoice = voices.find(v => v.lang === 'ja-JP' && (v.name.includes('Google') || v.name.includes('Microsoft')));
    if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja') && v.localService);
    if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja'));
    if (jaVoice) utter.voice = jaVoice;

    utter.onend = () => { TTS.speaking = false; resolve(); };
    utter.onerror = (e) => { TTS.speaking = false; reject(e); };

    speechSynthesis.speak(utter);
  });
}
