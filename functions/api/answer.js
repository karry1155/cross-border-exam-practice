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
  const normalized = normalizeAnswer(payload);
  if (!normalized) return json({ ok: false, error: "invalid_payload" }, 400);

  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO answer_events
      (session_id, source_id, mode, selected, selected_text, answer, answer_text, correct, answered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      normalized.session_id,
      normalized.source_id,
      normalized.mode,
      normalized.selected,
      normalized.selected_text,
      normalized.answer,
      normalized.answer_text,
      normalized.correct ? 1 : 0,
      normalized.now,
    )
    .run();

  if ((inserted.meta?.changes || 0) < 1) {
    return json({ ok: true, stored: false, duplicate: true });
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO question_stats
        (source_id, mode, question_order, category, knowledge_point, question_text, answer, answer_text,
         total_attempts, correct_count, wrong_count, bookmark_count, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?)
       ON CONFLICT(source_id, mode) DO UPDATE SET
         question_order = excluded.question_order,
         category = excluded.category,
         knowledge_point = excluded.knowledge_point,
         question_text = excluded.question_text,
         answer = excluded.answer,
         answer_text = excluded.answer_text,
         total_attempts = total_attempts + 1,
         correct_count = correct_count + excluded.correct_count,
         wrong_count = wrong_count + excluded.wrong_count,
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
      normalized.correct ? 1 : 0,
      normalized.correct ? 0 : 1,
      normalized.now,
      normalized.now,
    ),
    env.DB.prepare(
      `INSERT INTO option_stats
        (source_id, mode, option_key, option_text, chosen_count, wrong_chosen_count, last_seen)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(source_id, mode, option_key) DO UPDATE SET
         option_text = excluded.option_text,
         chosen_count = chosen_count + 1,
         wrong_chosen_count = wrong_chosen_count + excluded.wrong_chosen_count,
         last_seen = excluded.last_seen`,
    ).bind(
      normalized.source_id,
      normalized.mode,
      normalized.selected,
      normalized.selected_text,
      normalized.correct ? 0 : 1,
      normalized.now,
    ),
  ]);

  return json({ ok: true, stored: true });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function normalizeAnswer(payload) {
  if (!payload || typeof payload !== "object") return null;
  const session_id = clean(payload.session_id, 80);
  const source_id = clean(payload.source_id, 80);
  const mode = clean(payload.mode, 24);
  const selected = clean(payload.selected, 4).toUpperCase();
  const answer = clean(payload.answer, 4).toUpperCase();
  if (!session_id || !source_id || !mode || !selected || !answer) return null;
  return {
    session_id,
    source_id,
    mode,
    selected,
    answer,
    selected_text: clean(payload.selected_text, 300),
    answer_text: clean(payload.answer_text, 300),
    question_order: Number.isFinite(Number(payload.question_order)) ? Number(payload.question_order) : null,
    category: clean(payload.category, 120),
    knowledge_point: clean(payload.knowledge_point, 160),
    question_text: clean(payload.question_text, 800),
    correct: Boolean(payload.correct),
    now: new Date().toISOString(),
  };
}

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
