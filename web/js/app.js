// ドット先生 — 硬件终端控制器
// 管理 CRT 屏幕渲染、控件交互、状态

const APP = {
  currentPage: 'home',
  currentKanaIdx: 0,
  selectedRow: 'a',
  showHiragana: true,
  audioOn: true,
  popoverVisible: false,
  popoverKana: null,
  // 场景学习
  currentScenario: null,     // 当前场景对象引用
  scenarioTab: 'words',      // 'words' | 'phrases' | 'dialogue' | 'culture'
  scenarioPage: 0,           // 单词/短句分页
};

// ── DOM ──────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const D = {
  // CRT
  crt: $('#crt-content'),
  // Knob positions
  knobPositions: $$('.knob-positions span'),
  // Display switches
  swHiragana: $('#sw-hiragana'),
  swKatakana: $('#sw-katakana'),
  // Sliders
  tintSlider: $('#tint-slider'),
  scanlineSlider: $('#scanline-slider'),
  // Buttons
  btnSpeak: $('#btn-speak'),
  btnNext: $('#btn-next'),
  btnReset: $('#btn-reset'),
  // Status
  statusMsg: $('#status-msg'),
  statusScore: $('#status-score'),
  statusClock: $('#status-clock'),
  // LEDs
  ledAudio: $('#led-audio'),
  ledData: $('#led-data'),
};

// ═══════════════════════════════════════════════
// CRT 色调控制
// ═══════════════════════════════════════════════

function updateScreenTint(val) {
  const t = val / 100; // 0=amber, 1=green
  const r = Math.round(255 * (1 - t) + 0x33 * t);
  const g = Math.round(0xB0 * (1 - t) + 0xFF * t);
  const b = Math.round(0 * (1 - t) + 0x33 * t);
  const amber = `rgb(${r},${g},${b})`;

  const root = document.documentElement.style;
  root.setProperty('--crt-amber', amber);
  root.setProperty('--crt-amber-d', `rgb(${Math.round(r*0.7)},${Math.round(g*0.7)},${Math.round(b*0.7)})`);
  root.setProperty('--crt-amber-l', `rgb(${Math.round(Math.min(255,r*1.3))},${Math.round(Math.min(255,g*1.3))},${Math.round(Math.min(255,b*1.3))})`);
  root.setProperty('--crt-glow', `rgba(${r},${g},${b},0.15)`);
}

function updateScanlines(val) {
  const opacity = val / 100 * 0.12;
  const sl = $('.crt-scanlines');
  if (sl) {
    sl.style.background = `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,${opacity}) 2px, rgba(0,0,0,${opacity}) 4px)`;
  }
}

function updateBrightness(val) {
  const bright = 0.5 + (val / 100) * 0.7;
  const root = document.documentElement.style;
  root.setProperty('--crt-glow', `rgba(255,176,0,${0.08 + (val/100)*0.2})`);
  const crt = $('#crt-glass');
  if (crt) {
    crt.style.filter = `brightness(${bright})`;
  }
}

// ═══════════════════════════════════════════════
// 页面路由
// ═══════════════════════════════════════════════

function navigateTo(page, data) {
  // 关闭弹出框
  if (APP.popoverVisible) closePopover(true);

  APP.currentPage = page;
  $$('.crt-page').forEach(p => p.classList.remove('active'));
  const target = $(`#page-${page}`);
  if (target) target.classList.add('active');

  switch (page) {
    case 'home':
      renderHome();
      break;
    case 'kana-chart':    renderKanaChart(data || APP.selectedRow); break;
    case 'kana-detail':   renderKanaDetail(data); break;
    case 'quiz':          startQuiz(); break;
    case 'scenario':      renderScenarioPage(data); break;
  }

  // 更新旋钮位置
  D.knobPositions.forEach(sp => {
    sp.classList.toggle('active', sp.dataset.mode === page);
  });
}

