/** Google Analytics 4 via gtag.js. Loads only when VITE_GA_ID is set at build time. Cookie-light; no monetization. */
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() || '';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/index.html': 'Home',
  '/fling': 'Chancla Strike',
  '/fling.html': 'Chancla Strike',
  '/chancla-strike': 'Chancla Strike',
  '/chancla-strike.html': 'Chancla Strike',
  '/match': 'Chanclazo Match',
  '/match.html': 'Chanclazo Match',
  '/slots': 'Piñata Slots',
  '/slots.html': 'Piñata Slots',
  '/lore': 'Lore',
  '/lore.html': 'Lore',
};


export function pageTitle(pathname = location.pathname): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  return PAGE_TITLES[p] || PAGE_TITLES[p + '.html'] || document.title || 'Chanclazo';
}

export function initAnalytics(): void {
  if (!GA_ID || typeof document === 'undefined') return;
  if (document.querySelector(`script[data-ga="${GA_ID}"]`)) {
    sendPageView();
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) { window.dataLayer.push(args); };
  window.gtag('js', new Date());
  // send_page_view false — we send named page_views ourselves
  window.gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  s.dataset.ga = GA_ID;
  document.head.appendChild(s);
  sendPageView();
}

export function sendPageView(pathname = location.pathname): void {
  if (!GA_ID || !window.gtag) return;
  const title = pageTitle(pathname);
  const page_path = pathname.replace(/\.html$/, '') || '/';
  window.gtag('event', 'page_view', {
    page_title: title,
    page_path,
    page_location: location.origin + page_path,
  });
}

type Game = 'home' | 'fling' | 'match' | 'slots' | 'lore';

export function track(event: string, params: Record<string, string | number | boolean | undefined> = {}): void {
  if (!GA_ID || !window.gtag) return;
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = v;
  window.gtag('event', event, clean);
}

export function gameFromPath(pathname = location.pathname): Game {
  const p = pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  if (p === '/fling' || p === '/chancla-strike') return 'fling';
  if (p === '/match') return 'match';
  if (p === '/slots') return 'slots';
  if (p === '/lore') return 'lore';
  return 'home';
}

/** Session timer for game_exit seconds_played */
let startedAt = 0;
let firstActionSent = false;

export function markGameStart(game: Game): void {
  startedAt = performance.now();
  firstActionSent = false;
  track('game_start', { game });
}

export function markFirstAction(game: Game, action: string): void {
  if (firstActionSent) return;
  firstActionSent = true;
  track('first_action', { game, action });
}

export function markBonus(game: Game, type: string): void {
  track('bonus_triggered', { game, type });
}

export function markLandingCard(game: string): void {
  track('landing_card_click', { game });
}

export function bindGameExit(game: Game): void {
  const send = () => {
    if (!startedAt) return;
    const seconds = Math.round((performance.now() - startedAt) / 1000);
    track('game_exit', { game, seconds_played: seconds });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
  });
  addEventListener('pagehide', send);
}

export function gaEnabled(): boolean { return !!GA_ID; }
