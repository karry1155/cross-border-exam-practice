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
    noAnalysisText: "极简题库按题目质量保留高价值考点，并纳入你的已知错题。",
  },
};

const GLOBAL_PROGRESS_KEY = "ec_exam_choice_progress_by_source_v2";
const LEGACY_MIGRATION_KEY = "ec_exam_choice_progress_migrated_v3";
const SESSION_KEY = "ec_exam_anonymous_session_v1";
const OPTION_HINTS_KEY = "ec_exam_hide_option_hints_v1";
const LEGACY_PROGRESS_KEYS = Object.fromEntries(
  Object.entries(TRAINING_MODES).map(([mode, config]) => [mode, config.storeKey]),
);

const elements = {
  practiceShell: document.getElementById("practiceShell"),
  trainingModal: document.getElementById("trainingModal"),
  closeTrainingModal: document.getElementById("closeTrainingModal"),
  modeCards: Array.from(document.querySelectorAll("[data-training]")),
  changeTraining: document.getElementById("changeTraining"),
  currentTrainingLabel: document.getElementById("currentTrainingLabel"),
  category: document.getElementById("categorySelect"),
  search: document.getElementById("searchInput"),
  shuffle: document.getElementById("shuffleToggle"),
  hideOptionHints: document.getElementById("hideOptionHintsToggle"),
  autoNext: document.getElementById("autoNextToggle"),
  segments: Array.from(document.querySelectorAll(".segment")),
  statCorrect: document.getElementById("statCorrect"),
  statWrong: document.getElementById("statWrong"),
  statDone: document.getElementById("statDone"),
  statTotal: document.getElementById("statTotal"),
  wrongTools: document.getElementById("wrongTools"),
  wrongToolCount: document.getElementById("wrongToolCount"),
  wrongToolHint: document.getElementById("wrongToolHint"),
  exportWrongImage: document.getElementById("exportWrongImage"),
  meta: document.getElementById("questionMeta"),
  title: document.getElementById("questionTitle"),
  text: document.getElementById("questionText"),
  options: document.getElementById("optionsGrid"),
  feedback: document.getElementById("feedbackBox"),
  progress: document.getElementById("progressBar"),
  bookmark: document.getElementById("bookmarkButton"),
  bookmarkCount: document.getElementById("bookmarkCount"),
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
  bookmarkCounts: {},
  bookmarkCountsLoaded: false,
};

bindEvents();
restoreModeFromUrl();

function bindEvents() {
  elements.modeCards.forEach((button) => {
    button.addEventListener("click", () => startTraining(button.dataset.training));
  });
  elements.changeTraining.addEventListener("click", () => openTrainingModal());
  elements.closeTrainingModal.addEventListener("click", () => closeTrainingModal());
  elements.trainingModal.addEventListener("click", (event) => {
    if (event.target === elements.trainingModal) closeTrainingModal();
  });
  elements.category.addEventListener("change", () => rebuildDeck());
  elements.search.addEventListener("input", debounce(() => rebuildDeck(), 180));
  elements.shuffle.addEventListener("change", () => rebuildDeck());
  elements.hideOptionHints.checked = localStorage.getItem(OPTION_HINTS_KEY) === "1";
  elements.hideOptionHints.addEventListener("change", () => {
    localStorage.setItem(OPTION_HINTS_KEY, elements.hideOptionHints.checked ? "1" : "0");
    renderQuestion();
  });

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
  elements.exportWrongImage.addEventListener("click", exportWrongImage);

  elements.bookmark.addEventListener("click", () => {
    const question = currentQuestion();
    if (!question) return;
    const record = recordFor(question.id);
    record.bookmarked = !record.bookmarked;
    record.modes = { ...(record.modes || {}), [state.trainingMode]: true };
    adjustBookmarkCount(question.id, record.bookmarked ? 1 : -1);
    saveProgress();
    trackBookmark(question, record.bookmarked);
    renderQuestion();
    updateStats();
  });

  elements.reset.addEventListener("click", () => {
    if (!state.trainingMode) return;
    if (!confirm(`确定清空“${TRAINING_MODES[state.trainingMode].title}”的练习进度、错题和收藏吗？`)) return;
    state.all.forEach((question) => {
      delete state.progress[question.id];
    });
    saveProgress();
    rebuildDeck();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.trainingModal.classList.contains("hidden")) {
      closeTrainingModal();
      return;
    }
    if (event.target && ["INPUT", "SELECT"].includes(event.target.tagName)) return;
    const key = event.key.toUpperCase();
    if (["A", "B", "C", "D"].includes(key)) answer(key);
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });
}

function restoreModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  startTraining(TRAINING_MODES[mode] ? mode : "refined", { showPicker: params.get("choose") === "1" });
}

async function startTraining(mode, options = {}) {
  const config = TRAINING_MODES[mode];
  if (!config) return;
  state.trainingMode = mode;
  state.all = [];
  state.deck = [];
  state.index = 0;
    state.progress = loadProgress();
    state.metadata = {};
    state.bookmarkCounts = {};
    state.bookmarkCountsLoaded = false;
    showPractice(config);
    closeTrainingModal();

  try {
    const response = await fetch(config.dataUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const questions = Array.isArray(payload) ? payload : payload.questions || [];
    state.metadata = Array.isArray(payload) ? {} : payload.metadata || {};
    state.all = questions.map((question, index) => ({
      ...question,
      id: String(question.source_id || question.id || index + 1),
      order: index + 1,
      category: question.category || config.title,
      knowledge_point: question.knowledge_point || "综合训练",
    }));
    hydrateCategories();
    rebuildDeck();
    refreshBookmarkCounts();
    updateUrlMode(mode);
    if (options.showPicker) window.setTimeout(() => openTrainingModal(), 120);
  } catch (error) {
    renderLoadError(error, config);
  }
}

function showPractice(config) {
  elements.practiceShell.classList.remove("hidden");
  elements.currentTrainingLabel.textContent = `当前：${config.title}`;
  elements.meta.textContent = "正在加载题库";
  elements.title.textContent = config.title;
  elements.text.textContent = config.loadingText;
  elements.options.innerHTML = "";
  elements.feedback.className = "feedback-box idle";
  elements.feedback.innerHTML = "<strong>读取题库中</strong><span>马上进入练习。</span>";
  elements.progress.style.width = "0%";
  resetFilters();
}

function openTrainingModal() {
  elements.trainingModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  elements.closeTrainingModal.focus();
}

function closeTrainingModal() {
  elements.trainingModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
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
  updateWrongTools();
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
    elements.bookmarkCount.textContent = "收藏数 --";
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
  elements.bookmarkCount.textContent = bookmarkCountText(question.id);
  elements.prev.disabled = state.index === 0;
  elements.next.disabled = state.index >= total - 1;
  elements.jump.max = total;
  elements.jump.value = displayIndex;

  Object.entries(question.options || {}).forEach(([key, value]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.innerHTML = `<span class="option-key">${escapeHtml(key)}</span><span>${escapeHtml(optionText(value))}</span>`;
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
  record.modes = { ...(record.modes || {}), [state.trainingMode]: true };
  saveProgress();
  trackAnswer(question, record);
  renderQuestion();
  updateStats();
  updateWrongTools();

  if (record.correct && elements.autoNext.checked && state.index < state.deck.length - 1) {
    window.setTimeout(() => move(1), 520);
  }
}

function renderFeedback(question, selected, isCorrect) {
  const config = TRAINING_MODES[state.trainingMode];
  const selectedText = optionText(question.options[selected]);
  const answerText = optionText(question.options[question.answer]);
  const reason = question.pitfall || question.quality_reason || config.noAnalysisText;
  const memory = question.memory_tip ? `记忆提示：${question.memory_tip}` : "";
  const confidence = question.confidence ? `题库置信度：${Math.round(question.confidence * 100)}%` : "";
  const keep = question.why_keep ? `入选原因：${question.why_keep}` : "";
  elements.feedback.className = `feedback-box ${isCorrect ? "good" : "bad"}`;
  elements.feedback.innerHTML = isCorrect
    ? `<strong>回答正确：${escapeHtml(question.answer)}. ${escapeHtml(answerText)}</strong><span>${escapeHtml(memory || keep || question.quality_reason || "继续保持这个节奏。")}</span>`
    : `<strong>回答错误：你选了 ${escapeHtml(selected)}. ${escapeHtml(selectedText)}</strong><span>正确答案：${escapeHtml(question.answer)}. ${escapeHtml(answerText)}<br>${escapeHtml(reason)}${memory ? `<br>${escapeHtml(memory)}` : ""}${confidence ? `<br>${escapeHtml(confidence)}` : ""}</span>`;
}

function updateStats() {
  const currentRecords = state.all.map((question) => state.progress[question.id]).filter(Boolean);
  elements.statCorrect.textContent = currentRecords.filter((item) => item.correct).length;
  elements.statWrong.textContent = currentRecords.filter((item) => item.wrong).length;
  elements.statDone.textContent = currentRecords.filter((item) => item.selected).length;
  elements.statTotal.textContent = state.all.length;
}

function updateWrongTools() {
  const wrongItems = wrongQuestions();
  const visible = state.filterMode === "wrong";
  elements.wrongTools.classList.toggle("hidden", !visible);
  if (!visible) return;

  const count = wrongItems.length;
  elements.wrongToolCount.textContent = `${count} 题`;
  elements.exportWrongImage.disabled = count === 0;
  elements.wrongToolHint.textContent = count
    ? `将导出“${TRAINING_MODES[state.trainingMode].title}”下全部错题，彩色标记你的选择和正确选项。`
    : "当前训练强度还没有错题，答错后这里就能导出长图。";
}

function wrongQuestions() {
  return state.all
    .map((question) => ({ question, record: state.progress[question.id] }))
    .filter((item) => item.record?.wrong);
}

function exportWrongImage() {
  const wrongItems = wrongQuestions();
  if (!wrongItems.length) return;

  const config = TRAINING_MODES[state.trainingMode];
  const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  const width = 960;
  const padding = 42;
  const contentWidth = width - padding * 2;
  const blockGap = 24;
  const titleFont = "700 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif";
  const metaFont = "700 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif";
  const bodyFont = "400 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif";
  const smallFont = "400 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif";
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const blocks = wrongItems.map((item, index) => buildWrongExportBlock(item.question, item.record, index + 1, context, contentWidth, {
    bodyFont,
    smallFont,
  }));
  const contentHeight = blocks.reduce((total, block) => total + block.height + blockGap, 0);
  const height = Math.max(360, padding * 2 + 96 + contentHeight);

  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.scale(scale, scale);
  context.fillStyle = "#f4f7fa";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#152033";
  context.font = titleFont;
  context.fillText(`${config.title} · 错题长图`, padding, padding + 34);
  context.fillStyle = "#68778c";
  context.font = smallFont;
  context.fillText(`共 ${wrongItems.length} 题 · ${new Date().toLocaleString("zh-CN", { hour12: false })}`, padding, padding + 72);

  let y = padding + 112;
  blocks.forEach((block) => {
    drawRoundedRect(context, padding, y, contentWidth, block.height, 12, "#ffffff");
    drawWrappedLines(context, block.metaLines, padding + 22, y + 28, metaFont, "#128575", 26);
    let innerY = y + 64;
    drawWrappedLines(context, block.questionLines, padding + 22, innerY, bodyFont, "#152033", 32);
    innerY += block.questionLines.length * 32 + 16;
    block.optionBlocks.forEach((optionBlock) => {
      drawRoundedRect(context, padding + 22, innerY, contentWidth - 44, optionBlock.height, 10, optionBlock.background);
      drawWrappedLines(context, optionBlock.lines, padding + 40, innerY + 28, smallFont, optionBlock.color, 26);
      innerY += optionBlock.height + 10;
    });
    innerY += 8;
    drawWrappedLines(context, block.reasonLines, padding + 22, innerY, smallFont, "#68778c", 26);
    innerY += block.reasonLines.length * 26 + 8;
    if (block.memoryLines.length) drawWrappedLines(context, block.memoryLines, padding + 22, innerY, smallFont, "#8a5a00", 26);
    y += block.height + blockGap;
  });

  const link = document.createElement("a");
  link.download = `${config.title}-错题长图.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function buildWrongExportBlock(question, record, index, context, width, fonts) {
  const reason = question.pitfall || question.quality_reason || TRAINING_MODES[state.trainingMode].noAnalysisText;
  const memory = question.memory_tip || "暂无记忆提示。";
  const meta = `#${index} · 原第 ${question.order} 题 · ${question.category || "未分类"}`;
  const questionText = `题干：${question.question}`;
  const textWidth = width - 44;
  const optionWidth = width - 80;
  const metaLines = wrapCanvasText(context, meta, textWidth, fonts.smallFont);
  const questionLines = wrapCanvasText(context, questionText, textWidth, fonts.bodyFont);
  const optionBlocks = Object.entries(question.options || {}).map(([key, value]) => {
    const isCorrect = key === question.answer;
    const isWrongSelected = key === record.selected && key !== question.answer;
    const marker = isCorrect ? "正确" : isWrongSelected ? "你的选择" : "";
    const label = marker ? `${key}. ${optionText(value)}  ${marker}` : `${key}. ${optionText(value)}`;
    const lines = wrapCanvasText(context, label, optionWidth, fonts.smallFont);
    return {
      lines,
      height: 18 + lines.length * 26,
      background: isCorrect ? "#e9f8ef" : isWrongSelected ? "#fff1ee" : "#f4f7fa",
      color: isCorrect ? "#147a43" : isWrongSelected ? "#b42318" : "#152033",
    };
  });
  const reasonLines = wrapCanvasText(context, `解析：${reason}`, textWidth, fonts.smallFont);
  const memoryLines = wrapCanvasText(context, `记忆提示：${memory}`, textWidth, fonts.smallFont);
  const optionsHeight = optionBlocks.reduce((total, block) => total + block.height + 10, 0);
  const height =
    104 +
    questionLines.length * 32 +
    optionsHeight +
    reasonLines.length * 26 +
    memoryLines.length * 26 +
    36;
  return { metaLines, questionLines, optionBlocks, reasonLines, memoryLines, height };
}

function wrapCanvasText(context, text, maxWidth, font) {
  context.font = font;
  return String(text || "")
    .split("\n")
    .flatMap((line) => {
      const chars = Array.from(line);
      const lines = [];
      let current = "";
      chars.forEach((char) => {
        const next = current + char;
        if (context.measureText(next).width > maxWidth && current) {
          lines.push(current);
          current = char;
        } else {
          current = next;
        }
      });
      lines.push(current || " ");
      return lines;
    });
}

function drawWrappedLines(context, lines, x, y, font, color, lineHeight) {
  context.font = font;
  context.fillStyle = color;
  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight);
  });
}

