# Chanclazo

Day of the Dead browser games starring the original hand-drawn Chanclazo crew.

| Route | Game |
| --- | --- |
| `/` | Landing page: "When words fail, the Chanclazo speaks." |
| `/chancla-strike` | **Chancla Strike**: throw chanclas at villain forts (9 levels, 3 areas) |
| `/match` | **Chanclazo Match**: match-3 with sugar skulls, chanclas, bombs and piñatas |
| `/lore` | What is a chanclazo? (definition page) |

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

Built with Vite, TypeScript, Matter.js (Chancla Strike) and React (lore page). Deployed on Vercel (`vercel.json`).