// 渲染主页（含场景卡片网格 + 随机名言）
function renderHome() {
  // 检查主页 DOM 是否存在（可能被其他页面的 innerHTML 替换掉了）
  let homePage = $('#page-home');
  if (!homePage) {
    D.crt.innerHTML = `
      <div class="crt-page active" id="page-home">
        <pre class="crt-banner">
╔════════════════════════════════╗
║    ドット先生  DOT SENSEI     ║
║    LANGUAGE LEARNING TERM    ║
║    MODEL DS-1  v2.0  RAM 64K ║
╚════════════════════════════════╝
        </pre>
        <p class="crt-prompt">READY.</p>
        <p class="crt-hint">> シーンを 選んでください</p>
        <div id="crt-quote"></div>
        <div id="scenario-grid"></div>
        <p class="crt-hint cursor-blink" style="margin-top:12px;">■</p>
      </div>
      <div class="crt-page" id="page-kana-chart"></div>
      <div class="crt-page" id="page-kana-detail"></div>
      <div class="crt-page" id="page-quiz"></div>
      <div class="crt-page" id="page-scenario"></div>
    `;
  } else {
    // 已存在，只切换 active
    $$('.crt-page').forEach(p => p.classList.remove('active'));
    homePage.classList.add('active');
  }

  D.statusMsg.textContent = 'SYS OK';
  renderRandomQuote();
  renderScenarioList();
}

// 随机展示一句名言
function renderRandomQuote() {
  const container = $('#crt-quote');
  if (!container || typeof QUOTES === 'undefined') return;

  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  container.innerHTML = `
    <div class="crt-quote-text">「${q.jp}」</div>
    <div class="crt-quote-cn">${q.cn}</div>
    <div class="crt-quote-source">—— ${q.source}</div>
  `;
}

// ═══════════════════════════════════════════════
// 五十音图表（CRT 网格渲染）
// ═══════════════════════════════════════════════

function renderKanaChart(rowId) {
  APP.selectedRow = rowId || APP.selectedRow;
  const rowKana = getKanaByRow(APP.selectedRow);
  const rows = getAllRows();

  // 行标签
  let tabs = '';
  rows.forEach(row => {
    const cls = row.id === APP.selectedRow ? ' active' : '';
    tabs += `<button class="crt-row-tab${cls}" onclick="navigateTo('kana-chart','${row.id}')">${row.label}</button>`;
  });

  // 假名网格（点击弹出关联词提示框）
  let cells = '';
  rowKana.forEach(kana => {
    const char = APP.showHiragana ? kana.hiragana : kana.katakana;
    const idx = KANA_DATA.indexOf(kana);
    cells += `
      <div class="crt-cell" onclick="event.stopPropagation();showKanaPopover(KANA_DATA[${idx}], this)">
        <span class="cell-char">${char}</span>
        <span class="cell-roma">${kana.romaji}</span>
      </div>`;
  });
  for (let i = rowKana.length; i < 5; i++) {
    cells += '<div class="crt-cell" style="visibility:hidden;"></div>';
  }

  D.crt.innerHTML = `
    <div class="crt-page active" id="page-kana-chart">
      <p class="crt-prompt">KANA CHART > ${APP.showHiragana ? 'HIRAGANA' : 'KATAKANA'}</p>
      <div class="crt-row-tabs">${tabs}</div>
      <div class="crt-grid">${cells}</div>
    </div>
  `;

  D.statusMsg.textContent = `ROW: ${APP.selectedRow.toUpperCase()}`;
}

// ═══════════════════════════════════════════════
// 假名详情（CRT 风格）
// ═══════════════════════════════════════════════

function renderKanaDetail(idx) {
  if (typeof idx === 'number') APP.currentKanaIdx = idx;
  const kana = getKanaByIndex(APP.currentKanaIdx);
  if (!kana) { navigateTo('kana-chart'); return; }

  const total = KANA_DATA.length;
  const cur = APP.currentKanaIdx + 1;
  const char = APP.showHiragana ? kana.hiragana : kana.katakana;

  D.crt.innerHTML = `
    <div class="crt-page active" id="page-kana-detail">
      <p class="crt-prompt">DETAIL > ${cur}/${total}</p>
      <div class="crt-detail-char" onclick="event.stopPropagation();showKanaPopover(KANA_DATA[${APP.currentKanaIdx}], this)" style="cursor:pointer;" title="クリックで詳細（点击查看关联词）">${char}</div>
      <p class="crt-prompt" style="text-align:center;">${kana.romaji}</p>
      <p style="text-align:center;color:var(--crt-amber-d);font-size:12px;">
        HIRAGANA: ${kana.hiragana} ｜ KATAKANA: ${kana.katakana}
      </p>
      <p style="text-align:center;color:var(--crt-amber-d);font-size:11px;margin-top:6px;">
        EX: ${kana.example.word} (${kana.example.reading}) — ${kana.example.meaning}
      </p>
      <div style="text-align:center;margin-top:16px;">
        <button class="crt-btn" onclick="doSpeak()">[ SPEAK ]</button>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
        <button class="crt-btn" onclick="prevKana()" ${cur<=1?'disabled':''}>← PREV</button>
        <button class="crt-btn" onclick="nextKana()" ${cur>=total?'disabled':''}>NEXT →</button>
      </div>
      <div style="text-align:center;margin-top:8px;">
        <button class="crt-btn" onclick="navigateTo('kana-chart')">[ BACK ]</button>
      </div>
    </div>
  `;

  D.statusMsg.textContent = `KANA: ${kana.romaji.toUpperCase()}`;
}

