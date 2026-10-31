# CINEMORA — API Design

> Status: v2.0 · 2026-10-31 · Base URL: `/api/v1` · JSON only · Each group tagged with its phase.

## 1. Conventions

- **Auth:** `Authorization: Bearer <accessToken>` (JWT, 15 min, claims `sub` · `profileId` · `role`). Refresh via httpOnly cookie.
- **Pagination:** TMDB-backed → `?page=N`; owned data → in-memory pages (50/page). Responses: `{ page, totalPages, totalResults, items }`.
- **Validation:** Zod on every body/query; failures → 400 with field-level `details`.
- **Environments:** dev same-origin via Vite proxy; production served by Express behind `/api/v1`.

### 1.1 Error envelope (all non-2xx)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "path": "email", "message": "Invalid email" }], "requestId": "req_…" } }
```

### 1.2 Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | malformed/invalid input (incl. rejected uploads) |
| `UNAUTHORIZED` | 401 | missing/expired/invalid token |
| `FORBIDDEN` | 403 | wrong role / disabled account |
| `NOT_FOUND` | 404 | resource doesn't exist (incl. TMDB 404) |
| `CONFLICT` | 409 | e.g. email taken, profile limit reached |
| `PAYLOAD_TOO_LARGE` | 413 | upload exceeds cap |
| `RATE_LIMITED` | 429 | our limit or TMDB's |
| `UPSTREAM_ERROR` | 502 | TMDB unreachable/5xx/misconfigured |
| `INTERNAL_ERROR` | 500 | unexpected (logged, not leaked) |

### 1.3 Rate limits

`/auth/*` write routes: 10/min/IP · general API: 240/min/IP · uploads: 5 concurrent/admin.

---

## 2. Health — Phase 1

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ status:"ok", version, uptime }` |

## 3. Catalog (TMDB proxy, cached) — Phases 2–3

| Method | Path | Phase | Description |
|---|---|---|---|
| GET | `/movies/trending?window=day\|week` · `/movies/popular` · `/movies/top-rated` · `/movies/upcoming` | 2 | movie lists |
| GET | `/tv/trending?window=day\|week` · `/tv/popular` · `/tv/top-rated` · `/tv/on-the-air` | 2 | series lists |
| GET | `/genres?mediaType=movie\|tv` | 2 | genre list (24 h cache) |
| GET | `/discover?mediaType=&genres=&yearFrom=&yearTo=&voteAverageGte=&language=&sortBy=&page=` | 3 | filtered browse; `sortBy` whitelisted server-side |
| GET | `/search/multi?query=&page=` | 3 | movies + series + people |
| GET | `/movies/:id` · `/tv/:id` | 3 | detail with credits, videos, recommendations (single upstream call) |
| GET | `/tv/:id/season/:n` | 3 | season episodes |
| GET | `/people/:id` | 3 | person + filmography |

```json
// shared list item shape (normalized DTO)
{ "mediaType": "movie", "tmdbId": 693134, "title": "Dune: Part Two",
  "posterPath": "/1pdf…", "backdropPath": "/xOMo…", "voteAverage": 8.2,
  "releaseDate": "2024-02-27", "genreIds": [878, 12] }
```

Detail adds: `overview, runtimeMinutes, genres, status, originalLanguage, tagline, credits.{cast,crew}, videos[], recommendations{…}, seasons[]` (TV). `videos` = TMDB YouTube keys only (trailer embeds). Upstream status mapping per ARCHITECTURE §5.4; image paths returned bare (client prefixes the image CDN).

## 4. Auth — Phase 4

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | `{ email, password, displayName }` → 201 user + accessToken + refresh cookie |
| POST | `/auth/login` | → 200 user + tokens (generic 401 on bad credentials) |
| POST | `/auth/refresh` | rotate (cookie); reuse of revoked token ⇒ revoke family ⇒ 401 |
| POST | `/auth/logout` | revoke family → 204 (idempotent) |
| GET | `/auth/me` | current user + active profile |

Password ≥ 10 chars (letters + digits); displayName 2–50; email lowercased. First profile is created automatically at register.

## 5. Profiles & Preferences — Phase 4

| Method | Path | Description |
|---|---|---|
| GET | `/profiles` | account's profiles (id, name, avatarKey) |
| POST | `/profiles` | `{ name, avatarKey }` → 201; >5 → 409 `CONFLICT` |
| PATCH | `/profiles/:id` | rename / change avatar (owner-only, else 403) |
| DELETE | `/profiles/:id` | owner-only; last remaining profile → 400 |
| POST | `/profiles/:id/activate` | switch active profile → new access token with that `profileId` |
| GET/PUT | `/me/preferences` | preferredLanguage · subtitleLanguage · autoplayNext |

## 6. Personal Lists & History — Phase 5 *(profile-scoped via token)*

| Method | Path | Description |
|---|---|---|
| GET | `/lists/:listType/watchlist\|favorites?mediaType=&page=` | per-profile items, newest first |
| PUT | `/lists/:listType/items/:mediaType/:tmdbId` | idempotent add (snapshot body) |
| DELETE | `/lists/:listType/items/:mediaType/:tmdbId` | idempotent remove → 204 |
| GET | `/history?page=` | viewing history |
| POST | `/history` | record/bump (snapshot body) → 201 |
| DELETE | `/history/items/:mediaType/:tmdbId` · `DELETE /history` | remove one / clear |

```json
// PUT /lists/watchlist/items/movie/693134  body
{ "title": "Dune: Part Two", "posterPath": "…", "releaseDate": "2024-02-27", "voteAverage": 8.2 }
```

## 7. Playback — Phases 5–6

| Method | Path | Phase | Description |
|---|---|---|---|
| POST | `/playback/progress` | 5–6 | `{ videoAssetId, positionSeconds, durationSeconds }` upsert (throttled client-side to ≤ 1 write/10 s + on pause/exit) |
| GET | `/playback/progress/:videoAssetId` | 6 | resume point for the active profile |
| GET | `/playback/continue-watching` | 6 | continue-watching feed (incomplete, recent first) |
| GET | `/titles/:titleIdOrTmdbId/stream-info` | 6 | resolve playable asset: `{ available: true, videoAssetId, hlsUrl, durationSeconds, qualities[], subtitles[] }` or `{ available: false, reason: "NO_AUTHORIZED_SOURCE" \| "NOT_YET_READY" \| "REGION_BLOCKED" }` — **never an error code for ordinary unavailability** |

`stream-info` requires auth + profile; `hlsUrl` points at `/media/hls/…` (dev, Range-enabled) or a pre-signed URL (prod). Subtitles: `{ id, language, label, isDefault, url }` (WebVTT).

## 8. Admin — Phase 7 (`requireRole('ADMIN')` on every route)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/analytics/summary` | users, profiles, plays, top titles, storage usage |
| GET/POST | `/admin/titles` · GET/PATCH/DELETE `/admin/titles/:id` | local catalog CRUD (`is_published` gate) |
| POST | `/admin/titles/import-tmdb` | `{ mediaType, tmdbId }` → creates local entry + metadata |
| POST | `/admin/titles/:id/seasons` · PATCH/DELETE `/admin/seasons/:id` | season management |
| POST | `/admin/seasons/:id/episodes` · PATCH/DELETE `/admin/episodes/:id` | episode management |
| POST | `/admin/media/video` | multipart upload: `file` + `titleId\|episodeId` + `licenseType` + `licenseRef` → 202 `{ videoAssetId, status:"PENDING" }` |
| POST | `/admin/media/video/:id/retry` | re-queue failed transcode |
| GET | `/admin/media/video?status=` | asset pipeline monitor |
| POST | `/admin/media/video/:id/subtitles` | `file` (srt/vtt ≤ 1 MB) + `language` + `label` → 201 track |
| DELETE | `/admin/media/subtitles/:id` | remove track |
| GET | `/admin/users?q=&page=` · PATCH `/admin/users/:id` | list; set role / disable |
| GET/POST/PATCH/DELETE | `/admin/genres` | genre taxonomy |

Upload rules (enforced pre-controller): video ≤ 8 GB streamed, `.mp4/.mkv/.webm` only; ffprobe must validate; license fields mandatory — otherwise 400 `VALIDATION_ERROR` with details. Delete of a title/asset cascades to storage objects (hls segments, subtitles) server-side.

## 9. Reviews — Phase 7 (on local catalog titles)

| Method | Path | Description |
|---|---|---|
| GET | `/titles/:id/reviews?page=` | public, newest first |
| POST | `/titles/:id/reviews` | `{ rating 1–10, body ≤ 2000, containsSpoilers }` (one per profile) |
| DELETE | `/reviews/:id` | author-profile only |

## 10. Media delivery — Phase 6

| Method | Path | Description |
|---|---|---|
| GET | `/media/hls/:assetId/:file` | dev: Express serves segments/playlists with Range + correct MIME; access validated against asset status `READY` |
| GET | `/media/subtitles/:trackId.vtt` | WebVTT files |

Production swaps these for pre-signed S3/CDN URLs (`stream-info` returns them directly); no route change for the client player beyond honoring returned URLs.
