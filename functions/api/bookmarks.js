const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders });
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ok: true, bookmarks: [] }, 202);

  const result = await env.DB.prepare(
    `SELECT source_id, count(DISTINCT session_id) AS bookmark_count
     FROM bookmark_events
     WHERE active = 1
     GROUP BY source_id
     ORDER BY bookmark_count DESC`,
  ).all();

  return json({
    ok: true,
    bookmarks: result.results || [],
    generated_at: new Date().toISOString(),
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