function prevKana() {
  if (APP.currentKanaIdx > 0) { APP.currentKanaIdx--; renderKanaDetail(); }
}
function nextKana() {
  if (APP.currentKanaIdx < KANA_DATA.length - 1) { APP.currentKanaIdx++; renderKanaDetail(); }
}

// ═══════════════════════════════════════════════
// 语音
// ═══════════════════════════════════════════════

async function doSpeak() {
  if (!APP.audioOn) return;
  D.ledAudio.classList.add('on');
  let text = '';
  if (APP.currentPage === 'kana-detail') {
    const kana = getKanaByIndex(APP.currentKanaIdx);
    text = kana ? (APP.showHiragana ? kana.hiragana : kana.katakana) : '';
  } else if (APP.currentPage === 'quiz' && typeof QUIZ !== 'undefined' && QUIZ.active) {
    const q = QUIZ.questions[QUIZ.currentIdx];
    text = q ? (APP.showHiragana ? q.correct.hiragana : q.correct.katakana) : '';
  }
  if (text) {
    D.statusMsg.textContent = 'SPEAKING...';
    try { await speakText(text); } catch(e) { console.warn('Audio:', e); }
    D.statusMsg.textContent = 'SYS OK';
  }
  setTimeout(() => D.ledAudio.classList.remove('on'), 500);
}

// ═══════════════════════════════════════════════
// CRT 弹出提示框（Tooltip Popover）
// 点击假名弹出关联词汇和例句
// ═══════════════════════════════════════════════

function showKanaPopover(kana, anchorEl) {
  // 如果已有弹出框，先移除
  closePopover(true);

  APP.popoverVisible = true;
  APP.popoverKana = kana;

  const char = APP.showHiragana ? kana.hiragana : kana.katakana;

  // 关联词标签
  let tagsHTML = '';
  if (kana.related && kana.related.length) {
    tagsHTML = kana.related.map((r, i) =>
      `<span class="crt-popover-tag" onclick="event.stopPropagation();speakPopoverTag('${kana.romaji}',${i})">${r}</span>`
    ).join('');
  }

  // 例句
  const sentenceHTML = kana.sentence
    ? `<div class="crt-popover-sentence">「${kana.sentence}」</div>`
    : '';

  // 创建弹出框
  const popover = document.createElement('div');
  popover.className = 'crt-popover';
  popover.id = 'crt-popover';
  popover.innerHTML = `
    <button class="crt-popover-close" onclick="event.stopPropagation();closePopover();">×</button>
    <div class="crt-popover-title">${char}</div>
    <div class="crt-popover-roma">${kana.romaji} — ${APP.showHiragana ? 'HIRAGANA' : 'KATAKANA'}</div>
    ${kana.related && kana.related.length ? `
    <div class="crt-popover-section">
      <div class="crt-popover-label">▸ 関連語（关联词）</div>
      <div class="crt-popover-tags">${tagsHTML}</div>
    </div>` : ''}
    ${kana.sentence ? `
    <div class="crt-popover-section">
      <div class="crt-popover-label">▸ 例文（例句）</div>
      ${sentenceHTML}
    </div>` : ''}
    <div class="crt-popover-actions">
      <button class="crt-popover-btn" onclick="event.stopPropagation();popoverSpeakAndGlow();">🔊 SPEAK</button>
      <button class="crt-popover-btn" onclick="event.stopPropagation();closePopover();navigateTo('kana-detail',${KANA_DATA.indexOf(kana)});">📋 DETAIL</button>
    </div>
  `;

  // 遮罩层（点击关闭）
  const overlay = document.createElement('div');
  overlay.className = 'crt-overlay';
  overlay.id = 'crt-overlay';
  overlay.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopover();
  });

  document.body.appendChild(overlay);
  document.body.appendChild(popover);

  // 定位弹出框（相对于锚点元素）
  positionPopover(popover, anchorEl);

  // 播放数据指示灯闪烁
  D.ledData.classList.add('on');
}

