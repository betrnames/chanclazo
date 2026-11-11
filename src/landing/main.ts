import { BRAND, TAGLINE } from '../brand';
const GAMES = [
  { name: 'Chancla Strike', href: '/chancla-strike', img: '/play/abuela_sprite.webp', desc: 'Throw chanclas at villain forts across 9 levels: cemetery, night market and catacombs.' },
  { name: 'Chanclazo Match', href: '/match', img: '/play/t_skull.webp', desc: 'Swipe to match 3 or more sugar skulls. Make chanclas, bombs and piñatas.' },
];
document.title = BRAND;
document.getElementById('tagline')!.textContent = TAGLINE;
document.getElementById('games')!.innerHTML = GAMES.map((g) => `
  <a class="card" href="${g.href}"><img src="${g.img}" alt="" loading="lazy" />
    <div class="txt"><b>${g.name}</b><span>${g.desc}</span><em>Play ▸</em></div></a>`).join('');
document.getElementById('foot')!.textContent = `© ${new Date().getFullYear()} chanclazo.com`;
