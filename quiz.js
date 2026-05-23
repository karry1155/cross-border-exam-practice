const DATA_URL = "./qxueyou_refined_practice_questions.json";
const STORE_KEY = "ec_exam_refined_choice_progress_v1";

const elements = {
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
  mode: "all",
  progress: loadProgress(),
};

init();

async function init() {
  bindEvents();
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.all = (payload.questions || []).map((question, index) => ({
      ...question,
      id: String(question.source_id || index + 1),
      order: index + 1,
    }));
    hydrateCategories();
    rebuildDeck();
  } catch (error) {
    renderLoadError(error);
  }
}

function bindEvents() {
  elements.category.addEventListener("change", () => rebuildDeck());
  elements.search.addEventListener("input", debounce(() => rebuildDeck(), 180));
  elements.shuffle.addEventListener("change", () => rebuildDeck());

  elements.segments.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
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
    if (!confirm("确定清空选择题练习进度、错题和收藏吗？")) return;
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

function hydrateCategories() {
  const categories = Array.from(new Set(state.all.map((item) => item.category).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN"),
  );
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.category.appendChild(option);
  });
}

function rebuildDeck() {
  const category = elements.category.value;
  const keyword = elements.search.value.trim().toLowerCase();

  let deck = state.all.filter((question) => {
    const record = state.progress[question.id];
    const inMode =
      state.mode === "all" ||
      (state.mode === "wrong" && record?.wrong) ||
      (state.mode === "bookmarked" && record?.bookmarked);
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

  const record = state.progress[question.id] || {};
  const done = Boolean(record.selected);
  const isCorrect = record.selected === question.answer;
  const total = state.deck.length;
  const displayIndex = state.index + 1;

  elements.meta.textContent = `${question.category || "未分类"} · ${question.knowledge_point || "综合考点"} · ${displayIndex}/${total}`;
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
    elements.feedback.innerHTML = "<strong>请选择答案</strong><span>点击选项后会立刻判断，并给出错因解析。</span>";
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
  const selectedText = question.options[selected];
  const answerText = question.options[question.answer];
  const reason = question.pitfall || "这题的关键是区分题干中的限定词和选项概念边界。";
  const memory = question.memory_tip ? `记忆提示：${question.memory_tip}` : "";
  const confidence = question.confidence ? `题库置信度：${Math.round(question.confidence * 100)}%` : "";
  const keep = question.why_keep ? `入选原因：${question.why_keep}` : "";
  elements.feedback.className = `feedback-box ${isCorrect ? "good" : "bad"}`;
  elements.feedback.innerHTML = isCorrect
    ? `<strong>回答正确：${escapeHtml(question.answer)}. ${escapeHtml(answerText)}</strong><span>${escapeHtml(memory || keep || "继续保持这个节奏。")}</span>`
    : `<strong>回答错误：你选了 ${escapeHtml(selected)}. ${escapeHtml(selectedText)}</strong><span>正确答案：${escapeHtml(question.answer)}. ${escapeHtml(answerText)}<br>${escapeHtml(reason)}${memory ? `<br>${escapeHtml(memory)}` : ""}${confidence ? `<br>${escapeHtml(confidence)}` : ""}</span>`;
}

function updateStats() {
  const values = Object.values(state.progress);
  const answered = values.filter((item) => item.selected).length;
  elements.statCorrect.textContent = values.filter((item) => item.correct).length;
  elements.statWrong.textContent = values.filter((item) => item.wrong).length;
  elements.statDone.textContent = answered;
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

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.progress));
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderLoadError(error) {
  elements.meta.textContent = "题库读取失败";
  elements.title.textContent = "需要通过本地服务或 GitHub Pages 打开";
  elements.text.innerHTML = `<div class="empty-state">没有读取到题库数据。请确认 qxueyou_refined_practice_questions.json 与页面在同一目录，或使用本项目的本地预览服务打开。<br>${escapeHtml(error.message)}</div>`;
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
