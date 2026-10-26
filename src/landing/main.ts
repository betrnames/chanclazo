import { BRAND, TAGLINE } from '../brand';
const GAMES = [
  { name: 'Chanclazo Fling', href: '/fling', img: '/play/abuela_sprite.webp', desc: 'Slingshot chanclas at villain forts across 9 levels: cemetery, night market and catacombs.' },
  { name: 'Chanclazo Match', href: '/match', img: '/play/t_skull.webp', desc: 'Swipe to match 3 or more sugar skulls. Make chanclas, bombs and piñatas.' },
  { name: 'Chanclazo Strike', href: '/strike', img: '/play/luchador_sprite.webp', desc: 'Ride the Day of the Dead street at night and throw chanclas at luchadores and calacas.' },
  { name: 'Chanclazo Survival', href: '/survival', img: '/play/t_pinata.webp', desc: 'The original 3D game: dodge the flying chanclas and survive.' },
];
document.title = BRAND;
document.getElementById('brand')!.textContent = BRAND;
document.getElementById('tagline')!.textContent = TAGLINE;
document.getElementById('games')!.innerHTML = GAMES.map((g) => `
  <a class="card" href="${g.href}"><img src="${g.img}" alt="" loading="lazy" />
    <div class="txt"><b>${g.name}</b><span>${g.desc}</span><em>Play ▸</em></div></a>`).join('');
document.getElementById('foot')!.textContent = `© ${new Date().getFullYear()} ${BRAND} · chanclazo.com`;