function drawRoundedRect(context, x, y, width, height, radius, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
  context.fill();
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
    const stored = JSON.parse(localStorage.getItem(GLOBAL_PROGRESS_KEY) || "{}");
    const migrated = migrateLegacyProgress(stored);
    if (migrated.changed) localStorage.setItem(GLOBAL_PROGRESS_KEY, JSON.stringify(migrated.progress));
    return migrated.progress;
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(GLOBAL_PROGRESS_KEY, JSON.stringify(state.progress));
}

async function refreshBookmarkCounts() {
  try {
    const response = await fetch("/api/bookmarks");
    if (!response.ok) return;
    const data = await response.json();
    if (!data.ok || !Array.isArray(data.bookmarks)) return;
    state.bookmarkCounts = Object.fromEntries(
      data.bookmarks.map((item) => [String(item.source_id), Number(item.bookmark_count || 0)]),
    );
    state.bookmarkCountsLoaded = true;
    renderQuestion();
  } catch {
    state.bookmarkCountsLoaded = false;
  }
}

function bookmarkCountText(sourceId) {
  if (!state.bookmarkCountsLoaded) return "收藏数 --";
  return `收藏数 ${state.bookmarkCounts[String(sourceId)] || 0}`;
}

function adjustBookmarkCount(sourceId, delta) {
  if (!state.bookmarkCountsLoaded) return;
  const key = String(sourceId);
  state.bookmarkCounts[key] = Math.max((state.bookmarkCounts[key] || 0) + delta, 0);
}

