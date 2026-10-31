# CINEMORA — Massive Library & Streaming Engine: Architecture & Implementation Plan

> Status: v1.0 · 2026-10-31 · Approved direction from the "Massive Movie Library & Streaming Engine" master brief.
> Governing rule (from the brief): *"Implement the next logical phase only after presenting the architecture and risks."* This document is that presentation; implementation then proceeds one gated increment at a time.

## 1. Audit — what already exists and is preserved

| Capability | State | Reuse in the new system |
|---|---|---|
| TMDB proxy layer (bearer client, retry/timeout, error mapping, TTL cache + single-flight, normalizers) | ✅ Phase 2–3 | The sync engine reuses `TmdbClient` verbatim |
| Discovery UI (home, movies, series, genres, discover, search, detail, person) | ✅ Phase 2–3 | Stays as the live-discovery surface |
| Design system, layouts, error/skeleton states | ✅ Phase 1–3 | Availability badges extend MediaCard/detail pages |
| Server hardening (env fail-fast, helmet, CORS, rate limit, error envelope, request ids) | ✅ Phase 1 | Sync API and library API ride the same pipeline |
| Monorepo, test culture (99 tests), builds | ✅ | Extended, not replaced |
| Database / auth / profiles / player / admin | ❌ not built | These are the increments below |

**Nothing completed is destroyed.** The TMDB discovery proxy remains the browsing surface; the new local catalog adds the *ownership layer* (what we can legally play and everything about it).

## 2. Target architecture (delta from current)

```
                    ┌────────────────────────────────────────────────┐
 TMDB API ──sync──► │  PostgreSQL catalog (owned, deduplicated)      │
 (paced, paginated, │  titles · seasons · episodes · genres          │
  incremental)      │  video_sources · video_assets · subtitles      │
                    │  import_jobs · users · profiles · progress     │
                    └───────────────┬────────────────────────────────┘
                                    │ availability derivation
                                    ▼
 Client ──/api/v1──► Express ──► catalog API (proxy, unchanged)
                  └─► library API (local catalog: stats, availability, stream-info)
                  └─► playback API (Phase 6: HLS, progress)
 Storage/CDN ◄── FFmpeg HLS pipeline (Phase 6) — binaries never in Postgres
```

