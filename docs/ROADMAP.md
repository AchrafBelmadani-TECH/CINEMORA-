# CINEMORA — Development Roadmap

> Status: v2.0 · 2026-10-31 · Phase structure per the master specification (8 phases).

## Governing rules (every phase)

1. **Runnable after every phase.** `npm run dev` starts a working app; no phase leaves broken builds, stub endpoints or dead UI. End of phase = run tests, run production build, fix all critical errors.
2. **No fake features.** A control exists only if it works. Anything not implemented is *absent*, not disabled/placeholder. No fake streaming, no fake auth, no fake data. Unavailable content shows a clear unavailable state.
3. **TMDB = metadata & images only.** Trailers embed via official YouTube keys. Never full files.
4. **Only authorized video** (public domain / licensed / approved uploads) is playable.
5. **No secrets in the client.** Ever.
6. Each phase ends with: tests green → production build green → verification against acceptance criteria → `DEVELOPMENT_PROGRESS.md` updated → commits.
7. Dependencies install **within** the phase that needs them.
8. Navigation renders a link only when its destination exists (no broken navigation).

## Phase overview

| Phase | Theme | Depends on | Key deps introduced |
|---|---|---|---|
| 1 | Foundation, architecture, premium UI shell | – | vite, react, tailwind v4, framer-motion, express, zod, pino, vitest, eslint |
| 2 | Homepage, navigation, catalog, TMDB integration | 1 | tanstack-query ⚑ |
| 3 | Details, seasons/episodes, search & filters | 2 | – |
| 4 | PostgreSQL, auth, profiles | 1 | prisma, embedded-postgres ⚑, argon2, jsonwebtoken |
| 5 | Watchlist, favorites, history, progress APIs | 4 | – |
| 6 | Video player, authorized streaming, subtitles | 4 | hls.js, ffmpeg/ffprobe (system), multer, storage abstraction |
| 7 | Admin dashboard & content management | 6 | – |
| 8 | Security hardening, full testing, perf, deployment | 7 | playwright, s3 sdk (if S3) |

---

## Phase 1 — Foundation, Architecture & Premium UI Shell ✅ *(current)*

**Goal:** A runnable monorepo with the complete CINEMORA visual identity shell, hardened server skeleton, and quality tooling.

**Scope**
- npm workspaces; root scripts (`dev`, `build`, `lint`, `test`); strict TS base config; ESLint (flat) + Prettier; `.gitignore`, `.editorconfig`; git initialized.
- Server: Express + TS (ESM), zod-validated env (fail-fast), pino logger + requestId, helmet, CORS whitelist, in-memory rate limiter, central error envelope, `GET /api/v1/health`, graceful shutdown; Supertest integration tests.
- Client: Vite + React + TS + Tailwind v4 with the **exact spec palette** as design tokens, Cinzel + Inter fonts, React Router, Framer Motion page transitions, Navbar + Footer shell, branded landing page (no fake content), cinematic 404, UI primitives (Button, Skeleton, Spinner, EmptyState) with unit tests.
- No TMDB, no DB, no auth yet. No nav links to pages that don't exist yet.

**Acceptance criteria**
- [ ] `npm install` → `npm run dev` starts server (:3000) + client (:5173) together; client proxies `/api/v1/health`.
- [ ] `GET /api/v1/health` → `200 {status:"ok", version, uptime}` with `X-Request-Id`; unknown API route → 404 error envelope.
- [ ] Landing shows wordmark, tagline, navbar, footer; unknown URL → styled 404 with working Home link; page transitions animate and respect `prefers-reduced-motion`.
- [ ] `npm test` green (server: health/404/env/rate-limit; client: Button/Skeleton/App/Home/404).
- [ ] `npm run lint` → 0 errors; `npm run build` succeeds for **both** packages; built server serves health in production mode.
- [ ] Server boots fail-fast on invalid env (verified by test); no secrets in repo; `.env` gitignored; `.env.example` committed.
- [ ] Palette tokens exactly match the spec hex values; responsive at 390/768/1440 px; visible keyboard focus everywhere.
- [ ] `git log` shows clean Phase-1 commits; `DEVELOPMENT_PROGRESS.md` updated.

---

## Phase 2 — Homepage, Navigation, Catalog & TMDB

**Goal:** The real cinematic homepage driven by live TMDB data.

**Scope**
- `TmdbService`: bearer fetch client (timeout, retry, error mapping), DTO normalization, TTL cache + single-flight.
- Catalog API: trending (day/week), popular, top-rated, upcoming/on-the-air, genre lists — movies & TV.
- Client: TanStack Query layer (⚑); Navbar grows `Home · Movies · Series · Genres` (all live) + search box **omitted until Phase 3**; hero (rotating trending backdrop, gradient scrim, title/rating/year/overview, **no Watch/More-Info buttons yet — no player, no detail pages**); horizontal rows (Trending Now, Popular Movies, Top Rated, Latest Releases, genre rows: Action/Sci-Fi/Drama/Horror/Comedy, Popular TV); MediaCard (poster, title, year, rating, hover animation) — cards are **not** clickable until Phase 3 detail pages exist; skeletons; footer gains TMDB attribution line.
- `/movies`, `/series`, `/genres` catalog pages (paginated grids).

