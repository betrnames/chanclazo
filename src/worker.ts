// ─── Chanclazo Cloudflare Worker (D1 + KV-less presence via D1) ──────────────
// Handles: /score, /leaderboard, /ghost, /presence/ping, /presence/leave
// All state stored in D1. Assets served automatically by wrangler [assets].

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

// Allowlist for custom domain + local dev (since now on chanclazo.com Netlify DNS + proxy)
const ALLOWED_ORIGINS = [
  'https://chanclazo.com',
  'https://www.chanclazo.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

function getCorsHeaders(origin: string | null): HeadersInit {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status = 200, origin: string | null = null): Response {
  const cors = getCorsHeaders(origin);
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const cors = getCorsHeaders(origin);
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── Bootstrap tables on first request ───────────────────────────────
      await ensureTables(env.DB);

      // ── POST /score ─────────────────────────────────────────────────────
      if (path === '/score' && request.method === 'POST') {
        const { handle, score, level } = await request.json() as {
          handle: string; score: number; level: number;
        };
        if (!handle || typeof score !== 'number') {
          return json({ error: 'missing handle or score' }, 400, origin);
        }
        await env.DB.prepare(
          'INSERT INTO scores (handle, score, level) VALUES (?, ?, ?)'
        ).bind(handle, Math.floor(score), level || 1).run();
        return json({ ok: true }, 200, origin);
      }

      // ── GET /leaderboard ────────────────────────────────────────────────
      if (path === '/leaderboard' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT handle, MAX(score) as score, level, created_at FROM scores GROUP BY handle ORDER BY score DESC LIMIT 50'
        ).all();
        return json(results || [], 200, origin);
      }

      // ── POST /ghost ─────────────────────────────────────────────────────
      if (path === '/ghost' && request.method === 'POST') {
        const { handle, level, snapshots, score } = await request.json() as {
          handle: string; level: number; snapshots: unknown[]; score: number;
        };
        if (!handle || !snapshots) {
          return json({ error: 'missing data' }, 400, origin);
        }
        // Keep only top 3 ghosts per level
        const existing = await env.DB.prepare(
          'SELECT id, score FROM ghosts WHERE level = ? ORDER BY score DESC'
        ).bind(level || 1).all();
        if ((existing.results?.length || 0) >= 3) {
          const lowest = existing.results![existing.results!.length - 1] as { id: number; score: number };
          if (score <= lowest.score) {
            return json({ ok: true, kept: false }, 200, origin);
          }
          await env.DB.prepare('DELETE FROM ghosts WHERE id = ?').bind(lowest.id).run();
        }
        await env.DB.prepare(
          'INSERT INTO ghosts (handle, level, score, snapshots) VALUES (?, ?, ?, ?)'
        ).bind(handle, level || 1, Math.floor(score), JSON.stringify(snapshots)).run();
        return json({ ok: true, kept: true }, 200, origin);
      }

      // ── GET /ghost?level=N ────────────────────────────────────────────
      if (path === '/ghost' && request.method === 'GET') {
        const level = parseInt(url.searchParams.get('level') || '1');
        const { results } = await env.DB.prepare(
          'SELECT handle, score, snapshots FROM ghosts WHERE level = ? ORDER BY score DESC LIMIT 3'
        ).bind(level).all();
        return json(results || [], 200, origin);
      }

      // ── POST /presence/ping ─────────────────────────────────────────────
      if (path === '/presence/ping' && request.method === 'POST') {
        const { sessionId } = await request.json() as { sessionId: string };
        if (!sessionId) return json({ count: 0 }, 200, origin);
        const now = Date.now();
        await env.DB.prepare(
          'INSERT OR REPLACE INTO presence (session_id, last_seen) VALUES (?, ?)'
        ).bind(sessionId, now).run();
        // Clean stale sessions (>30s old)
        await env.DB.prepare(
          'DELETE FROM presence WHERE last_seen < ?'
        ).bind(now - 30000).run();
        const countResult = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM presence'
        ).first() as { count: number } | null;
        return json({ count: countResult?.count || 0 }, 200, origin);
      }

      // ── POST /presence/leave ────────────────────────────────────────────
      if (path === '/presence/leave' && request.method === 'POST') {
        const { sessionId } = await request.json() as { sessionId: string };
        if (sessionId) {
          await env.DB.prepare(
            'DELETE FROM presence WHERE session_id = ?'
          ).bind(sessionId).run();
        }
        return json({ ok: true }, 200, origin);
      }

      // ── Fallback: pass through to static assets ──────────────────────────
      return env.ASSETS.fetch(request);

    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'internal error' }, 500, origin);
    }
  },
};

// ─── Auto-create tables ───────────────────────────────────────────────────────
let tablesReady = false;
async function ensureTables(db: D1Database): Promise<void> {
  if (tablesReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle TEXT NOT NULL,
      score INTEGER NOT NULL,
      level INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ghosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      score INTEGER NOT NULL,
      snapshots TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS presence (
      session_id TEXT PRIMARY KEY,
      last_seen INTEGER NOT NULL
    )`),
  ]);
  tablesReady = true;
}
