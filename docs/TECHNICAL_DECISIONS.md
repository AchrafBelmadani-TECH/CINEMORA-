# CINEMORA — Technical Decisions (ADR log)

> Status: v2.0 · 2026-10-31 · ⚑ = needs user sign-off before the phase that relies on it.

## 1. Monorepo with npm workspaces
One repo, `client/` + `server/`, shared root scripts. Environment has npm only. **Kept.**

## 2. Backend-for-Frontend — client never talks to TMDB
Express proxies, normalizes and caches all TMDB traffic; the key stays in `server/env`. **Kept — non-negotiable.**

## 3. PostgreSQL without Docker: embedded-postgres for dev ⚑
No Docker/PostgreSQL on this machine (audited 2026-10-31). Proposal: `embedded-postgres` npm package runs official PG 16 binaries locally; `DATABASE_URL` stays standard so staging/prod use managed Postgres unchanged. Now needed by **Phase 4**. Alternative: user-installed Postgres via env var. *Awaiting sign-off.*

## 4. Prisma ORM with committed migrations
`prisma migrate` from day one (never `db push`). **Kept.**

## 5. JWT access (memory) + rotating refresh cookie
15-min access JWT in body → Zustand memory only; 30-day 256-bit refresh in httpOnly cookie, SHA-256-hashed in DB, rotation + family revocation on reuse. **Kept.** *(v2: JWT now also carries `profileId` + `role`.)*

## 6. argon2id password hashing
`argon2` (prebuilt win-x64 binaries). **Kept.**

## 7. Zod validation at every boundary
Schemas validate inputs and export inferred types reused by controllers. **Kept.**

## 8. Native `fetch`, no HTTP library
Node 24 + browser native fetch; small typed wrappers. **Kept.**

## 9. Zustand (client state) + TanStack Query (server state) ⚑
Spec stack lists Zustand only; discovery UIs are server-state dominated. Proposal: TanStack Query from **Phase 2** for caching/pagination/optimistic toggles; Zustand for auth/UI/player prefs. *Awaiting sign-off (fallback: hand-rolled hooks, same architecture).*

## 10. URL as state (React Router)
Search/filter state in query params. **Kept.**

## 11. Tailwind v4 with a token layer
Design tokens (spec palette, exact hex) in `@theme`; `components/ui` is the only ad-hoc-composition zone. **Kept** *(palette updated to spec colors in v2).*

## 12. In-memory TTL cache for TMDB (+ single-flight)
Per-endpoint TTLs; DB-backed cache only if multi-process (Phase 8 option). **Kept.**

## 13. Cross-platform scripts (Windows first)
All npm scripts Node-file-based or `cross-env`; no bare shell syntax. **Kept — validated by Phase 1 implementation.**

## 14. Testing stack
Vitest (unit both sides) · Supertest + real Postgres (integration) · RTL (components) · Playwright (Phase 8 E2E). **Kept.**

## 15. Content legality (hard rule, restated for streaming scope)
TMDB supplies **metadata and images only** — never full movie files; trailers embed via official YouTube keys. The platform streams **only** content it has permission to distribute: public-domain works, licensed content, and authorized uploads. Every `video_asset` records a license basis; uploads without one are rejected. No scraping, no rehosting, no deep-linking pirated sources, and no UI that pretends unplayable content is playable (clear unavailable states instead). **Kept and extended.**

## 16. Rejected alternatives (v1 list stands)
Next.js SSR · SQLite · GraphQL · localStorage tokens · mirroring TMDB wholesale.

---

## 17. Hybrid catalog model (v2 — resolves the spec-vs-v1 contradiction)
**Context:** Spec requires admin-managed Movies/Series/Seasons/Episodes entities, but TMDB already is the discovery universe and forbids/nauseates wholesale mirroring.
**Decision:** Two-tier catalog. (a) *Discovery* — live TMDB proxy + cache, no local rows. (b) *Distributable catalog* — local `titles/seasons/episodes` rows created by admin import/entry, linked to TMDB ids when they exist; only these own `video_assets` and are playable.
**Consequences:** browsing stays cheap and fresh; playback/admin operate on a small governed set; no ToS gray zone; "Add movie" in admin = create local entry (+ TMDB metadata import), never "enable a TMDB stream".

## 18. Streaming pipeline: FFmpeg → HLS → HLS.js (v2)
**Decision:** Admin uploads original → ffprobe validation → FFmpeg transcodes to HLS fmp4 ladders (480/720/1080, 6 s segments) → storage abstraction → client plays via **HLS.js** (adaptive quality). In-process serial transcode queue in Phase 6; BullMQ/Redis only if Phase 8 scale demands it.
**Consequences:** real adaptive streaming, seekable, CDN-ready; requires FFmpeg/FFprobe on the host (system dependency — availability checked at Phase 6 start; PATH-configurable via env).

## 19. Subtitles: SRT → WebVTT server-side (v2)
**Decision:** SRT uploads are converted to WebVTT at intake; the player consumes native `<track>` sources only.
**Consequences:** no client-side parser dependency; one canonical format stored; validation is trivial (parse during conversion; malformed files rejected).

## 20. Storage abstraction: local dev, S3-compatible prod (v2)
**Decision:** `MediaStorage` interface (`put/get/url/delete`) with `LocalStorage` (dev: `storage/` served by Express with Range support) and `S3Storage` (prod: pre-signed URLs/CDN). Selected by `STORAGE_DRIVER`.
**Consequences:** dev needs zero infra; prod swap is config-only; originals are never publicly served — only HLS output/subtitles via signed or validated paths.

## 21. RBAC: USER / ADMIN + profile scoping (v2)
**Decision:** `users.role` enum; `requireAuth` → `requireRole('ADMIN')` middleware chain guards `/admin/*`; first admin seeded from `ADMIN_BOOTSTRAP_EMAIL`. Personal APIs scope strictly by JWT `profileId`.
**Consequences:** tiny role model fits the product; profile switching re-issues the access token (no stale-scope leakage); every personal endpoint tests both authorization *and* scoping.

## 22. Framer Motion for transitions & micro-interactions (v2)
**Decision:** Spec-listed. Page transitions, hover lifts, hero entrance; all motion behind `prefers-reduced-motion` checks.
**Consequences:** expressive UI without hand-written animation code; bundle cost accepted (lazy-loaded where sensible).

## 23. Upload hardening (v2)
**Decision:** streamed multipart (multer busboy storage, never memory-buffer whole files); caps — video ≤ 8 GB, subtitle ≤ 1 MB; extension+MIME whitelist; ffprobe sniffing; randomized storage keys; originals outside the public root; per-admin audit fields (`uploaded_by`, checksum).
**Consequences:** upload surface is validated at three layers before transcode; storage keys can't collide or traverse.

## 24. Preset avatars for profiles (v2)
**Context:** Spec asks "choose avatar"; user file uploads add a whole image-pipeline attack surface.
**Decision:** curated gradient/illustration avatar gallery keyed by `avatar_key` (Phase 4). No user file uploads in current scope.
**Consequences:** profile avatars are safe and instant; custom image upload stays in backlog with its own ADR if ever needed.

## 25. "Recommended For You": simple, honest, history-based (v2)
**Decision:** Phase 5 recommendation row = TMDB recommendations/similar for recent history items (per profile). No ML, no black-box scoring; absent for guests/new profiles rather than faked with popular data.
**Consequences:** genuinely personal from day one; upgradeable later without schema change.
