# CINEMORA — Development Progress

> Living status tracker, updated at the end of every phase. Latest changelog entry first.

## Current Status

| | |
|---|---|
| **Phase** | **6 of 8 — Streaming engine & watchable content** |
| **State** | ✅ **COMPLETE** — 4 verified watchable movies playing live in the browser, 159/159 tests, all gates green (2026-11-05) |
| **App runnable?** | Yes — run db:start then npm run dev. Register/login/profiles/preferences/RBAC fully functional |
| **Next** | Phase 7 — Admin ingestion dashboard (**awaiting user approval**) |

## Phase 5 — Definition of Done (verified 2026-11-01)

- [x] **Registration & login**: argon2id hashing (19 MiB, OWASP baseline), validation (email, 10+ char password with letters+digits, displayName 2–50), duplicate email → 409, generic 401 (no user enumeration; timing-parity hash burn), disabled accounts → 403
- [x] **Tokens**: 15-min HS256 access JWT (sub, role, profileId) held client-side in memory only; 30-day 256-bit refresh token in httpOnly/SameSite=Lax cookie (path /api/v1/auth), stored SHA-256-hashed with rotation + family revocation on reuse (theft detection); logout revokes the family; 401 triggers single-flight silent refresh with request replay
- [x] **Profiles**: CRUD (max 5/account, last-profile delete blocked, owner-scoped 404s), 12 gradient avatar presets (no uploads), activate/switch re-issues the session; refresh preserves the active profile (refresh_tokens.profile_id migration); preferences API (language, subtitle language, autoplay-next)
- [x] **RBAC**: requireAuth → requireRole('ADMIN'); bootstrap-token admin gate REMOVED — admin sync APIs require a real ADMIN session; ADMIN_BOOTSTRAP_EMAIL registration grants the first admin
- [x] **Rate limiting**: auth endpoints 10/min/IP (AUTH_RATE_LIMIT_MAX configurable)
- [x] **Frontend**: login/register pages, 'Who's watching?' profile screen (gradient avatars, add/rename/delete), navbar auth state (profile chip, switch, sign out), ProtectedRoute/GuestOnlyRoute gates, silent-refresh bootstrap
- [x] **Tests**: server 89/89 (21 new), client 70/70 (9 new) — total 159/159
- [x] **Live browser verification**: register → profile chip; create + switch profiles; reload → session + active profile persist; sign out → guest state
- [x] **Gates**: typechecks ×2 clean, lint 0, production builds clean, DB data preserved (280 titles)

## Known issues (honest)

- Embedded Postgres daemon can die if its parent shell session is force-killed; db:start restarts it and data persists (280 titles survived restarts). Managed Postgres in prod is unaffected.
- Preferences API is complete but has no settings page yet (planned with player/settings work).
- Client tests run as two deterministic vitest invocations (test script); the Windows worker instability was root-caused to a test-harness redirect loop and fixed — batching retained for stability.

## Phase Tracker

| Phase | Theme | Status | Notes |
|---|---|---|---|
| 0–3 | Docs, foundation, UI shell, TMDB discovery, details/search | ✅ done | 2026-10-31 |
| 4 | Data foundation & catalog sync | ✅ done | 280 titles synced; dedupe verified; availability truthfully UNAVAILABLE |
| 5 | Auth & profiles | ✅ **done** | argon2id + JWT/refresh rotation + RBAC; verified live |
| 5 | Auth & profiles | ⬜ pending | next |
| 6 | Player, HLS streaming, sources & subtitles | ⬜ pending | storage abstraction + FFmpeg; needs real licensed/public-domain sources |
| 7 | Admin dashboard & ingestion tools | ⬜ pending | builds on Phase 5 RBAC + Phase 4 sync APIs |
| 8 | Hardening, testing & deployment | ⬜ pending | |

## Phase 4 — Definition of Done (verified 2026-10-31)

- [x] `npm run db:start` boots embedded PostgreSQL 18 (127.0.0.1:5433, trust auth, gitignored `.pgdata`); `db:stop`/`db:status`/`db:reset` work; daemon survives the npm script (binaries driven directly, not via JS wrapper)
- [x] Migration `phase4_catalog_baseline`: users, refresh_tokens, profiles, user_preferences, titles, genres (composite PK `(id, tmdb_type)` — TMDB shares genre ids across movie/TV), title_genres, seasons, episodes, video_sources, video_assets, subtitle_tracks, list_items, viewing_history, playback_progress, import_jobs, reviews — with unique constraints + indexes; no media in Postgres
- [x] Sync engine: 9 TMDB sources (trending/popular/top-rated/now-playing/upcoming movies; popular/top-rated/airing-today/on-the-air TV), bounded pages, 250 ms pacing, per-page retry, dedupe on `(tmdb_type, tmdb_id)`, `import_jobs` audit trail, single-run lock per source, deep-sync per title on demand (seasons+episodes)
- [x] Availability model: derived ONLY from video_sources/assets (metadata imports can never flip it); `RESTRICTED` decided per request; verified in unit tests + live data
- [x] APIs: public `GET /library/stats` + `GET /titles/:type/:id/availability` (honest UNAVAILABLE); admin `POST /admin/sync`, `POST /admin/titles/deep-sync`, `GET /admin/import-jobs` behind `x-bootstrap-token` (503 when unset — replaced by RBAC in Phase 5)
- [x] Script: `npm run sync:catalog -- --source=… --pages=N`
- [x] Tests: **server 67/67** (17 new: availability truth table, sync import/dedupe/job-audit/failed-run/deep-sync/concurrency lock, library API incl. admin token matrix), **client 49/49** untouched — total **116/116**
- [x] Live sync result: 9/9 sources COMPLETED, **280 unique titles** (128 movies / 152 TV), second run = 0 created / all updated (dedupe), database size **9.3 MB**, watchable **0** (no sources exist yet — honest)
- [x] Gates: typecheck ×2 clean · lint 0 · production builds clean · app runnable throughout

