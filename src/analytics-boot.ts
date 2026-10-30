import { initAnalytics, markLandingCard, gameFromPath, bindGameExit } from './analytics';

initAnalytics();

// Landing: track card / CTA clicks to games
if (gameFromPath() === 'home') {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if ((href.startsWith('/chancla-strike') || href.startsWith('/fling'))) markLandingCard('fling');
    else if (href.startsWith('/match')) markLandingCard('match');
    else if (href.startsWith('/slots')) markLandingCard('slots');
    else if (href.startsWith('/lore')) markLandingCard('lore');
  }, true);
}

// Soft bind exit on every page (seconds only meaningful after game_start)
bindGameExit(gameFromPath());