**Acceptance criteria**
- [ ] Home renders hero + all rows from live TMDB (real titles, real posters); skeletons → content with no layout shift.
- [ ] Second identical API call served from cache (log-verified, one upstream hit).
- [ ] TMDB token appears **nowhere** in client sources or bundle (grep + network-tab: browser only hits `/api/v1/*`).
- [ ] TMDB outage simulated → graceful error states, never a crash or blank page.
- [ ] Attribution line visible in footer.
- [ ] Mobile: rows swipe-scroll; hero degrades gracefully at 390 px.

---

## Phase 3 — Details, Seasons/Episodes, Search & Filters

**Goal:** Complete the discovery loop.

**Scope**
- Detail API: movie/tv detail (`append_to_response` credits, videos, recommendations, similar), season detail, person detail, `/search/multi`, `/discover` (param whitelist), genres.
- Client detail pages: cinematic backdrop, poster, synopsis, date, runtime, genres, rating ring, cast & crew, director/creator, trailer modal (YouTube embed, real key only), similar titles, season/episode browser (thumbnails, descriptions, durations), person pages.
- Cards become clickable; hero gains **More Info** (→ detail). **Watch Now still absent** (Phase 6).
- Search: navbar search box (debounced 300 ms, race-safe), `/search` page (movies/series/people); `/discover` filters (year, rating, genre, movie/series, language) synced to URL; pagination; empty/error states.

**Acceptance criteria**
- [ ] Every card → correct detail page; credits, trailer (iff key exists), similar titles all functional.
- [ ] Season browser lists episodes with thumbnails/durations; person pages link both directions.
- [ ] Search: "dune" returns movies+series+people; rapid typing never shows stale results (request abortion).
- [ ] Discover filters compose, reflect in URL, survive reload; back/forward correct; invalid values rejected visibly.
- [ ] Keyboard: modal Esc-close + focus trap; rows arrow-scrollable.

---

## Phase 4 — Data Foundation & Catalog Sync Engine (expanded per library brief; see CATALOG_AND_STREAMING_PLAN.md)

**Goal:** Real PostgreSQL with the full catalog schema, availability model, and an automated incremental TMDB sync engine. Auth/profiles move to Phase 5 unchanged.

