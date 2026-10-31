# CINEMORA — Architecture

> Status: v2.0 · 2026-10-31 · Reconciled with the CINEMORA streaming-platform master specification.

## 1. Overview

CINEMORA is a **premium movie & TV discovery + authorized streaming platform** built as a Backend-for-Frontend (BFF):

- The **React SPA** talks only to our **Express API**.
- The **Express API** is the sole consumer of the **TMDB API** — **TMDB supplies metadata, posters, backdrops and trailer keys only. It never provides full movie files, and CINEMORA will never pretend otherwise.**
- **PostgreSQL + Prisma** store everything that is ours: accounts, profiles, preferences, personal lists, history, playback progress, the **local distributable catalog** (titles with authorized video assets), video/subtitle assets, reviews.
- **Authorized video** (public-domain, licensed, or approved uploads) is transcoded to **HLS** with FFmpeg, stored behind a **storage abstraction** (local disk in dev, S3-compatible in production), and played in a custom **HTML5 + HLS.js** player.

**Current goals:** discovery & browsing; detail pages; search & filters; accounts with **multiple profiles**; per-profile watchlist/favorites/history; a real streaming player with subtitles, resume and next-episode; an admin panel for catalog/content management.

**Hard non-goals:** hosting, proxying, or linking unauthorized streams; scraping; fabricating playable content. Where no authorized stream exists, the UI shows a clear **unavailable-content state** — never a fake play button.

## 2. High-Level System Diagram

```
┌──────────────────────┐         ┌──────────────────────────────────────┐         ┌──────────────────┐
│  React SPA (Vite)    │  HTTPS  │        Express API (Node + TS)       │  HTTPS  │   TMDB API v3    │
│  client/ · :5173     │ ──────► │  server/ · :3000                     │ ──────► │ metadata/images  │
│  React Router        │         │                                      │         └──────────────────┘
│  Zustand (client)    │         │  routes → controllers → services     │         ┌──────────────────┐
│  TanStack Query ⚑    │         │             → repositories → Prisma │ ──────► │   PostgreSQL     │
│  Tailwind v4 tokens  │         │                                      │         │   · :5432        │
│  Framer Motion       │         │  ┌ Streaming subsystem (Ph.6-8) ───┐ │         └──────────────────┘
│  HLS.js player       │         │  │ uploads → validate(ffprobe) →   │ │         ┌──────────────────┐
└──────────────────────┘         │  │ transcode queue (FFmpeg→HLS) →  │ ──────► │ Storage (abstract)│
       ▲                          │  │ storage (local dev / S3 prod)   │ │         │ local FS / S3    │
       │ HLS segments + WebVTT    │  └────────────────────────────────┘ │         │ + CDN (prod)     │
       └──────────────────────────┴──────────────────────────────────────┘         └──────────────────┘
```

**Inviolable rules:** (1) the TMDB key exists only in `server/.env`; (2) no video is ever served without a recorded license basis; (3) no fake UI controls.

## 3. Repository Structure (npm-workspaces monorepo)

```
cinemora/
├── client/
│   └── src/
│       ├── app/                 # Router, providers, root layout
│       ├── pages/               # Home, Movies, Series, Genres, Search, Discover, TitleDetail,
│       │                        # SeasonDetail, Person, MyList, Profiles, Player, Auth, Admin (phased)
│       ├── features/            # discovery · title · search · library · profiles · player · admin
│       ├── components/
│       │   ├── ui/              # Button, Chip, Rating, Skeleton, Spinner, Modal, EmptyState, Input
│       │   ├── layout/          # Navbar, Footer, PageShell, MobileNav, PageTransition
│       │   └── media/           # MediaCard, MediaRow, HeroBackdrop, PersonCard, TrailerModal
│       ├── player/              # VideoPlayer (HLS.js), controls, subtitle manager (Phase 6)
│       ├── stores/              # authStore (access token in memory), uiStore
│       ├── hooks/ services/ types/ lib/ styles/ test/
├── server/
│   └── src/
│       ├── routes/ controllers/ services/ repositories/    # layered core
│       ├── middleware/          # requireAuth · requireRole · validate(zod) · errorHandler ·
│       │                        # requestId · rateLimit · uploadLimiter
│       ├── lib/                 # env · logger · cache · errors · storage abstraction
│       ├── media/               # ffmpeg.ts · ffprobe.ts · hls.ts · subtitles.ts (Phase 6)
│       ├── jobs/                # transcode worker (in-process queue, Phase 6)
│       ├── validators/          # zod schemas per module
│       ├── types/  app.ts  server.ts
├── storage/                     # dev media root (gitignored): originals/ hls/ subtitles/
├── docs/                        # ← this folder
├── package.json                 # workspaces + shared scripts
```

Dependency directions: frontend `pages → features → components/ui` (never upward); backend `routes → controllers → services → repositories → prisma`; controllers never touch Prisma; services never touch `req/res`.

## 4. Frontend Architecture