function positionPopover(popover, anchorEl) {
  const anchorRect = anchorEl.getBoundingClientRect();
  const popoverWidth = popover.offsetWidth;
  const popoverHeight = popover.offsetHeight;
  const margin = 12;

  // 默认显示在锚点下方
  let top = anchorRect.bottom + margin;
  let left = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2;

  // 判断是否需要箭头朝下（弹出框在上方）
  let arrowBottom = false;

  // 如果下方空间不够，显示在上方
  if (top + popoverHeight > window.innerHeight - 20) {
    top = anchorRect.top - popoverHeight - margin;
    arrowBottom = true;
  }

  // 水平边界检测
  if (left < 10) left = 10;
  if (left + popoverWidth > window.innerWidth - 10) {
    left = window.innerWidth - popoverWidth - 10;
  }

  // 确保不超出顶部
  if (top < 10) {
    top = anchorRect.bottom + margin;
    arrowBottom = false;
  }

  popover.style.top = top + 'px';
  popover.style.left = left + 'px';

  if (arrowBottom) {
    popover.classList.add('arrow-bottom');
  }

  // 调整箭头水平位置指向锚点中心
  const arrowLeft = anchorRect.left + anchorRect.width / 2 - left;
  popover.style.setProperty('--arrow-left', Math.max(12, Math.min(arrowLeft, popoverWidth - 20)) + 'px');
  // 更新箭头位置
  const arrowLeftClamped = Math.max(12, Math.min(arrowLeft, popoverWidth - 20));
  popover.style.setProperty('--arrow-left', arrowLeftClamped + 'px');
  // 动态更新伪元素位置
  const styleId = 'popover-arrow-style';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  const arrowDir = arrowBottom ? 'bottom' : 'top';
  styleEl.textContent = `
    #crt-popover::before { left: ${arrowLeftClamped}px !important; }
    #crt-popover.arrow-bottom::before { left: ${arrowLeftClamped}px !important; }
  `;
}

function closePopover(silent) {
  APP.popoverVisible = false;
  APP.popoverKana = null;
  const popover = document.getElementById('crt-popover');
  const overlay = document.getElementById('crt-overlay');
  if (popover) popover.remove();
  if (overlay) overlay.remove();
  // 清理动态样式
  const styleEl = document.getElementById('popover-arrow-style');
  if (styleEl) styleEl.remove();
  if (!silent) {
    D.ledData.classList.remove('on');
  }
}

// 点击弹出框中关联词标签 → 朗读该词
function speakPopoverTag(romaji, index) {
  // 闪烁数据灯
  D.ledData.classList.add('on');
  setTimeout(() => D.ledData.classList.remove('on'), 400);

  // 朗读标签对应的关联词文本（提取日语部分）
  const kana = APP.popoverKana;
  if (kana && kana.related && kana.related[index]) {
    const tagText = kana.related[index];
    // 提取日语部分（空格之前的内容）
    const jpMatch = tagText.match(/^([^\s（]+)/);
    const jpText = jpMatch ? jpMatch[1] : tagText;
    speakText(jpText).catch(() => {});
  }
}

// 弹出框中 SPEAK 按钮 — 朗读并闪烁
async function popoverSpeakAndGlow() {
  if (!APP.popoverKana) return;
  D.ledAudio.classList.add('on');
  D.ledData.classList.add('on');
  const kana = APP.popoverKana;
  const text = APP.showHiragana ? kana.hiragana : kana.katakana;
  D.statusMsg.textContent = 'SPEAKING...';
  try { await speakText(text); } catch(e) {}
  D.statusMsg.textContent = 'SYS OK';
  setTimeout(() => {
    D.ledAudio.classList.remove('on');
    D.ledData.classList.remove('on');
  }, 400);
}

// ═══════════════════════════════════════════════
// 测验（CRT 风格）
// ═══════════════════════════════════════════════

