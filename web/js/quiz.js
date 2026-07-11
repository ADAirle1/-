// ドット先生 Terminal — 测验数据生成
// 渲染由 app.js 中的 CRT 风格函数负责

const QUIZ = {
  active: false,
  questions: [],
  currentIdx: 0,
  score: 0,
  answered: false,
  totalQuestions: 10,
};

function generateQuestions(count = 10) {
  const questions = [];
  const pool = [...KANA_DATA];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const selected = pool.slice(0, count);
  for (const correctKana of selected) {
    const wrongPool = KANA_DATA.filter(k => k.romaji !== correctKana.romaji);
    const wrongs = [];
    const usedIdx = new Set();
    while (wrongs.length < 3) {
      const idx = Math.floor(Math.random() * wrongPool.length);
      if (!usedIdx.has(idx)) { usedIdx.add(idx); wrongs.push(wrongPool[idx]); }
    }
    const options = [correctKana, ...wrongs];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    questions.push({
      correct: correctKana,
      options: options,
      correctIdx: options.findIndex(o => o.romaji === correctKana.romaji),
    });
  }
  return questions;
}