Key principles:
1. **Two-tier catalog (ADR #17 stands).** TMDB proxy = infinite browsing. Local Postgres = governed distributable set with availability truth. A title is **playable only** when a valid `video_source`/`video_asset` exists; otherwise `UNAVAILABLE`.
2. **Metadata ≠ playability** — enforced in code: `Title.availability` is derived **only** from sources/assets, never from TMDB metadata; imports can never flip it to AVAILABLE.
3. **Postgres stores no media** — only keys/metadata (per brief §6). Media lives behind the storage abstraction (local FS dev / S3+CDN prod).
4. **Sync is incremental, paced and job-tracked** — bounded pages per run, dedupe by TMDB id, per-page retry, `import_jobs` audit; never a full-catalog download.
5. **Seasons/episodes deep-sync on demand** — list sync imports titles cheaply; seasons/episodes sync per title when it gains a source (or explicitly requested) — keeps the 100k-title goal achievable without millions of episode detail calls.

## 3. Data model (Prisma, migration `phase4_catalog_baseline`)

**Identity & profiles** (needed by admin RBAC + later personal features): `users`, `refresh_tokens`, `profiles`, `user_preferences` — exactly as DATABASE_DESIGN.md §4.

**Catalog:** `titles` (unique `(tmdb_type, tmdb_id)`, kind, metadata snapshot, `availability` column, popularity, is_published), `genres` (unique `(tmdb_id, tmdb_media_type)`), `title_genres` join, `seasons` (unique `(title_id, season_number)`), `episodes` (unique `(season_id, episode_number)`).

**Sources & licensing:** `video_sources` (provider, url/storage ref, format, resolution, `license_type` PUBLIC_DOMAIN|CC|LICENSED|USER_UPLOAD, `license_ref`, territories `text[]` with `ALL` wildcard, status, expires_at, added_by), `video_assets` (upload pipeline PENDING→…→READY|FAILED, storage keys, checksum — Phase 6 activation), `subtitle_tracks` (language, label, format, storage key).

**Operations:** `import_jobs` (source, pages requested/completed, items seen/created/updated, errors jsonb, timing) — the audit trail for every sync.

**Indexes:** `titles(kind, popularity desc)`, `titles(availability)`, `titles(release_date desc)`, unique constraints as above, `episodes(season_id, episode_number)`, `import_jobs(status, started_at)`.

**Availability derivation** (`computeTitleAvailability`): any active, unexpired source with territory coverage → `AVAILABLE` (territory-specific `RESTRICTED` is decided at request time); asset `TRANSCODING/VALIDATING` → `PROCESSING`; expired source → `EXPIRED`; none → `UNAVAILABLE`. Column maintained transactionally when sources/assets change; `RESTRICTED` never persisted.

## 4. Phase mapping (brief §8 → roadmap)

| Brief item | Roadmap phase | Scope |
|---|---|---|
| 1. Scalable metadata catalog | **Phase 4 (this increment)** | Postgres baseline, catalog schema, availability column, library stats API |
| 2. Automated TMDB synchronization | **Phase 4 (this increment)** | Sync engine + import jobs + `sync:catalog` script + bootstrap-admin sync API |
| 3. Availability & licensing model | Phase 4 (model) → Phase 6 (UI) | Model + derivation now; badges/filters in UI when playback exists |
| 4. Authorized video-source management | Phase 6 | Source CRUD (admin), ffprobe/HLS pipeline, storage abstraction |
| 5. Video player & HLS playback | Phase 6 | Player, subtitles, progress, continue-watching |
| 6. Admin ingestion tools | Phase 7 | Auth first (Phase 5): users/profiles/RBAC → admin dashboard, deep-sync, moderation |
| 7. Performance & security | Phase 8 | E2E, audits, CDN, multi-process options |

Auth/profiles (Phase 5) stays between 4 and 6 because admin RBAC (§5 of the brief) and playback progress require it.

## 5. Risks & mitigations (presented per the brief)

| Risk | Mitigation |
|---|---|
| **No Docker/native Postgres on this machine** | ADR #3 exercised: `embedded-postgres` runs official PG binaries via npm for dev; `DATABASE_URL` remains standard — production points at any managed Postgres. Data dir gitignored. |
| **TMDB rate limits / marathon syncs** | Bounded pages per job (default small), 250 ms inter-page pacing, per-page retry, job lock (one sync at a time), resumable via `lastPage`. |
| **100k titles ≠ 100k playable** | Explicit non-goal conflation guard: availability derives only from sources; report always shows both numbers. |
| **Seasons/episodes explosion** | Title-level sync only from lists; per-title deep-sync on demand. Episode rows created only for titles we govern. |
| **Legal** | No scraping, no DRM circumvention, no random YouTube substitutes. Sources carry license type + ref + territories + expiry; without a license record nothing becomes AVAILABLE. Phase 6 seeds public-domain/CC content (e.g., Archive.org-hosted) for real playback testing. |
| **Admin API before auth exists** | Interim `x-bootstrap-token` check against `ADMIN_BOOTSTRAP_TOKEN` env (disabled → 503) — a real credential mechanism, replaced by USER/ADMIN RBAC in Phase 5. |
| **App stays runnable** | Every increment ends green: tests, builds, `npm run dev`. |

## 6. Acceptance criteria for the Phase 4 increment (this document's scope)

1. `npm run db:start` boots real PostgreSQL; migrations apply; `db:stop`/`db:reset` work.
2. Sync engine imports real TMDB metadata with dedupe (re-run updates, not duplicates) and records an `import_jobs` row.
3. Library stats API reports truthful counts (titles/episodes/watchable — watchable will be 0 until sources exist).
4. Availability endpoint honestly reports UNAVAILABLE for metadata-only titles.
5. All existing 99 tests still green; new DB/sync tests green; builds clean.
6. Report includes real imported counts and storage footprint.
