export const WORKER_URL = '';

export interface LeaderboardEntry {
  handle: string;
  score: number;
  level: number;
  created_at: string;
}

export interface GhostSnapshot {
  t: number;   // elapsed seconds
  x: number;   // player x position
  y: number;   // player y (jump height)
  d: number;   // isDucking 0|1
}

export interface GhostRun {
  handle: string;
  score: number;
  snapshots: GhostSnapshot[];
}

// ── Score ─────────────────────────────────────────────────────────────────────
export async function submitScore(handle: string, score: number, level: number): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, score, level }),
    });
  } catch (e) { console.error('submitScore:', e); }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${WORKER_URL}/leaderboard`);
    return await res.json();
  } catch (e) { console.error('fetchLeaderboard:', e); return []; }
}

// ── Presence ──────────────────────────────────────────────────────────────────
export async function pingPresence(sessionId: string): Promise<number> {
  try {
    const res = await fetch(`${WORKER_URL}/presence/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json() as { count: number };
    return data.count ?? 0;
  } catch (e) { return 0; }
}

export async function leavePresence(sessionId: string): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/presence/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch (e) {}
}

// ── Ghosts ────────────────────────────────────────────────────────────────────
export async function submitGhost(handle: string, level: number, snapshots: GhostSnapshot[], score: number): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/ghost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, level, snapshots, score }),
    });
  } catch (e) { console.error('submitGhost:', e); }
}

export async function fetchGhosts(level: number): Promise<GhostRun[]> {
  try {
    const res = await fetch(`${WORKER_URL}/ghost?level=${level}`);
    const rows = await res.json() as { handle: string; score: number; snapshots: string }[];
    return rows.map(r => ({
      handle: r.handle,
      score: r.score,
      snapshots: JSON.parse(r.snapshots) as GhostSnapshot[],
    }));
  } catch (e) { return []; }
}
