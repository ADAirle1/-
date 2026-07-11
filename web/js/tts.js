// ドット先生 v2 Web — 语音合成模块
// Web Speech API（浏览器内置日语语音）
// 优化：更大音量、更清晰发音

// 平台检测：移动端语音引擎对 rate 参数的解释与桌面端不同
// 相同 rate 值在移动端（Android/iOS）朗读速度明显快于桌面端
// 因此移动端使用更低的 rate 值 + 更低音高，消除电子音、接近真人语速
const _isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

const TTS = {
  speaking: false,
  // 桌面端保持默认语速；移动端大幅降低语速，减少电子感，接近真人朗读节奏
  rate: _isMobile ? 0.38 : 0.75,
  // 移动端微降音高可进一步减少合成感（桌面保持 1.05）
  pitch: _isMobile ? 0.95 : 1.05,
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

    // 语音选择策略（桌面端与移动端不同）
    const voices = speechSynthesis.getVoices();
    let jaVoice = null;

    if (_isMobile) {
      // 移动端：Google TTS 本地语音电子音重，优先选择非 Google 的高质量语音
      // 1) 优先选非 Google 的 ja-JP 本地语音（如厂商内置语音，通常更自然）
      jaVoice = voices.find(v => v.lang === 'ja-JP' && v.localService && !v.name.includes('Google'));
      // 2) 其次选网络语音（localService: false），通常质量更高
      if (!jaVoice) jaVoice = voices.find(v => v.lang === 'ja-JP' && !v.localService);
      // 3) 再次选 iOS 设备的高质量语音（Kyoko 等）
      if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja') && (v.name.includes('Kyoko') || v.name.includes('O-ren')));
      // 4) 兜底：任意日语语音
      if (!jaVoice) jaVoice = voices.find(v => v.lang.startsWith('ja'));
    } else {
      // 桌面端：优先选 Microsoft 或 Google 的日语声音（通常更清晰）
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
