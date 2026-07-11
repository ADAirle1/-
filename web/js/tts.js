// ドット先生 v2 Web — 语音合成模块
// 桌面端 + 移动端均使用 Web Speech API（浏览器内置语音）
// 移动端通过降低语速 + 优选高质量语音来减少电子感

const _isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

const TTS = {
  speaking: false,
  // 桌面端保持默认语速；移动端降低语速减少电子感
  rate: _isMobile ? 0.45 : 0.75,
  // 移动端稍低音高更自然
  pitch: _isMobile ? 0.95 : 1.05,
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

    // 语音选择策略
    const voices = speechSynthesis.getVoices();
    let jaVoice = null;

    if (_isMobile) {
      // 移动端：优先厂商内置语音（非 Google），音质通常更自然
      jaVoice = voices.find(v => v.lang === 'ja-JP' && v.localService && !v.name.includes('Google'));
      // 其次网络语音（云端合成质量高）
      if (!jaVoice) jaVoice = voices.find(v => v.lang === 'ja-JP' && !v.localService);
      // 再次 iOS 高质量语音
      if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja') && (v.name.includes('Kyoko') || v.name.includes('O-ren')));
      // 兜底
      if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja'));
    } else {
      // 桌面端：优先 Microsoft / Google（声音最清晰）
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
