// ドット先生 v2 Web — 语音合成模块
// 桌面端 + 移动端统一使用 Web Speech API（浏览器内置语音）
// 语速、音高、语音选择策略两端保持一致

const TTS = {
  speaking: false,
  rate: 0.75,
  pitch: 1.05,
  volume: 1.0,
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
    await new Promise(r => setTimeout(r, 100));
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
    utter.volume = TTS.volume;

    // 语音选择策略：优先 Microsoft / Google（声音最清晰）
    const voices = speechSynthesis.getVoices();
    let jaVoice = voices.find(v => v.lang === 'ja-JP' && (v.name.includes('Google') || v.name.includes('Microsoft')));
    if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja') && v.localService);
    if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja'));

    if (jaVoice) utter.voice = jaVoice;

    utter.onend = () => { TTS.speaking = false; resolve(); };
    utter.onerror = (e) => { TTS.speaking = false; reject(e); };

    speechSynthesis.speak(utter);
  });
}
