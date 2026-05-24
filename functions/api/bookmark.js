const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: true, stored: false, reason: "D1 binding missing" }, 202);

  const payload = await readJson(request);
  const normalized = normalizeBookmark(payload);
  if (!normalized) return json({ ok: false, error: "invalid_payload" }, 400);

  const previous = await env.DB.prepare(
    `SELECT active FROM bookmark_events WHERE session_id = ? AND source_id = ? AND mode = ?`,
  )
    .bind(normalized.session_id, normalized.source_id, normalized.mode)
    .first();

  const previousActive = previous ? Number(previous.active) === 1 : false;
  const nextActive = normalized.bookmarked;
  const delta = previous ? (previousActive === nextActive ? 0 : nextActive ? 1 : -1) : nextActive ? 1 : 0;

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO bookmark_events
        (session_id, source_id, mode, active, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_id, source_id, mode) DO UPDATE SET
         active = excluded.active,
         updated_at = excluded.updated_at`,
    ).bind(normalized.session_id, normalized.source_id, normalized.mode, nextActive ? 1 : 0, normalized.now),
    env.DB.prepare(
      `INSERT INTO question_stats
        (source_id, mode, question_order, category, knowledge_point, question_text, answer, answer_text,
         total_attempts, correct_count, wrong_count, bookmark_count, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?)
       ON CONFLICT(source_id, mode) DO UPDATE SET
         question_order = excluded.question_order,
         category = excluded.category,
         knowledge_point = excluded.knowledge_point,
         question_text = excluded.question_text,
         answer = excluded.answer,
         answer_text = excluded.answer_text,
         bookmark_count = max(bookmark_count + ?, 0),
         last_seen = excluded.last_seen`,
    ).bind(
      normalized.source_id,
      normalized.mode,
      normalized.question_order,
      normalized.category,
      normalized.knowledge_point,
      normalized.question_text,
      normalized.answer,
      normalized.answer_text,
      Math.max(delta, 0),
      normalized.now,
      normalized.now,
      delta,
    ),
  ]);

  return json({ ok: true, stored: true, delta });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeBookmark(payload) {
  if (!payload || typeof payload !== "object") return null;
  const session_id = clean(payload.session_id, 80);
  const source_id = clean(payload.source_id, 80);
  const mode = clean(payload.mode, 24);
  if (!session_id || !source_id || !mode) return null;
  return {
    session_id,
    source_id,
    mode,
    bookmarked: Boolean(payload.bookmarked),
    question_order: Number.isFinite(Number(payload.question_order)) ? Number(payload.question_order) : null,
    category: clean(payload.category, 120),
    knowledge_point: clean(payload.knowledge_point, 160),
    question_text: clean(payload.question_text, 800),
    answer: clean(payload.answer, 4).toUpperCase(),
    answer_text: clean(payload.answer_text, 300),
    now: new Date().toISOString(),
  };
}

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
