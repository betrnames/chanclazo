export const WORKER_URL = 'https://chanclazo-worker.betrnames.workers.dev';

export async function submitScore(handle: string, score: number, level: number): Promise<void> {
  try {
    await fetch(`${WORKER_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, score, level }),
    });
  } catch (e) {
    console.error('Failed to submit score:', e);
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${WORKER_URL}/leaderboard`);
    return await res.json();
  } catch (e) {
    console.error('Failed to fetch leaderboard:', e);
    return [];
  }
}

export interface LeaderboardEntry {
  handle: string;
  score: number;
  level: number;
  created_at: string;
}