### 4.1 Routing (React Router; routes appear as their phase lands)

| Route | Page | Phase | Access |
|---|---|---|---|
| `/` | Home: hero + curated rows | 2 | public |
| `/movies` `/series` | Browsable catalogs | 2 | public |
| `/genres` + `/genre/:id` | Genre explorer | 2–3 | public |
| `/movie/:id` `/tv/:id` | Detail pages | 3 | public |
| `/tv/:id/season/:n` | Season & episodes | 3 | public |
| `/person/:id` | Person filmography | 3 | public |
| `/search?q=` · `/discover?…` | Search & filters | 3 | public |
| /login /register | Auth | 4 | guest-only |
| /profiles | Profile selection/management | 4 | auth |
| /my-list?tab=… | Watchlist / Favorites / History / Continue | 5–6 | auth+profile |
| /watch/:videoAssetId | Player page | 6 | auth+profile |
| /admin/* | Admin dashboard | 7 | role=ADMIN |

Route-level lazy loading; **URL is the source of truth** for search/filter state (shareable, back/forward correct).

### 4.2 State management

- **Server state:** TanStack Query (⚑ ADR #9) — caching, pagination, optimistic list toggles.
- **Client state:** **Zustand** — auth/session (access token **in memory only**), active profile, UI prefs (volume, playback speed).

### 4.3 Player architecture (Phase 6)

Custom player built on `<video>` + **HLS.js**: play/pause, seek, volume, fullscreen, speed (0.5–2×), quality picker (from HLS levels), subtitle picker (WebVTT `<track>`), keyboard shortcuts (space/←/→/↑/↓/f/m/c), buffering spinner, error recovery + retry, resume from `playback_progress`, autoplay-next-episode (per preference). SRT subtitles are converted to WebVTT server-side at upload.

### 4.4 Design system (spec palette — exact)

| Token | Value | Use |
|---|---|---|
| `base` | `#08090D` | page background (deep black) |
| `surface` | `#11131B` | secondary background |
| `card` | `#171A24` | cards, rows, glass panels |
| `primary` | `#8B5CF6` | electric purple — interactive accents |
| `accent` | `#38BDF8` | neon blue — interactive accents |
| `gold` | `#D6B36A` | premium details, ratings, dividers |
| `ink` | `#F8FAFC` | primary text |
| `muted` | `#A1A1AA` | secondary text |
| Fonts | **Cinzel** (display/wordmark) · **Inter** (body/UI) | elegant, cinematic |

Visual language: full-bleed cinematic heroes with gradient scrims; poster-forward cards with hover lift + glow; purple→blue gradients **only** on primary interactive elements; subtle gold accents; restrained glassmorphism (navbar, modals); skeleton loaders; smooth page transitions (Framer Motion, `prefers-reduced-motion` aware). No excessive neon, no clutter.

## 5. Backend Architecture

### 5.1 Request pipeline

```
requestId → helmet → cors(whitelist) → json(100kb) → rateLimit
  → routes → validate(zod) → controller → service → repository
  → central errorHandler → envelope response
```

Multipart uploads (Phase 6/7) additionally pass `uploadLimiter` (size caps, MIME whitelist, random filenames) before controllers. `app.ts` exports the app without listening (Supertest-friendly); `server.ts` boots env → DB check → listen, with graceful shutdown.

### 5.2 Modules

| Module | Phase | Responsibility |
|---|---|---|
| `health` | 1 | liveness + version |
| `catalog` | 2–3 | TMDB proxy (lists, detail, search, discover, genres, person) — read-only, cached, DTO-normalized |
| `auth` | 4 | register/login/refresh rotation/logout/me; argon2id; JWT (sub, profileId, role) |
| `profiles` | 4 | CRUD (≤5/account), avatar presets, activate/switch, preferences |
| `lists` | 5 | per-profile watchlist & favorites |
| `history` | 5 | per-profile viewing history |
| `playback` | 5–6 | progress save/resume, stream-info resolution, continue-watching |
| `media` | 6 | video upload intake, ffprobe validation, transcode jobs, subtitle conversion/serving |
| `reviews` | 7 | per-title reviews (auth) |
| `admin` | 7 | catalog CRUD, TMDB import, seasons/episodes, assets, users, genres, analytics — `requireRole('ADMIN')` |

### 5.3 Streaming subsystem (Phase 6)

1. **Intake:** admin upload → size/type checks → stored to `storage/originals/<uuid>.<ext>` (never executed, random names).
2. **Validation:** ffprobe verifies it is real media (duration, codecs); rejects malformed files.
3. **Transcode:** in-process job queue (BullMQ/Redis **only if** Phase 8 needs it; otherwise a simple serial worker) → FFmpeg HLS ladders (480p/720p/1080p, `fmp4` segments, 6s) → `storage/hls/<assetId>/…`.
4. **Storage abstraction:** `interface MediaStorage { put/get/url/delete }` with `LocalStorage` (dev: Express serves with Range support) and `S3Storage` (prod: pre-signed URLs/CDN). Asset states: `PENDING → VALIDATING → TRANSCODING → READY | FAILED`.
5. **Subtitles:** SRT uploaded → converted to WebVTT (server) → served as `<track>` sources.

### 5.4 Error model

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [...], "requestId": "req_…" } }
```

`AppError(code, status, message, details?)` thrown anywhere; central handler renders, logs with requestId, hides internals outside dev.

## 6. Authentication, Profiles & RBAC

```
register/login ──► argon2id ──► access JWT (sub, profileId, role; 15 min) → body → memory only
                          └──► refresh (256-bit, 30 d) → httpOnly cookie → DB hash + family rotation
profile switch: POST /profiles/:id/activate → new access token carrying that profileId
RBAC: users.role ∈ {USER, ADMIN}; requireAuth → requireRole('ADMIN') guards /admin/*
```

Reuse of a revoked refresh token revokes the whole family (theft signal). All personal data is scoped by **profileId** (watchlist, favorites, history, progress, preferences, reviews) with `user_id` retained for integrity.

## 7. Security Posture

- Secrets only in `server/.env` (gitignored, zod-validated, fail-fast boot).
- helmet + CSP (API), CORS whitelist (client origin only), 100 KB JSON limit.
- Auth rate limits (10/min/IP) + general limit (240/min/IP).
- **Uploads:** size caps (video ≤ 8 GB streamed, subtitle ≤ 1 MB), extension+MIME whitelist (`mp4|mkv|webm` / `srt|vtt`), ffprobe content sniffing, randomized storage keys, no user-controlled paths, never executed; originals not exposed publicly.
- **Media delivery:** authorized requests only; dev = Express Range streaming from `storage/`; prod = short-lived pre-signed URLs.
- Validation (Zod) on every input; Prisma parameterization; argon2id; JWT secret ≥ 32 bytes; generic auth errors (no user enumeration); no stack traces in prod.
- **Only content the platform has permission to distribute** (public domain / licensed / authorized uploads) — enforced by license metadata on every `video_asset` and admin-only upload paths.

## 8. Performance & Caching

Route code-splitting; lazy sized images; skeletons (no CLS); TMDB in-memory TTL cache + single-flight (lists 5 min, detail 1 h, genres 24 h, search 2 min); pagination everywhere; HLS adaptive delivery (buffer-based quality); transcode jobs run off the request path; DB indexes per DATABASE_DESIGN; vendor chunking in the Vite build.

## 9. Observability

pino JSON logs with `requestId`; access log (method/path/status/duration); transcode job state transitions logged; TMDB latency warnings (>2 s); slow-query threshold (Phase 8: metrics endpoint/dashboard).

## 10. Testing Strategy

| Layer | Tool | Covers |
|---|---|---|
| Unit (client) | Vitest + RTL | UI primitives, formatters, stores, player logic |
| Unit (server) | Vitest | services, cache, validators, env, subtitle conversion, storage paths |
| Integration | Vitest + Supertest + real Postgres | auth (incl. rotation/reuse), profiles, lists, history, progress, search proxy, **RBAC denials**, upload validation |
| E2E | Playwright (Phase 8) | browse → detail → search → auth → profile → watchlist → player happy paths |

TMDB and FFmpeg are mocked/stubbed in tests; the real TMDB token is used only in manual verification.

## 11. Environment & Configuration

| Variable | Where | Phase |
|---|---|---|
| `PORT` (3000) · `NODE_ENV` · `LOG_LEVEL` · `CLIENT_ORIGIN` | server | 1 |
| `TMDB_READ_ACCESS_TOKEN` | server | 2 |
| `DATABASE_URL` | server | 4 |
| `JWT_SECRET` | server | 4 |
| `STORAGE_DRIVER` (`local`) · `STORAGE_ROOT` (`./storage`) | server | 6 |
| `FFMPEG_PATH` · `FFPROBE_PATH` (optional overrides) | server | 6 |
| `S3_*` (endpoint, bucket, keys) · `MEDIA_CDN_BASE` | server | 6/8 |
| `ADMIN_BOOTSTRAP_EMAIL` (first admin seed) | server | 7 |
| `VITE_API_URL` (`/api/v1` via dev proxy) | client | 1 |

`.env.example` files ship per package; real `.env` files are gitignored and **never** reach the client bundle.

## 12. Legal & Compliance

- **TMDB:** metadata, posters, backdrops, trailer keys only — with the required attribution ("This product uses the TMDB API but is not endorsed or certified by TMDB.") shown in the UI from Phase 2 onward, plus links to TMDB where required.
- **Video:** every `video_asset` records `license_type` (PUBLIC_DOMAIN | LICENSED | USER_UPLOAD) + `license_ref`; uploads without a declared license basis are rejected; takedown/DMCA handling documented in Phase 8.
- No scraping, no rehosting, no deep-links to pirated sources — anywhere, ever.