function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (sessionId) return sessionId;
  sessionId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

function questionTelemetryPayload(question) {
  return {
    session_id: getSessionId(),
    source_id: question.id,
    mode: state.trainingMode,
    question_order: question.order,
    category: question.category || "",
    knowledge_point: question.knowledge_point || "",
    question_text: question.question || "",
    answer: question.answer || "",
    answer_text: question.options?.[question.answer] || "",
  };
}

function trackAnswer(question, record) {
  sendTelemetry("/api/answer", {
    ...questionTelemetryPayload(question),
    selected: record.selected,
    selected_text: question.options?.[record.selected] || "",
    correct: Boolean(record.correct),
  });
}

function trackBookmark(question, bookmarked) {
  sendTelemetry("/api/bookmark", {
    ...questionTelemetryPayload(question),
    bookmarked: Boolean(bookmarked),
  });
}

function sendTelemetry(url, payload) {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    if (sent) return;
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function migrateLegacyProgress(progress) {
  if (localStorage.getItem(LEGACY_MIGRATION_KEY) === "done") return { progress, changed: false };
  let changed = false;
  const next = { ...(progress || {}) };
  for (const [mode, key] of Object.entries(LEGACY_PROGRESS_KEYS)) {
    let legacy = {};
    try {
      legacy = JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      legacy = {};
    }

    for (const [legacyId, record] of Object.entries(legacy)) {
      if (!record || typeof record !== "object") continue;
      const sourceId = normalizeLegacyProgressId(legacyId);
      if (!sourceId) continue;
      const existing = next[sourceId] || {};
      const touchedInMode = Boolean(record.selected || record.correct || record.wrong || record.bookmarked);
      const preferred = newerProgressRecord(existing, record);
      next[sourceId] = {
        ...preferred,
        modes: { ...(existing.modes || {}), ...(record.modes || {}), [mode]: touchedInMode },
      };
      changed = true;
    }
  }
  localStorage.setItem(LEGACY_MIGRATION_KEY, "done");
  return { progress: next, changed };
}

function normalizeLegacyProgressId(id) {
  const value = String(id || "");
  const match = value.match(/^(?:full|refined|ultra)-(.+)$/);
  return match ? match[1] : value;
}

function newerProgressRecord(existing, incoming) {
  if (!existing.selected) return { ...existing, ...incoming };
  if (!incoming.selected) return existing;
  const existingTime = Date.parse(existing.lastAnsweredAt || "") || 0;
  const incomingTime = Date.parse(incoming.lastAnsweredAt || "") || 0;
  return incomingTime >= existingTime ? { ...existing, ...incoming } : existing;
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

function optionText(value) {
  const text = String(value ?? "");
  if (!elements.hideOptionHints.checked) return text;
  return text
    .replace(/（[^（）]*）/g, "")
    .replace(/\([^()]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