## Phase 3 — Definition of Done (verified 2026-10-31)

- [x] **Detail API**: `/movies/:id` & `/tv/:id` via a single upstream `append_to_response` call (credits, videos, recommendations with similar-fallback); `/tv/:id/season/:n`; `/people/:id` (combined credits → known-for + deduped filmography); trailers filtered to official YouTube trailers/teasers only
- [x] **Search API**: `/search/multi` with typed movie/tv/person results, adult content excluded, 2-min cache
- [x] **Discover API**: genres csv, year bounds (mapped per media type), min rating (+ automatic vote_count floor), original language, whitelisted sorts mapped to `primary_release_date`/`first_air_date`; invalid params → 400
- [x] **Detail pages**: cinematic backdrop + poster, title/tagline, date · runtime (or per-episode runtime) · seasons/episodes · status, rating ring + vote count, genre chips linking to genre pages, director/creator, cast strip linking to person pages, overview, **Watch trailer modal** (YouTube-nocookie embed, Esc/backdrop close, focus management), "More like this" row
- [x] **TV seasons**: season pills synced to `?season=` URL param, episode list with stills, numbers, overviews, air dates, runtimes, ratings; skeleton + error states
- [x] **Person pages**: profile photo, facts (department, lifespan, origin), biography, known-for grid, filmography list linking both ways
- [x] **Search**: navbar combobox with 300 ms debounced suggestions (movies/series/people), Enter → `/search?q=`; results page with pagination, person result cards, empty/error states
- [x] **Discover page**: URL-driven panel — media type toggle, genre chips, year range, min rating, language, sort — composable, clear-all, pagination, empty state
- [x] **Navigation**: cards + hero "More information" link to detail pages; navbar gains Discover + search; ScrollToTop on route change
- [x] **Tests**: server **50/50** (18 new: detail normalization ×2, season + cache, person dedupe, search typing + validation + cache, discover mapping/validation), client **49/49** (21 new: card links, trailer modal, detail movie/TV, person, search page + empty, discover filters via URL state, SearchBar debounce)
- [x] **Quality gates**: typecheck ×2 clean · lint 0 · production builds clean · **99/99 total**
- [x] **Browser-verified live**: Dune detail (real cast/director/12 videos/20 recs), GoT seasons & episodes, "star wars" search (240 results), Nolan person page (12 known-for, 78 filmography), filtered discover (152 sci-fi titles), trailer modal embedding the official YouTube trailer; TV default-season bug found & fixed (season 0 "Specials" shadowed Season 1 via `Number(null)`)
- [x] **No fake streaming**: no play buttons for content; trailer embed is the only video, clearly labeled; footer states streaming arrives only with licensed sources

## Issues fixed during Phase 2

| Issue | Fix |
|---|---|
| User's env file landed as `server/env` (no dot) — **not** gitignored | Renamed to `server/.env`; confirmed `git check-ignore` passes |
| Server never loaded `.env` into `process.env` | `dotenv` added; imported at `server.ts` entry before env validation |
| Fail-fast boot rejected empty-string placeholders (`DATABASE_URL=`, `JWT_SECRET=`, `FFMPEG_PATH=`, `FFPROBE_PATH=` copied from `.env.example`) | Empty strings now parse as *unset*; later phases tighten their own vars to required |
| **TMDB URL join dropped the `/3` prefix** — `new URL('/trending/movie/day', '…/3')` resolves to `…/trending/movie/day`, so every upstream call hit TMDB's HTML 404 page | `buildUrl` joins against the origin and prefixes `/3`; test now asserts the full `/3/...` upstream URL |
| `createApp` dropped its `fetchImpl` option — tests hit real network | Seam wired through to `CatalogService`/`TmdbClient` |
| Error handler masked **all** 5xx messages, hiding actionable "TMDB is not configured" | Mask only unexpected `INTERNAL_ERROR`s |
| `vi.mock` called inside a helper ran after ES-import evaluation → real API used in tests | Hoisted top-level `vi.mock` blocks per test file |
| Stale Phase-1 smoke-test `node.exe` survived TaskStop on port 3000, intercepting test fetches | Killed by PID; smoke tests now always kill by port afterwards |
| Mixed movie/tv payloads normalized with endpoint type only | Per-item `media_type` inference from TMDB payloads |
| `CatalogListItem` lacked `overview` (needed by hero) | Added through server normalizer + client type + tests |
| Various TS strictness issues (`AnimatePresence` import source, nullable `useReducedMotion`, `string|null` params, unused vars) | Fixed; typecheck clean |

