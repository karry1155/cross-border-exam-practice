const elements = {
  token: document.getElementById("adminToken"),
  mode: document.getElementById("analyticsMode"),
  load: document.getElementById("loadAnalytics"),
  status: document.getElementById("analyticsStatus"),
  sumAttempts: document.getElementById("sumAttempts"),
  sumWrong: document.getElementById("sumWrong"),
  sumRate: document.getElementById("sumRate"),
  sumBookmark: document.getElementById("sumBookmark"),
  wrongList: document.getElementById("wrongList"),
  bookmarkList: document.getElementById("bookmarkList"),
  categoryList: document.getElementById("categoryList"),
};

const TOKEN_KEY = "ec_exam_admin_token_v1";

elements.token.value = sessionStorage.getItem(TOKEN_KEY) || "";
elements.load.addEventListener("click", loadAnalytics);
elements.token.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadAnalytics();
});

async function loadAnalytics() {
  const token = elements.token.value.trim();
  if (!token) {
    setStatus("先输入后台口令。", true);
    return;
  }

  sessionStorage.setItem(TOKEN_KEY, token);
  setStatus("正在读取云端统计...");
  elements.load.disabled = true;

  try {
    const response = await fetch(`/api/analytics?mode=${encodeURIComponent(elements.mode.value)}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await readJsonResponse(response);
    if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
    renderAnalytics(data);
    setStatus(`已更新：${new Date(data.generated_at).toLocaleString("zh-CN", { hour12: false })}`);
  } catch (error) {
    renderAnalytics(null);
    setStatus(error.message === "unauthorized" ? "口令不对，或者 Cloudflare 还没有设置 ADMIN_TOKEN。" : `读取失败：${error.message}`, true);
  } finally {
    elements.load.disabled = false;
  }
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    if (response.status === 404) throw new Error("当前预览服务没有云端统计接口，发布到 Cloudflare Pages 并绑定 D1 后可读取。");
    throw new Error(text || `HTTP ${response.status}`);
  }
}

function renderAnalytics(data) {
  const summary = data?.summary || {};
  const attempts = Number(summary.total_attempts || 0);
  const wrong = Number(summary.wrong_count || 0);
  const bookmark = Number(summary.bookmark_count || 0);
  elements.sumAttempts.textContent = formatNumber(attempts);
  elements.sumWrong.textContent = formatNumber(wrong);
  elements.sumRate.textContent = attempts ? `${((wrong / attempts) * 100).toFixed(1)}%` : "0%";
  elements.sumBookmark.textContent = formatNumber(bookmark);
  renderQuestionList(elements.wrongList, data?.top_wrong || [], "wrong");
  renderQuestionList(elements.bookmarkList, data?.top_bookmarked || [], "bookmark");
  renderCategoryList(data?.category_stats || []);
}

function renderQuestionList(container, items, type) {
  if (!items.length) {
    container.innerHTML = `<div class="analytics-empty">还没有统计数据。</div>`;
    return;
  }
  container.innerHTML = items
    .map((item, index) => {
      const attempts = Number(item.total_attempts || 0);
      const wrong = Number(item.wrong_count || 0);
      const wrongRate = attempts ? `${((wrong / attempts) * 100).toFixed(1)}%` : "0%";
      const headline =
        type === "wrong"
          ? `错率 ${escapeHtml(item.wrong_rate || wrongRate)} · 错 ${formatNumber(wrong)} / 做 ${formatNumber(attempts)}`
          : `收藏 ${formatNumber(item.bookmark_count || 0)} · 错 ${formatNumber(wrong)} / 做 ${formatNumber(attempts)}`;
      return `
        <div class="analytics-item">
          <div class="analytics-rank">${index + 1}</div>
          <div>
            <strong>${headline}</strong>
            <p>${escapeHtml(item.question_text || "未记录题干")}</p>
            <small>${escapeHtml(item.category || "未分类")} · ${escapeHtml(item.knowledge_point || "综合考点")} · 答案 ${escapeHtml(item.answer || "")}. ${escapeHtml(item.answer_text || "")}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderCategoryList(items) {
  if (!items.length) {
    elements.categoryList.innerHTML = `<div class="analytics-empty">还没有分类统计。</div>`;
    return;
  }
  elements.categoryList.innerHTML = `
    <div class="analytics-row header">
      <span>分类</span><span>作答</span><span>错误</span><span>错率</span><span>收藏</span>
    </div>
    ${items
      .map((item) => {
        const attempts = Number(item.total_attempts || 0);
        const wrong = Number(item.wrong_count || 0);
        const wrongRate = attempts ? `${((wrong / attempts) * 100).toFixed(1)}%` : "0%";
        return `
          <div class="analytics-row">
            <span>${escapeHtml(item.category || "未分类")}</span>
            <span>${formatNumber(attempts)}</span>
            <span>${formatNumber(wrong)}</span>
            <span>${escapeHtml(item.wrong_rate || wrongRate)}</span>
            <span>${formatNumber(item.bookmark_count || 0)}</span>
          </div>
        `;
      })
      .join("")}
  `;
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