function startQuiz() {
  if (typeof QUIZ === 'undefined') return;
  QUIZ.totalQuestions = 10;
  QUIZ.questions = generateQuestions(QUIZ.totalQuestions);
  QUIZ.currentIdx = 0;
  QUIZ.score = 0;
  QUIZ.answered = false;
  QUIZ.active = true;
  renderQuizQuestion();
  D.statusScore.textContent = 'SCORE: 0';
}

function renderQuizQuestion() {
  const q = QUIZ.questions[QUIZ.currentIdx];
  if (!q) { finishQuiz(); return; }

  const cur = QUIZ.currentIdx + 1;
  const total = QUIZ.totalQuestions;
  const pct = (cur - 1) / total * 100;

  let opts = '';
  q.options.forEach((opt, i) => {
    const char = APP.showHiragana ? opt.hiragana : opt.katakana;
    opts += `
      <div class="crt-quiz-opt" onclick="selectQuizAnswer(${i})" id="quiz-opt-${i}">
        ${char}
        <div style="font-size:10px;font-family:var(--mono);">${opt.romaji}</div>
      </div>`;
  });

  D.crt.innerHTML = `
    <div class="crt-page active" id="page-quiz">
      <p class="crt-prompt">QUIZ > Q${cur}/${total}</p>
      <div class="crt-score">
        <span>SCORE: ${QUIZ.score}</span>
        <span>${APP.showHiragana ? 'HIRAGANA' : 'KATAKANA'} MODE</span>
      </div>
      <div class="crt-progress">
        <div class="crt-progress-bar" style="width:${pct}%;"></div>
      </div>
      <p style="text-align:center;font-size:13px;margin:12px 0;">LISTEN AND SELECT ></p>
      <button class="crt-btn" onclick="quizPlayAudio()" id="btn-quiz-play"
              style="display:block;margin:0 auto 12px;">[ REPLAY ]</button>
      <div class="crt-quiz-opts" id="quiz-options">${opts}</div>
      <div id="quiz-feedback" style="text-align:center;margin-top:10px;min-height:30px;"></div>
      <div id="quiz-actions" style="text-align:center;margin-top:8px;display:none;">
        <button class="crt-btn" onclick="nextQuizQuestion()">
          ${cur >= total ? '[ SHOW RESULTS ]' : '[ NEXT ]'}
        </button>
      </div>
      <div style="text-align:center;margin-top:10px;">
        <button class="crt-btn" onclick="exitQuiz()">[ QUIT ]</button>
      </div>
    </div>
  `;

  QUIZ.answered = false;
  D.statusMsg.textContent = `QUIZ Q${cur}/${total}`;
  setTimeout(() => quizPlayAudio(), 300);
}

async function quizPlayAudio() {
  const q = QUIZ.questions[QUIZ.currentIdx];
  if (!q) return;
  const char = APP.showHiragana ? q.correct.hiragana : q.correct.katakana;
  const btn = $('#btn-quiz-play');
  if (btn) btn.textContent = '[ PLAYING... ]';
  try { await speakText(char); } catch(e) {}
  if (btn) btn.textContent = '[ REPLAY ]';
}

function selectQuizAnswer(optIdx) {
  if (QUIZ.answered) return;
  QUIZ.answered = true;

  const q = QUIZ.questions[QUIZ.currentIdx];
  const isCorrect = (optIdx === q.correctIdx);

  const correctEl = document.getElementById(`quiz-opt-${q.correctIdx}`);
  const selectedEl = document.getElementById(`quiz-opt-${optIdx}`);
  if (correctEl) correctEl.classList.add('correct');
  if (!isCorrect && selectedEl) selectedEl.classList.add('wrong');

  document.querySelectorAll('.crt-quiz-opt').forEach(el => el.style.pointerEvents = 'none');

  const fb = $('#quiz-feedback');
  const actions = $('#quiz-actions');

  if (isCorrect) {
    QUIZ.score++;
    fb.innerHTML = '<p style="color:#44FF44;">[ CORRECT ]</p>';
  } else {
    const rightChar = APP.showHiragana ? q.correct.hiragana : q.correct.katakana;
    fb.innerHTML = `<p style="color:#FF4444;">[ WRONG ] ANSWER: ${rightChar} (${q.correct.romaji})</p>`;
  }

  D.statusScore.textContent = `SCORE: ${QUIZ.score}`;
  if (actions) actions.style.display = 'block';
}

