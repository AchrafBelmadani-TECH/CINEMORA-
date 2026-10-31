# CINEMORA

Premium movie & TV discovery platform with authorized streaming. Built with React · TypeScript · Vite · Tailwind CSS · Express · PostgreSQL · Prisma · TMDB.

> **Status:** Phase 1 of 8 complete (foundation & premium UI shell). See [`docs/DEVELOPMENT_PROGRESS.md`](docs/DEVELOPMENT_PROGRESS.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Quick start

```bash
npm install
npm run dev        # server :3000 + client :5173
```

| Command | What it does |
|---|---|
| `npm run dev` | run both workspaces concurrently (watch mode) |
| `npm run build` | production builds (client `dist/`, server `dist/`) |
| `npm test` | all unit + integration tests |
| `npm run lint` | eslint across the monorepo |

## Legal

TMDB supplies metadata and images only. CINEMORA streams exclusively content it is authorized to distribute (public domain, licensed, approved uploads). See `docs/TECHNICAL_DECISIONS.md` §15/§17.
