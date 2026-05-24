const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders });
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "D1 binding missing" }, 500);
  if (!isAuthorized(request, env)) return json({ ok: false, error: "unauthorized" }, 401);

  const url = new URL(request.url);
  const mode = clean(url.searchParams.get("mode"), 24);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 5), 100);
  const where = mode && mode !== "all" ? "WHERE mode = ?" : "";
  const bindMode = (statement) => (where ? statement.bind(mode, limit) : statement.bind(limit));
  const bindModeNoLimit = (statement) => (where ? statement.bind(mode) : statement);

  const summaryQuery = env.DB.prepare(
    `SELECT
       coalesce(sum(total_attempts), 0) AS total_attempts,
       coalesce(sum(correct_count), 0) AS correct_count,
       coalesce(sum(wrong_count), 0) AS wrong_count,
       coalesce(sum(bookmark_count), 0) AS bookmark_count,
       count(*) AS question_count
     FROM question_stats ${where}`,
  );
  const summary = await bindModeNoLimit(summaryQuery).first();

  const topWrongQuery = env.DB.prepare(
    `SELECT
       source_id,
       group_concat(DISTINCT mode) AS modes,
       min(question_order) AS question_order,
       max(category) AS category,
       max(knowledge_point) AS knowledge_point,
       max(question_text) AS question_text,
       max(answer) AS answer,
       max(answer_text) AS answer_text,
       sum(total_attempts) AS total_attempts,
       sum(correct_count) AS correct_count,
       sum(wrong_count) AS wrong_count,
       sum(bookmark_count) AS bookmark_count,
       round(100.0 * sum(wrong_count) / nullif(sum(total_attempts), 0), 1) AS wrong_rate
     FROM question_stats
     ${where}
     GROUP BY source_id
     HAVING sum(total_attempts) > 0
     ORDER BY wrong_rate DESC, wrong_count DESC, total_attempts DESC
     LIMIT ?`,
  );
  const topWrong = await bindMode(topWrongQuery).all();

  const topBookmarkedQuery = env.DB.prepare(
    `SELECT
       source_id,
       group_concat(DISTINCT mode) AS modes,
       min(question_order) AS question_order,
       max(category) AS category,
       max(knowledge_point) AS knowledge_point,
       max(question_text) AS question_text,
       max(answer) AS answer,
       max(answer_text) AS answer_text,
       sum(total_attempts) AS total_attempts,
       sum(wrong_count) AS wrong_count,
       sum(bookmark_count) AS bookmark_count
     FROM question_stats
     ${where}
     GROUP BY source_id
     HAVING sum(bookmark_count) > 0
     ORDER BY bookmark_count DESC, wrong_count DESC
     LIMIT ?`,
  );
  const topBookmarked = await bindMode(topBookmarkedQuery).all();

  const categoryQuery = env.DB.prepare(
    `SELECT
       coalesce(nullif(category, ''), '未分类') AS category,
       sum(total_attempts) AS total_attempts,
       sum(correct_count) AS correct_count,
       sum(wrong_count) AS wrong_count,
       sum(bookmark_count) AS bookmark_count,
       round(100.0 * sum(wrong_count) / nullif(sum(total_attempts), 0), 1) AS wrong_rate
     FROM question_stats
     ${where}
     GROUP BY coalesce(nullif(category, ''), '未分类')
     ORDER BY wrong_count DESC, total_attempts DESC
     LIMIT ?`,
  );
  const categoryStats = await bindMode(categoryQuery).all();

  return json({
    ok: true,
    mode: mode || "all",
    summary,
    top_wrong: topWrong.results || [],
    top_bookmarked: topBookmarked.results || [],
    category_stats: categoryStats.results || [],
    generated_at: new Date().toISOString(),
  });
}

function isAuthorized(request, env) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token && token === expected;
}

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
