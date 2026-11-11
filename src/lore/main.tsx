import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import LorePage from './LorePage';
import { initLanderMusic } from '../play/music';

const musicBtn = document.createElement('button');
musicBtn.id = 'lmusic';
musicBtn.type = 'button';
musicBtn.setAttribute('aria-label', 'Music on or off');
musicBtn.style.cssText = 'position:fixed;top:max(10px,env(safe-area-inset-top));right:10px;z-index:20;font:600 12px system-ui,sans-serif;color:#ffe9c2;background:rgba(20,5,40,.6);border:1px solid rgba(255,210,63,.5);border-radius:999px;padding:5px 10px;cursor:pointer';
document.body.appendChild(musicBtn);
initLanderMusic(musicBtn);
createRoot(document.getElementById('root')!).render(<StrictMode><LorePage /></StrictMode>);
