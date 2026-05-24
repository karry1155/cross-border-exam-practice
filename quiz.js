const TRAINING_MODES = {
  full: {
    title: "全量训练",
    dataUrl: "./full_questions.json",
    storeKey: "ec_exam_full_choice_progress_v1",
    loadingText: "正在读取 full_questions.json...",
    noAnalysisText: "全量题库保留原始题干、选项和答案，原始数据没有逐题分类和错因解析。",
  },
  refined: {
    title: "精简训练",
    dataUrl: "./qxueyou_refined_practice_questions.json",
    storeKey: "ec_exam_refined_choice_progress_v1",
    loadingText: "正在读取 qxueyou_refined_practice_questions.json...",
    noAnalysisText: "这题的关键是区分题干中的限定词和选项概念边界。",
  },
  ultra: {
    title: "极简训练",
    dataUrl: "./ultra_questions.json",
    storeKey: "ec_exam_ultra_choice_progress_v1",
    loadingText: "正在读取 ultra_questions.json...",
    noAnalysisText: "极简题库优先保留反直觉和易错题，注意不要被选项长短诱导。",
  },
};

const elements = {
  modeShell: document.getElementById("modeShell"),
  practiceShell: document.getElementById("practiceShell"),
  modeCards: Array.from(document.querySelectorAll("[data-training]")),
  changeTraining: document.getElementById("changeTraining"),
  category: document.getElementById("categorySelect"),
  search: document.getElementById("searchInput"),
  shuffle: document.getElementById("shuffleToggle"),
  autoNext: document.getElementById("autoNextToggle"),
  segments: Array.from(document.querySelectorAll(".segment")),
  statCorrect: document.getElementById("statCorrect"),
  statWrong: document.getElementById("statWrong"),
  statDone: document.getElementById("statDone"),
  statTotal: document.getElementById("statTotal"),
  meta: document.getElementById("questionMeta"),
  title: document.getElementById("questionTitle"),
  text: document.getElementById("questionText"),
  options: document.getElementById("optionsGrid"),
  feedback: document.getElementById("feedbackBox"),
  progress: document.getElementById("progressBar"),
  bookmark: document.getElementById("bookmarkButton"),
  prev: document.getElementById("prevButton"),
  next: document.getElementById("nextButton"),
  jump: document.getElementById("jumpInput"),
  jumpButton: document.getElementById("jumpButton"),
  reset: document.getElementById("resetProgress"),
};

const state = {
  all: [],
  deck: [],
  index: 0,
  filterMode: "all",
  trainingMode: "",
  progress: {},
  metadata: {},
};

bindEvents();
restoreModeFromUrl();

function bindEvents() {
  elements.modeCards.forEach((button) => {
    button.addEventListener("click", () => startTraining(button.dataset.training));
  });
  elements.changeTraining.addEventListener("click", () => showModeSelect());
  elements.category.addEventListener("change", () => rebuildDeck());
  elements.search.addEventListener("input", debounce(() => rebuildDeck(), 180));
  elements.shuffle.addEventListener("change", () => rebuildDeck());

  elements.segments.forEach((button) => {
    button.addEventListener("click", () => {
      state.filterMode = button.dataset.mode;
      elements.segments.forEach((item) => item.classList.toggle("active", item === button));
      rebuildDeck();
    });
  });

  elements.prev.addEventListener("click", () => move(-1));
  elements.next.addEventListener("click", () => move(1));
  elements.jumpButton.addEventListener("click", jumpTo);
  elements.jump.addEventListener("keydown", (event) => {
    if (event.key === "Enter") jumpTo();
  });

  elements.bookmark.addEventListener("click", () => {
    const question = currentQuestion();
    if (!question) return;
    const record = recordFor(question.id);
    record.bookmarked = !record.bookmarked;
    saveProgress();
    renderQuestion();
    updateStats();
  });

  elements.reset.addEventListener("click", () => {
    if (!state.trainingMode) return;
    if (!confirm(`确定清空“${TRAINING_MODES[state.trainingMode].title}”的练习进度、错题和收藏吗？`)) return;
    state.progress = {};
    saveProgress();
    rebuildDeck();
  });

  window.addEventListener("keydown", (event) => {
    if (event.target && ["INPUT", "SELECT"].includes(event.target.tagName)) return;
    const key = event.key.toUpperCase();
    if (["A", "B", "C", "D"].includes(key)) answer(key);
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });
}

function restoreModeFromUrl() {
  const mode = new URLSearchParams(window.location.search).get("mode");
  if (TRAINING_MODES[mode]) startTraining(mode);
}

