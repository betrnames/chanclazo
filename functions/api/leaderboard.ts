// Cloudflare Pages Function: GET/POST /api/leaderboard?game=match|fling
// Needs a D1 binding named DB (e.g. the original "chanclazo-leaderboard" database).
// Without the binding it answers 503 and the client falls back to a local-only board.
interface Env { DB?: any }
const GAMES = new Set(['match', 'fling']);
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const j = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
async function ensure(db: any) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS game_scores (id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT NOT NULL, handle TEXT NOT NULL, score INTEGER NOT NULL, level INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
}
export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  if (!env.DB) return j({ error: 'leaderboard storage not configured' }, 503);
  const game = new URL(request.url).searchParams.get('game') || '';
  if (!GAMES.has(game)) return j({ error: 'bad game' }, 400);
  await ensure(env.DB);
  const { results } = await env.DB.prepare('SELECT handle, MAX(score) AS score, MAX(level) AS level FROM game_scores WHERE game = ? GROUP BY handle ORDER BY score DESC LIMIT 20').bind(game).all();
  return j(results || []);
};
export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  if (!env.DB) return j({ error: 'leaderboard storage not configured' }, 503);
  let b: any; try { b = await request.json(); } catch { return j({ error: 'bad json' }, 400); }
  const handle = String(b?.handle || '').replace(/^@/, '');
  const score = Math.floor(Number(b?.score)); const level = Math.floor(Number(b?.level) || 1);
  if (!GAMES.has(b?.game) || !HANDLE.test(handle) || !Number.isFinite(score) || score < 0 || score > 10_000_000 || level < 1 || level > 99) return j({ error: 'invalid' }, 400);
  await ensure(env.DB);
  await env.DB.prepare('INSERT INTO game_scores (game, handle, score, level) VALUES (?, ?, ?, ?)').bind(b.game, handle, score, level).run();
  return j({ ok: true });
};
