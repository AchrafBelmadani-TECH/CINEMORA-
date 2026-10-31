# CINEMORA — Development Progress

> Living status tracker, updated at the end of every phase. Latest changelog entry first.

## Current Status

| | |
|---|---|
| **Phase** | **3 of 8 — Details, seasons/episodes, search & filters** |
| **State** | ✅ **COMPLETE** — implemented, tested (99/99), built, and live-verified in the browser (2026-10-31) |
| **App runnable?** | Yes — `npm run dev`. Detail pages, person pages, search with suggestions, and advanced discovery all live against real TMDB data |
| **Next** | Phase 4 — PostgreSQL, authentication & profiles (**awaiting user approval**; ⚑ ADR #3 embedded-postgres sign-off needed) |

## Phase Tracker

| Phase | Theme | Status | Notes |
|---|---|---|---|
| 0 | Documentation & reconciliation | ✅ done | Six docs reconciled to the streaming spec (v2) |
| 1 | Foundation & premium UI shell | ✅ done | 2026-10-31 |
| 2 | Homepage, catalog & TMDB | ✅ done | Live data verified 2026-10-31 |
| 3 | Details, search & filters | ✅ **done** | Browser-verified 2026-10-31; see DoD below |
| 4 | PostgreSQL, auth & profiles | ⬜ pending | ⚑ ADR #3 embedded-postgres sign-off needed |
| 5 | Watchlist, favorites, history, progress | ⬜ pending | |
| 6 | Video player & authorized streaming | ⬜ pending | Requires FFmpeg/FFprobe on host |
| 7 | Admin dashboard & content management | ⬜ pending | |
| 8 | Hardening, testing & deployment | ⬜ pending | |

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
| 2026-10-31 | 2 | **Phase 2 implemented.** Server: TmdbClient + TmdbCache (single-flight) + normalizers + CatalogService + 13 catalog routes with validation; 18 new tests. Client: TanStack Query adoption, apiClient with envelope mapping, Hero/MediaRow/MediaCard/ErrorState/skeletons, home with hero + 10 rows, 4 catalog pages with URL pagination, navbar/footer wiring, attribution; 19 new tests. Verified: 65/65 tests, typecheck ×2, lint 0, builds ×2, browser smoke of error states. Token requested from user for live verification. |
| 2026-10-31 | 1 | **Phase 1 complete.** Monorepo, hardened API skeleton, premium UI shell, 28 tests, builds, git initialized. |
| 2026-10-31 | 0 | Environment audited; six planning docs reconciled to the streaming-platform spec (v2). |