**Scope**
- embedded-postgres (ADR #3 exercised) + Node scripts (db:start/stop/reset); data dir gitignored; standard DATABASE_URL (defaults to localhost:5433 embedded).
- Prisma migration phase4_catalog_baseline: identity (users, refresh_tokens, profiles, user_preferences) + catalog (titles, genres, title_genres, seasons, episodes) + sources/licensing (video_sources, video_assets, subtitle_tracks) + operations (import_jobs). No media in Postgres.
- Availability derivation (AVAILABLE / PROCESSING / EXPIRED / UNAVAILABLE; RESTRICTED decided per-request) — driven only by video_sources/assets, never by metadata imports.
- Sync engine: bounded-page TMDB list sync (trending/popular/top-rated/now-playing/upcoming movies; popular/top-rated/airing-today/on-the-air TV) with pacing, per-page retry, dedupe on (tmdb_type, tmdb_id), import_jobs audit; seasons/episodes deep-sync per title on demand.
- APIs: bootstrap-token-gated sync trigger + job list (x-bootstrap-token vs ADMIN_BOOTSTRAP_TOKEN; 503 when unset; replaced by RBAC in Phase 5); public GET /library/stats and GET /titles/:type/:id/availability (honest UNAVAILABLE until sources exist).
- Script: npm run sync:catalog -- --pages=N.

**Acceptance criteria**
- [ ] db:start boots PG, migrations apply cleanly, db:stop/db:reset work.
- [ ] A sync run imports real titles; re-run updates (no duplicates); import_jobs reflects pages/counts/errors.
- [ ] /library/stats truthful (watchable = 0 until sources); availability endpoint = UNAVAILABLE for metadata-only titles.
- [ ] All prior tests green + new DB/sync tests; builds clean; app runnable.

---

## Phase 5 — Watchlist, Favorites, History & Progress APIs

**Goal:** The per-profile personal-data layer (player activation comes in Phase 6).

**Scope**
- Migrations: `list_items` (watchlist + favorites), `viewing_history`, `playback_progress` — all profile-scoped.
- APIs: list add/remove/list (idempotent), history record/bump/list, progress save/resume, continue-watching feed (populated once playback starts).
- Client: watchlist/favorite toggles (optimistic, rollback on error) on cards + detail; `/my-list` with tabs Watchlist / Favorites / History (Continue-watching tab **renders in Phase 6** when progress exists — no empty fake feature); history recorded after detail-page dwell; guest sees no toggles.
- "Recommended For You" row on Home (simple: TMDB recommendations based on recent history items).

**Acceptance criteria**
- [ ] Toggles persist per-profile (switching profiles shows different data); double-add never duplicates (DB unique + idempotent API).
- [ ] Optimistic toggle visibly rolls back on simulated offline.
- [ ] History: detail dwell >5 s records once; revisit bumps `watched_at`.
- [ ] Resume API round-trips position/duration for arbitrary assets (verified by integration test — UI lands Phase 6).
- [ ] Recommended row reflects history (auth) and is hidden for guests (no fake data).

---

## Phase 6 — Video Player, Authorized Streaming, Subtitles & Progress

**Goal:** A genuinely functional player fed **only** by authorized assets.

**Scope**
- Storage abstraction (`LocalStorage` dev / `S3Storage` prod) + `storage/` layout (originals/hls/subtitles).
- Admin-only upload path (minimal UI in Phase 7; API now): size/MIME caps, ffprobe validation, FFmpeg HLS ladders (480/720/1080), SRT→WebVTT conversion, asset lifecycle `PENDING→…→READY|FAILED`.
- Catalog bridge: local `titles/seasons/episodes` entries (TMDB-linked) that own `video_assets`.
- Player (`/watch/:assetId`): HTML5 + HLS.js — play/pause/seek/volume/fullscreen/speed/quality/subtitles/keyboard shortcuts/buffering/error states; resume from saved position; next-episode navigation (per preference); Continue Watching row + hero **Watch Now** (only when an authorized asset is READY, else a clear "not available for streaming" state).
- Demo seeding: bundled public-domain title(s) for verifiable end-to-end playback.

**Acceptance criteria**
- [ ] An uploaded (or seeded public-domain) file transcodes to READY; `/watch/:id` genuinely plays it with all controls working.
- [ ] Resume: leave at T, return → resumes; Continue Watching shows it; finishing (>95%) drops it from the row.
- [ ] Subtitles: SRT upload → selectable track renders correctly; switching tracks works.
- [ ] Quality switch changes levels without playback death; buffering spinner on slow network (throttled devtools).
- [ ] Title without authorized asset → explicit unavailable state; **no Watch button** for it anywhere.
- [ ] ffprobe rejects a renamed text file (upload validation test); oversized file rejected with clear error.
- [ ] Playback progress writes per-profile (switch profile → different resume point).

---

## Phase 7 — Admin Dashboard & Content Management

**Goal:** Administrators manage everything through a professional panel.

**Scope**
- RBAC-enforced `/admin/*` UI + APIs: titles CRUD + import-from-TMDB; seasons/episodes management; video upload + transcode status monitoring; subtitle management; poster/backdrop overrides; user management (list, roles, disable); genre management; basic analytics (users, profiles, plays, top titles, storage usage).
- Reviews (per-title, profile-scoped) if sprint allows — otherwise explicitly moved to Phase 8/backlog with user sign-off.

**Acceptance criteria**
- [ ] Non-admin gets 403 on every `/admin/*` API **and** UI route (verified for USER and anonymous).
- [ ] Admin imports a TMDB title → appears in local catalog → uploads video → READY → playable by users end-to-end.
- [ ] Delete/edit title cascades correctly (assets removed from storage; no orphaned HLS).
- [ ] Transcode failures visible in admin with retry; user sees unavailable state meanwhile.
- [ ] Analytics numbers match DB counts (spot-verified).
- [ ] All Phase 7 integration tests (RBAC, CRUD, upload validation) green.

---

## Phase 8 — Security, Testing, Performance & Deployment

**Goal:** Production confidence.

**Scope**
- Playwright E2E suite (browse→detail→search→auth→profile→watchlist→player); coverage completion for auth/profiles/lists/progress/search/admin-permissions; dependency audit; CSP/CORS/media-domain review; rate-limit review; error-monitoring hooks.
- Performance: Lighthouse pass, bundle analysis, image pipeline, HLS/CDN config; optional DB-backed TMDB cache if multi-process.
- Production topology: `npm run build && npm start` (Express serves SPA + API); managed Postgres via `DATABASE_URL`; S3 + CDN signed URLs; deployment guide + runbook (backup/restore, takedown policy, TMDB attribution).

**Acceptance criteria**
- [ ] `npm test` (all workspaces) + E2E green against the production build.
- [ ] Clean-clone → running in ≤ 10 min using README only.
- [ ] `npm audit`: no high/critical (or documented exceptions).
- [ ] Lighthouse: Performance ≥ 85, Accessibility ≥ 90 on Home/Detail (desktop).
- [ ] Deep-link refresh works in production mode (SPA fallback); zero downtime graceful shutdown.

---

## Backlog (explicitly out of current scope)

Licensed Hollywood catalog integrations · user subtitle uploads · offline downloads · multi-language UI · social follows · watchdog metrics dashboards. Any item requires a new ADR + phase before work starts.
