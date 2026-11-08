<div align="center">

# CINEMORA

**A premium movie & TV streaming platform with legally authorized content**

React · TypeScript · Vite · Tailwind CSS v4 · Express 5 · PostgreSQL 18 · Prisma · FFmpeg · HLS.js · TMDB

</div>

---

## Overview

CINEMORA is a full-stack streaming platform where users can discover movies and TV shows, create profiles, and **watch legally authorized content** — public domain films, Creative Commons–licensed works, and admin-uploaded video. It features a cinematic dark UI, a complete video player with resume support, a robust admin ingestion pipeline, and a growing library of genuinely playable titles sourced from the Internet Archive.

> **Legal stance:** CINEMORA streams only content it is authorized to distribute. TMDB provides metadata and artwork only — never full movies. Every playable title has a verified video source with recorded license type, reference, and territories. Metadata-only titles clearly display "Currently unavailable."

## Features

### Discovery & browsing
- Cinematic homepage with hero backdrop, curated rows, and genre collections
- Movie / TV catalog pages with pagination
- Detail pages with cast, crew, trailers, recommendations, and season/episode browser
- Global search with debounced suggestions (movies, series, people)
- Advanced discovery filters (genre, year, rating, language, sort) — all URL-driven
- Person pages with filmography and known-for grids

### Streaming
- **Real video playback** from verified authorized sources (public domain, CC-BY, admin uploads)
- HLS adaptive streaming via FFmpeg 6.1 (720p/480p ladder) with HLS.js
- Progressive MP4 fallback for direct sources
- Custom video player: play/pause, seek, volume, fullscreen, speed, quality selector, subtitles, keyboard shortcuts
- Playback progress saved per profile; resume across sessions
- Continue Watching feed on the homepage
- Next/previous episode navigation for TV

### User accounts
- Secure registration and login (argon2id password hashing)
- JWT access tokens (in-memory) + rotating refresh tokens (httpOnly cookie, family revocation on reuse)
- Multiple user profiles with gradient avatar presets (max 5 per account)
- Per-profile preferences (language, subtitles, autoplay)
- Role-based access control (USER / ADMIN)

### Admin & content management
- Admin-only sync API for TMDB catalog ingestion (batch, paced, dedup)
- Video upload API with multipart streaming, extension whitelist, 8 GB cap
- FFmpeg HLS transcoding pipeline with progress tracking, cancellation, and retry
- Subtitle management (SRT → WebVTT conversion, originals preserved)
- Source health monitoring and availability reconciliation

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5, Vite 6, Tailwind CSS v4, Zustand 5, TanStack Query 5, Framer Motion 12, HLS.js 1.7 |
| Backend | Node.js 24, Express 5, TypeScript 5, Prisma 6, PostgreSQL 18 (embedded for dev), Zod 3 |
| Media | FFmpeg 6.1, FFprobe, HLS (fMP4/MPEG-TS), SRT→WebVTT |
| Auth | argon2id, jose (HS256 JWT), rotating refresh tokens |
| External data | TMDB API (metadata, posters, backdrops, trailers) |
| Content sources | Internet Archive (public domain + CC), admin-authorized uploads |

## Getting started

### Prerequisites