function nextQuizQuestion() {
  QUIZ.currentIdx++;
  if (QUIZ.currentIdx >= QUIZ.totalQuestions) { finishQuiz(); return; }
  renderQuizQuestion();
}

function finishQuiz() {
  QUIZ.active = false;
  const score = QUIZ.score;
  const total = QUIZ.totalQuestions;
  const pct = Math.round((score / total) * 100);

  let stars = '', comment = '';
  if (pct >= 90)      { stars = '***'; comment = 'EXCELLENT'; }
  else if (pct >= 70) { stars = '**';  comment = 'GOOD'; }
  else if (pct >= 50) { stars = '*';   comment = 'OK'; }
  else                { stars = '-';   comment = 'TRY AGAIN'; }

  D.crt.innerHTML = `
    <div class="crt-page active" id="page-quiz">
      <p class="crt-prompt">RESULTS</p>
      <div class="crt-result">
        <div class="big-score">${score}/${total}</div>
        <div class="stars">${stars}</div>
        <p style="margin:8px 0;">${comment} — ${pct}%</p>
        <div style="margin-top:16px;display:flex;gap:8px;justify-content:center;">
          <button class="crt-btn" onclick="navigateTo('quiz')">[ RETRY ]</button>
          <button class="crt-btn" onclick="navigateTo('kana-chart')">[ CHART ]</button>
        </div>
      </div>
    </div>
  `;

  D.statusScore.textContent = `FINAL: ${score}/${total}`;
}

function exitQuiz() {
  QUIZ.active = false;
  navigateTo('home');
}

// 这些函数由 quiz.js 调用，需要全局可访问
function renderQuiz() { navigateTo('quiz'); }

// ═══════════════════════════════════════════════
// 场景化学习
// ═══════════════════════════════════════════════

// 每页显示数量
const WORDS_PER_PAGE = 5;
const PHRASES_PER_PAGE = 4;

// 主页渲染场景卡片网格
function renderScenarioList() {
  const grid = document.getElementById('scenario-grid');
  if (!grid) return;

  let cards = '';
  SCENARIOS.forEach((sc, i) => {
    cards += `
      <button class="scenario-card" onclick="navigateToScenario('${sc.id}')">
        <span class="sc-icon">${sc.icon}</span>
        <span class="sc-info">
          <span class="sc-name">${sc.name}</span><br>
          <span class="sc-cn">${sc.nameCN}</span>
        </span>
      </button>`;
  });

  grid.innerHTML = cards;
}

// 进入场景
function navigateToScenario(scenarioId) {
  const sc = SCENARIOS.find(s => s.id === scenarioId);
  if (!sc) return;
  APP.currentScenario = sc;
  APP.scenarioTab = 'words';
  APP.scenarioPage = 0;
  navigateTo('scenario', sc);
}

// 渲染场景学习页
function renderScenarioPage() {
  const sc = APP.currentScenario;
  if (!sc) { navigateTo('home'); return; }

  let tabs = '';
  const tabDefs = [
    { id: 'words',    label: '📝 単語' },
    { id: 'phrases',  label: '💬 フレーズ' },
    { id: 'dialogue', label: '🎭 会話' },
    { id: 'culture',  label: '🎌 豆知識' },
  ];
  tabDefs.forEach(t => {
    const cls = t.id === APP.scenarioTab ? ' active' : '';
    tabs += `<button class="scenario-tab${cls}" onclick="switchScenarioTab('${t.id}')">${t.label}</button>`;
  });

  // 内容区（由各 Tab 函数填充）
  let content = '';
  switch (APP.scenarioTab) {
    case 'words':    content = renderWordsContent(); break;
    case 'phrases':  content = renderPhrasesContent(); break;
    case 'dialogue': content = renderDialogueContent(); break;
    case 'culture':  content = renderCultureContent(); break;
  }

  D.crt.innerHTML = `
    <div class="crt-page active" id="page-scenario">
      <div class="scenario-header">
        <span class="sh-title">${sc.icon} ${sc.name}</span>
        <button class="sh-back" onclick="navigateTo('home')">← BACK</button>
      </div>
      <div class="scenario-tabs">${tabs}</div>
      <div id="scenario-content">${content}</div>
    </div>
  `;

  D.statusMsg.textContent = `SCENE: ${sc.nameCN}`;
}

// Tab 切换
function switchScenarioTab(tab) {
  APP.scenarioTab = tab;
  APP.scenarioPage = 0;
  renderScenarioPage();
}

