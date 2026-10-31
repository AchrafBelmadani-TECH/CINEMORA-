# CINEMORA — Development Progress

> Living status tracker, updated at the end of every phase. Latest changelog entry first.

## Current Status

| | |
|---|---|
| **Phase** | **2 of 8 — Homepage, navigation, catalog & TMDB integration** |
| **State** | ✅ **COMPLETE** — token configured, live TMDB data verified end-to-end in browser and production build (2026-10-31) |
| **App runnable?** | Yes — `npm run dev`. Live posters, titles, ratings, genre names, hero and all catalog pages verified against real TMDB data |
| **Next** | Phase 3 — details, seasons/episodes, search & filters (**awaiting user approval**) |

## Phase Tracker

| Phase | Theme | Status | Notes |
|---|---|---|---|
| 0 | Documentation & reconciliation | ✅ done | Six docs reconciled to the streaming spec (v2) |
| 1 | Foundation & premium UI shell | ✅ done | 2026-10-31 |
| 2 | Homepage, catalog & TMDB | ✅ **done** | Live data verified 2026-10-31; see DoD below |
| 3 | Details, search & filters | ⬜ pending | |
| 4 | PostgreSQL, auth & profiles | ⬜ pending | ⚑ ADR #3 embedded-postgres sign-off needed |
| 5 | Watchlist, favorites, history, progress | ⬜ pending | TanStack Query already adopted (Phase 2) |
| 6 | Video player & authorized streaming | ⬜ pending | Requires FFmpeg/FFprobe on host |
| 7 | Admin dashboard & content management | ⬜ pending | |
| 8 | Hardening, testing & deployment | ⬜ pending | |

## Phase 2 — Definition of Done

- [x] TMDB service: bearer client (8 s timeout, 1 retry on network/5xx/429), DTO normalizers (movie/tv field mapping, per-item `media_type` inference), TTL cache + single-flight, upstream error mapping (404→NOT_FOUND, 401→UPSTREAM_ERROR, 429→RATE_LIMITED, network→UPSTREAM_ERROR)
- [x] Catalog API: `/movies/{trending,popular,top-rated,upcoming,genre/:id}`, `/tv/{trending,popular,top-rated,on-the-air,genre/:id}`, `/discover`, `/genres` — Zod-validated params (page 1–500, window day/week, mediaType whitelist)
- [x] Client: TanStack Query layer (ADR #9), typed api client with error-envelope mapping, `useCatalogList`/`useCatalogGenre`/`useGenres` hooks with URL-driven pagination
- [x] Homepage: rotating cinematic hero (trending day, auto-advance + slide dots, `prefers-reduced-motion` aware) + 10 rows (Trending Now, Popular Movies, Top Rated, Latest Releases, Action, Sci-Fi, Drama, Horror, Comedy, Popular TV) with genre-name lookup
- [x] Pages: `/movies`, `/series`, `/genres`, `/genre/:id?type=` — paginated grids with URL state; Navbar gains Movies/Series/Genres; footer gains required TMDB attribution
- [x] States: skeletons (hero/row/grid), designed error states with wired retry per row/page, empty states; no fake rows — "Recommended For You"/"Continue Watching" correctly absent until Phases 5–6
- [x] Cards are non-clickable (detail pages = Phase 3); no search box yet; no Watch buttons anywhere
- [x] Tests: **server 37/37** (cache single-flight/TTL/failure, route happy/error/validation incl. cache-hit-serves-second-request), **client 28/28** (apiClient envelope mapping, MediaCard, MediaRow, ErrorState, HomePage rows+links+error, MoviesPage pagination via URL, App nav+attribution)
- [x] `npm run lint` → 0 problems · typechecks clean both workspaces · production builds both succeed (client 145 KB gzip)
- [x] **Token isolation:** TMDB token lives only in `server/.env`; browser only ever calls `/api/v1/*` (verified live via proxy + code); no key material in client bundle
- [x] **Live smoke (no token):** `/api/v1/movies/trending` → 502 `UPSTREAM_ERROR` "TMDB is not configured — set TMDB_READ_ACCESS_TOKEN in server/.env"; homepage renders hero error card + 10 per-row error cards with retry (browser-verified); `/genres` error states render; validation 400 with field details; attribution visible
- [x] **Live verification (with token):** user's v4 token loaded from `server/.env` (dotenv); `/movies/trending` returns real October-2026 titles with ratings/posters; genres, discover, TV, cache-served second call all verified; homepage hero (real backdrop + overview + slide tabs), all rows with resolved genre names; `/movies` page shows "Page 1 of 500 · 20,001 titles" with 20/20 posters loaded; **201 images from image.tmdb.org, 0 broken**; production build (`node dist/server.js`) serves live data. *Pixel screenshots time out under the hero's continuous crossfade animation — DOM-level checks used instead (stronger evidence)*

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
| 1 | Approval to begin **Phase 3** (details, seasons/episodes, search & filters) | now |
| 2 | ⚑ ADR #3 — embedded-postgres for local dev | Phase 4 |

## Changelog

| Date | Phase | Entry |
|---|---|---|
| 2026-10-31 | 2 | **Phase 2 implemented.** Server: TmdbClient + TmdbCache (single-flight) + normalizers + CatalogService + 13 catalog routes with validation; 18 new tests. Client: TanStack Query adoption, apiClient with envelope mapping, Hero/MediaRow/MediaCard/ErrorState/skeletons, home with hero + 10 rows, 4 catalog pages with URL pagination, navbar/footer wiring, attribution; 19 new tests. Verified: 65/65 tests, typecheck ×2, lint 0, builds ×2, browser smoke of error states. Token requested from user for live verification. |
| 2026-10-31 | 1 | **Phase 1 complete.** Monorepo, hardened API skeleton, premium UI shell, 28 tests, builds, git initialized. |
| 2026-10-31 | 0 | Environment audited; six planning docs reconciled to the streaming-platform spec (v2). |