- **Node.js** ≥ 20 ([download](https://nodejs.org))
- **npm** ≥ 10 (bundled with Node)
- A **TMDB API read access token** — free from [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/cinemora.git
cd cinemora

# 2. Install dependencies (root + workspaces)
npm install

# 3. Configure environment
cp server/.env.example server/.env
# Edit server/.env and set:
#   TMDB_READ_ACCESS_TOKEN=your_token_here
#   JWT_SECRET=<random 48+ hex chars>
#   ADMIN_BOOTSTRAP_EMAIL=your@email.com  (this account becomes ADMIN)
#
# Generate a JWT secret:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Database setup

CINEMORA uses an embedded PostgreSQL 18 instance for development — no Docker or system install needed.

```bash
# Start the database (first run initializes the data directory)
npm run db:start

# Apply migrations
cd server && npx prisma migrate dev
```

The database runs on `127.0.0.1:5433` with trust auth (dev only). For production, set `DATABASE_URL` to a managed PostgreSQL instance.

### Running the app

```bash
# Start both API (:3000) and frontend (:5173)
npm run dev
```

Open **http://localhost:5173** in your browser.

### Seeding playable content

```bash
# Import verified public-domain / CC movies from Archive.org
cd server
npx tsx scripts/seed-content.ts          # Blender films + NOTLD (4 titles)
npx tsx scripts/batch-discover.ts --page=1 --limit=50   # batch from feature_films

# Deep-sync a specific TV series (all seasons + episodes)
npx tsx scripts/dexter-sync.ts           # example: Dexter
```

### Testing playback

1. Sign in (or create an account)
2. Search for **Big Buck Bunny**, **Sintel**, **Carnival of Souls**, or **His Girl Friday**
3. Click **Watch now** on the detail page
4. The video player opens and plays the film from Archive.org

## Project structure

```
cinemora/
├── client/                    # React SPA (Vite + Tailwind v4)
│   └── src/
│       ├── player/            # VideoPlayer (HTML5 + HLS.js)
│       ├── pages/             # Home, Detail, Search, Discover, Watch, Profiles, Auth
│       ├── components/        # UI primitives, layout, media, search
│       ├── stores/            # Zustand (auth, session)
│       ├── services/          # API clients (catalog, auth, playback)
│       └── hooks/             # TanStack Query hooks
├── server/                    # Express API (TypeScript, ESM)
│   └── src/
│       ├── routes/            # auth, profiles, catalog, library, media
│       ├── services/          # TMDB client, sync, catalog, playback, media
│       ├── services/media/    # storage, ffmpeg, transcode, tokens, subtitles
│       ├── middleware/        # auth, rate limit, error handler, request ID
│       └── lib/               # env, prisma, logger, errors
├── docs/                      # Architecture, roadmap, database design, API design
└── scripts/                   # DB lifecycle, seeding, batch discovery
```

## Environment variables

All secrets live in `server/.env` (gitignored). See `server/.env.example` for the full template.

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | ✅ | `development` or `production` |
| `PORT` | ✅ | API port (default 3000) |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `TMDB_READ_ACCESS_TOKEN` | ✅ | TMDB v4 read token (metadata only) |
| `JWT_SECRET` | ✅ | 48+ random hex chars for JWT signing |
| `CLIENT_ORIGIN` | ✅ | Frontend origin for CORS |
| `ADMIN_BOOTSTRAP_EMAIL` | optional | First registered user with this email becomes ADMIN |
| `AUTH_RATE_LIMIT_MAX` | optional | Auth requests per minute per IP (default 10) |
| `STORAGE_DRIVER` | optional | `local` (default) or `s3` (Phase 8) |
| `STORAGE_ROOT` | optional | Local media storage directory (default `./storage`) |

## Streaming architecture

```
Archive.org (PD/CC) ──► Source Registry ──► stream-info API ──► Video Player (MP4/HLS)
Admin upload ──► FFmpeg probe ──► HLS ladder ──► Local/S3 storage ──► stream-info ──► Player
TMDB API ──► Catalog sync ──► PostgreSQL (metadata only, no video)
```

- **Availability** is derived only from verified video sources — never from metadata
- **Playback URLs** are HMAC-signed (6-hour tokens) and verified before file access
- **Progress** is saved per profile at 10-second intervals and on page exit
- **Storage** is pluggable: local filesystem (dev) / S3-compatible (production)

## Current limitations

- Most TMDB titles are **metadata-only** — they display information but show "Currently unavailable" because no authorized video source exists
- TV episode sources are limited to titles with verified public-domain or CC-licensed episodes
- Commercial streaming (Netflix, Disney+, etc.) requires licensing agreements not included in this project
- HLS transcoding requires FFmpeg on the host (auto-resolved from `ffmpeg-static` in dev)
- Subtitle support requires manual upload per title (SRT or WebVTT)

## Roadmap

| Phase | Status | Description |
|---|---|---|
| 1–3 | ✅ | Foundation, TMDB discovery, detail pages, search, filters |
| 4 | ✅ | PostgreSQL data foundation + catalog sync engine |
| 5 | ✅ | Authentication, profiles, RBAC |
| 6–6b | ✅ | Streaming engine, player, progress, continue watching |
| 7 | ✅ | Batch content expansion (293 → 387 watchable) |
| 7b | ✅ | Dexter complete series import (170 episodes) |
| 8 | ⬜ | Admin dashboard, S3 storage, security hardening, deployment |

## License

This project is licensed for educational and portfolio use. Individual video content retains its original licensing (public domain, CC-BY, or admin-verified agreements).

## Acknowledgments

- [TMDB](https://www.themoviedb.org) — movie and TV metadata
- [Internet Archive](https://archive.org) — public domain film streaming
- [Blender Foundation](https://www.blender.org) — open movies (CC-BY)
- [The Movie Database API](https://developer.themoviedb.org) — this product uses the TMDB API but is not endorsed or certified by TMDB
