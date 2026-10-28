// Shared leaderboard panel for the end screen. Uses /api/leaderboard (Pages Function + D1)
// and falls back to a local-only board saved in this browser when the API is unavailable.
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
const SITE = 'https://chanclazo.com';
type Entry = { handle: string; score: number; level: number };
export const cleanHandle = (s: string) => s.replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
const lkey = (g: string) => `chanclazo-lb-${g}`;
const local = (g: string): Entry[] => { try { return JSON.parse(localStorage.getItem(lkey(g)) || '[]'); } catch { return []; } };
function saveLocal(g: string, e: Entry) {
  const m = new Map<string, Entry>(); for (const x of [...local(g), e]) { const p = m.get(x.handle); if (!p || x.score > p.score) m.set(x.handle, x); }
  const arr = [...m.values()].sort((a, b) => b.score - a.score).slice(0, 20); localStorage.setItem(lkey(g), JSON.stringify(arr)); return arr;
}
async function fetchGlobal(g: string): Promise<Entry[] | null> {
  try { const r = await fetch(`/api/leaderboard?game=${g}`); if (!r.ok) return null; const d = await r.json(); return Array.isArray(d) ? d : null; } catch { return null; }
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const css = `.lb{margin:12px 0;text-align:left;background:#7a1f4f;border-radius:12px;padding:10px 12px;font-size:13px}
.lb h3{margin:0 0 6px;font-size:15px;color:#ffd23f;display:flex;justify-content:space-between;align-items:baseline}
.lb h3 small{font-size:10px;opacity:.75;font-weight:700;color:#f3e9d2}
.lb .row{display:flex;gap:6px;margin-bottom:8px}.lb .tag{display:flex;flex:1;align-items:center;background:#fff;border-radius:10px;color:#2a0a00;font-weight:800;padding:0 8px}
.lb input{flex:1;min-width:0;border:0;outline:0;font:inherit;font-weight:800;padding:8px 2px;background:transparent;color:#2a0a00}
.lb button.save{font-size:14px!important;padding:8px 12px!important;box-shadow:none!important;border-width:2px!important}
.lb ol{margin:0;padding-left:22px;max-height:150px;overflow:auto}.lb li{padding:2px 0}.lb li b{float:right}
.lb .err{color:#ff8fa3;font-size:12px;min-height:14px}.lb a.x{display:inline-block;margin-top:8px;background:#3b1a5c;color:#fff;border:2px solid #fff;border-radius:12px;padding:7px 12px;font-weight:900;text-decoration:none}`;

export function showLeaderboard(game: string, gameName: string, score: number, level: number, path: string) {
  if (!document.getElementById('lb-css')) { const s = document.createElement('style'); s.id = 'lb-css'; s.textContent = css; document.head.appendChild(s); }
  const host = document.querySelector('#end .card') as HTMLElement; if (!host) return;
  let box = host.querySelector('.lb') as HTMLElement | null;
  if (!box) { box = document.createElement('div'); box.className = 'lb'; host.insertBefore(box, host.querySelector('#again')); }
  const saved = localStorage.getItem('chanclazo-handle') || '';
  const text = `I scored ${score.toLocaleString('en-US')} in ${gameName} (level ${level}) on Chanclazo! Can you beat me? #Chanclazo`;
  const share = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE + path)}`;
  box.innerHTML = `<h3>Leaderboard <small class="mode">loading…</small></h3>
  <div class="row"><label class="tag">@<input maxlength="15" placeholder="your X handle" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(cleanHandle(saved))}" aria-label="Your X handle"/></label><button class="save" type="button">Save score</button></div>
  <div class="err"></div><ol></ol>
  <a class="x" href="${share}" target="_blank" rel="noopener noreferrer">Share on X</a>`;
  const input = box.querySelector('input')!, err = box.querySelector('.err')!, ol = box.querySelector('ol')!, mode = box.querySelector('.mode')!, btn = box.querySelector('.save') as HTMLButtonElement;
  const render = (list: Entry[], global: boolean) => {
    mode.textContent = global ? 'Global' : 'This device only';
    ol.innerHTML = list.length ? list.slice(0, 10).map((e) => `<li>@${esc(cleanHandle(e.handle))}<b>${Number(e.score).toLocaleString('en-US')}</b></li>`).join('') : '<li style="list-style:none;margin-left:-22px;opacity:.75">No scores yet. Be the first!</li>';
  };
  input.addEventListener('input', () => { const c = cleanHandle(input.value); if (c !== input.value) input.value = c; err.textContent = ''; });
  fetchGlobal(game).then((g) => render(g ?? local(game), !!g));
  btn.onclick = async () => {
    const h = cleanHandle(input.value);
    if (!HANDLE_RE.test(h)) { err.textContent = 'Use 1 to 15 letters, numbers, or underscores.'; return; }
    localStorage.setItem('chanclazo-handle', h); btn.disabled = true; btn.textContent = 'Saved';
    const entry = { handle: h, score, level };
    let ok = false;
    try { const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game, ...entry }) }); ok = r.ok; } catch { /* offline */ }
    const g = ok ? await fetchGlobal(game) : null;
    render(g ?? saveLocal(game, entry), !!g);
  };
}

/** Remove the leaderboard / X handle / Share on X box (used on mid-run level-clear screens). */
export function hideLeaderboard() { document.querySelector('#end .card .lb')?.remove(); }