// ── 单词 Tab ──
function renderWordsContent() {
  const sc = APP.currentScenario;
  const words = sc.words;
  const totalPages = Math.ceil(words.length / WORDS_PER_PAGE);
  const page = APP.scenarioPage;
  const start = page * WORDS_PER_PAGE;
  const pageWords = words.slice(start, start + WORDS_PER_PAGE);

  let html = '';
  pageWords.forEach((w, i) => {
    const idx = start + i;
    html += `
      <div class="word-card">
        <div class="wc-jp">${w.jp}</div>
        <div class="wc-reading">${w.reading}</div>
        <div class="wc-cn">${w.cn}</div>
        <button class="wc-speak" onclick="event.stopPropagation();doScenarioSpeak('${w.reading.replace(/'/g, "\\'")}')">▶ SPEAK</button>
      </div>`;
  });

  html += pagerHTML(page, totalPages, 'words');
  return html;
}

// ── 短句 Tab ──
function renderPhrasesContent() {
  const sc = APP.currentScenario;
  const phrases = sc.phrases;
  const totalPages = Math.ceil(phrases.length / PHRASES_PER_PAGE);
  const page = APP.scenarioPage;
  const start = page * PHRASES_PER_PAGE;
  const pagePhrases = phrases.slice(start, start + PHRASES_PER_PAGE);

  let html = '';
  pagePhrases.forEach(p => {
    html += `
      <div class="phrase-card">
        <div class="pc-jp">${p.jp}</div>
        <div class="pc-reading">${p.reading}</div>
        <div class="pc-cn">💡 ${p.cn}</div>
        <button class="pc-speak" onclick="event.stopPropagation();doScenarioSpeak('${p.jp.replace(/'/g, "\\'")}')">▶ SPEAK</button>
      </div>`;
  });

  html += pagerHTML(page, totalPages, 'phrases');
  return html;
}

// ── 对话 Tab ──
function renderDialogueContent() {
  const sc = APP.currentScenario;
  const dlg = sc.dialogue;

  let html = `<p class="crt-prompt" style="font-size:11px;">🎭 ${dlg.title}</p>`;

  dlg.lines.forEach((line, i) => {
    const isCustomer = line.role === dlg.roles[1]; // 第二个角色 = 学习者角色
    const cls = isCustomer ? ' dialogue-line dl-customer' : ' dialogue-line';
    html += `
      <div class="${cls}">
        <div class="dl-role">${line.role}</div>
        <div class="dl-jp">${line.jp}</div>
        <div class="dl-reading">${line.reading}</div>
        <div class="dl-cn">${line.cn}</div>
        <button class="dl-speak" onclick="event.stopPropagation();doScenarioSpeak('${line.jp.replace(/'/g, "\\'")}')">▶ SPEAK</button>
      </div>`;
  });

  return html;
}

// ── 文化贴士 Tab ──
function renderCultureContent() {
  const sc = APP.currentScenario;
  let html = '';
  sc.culture.forEach((tip, i) => {
    html += `
      <div class="culture-item">
        <span class="ci-num">0${i+1}</span> ${tip}
      </div>`;
  });
  return html;
}

// ── 分页器 ──
function pagerHTML(page, totalPages, tabId) {
  if (totalPages <= 1) return '';
  return `
    <div class="scenario-pager">
      <button onclick="scenarioPrevPage('${tabId}')" ${page <= 0 ? 'disabled' : ''}>◀ PREV</button>
      <span>${page + 1} / ${totalPages}</span>
      <button onclick="scenarioNextPage('${tabId}')" ${page >= totalPages - 1 ? 'disabled' : ''}>NEXT ▶</button>
    </div>`;
}

function scenarioPrevPage() {
  if (APP.scenarioPage > 0) {
    APP.scenarioPage--;
    renderScenarioPage();
  }
}
function scenarioNextPage() {
  const sc = APP.currentScenario;
  const perPage = APP.scenarioTab === 'words' ? WORDS_PER_PAGE : PHRASES_PER_PAGE;
  const items = APP.scenarioTab === 'words' ? sc.words : sc.phrases;
  const maxPage = Math.ceil(items.length / perPage) - 1;
  if (APP.scenarioPage < maxPage) {
    APP.scenarioPage++;
    renderScenarioPage();
  }
}