## Open Items (decisions / inputs needed from user)

| # | Item | Needed by |
|---|---|---|
| 1 | Approval to begin **Phase 4** (PostgreSQL, auth, profiles) | now |
| 2 | ⚑ ADR #3 — embedded-postgres for local dev | Phase 4 |

## Changelog

| Date | Phase | Entry |
|---|---|---|
| 2026-11-05 | 6 | **Streaming engine + real playable content complete.** Storage abstraction (local FS, S3-ready interface); FFmpeg 6.1 HLS transcode pipeline (ffprobe validation, per-variant ladder, progress, cancellation, retry); HMAC-signed playback URLs; SRT→WebVTT conversion (original preserved); admin upload API (multipart, 8 GB cap, extension whitelist); stream-info with title+episode resolution; playback progress API (upsert, 95% completion); continue-watching feed; Watch Now button on detail pages (only when AVAILABLE); VideoPlayer (HTML5 + HLS.js, play/pause/seek/volume/speed/fullscreen/subtitles/keyboard/buffering/error/resume/next-episode); Continue Watching row on home. Seeded 4 verified watchable movies (Blender CC-BY + PD via Archive.org) with TMDB deep-sync and deduped source registration. Fixed TMDB id mismatches (2 wrong titles detached and unpublished). **Real playback verified in browser: Big Buck Bunny plays end-to-end, resume works, progress saves.** Tests 159/159, lint 0, builds clean. |
| 2026-11-01 | 5 | **Authentication & profiles complete.** argon2id hashing; 15-min access JWT (memory-only client-side) + 30-day rotating refresh cookie (hashed at rest, family revocation on reuse); profile CRUD (max 5, avatar presets, preferences API); requireAuth/requireRole RBAC replacing the bootstrap token; rate-limited auth endpoints. Frontend: login/register, 'Who's watching?' profile screen, navbar auth state, silent-refresh bootstrap, protected routes. **Root-caused the vitest worker crash: an infinite redirect loop in ProtectedRoute.test's route map** (login remapped to the gate); harness fixed, batches documented. Live-verified: register, profile create/switch, session persistence across reload, sign out. Tests 159/159 (server 89, client 70), lint 0, builds clean. |
| 2026-10-31 | 4 | **Data foundation & catalog sync complete.** Embedded PostgreSQL 18 via ADR #3 (binaries driven directly so the daemon survives scripts); db:start/stop/status/reset; migration phase4_catalog_baseline (16 tables incl. titles/genres/seasons/episodes, video_sources/assets/subtitles with license+territory fields, import_jobs). Genre composite PK fix ((id, tmdb_type) — TMDB shares ids across movie/TV). Sync engine: 9 sources, bounded pages, pacing, retries, dedupe, import_jobs audit, deep-sync per title; bootstrap-token admin API; public stats/availability. **280 unique titles imported live (dedupe verified: re-run = 0 created); watchable 0 (no sources yet — honest); DB 9.3 MB.** Tests 116/116, lint 0, builds clean. |
| 2026-10-31 | 3 | **Phase 3 complete.** Detail pages (movies + TV with season/episode browser), person pages, debounced navbar search with suggestions + results page, advanced /discover with URL-driven filters, trailer modal, clickable cards + hero More Info, ScrollToTop. Server: detail/season/person/search/discover endpoints with whitelisted params. Tests 99/99 (50 server + 49 client), lint 0, builds clean, browser-verified live. Fixed TV default-season bug (season 0 shadowing). |
| 2026-10-31 | 2 | **Phase 2 implemented.** Server: TmdbClient + TmdbCache (single-flight) + normalizers + CatalogService + 13 catalog routes with validation; 18 new tests. Client: TanStack Query adoption, apiClient with envelope mapping, Hero/MediaRow/MediaCard/ErrorState/skeletons, home with hero + 10 rows, 4 catalog pages with URL pagination, navbar/footer wiring, attribution; 19 new tests. Verified: 65/65 tests, typecheck ×2, lint 0, builds ×2, browser smoke of error states. Token requested from user for live verification. |
| 2026-10-31 | 1 | **Phase 1 complete.** Monorepo, hardened API skeleton, premium UI shell, 28 tests, builds, git initialized. |
| 2026-10-31 | 0 | Environment audited; six planning docs reconciled to the streaming-platform spec (v2). |