async function startTraining(mode) {
  const config = TRAINING_MODES[mode];
  if (!config) return;
  state.trainingMode = mode;
  state.all = [];
  state.deck = [];
  state.index = 0;
  state.progress = loadProgress(config.storeKey);
  state.metadata = {};
  showPractice(config);

  try {
    const response = await fetch(config.dataUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const questions = Array.isArray(payload) ? payload : payload.questions || [];
    state.metadata = Array.isArray(payload) ? {} : payload.metadata || {};
    state.all = questions.map((question, index) => ({
      ...question,
      id: `${mode}-${question.source_id || question.id || index + 1}`,
      order: index + 1,
      category: question.category || config.title,
      knowledge_point: question.knowledge_point || "综合训练",
    }));
    hydrateCategories();
    rebuildDeck();
    updateUrlMode(mode);
  } catch (error) {
    renderLoadError(error, config);
  }
}

function showPractice(config) {
  elements.modeShell.classList.add("hidden");
  elements.practiceShell.classList.remove("hidden");
  elements.meta.textContent = "正在加载题库";
  elements.title.textContent = config.title;
  elements.text.textContent = config.loadingText;
  elements.options.innerHTML = "";
  elements.feedback.className = "feedback-box idle";
  elements.feedback.innerHTML = "<strong>读取题库中</strong><span>马上进入练习。</span>";
  elements.progress.style.width = "0%";
  resetFilters();
}

function showModeSelect() {
  elements.practiceShell.classList.add("hidden");
  elements.modeShell.classList.remove("hidden");
  window.history.replaceState({}, "", window.location.pathname);
}

function resetFilters() {
  elements.category.innerHTML = `<option value="all">全部分类</option>`;
  elements.search.value = "";
  state.filterMode = "all";
  elements.segments.forEach((button) => button.classList.toggle("active", button.dataset.mode === "all"));
}

function hydrateCategories() {
  const categories = Array.from(new Set(state.all.map((item) => item.category).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN"),
  );
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.category.appendChild(option);
  }
  const hasRealCategories = categories.length > 1 || categories[0] !== TRAINING_MODES[state.trainingMode].title;
  elements.category.disabled = !hasRealCategories;
}

function rebuildDeck() {
  const category = elements.category.value;
  const keyword = elements.search.value.trim().toLowerCase();

  let deck = state.all.filter((question) => {
    const record = state.progress[question.id];
    const inMode =
      state.filterMode === "all" ||
      (state.filterMode === "wrong" && record?.wrong) ||
      (state.filterMode === "bookmarked" && record?.bookmarked);
    const inCategory = category === "all" || question.category === category;
    const text = `${question.question} ${question.category || ""} ${question.knowledge_point || ""}`.toLowerCase();
    const inSearch = !keyword || text.includes(keyword);
    return inMode && inCategory && inSearch;
  });

  if (elements.shuffle.checked) deck = shuffle(deck);
  state.deck = deck;
  state.index = 0;
  renderQuestion();
  updateStats();
}

function renderQuestion() {
  const question = currentQuestion();
  elements.options.innerHTML = "";

  if (!question) {
    elements.meta.textContent = "没有匹配的题目";
    elements.title.textContent = "换个条件试试";
    elements.text.innerHTML = `<div class="empty-state">当前筛选条件下没有题目。可以切回“全部”，或清空搜索关键词。</div>`;
    elements.feedback.className = "feedback-box idle";
    elements.feedback.innerHTML = "<strong>等待题目</strong><span>调整左侧条件后继续练习。</span>";
    elements.progress.style.width = "0%";
    elements.bookmark.classList.remove("active");
    elements.bookmark.textContent = "☆";
    elements.prev.disabled = true;
    elements.next.disabled = true;
    elements.jump.value = "";
    return;
  }

  const config = TRAINING_MODES[state.trainingMode];
  const record = state.progress[question.id] || {};
  const done = Boolean(record.selected);
  const isCorrect = record.selected === question.answer;
  const total = state.deck.length;
  const displayIndex = state.index + 1;

  elements.meta.textContent = `${config.title} · ${question.category || "未分类"} · ${question.knowledge_point || "综合考点"} · ${displayIndex}/${total}`;
  elements.title.textContent = `第 ${question.order} 题`;
  elements.text.textContent = question.question;
  elements.progress.style.width = `${(displayIndex / Math.max(total, 1)) * 100}%`;
  elements.bookmark.classList.toggle("active", Boolean(record.bookmarked));
  elements.bookmark.textContent = record.bookmarked ? "★" : "☆";
  elements.prev.disabled = state.index === 0;
  elements.next.disabled = state.index >= total - 1;
  elements.jump.max = total;
  elements.jump.value = displayIndex;

  Object.entries(question.options || {}).forEach(([key, value]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.innerHTML = `<span class="option-key">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span>`;
    if (done && key === question.answer) button.classList.add("correct");
    if (done && key === record.selected && key !== question.answer) button.classList.add("wrong");
    button.addEventListener("click", () => answer(key));
    elements.options.appendChild(button);
  });

  if (!done) {
    elements.feedback.className = "feedback-box idle";
    const suffix = state.trainingMode === "full" ? "全量题答题后会显示正确答案；原始题库没有逐题错因解析。" : "答错会展示解析原因和记忆提示。";
    elements.feedback.innerHTML = `<strong>请选择答案</strong><span>${escapeHtml(suffix)}</span>`;
  } else {
    renderFeedback(question, record.selected, isCorrect);
  }
}

function answer(key) {
  const question = currentQuestion();
  if (!question || !question.options || !question.options[key]) return;

  const record = recordFor(question.id);
  record.selected = key;
  record.correct = key === question.answer;
  record.wrong = key !== question.answer;
  record.lastAnsweredAt = new Date().toISOString();
  record.attempts = (record.attempts || 0) + 1;
  saveProgress();
  renderQuestion();
  updateStats();

  if (record.correct && elements.autoNext.checked && state.index < state.deck.length - 1) {
    window.setTimeout(() => move(1), 520);
  }
}

function renderFeedback(question, selected, isCorrect) {
  const config = TRAINING_MODES[state.trainingMode];
  const selectedText = question.options[selected];
  const answerText = question.options[question.answer];
  const reason = question.pitfall || question.ultra_reason || config.noAnalysisText;
  const memory = question.memory_tip ? `记忆提示：${question.memory_tip}` : "";
  const confidence = question.confidence ? `题库置信度：${Math.round(question.confidence * 100)}%` : "";
  const keep = question.why_keep ? `入选原因：${question.why_keep}` : "";
  const rewritten = question.rewritten ? "本题已压平选项长度，避免“三短一长”诱导。" : "";
  elements.feedback.className = `feedback-box ${isCorrect ? "good" : "bad"}`;
  elements.feedback.innerHTML = isCorrect
    ? `<strong>回答正确：${escapeHtml(question.answer)}. ${escapeHtml(answerText)}</strong><span>${escapeHtml(memory || rewritten || keep || "继续保持这个节奏。")}</span>`
    : `<strong>回答错误：你选了 ${escapeHtml(selected)}. ${escapeHtml(selectedText)}</strong><span>正确答案：${escapeHtml(question.answer)}. ${escapeHtml(answerText)}<br>${escapeHtml(reason)}${memory ? `<br>${escapeHtml(memory)}` : ""}${rewritten ? `<br>${escapeHtml(rewritten)}` : ""}${confidence ? `<br>${escapeHtml(confidence)}` : ""}</span>`;
}

function updateStats() {
  const values = Object.values(state.progress);
  elements.statCorrect.textContent = values.filter((item) => item.correct).length;
  elements.statWrong.textContent = values.filter((item) => item.wrong).length;
  elements.statDone.textContent = values.filter((item) => item.selected).length;
  elements.statTotal.textContent = state.all.length;
}

function move(delta) {
  if (!state.deck.length) return;
  state.index = Math.min(Math.max(state.index + delta, 0), state.deck.length - 1);
  renderQuestion();
}

function jumpTo() {
  const nextIndex = Number(elements.jump.value) - 1;
  if (!Number.isFinite(nextIndex)) return;
  state.index = Math.min(Math.max(nextIndex, 0), state.deck.length - 1);
  renderQuestion();
}

function currentQuestion() {
  return state.deck[state.index];
}

function recordFor(id) {
  if (!state.progress[id]) state.progress[id] = {};
  return state.progress[id];
}

function loadProgress(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(TRAINING_MODES[state.trainingMode].storeKey, JSON.stringify(state.progress));
}

function updateUrlMode(mode) {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.history.replaceState({}, "", url);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderLoadError(error, config) {
  elements.meta.textContent = "题库读取失败";
  elements.title.textContent = "需要通过本地服务或 Cloudflare Pages 打开";
  elements.text.innerHTML = `<div class="empty-state">没有读取到题库数据。请确认 ${escapeHtml(config.dataUrl)} 与页面一起发布。<br>${escapeHtml(error.message)}</div>`;
  elements.feedback.className = "feedback-box bad";
  elements.feedback.innerHTML = "<strong>数据未加载</strong><span>页面本身正常，等待题库 JSON 可访问。</span>";
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