// ── 场景朗读 ──
async function doScenarioSpeak(text) {
  if (!APP.audioOn || !text) return;
  D.ledAudio.classList.add('on');
  D.ledData.classList.add('on');
  D.statusMsg.textContent = 'SPEAKING...';
  try { await speakText(text); } catch(e) { console.warn('Scenario speak:', e); }
  D.statusMsg.textContent = 'SYS OK';
  setTimeout(() => {
    D.ledAudio.classList.remove('on');
    D.ledData.classList.remove('on');
  }, 400);
}

// ═══════════════════════════════════════════════
// 控件事件绑定
// ═══════════════════════════════════════════════

// 模式旋钮位置点击
D.knobPositions.forEach(sp => {
  sp.addEventListener('click', () => {
    navigateTo(sp.dataset.mode);
  });
});

// 显示切换
D.swHiragana.addEventListener('click', () => {
  APP.showHiragana = true;
  D.swHiragana.classList.add('active');
  D.swKatakana.classList.remove('active');
  if (APP.currentPage === 'kana-chart') renderKanaChart();
  if (APP.currentPage === 'kana-detail') renderKanaDetail();
  if (APP.currentPage === 'quiz') renderQuizQuestion();
});
D.swKatakana.addEventListener('click', () => {
  APP.showHiragana = false;
  D.swKatakana.classList.add('active');
  D.swHiragana.classList.remove('active');
  if (APP.currentPage === 'kana-chart') renderKanaChart();
  if (APP.currentPage === 'kana-detail') renderKanaDetail();
  if (APP.currentPage === 'quiz') renderQuizQuestion();
});

// 色调滑块
D.tintSlider.addEventListener('input', () => {
  updateScreenTint(parseInt(D.tintSlider.value));
});

// 扫描线滑块
D.scanlineSlider.addEventListener('input', () => {
  updateScanlines(parseInt(D.scanlineSlider.value));
});

// 亮度旋钮
const knobBright = $('#knob-bright');
let brightVal = 70;
if (knobBright) {
  knobBright.addEventListener('click', () => {
    brightVal = brightVal >= 100 ? 30 : brightVal + 20;
    updateBrightness(brightVal);
    // 旋转旋钮视觉
    const dot = knobBright.querySelector('.knob-dot');
    if (dot) dot.style.transform = `translateX(-50%) rotate(${brightVal * 2.7}deg)`;
  });
}

// 模式旋钮
const knobMode = $('#knob-mode');
let modeIdx = 0;
const modes = ['home', 'kana-chart', 'quiz', 'kana-detail'];
if (knobMode) {
  knobMode.addEventListener('click', () => {
    modeIdx = (modeIdx + 1) % modes.length;
    navigateTo(modes[modeIdx]);
    const dot = knobMode.querySelector('.knob-dot');
    if (dot) dot.style.transform = `translateX(-50%) rotate(${modeIdx * 90}deg)`;
  });
}

// 操作按钮
D.btnSpeak.addEventListener('click', () => doSpeak());
D.btnNext.addEventListener('click', () => {
  if (APP.currentPage === 'kana-detail') nextKana();
  else if (APP.currentPage === 'quiz' && QUIZ.active && QUIZ.answered) nextQuizQuestion();
});
D.btnReset.addEventListener('click', () => {
  navigateTo('home');
  D.statusScore.textContent = 'SCORE: --';
});

// 键盘
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); if (APP.currentPage==='kana-detail') prevKana(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); if (APP.currentPage==='kana-detail') nextKana(); }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (APP.popoverVisible) { closePopover(); return; }
    navigateTo('home');
  }
  if (e.key === ' ') { e.preventDefault(); doSpeak(); }
});

// ═══════════════════════════════════════════════
// 时钟
// ═══════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  D.statusClock.textContent = now.toTimeString().slice(0,8);
}
setInterval(updateClock, 30000);
updateClock();

// ═══════════════════════════════════════════════
// 初始化
// ═══════════════════════════════════════════════
function initApp() {
  console.log('🔹 ドット先生 Terminal DS-1 起動...');
  // 默认设置
  updateScreenTint(50);
  updateScanlines(60);
  updateBrightness(70);
  D.ledAudio.classList.add('on'); // audio ready

  navigateTo('home');
  console.log('🔹 SYS OK');
}

document.addEventListener('DOMContentLoaded', initApp);
