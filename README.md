# Chanclazo

Day of the Dead browser games starring the original hand-drawn Chanclazo crew.

| Route | Game |
| --- | --- |
| `/` | Landing page: "When words fail, the Chanclazo speaks." |
| `/fling` | **Chancla Strike**: slingshot chanclas at villain forts (9 levels, 3 areas) |
| `/match` | **Chanclazo Match**: match-3 with sugar skulls, chanclas, bombs and piñatas |
| `/strike` | **Chanclazo Strike**: ride the cemetery street, throw chanclas and dodge the abuela |
| `/lore` | What is a chanclazo? (definition page) |

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

Built with Vite, TypeScript, Three.js (Strike), Matter.js (Chancla Strike) and React (lore page). Deployed on Vercel (`vercel.json`).
