# CINEMORA — Database Design

> Status: v2.0 · 2026-10-31 · Reconciled with the streaming-platform spec. Schema created via Prisma Migrate, phase by phase.

## 1. Principles

- PostgreSQL stores **user data + the local distributable catalog + asset metadata**. TMDB remains the live discovery source (proxied + cached); we do **not** mirror the TMDB universe — only titles the platform distributes (or curates) get local rows.
- **Large binaries never live in Postgres** (spec §11): video/subtitle files live in the storage layer; the DB keeps only keys and metadata.
- Personal data is **profile-scoped** (one account → up to 5 profiles, each with its own watchlist/favorites/history/progress/preferences), with `user_id` retained for integrity and admin queries.
- Title references carry a small **snapshot** (`title`, `poster_path`, `release_date`, `vote_average`) so personal pages render without N upstream calls.
- UUID PKs for user-facing aggregates; TMDB integer ids where bridging to TMDB. All timestamps `timestamptz` (UTC).

## 2. Migration Plan (phases → tables)

| Migration | Phase | Creates |
|---|---|---|
| `phase1_baseline` | 4 | `users` |
| `phase4_auth` | 4 | `refresh_tokens`, `profiles`, `user_preferences` |
| `phase5_personal` | 5 | `list_items`, `viewing_history`, `playback_progress` |
| `phase6_catalog_media` | 6 | `titles`, `genres`, `title_genres`, `people`, `title_credits`, `seasons`, `episodes`, `video_assets`, `subtitle_tracks` |
| `phase7_reviews` | 7 | `reviews` |

## 3. Entity-Relationship Overview

```
users 1──* refresh_tokens                     titles 1──* seasons 1──* episodes
users 1──* profiles 1──1 user_preferences     titles 1──* video_assets *──1 episodes (nullable)
              │                               video_assets 1──* subtitle_tracks
              ├──* list_items (watchlist|favorites)      titles ↔ genres (title_genres)
              ├──* viewing_history                          titles ↔ people (title_credits)
              ├──* playback_progress            titles 1──* reviews (profile-scoped)
              └──* reviews
list_items / viewing_history / playback_progress reference media by
(media_type, tmdb_id) for TMDB-discovered titles OR catalog title_id when local.
```

## 4. Identity & Profiles (Phase 4)

### 4.1 `users`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | |
| `email` | text | `NOT NULL UNIQUE` (lowercased; Zod-validated) |
| `password_hash` | text | `NOT NULL` (argon2id) |
| `display_name` | text | 2–50 chars |
| `role` | enum `UserRole { USER, ADMIN }` | default `USER` |
| `is_disabled` | boolean | default false (admin kill-switch) |
| `created_at` / `updated_at` | timestamptz | |

### 4.2 `refresh_tokens`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users `ON DELETE CASCADE` | |
| `token_hash` | text | `NOT NULL UNIQUE` (SHA-256 of raw token) |
| `family_id` | uuid | `NOT NULL`, indexed (rotation chain / theft detection) |
| `expires_at` | timestamptz | 30 days |
| `revoked_at` | timestamptz | nullable |
| `created_at` | timestamptz | |

### 4.3 `profiles`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users `ON DELETE CASCADE` | |
| `name` | text | 1–25 chars |
| `avatar_key` | text | preset gallery key (e.g. `aurora`, `nova`…) — no user file uploads |
| `created_at` / `updated_at` | timestamptz | |

Max 5 per account (app-enforced + advisory). Index `(user_id)`.

### 4.4 `user_preferences` (1:1 with profile)
| Column | Type | Notes |
|---|---|---|
| `profile_id` | uuid PK, FK → profiles `ON DELETE CASCADE` | |
| `preferred_language` | text | UI/content language hint (BCP-47), default `en` |
| `subtitle_language` | text | default subtitle pick, nullable |
| `autoplay_next` | boolean | default true |

## 5. Personal Library (Phase 5)

### 5.1 `list_items` (watchlist + favorites — unified, list_type discriminator)
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | |
| `user_id` / `profile_id` | uuid FKs (cascade) | profile scoping |
| `list_type` | enum `LIST_TYPE { WATCHLIST, FAVORITES }` | |
| `media_type` | enum `MEDIA_TYPE { MOVIE, TV }` | |
| `tmdb_id` | integer | `NOT NULL` |
| `title`, `poster_path`, `release_date`, `vote_average` | snapshot | |
| `created_at` | timestamptz | "added on" |

**UNIQUE** `(profile_id, list_type, media_type, tmdb_id)` — idempotent adds.
**INDEX** `(profile_id, list_type, created_at DESC)`.

### 5.2 `viewing_history`
Same shape as `list_items` minus `list_type`, plus `watched_at` (default now, bumped on revisit).
**UNIQUE** `(profile_id, media_type, tmdb_id)` · **INDEX** `(profile_id, watched_at DESC)`.

### 5.3 `playback_progress`
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | |
| `user_id` / `profile_id` | uuid FKs (cascade) | |
| `video_asset_id` | uuid FK → video_assets `ON DELETE CASCADE` | |
| `position_seconds` | integer | `>= 0` |
| `duration_seconds` | integer | for completion math |
| `completed` | boolean | position ≥ 95% |
| `updated_at` / `created_at` | timestamptz | |

**UNIQUE** `(profile_id, video_asset_id)` (upsert) · **INDEX** `(profile_id, updated_at DESC)` for Continue Watching.

## 6. Local Catalog & Media (Phase 6)

The local catalog represents **distributable/curated titles**. Discovery of the wider TMDB universe stays proxied.

### 6.1 `titles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tmdb_id` / `tmdb_media_type` | int + enum | `UNIQUE(tmdb_id, tmdb_media_type)`, nullable for standalone entries |
| `kind` | enum `TITLE_KIND { MOVIE, TV }` | |
| `title`, `original_title` | text | admin/TMDB-sourced |
| `overview` | text | |
| `poster_path`, `backdrop_path` | text | TMDB paths or uploaded overrides |
| `release_date` | date | |
| `vote_average` | numeric(3,1) | snapshot |
| `runtime_minutes` | int | movies |
| `status`, `original_language` | text | TMDB fields |
| `is_published` | boolean | admin publish flag |
| `created_by` | uuid FK → users | audit |
| `created_at` / `updated_at` | timestamptz | |

### 6.2 `genres` + `title_genres`
`genres(id int PK [TMDB genre id], name, tmdb_media_type)`; join `title_genres(title_id FK, genre_id FK, PK(title_id, genre_id))`.

### 6.3 `people` + `title_credits`
`people(id uuid PK, tmdb_id int UNIQUE nullable, name, profile_path)`;
`title_credits(id, title_id FK, person_id FK, credit_role enum {CAST, CREW}, character text nullable, job text nullable, sort_order int, PK-adjacent index (title_id))`.

### 6.4 `seasons` / `episodes`
- `seasons(id uuid PK, title_id FK cascade, season_number int, name, overview, poster_path, air_date, UNIQUE(title_id, season_number))`
- `episodes(id uuid PK, season_id FK cascade, episode_number int, name, overview, still_path, runtime_minutes, air_date, UNIQUE(season_id, episode_number))`

### 6.5 `video_assets`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `title_id` | uuid FK → titles cascade | movies (episode_id NULL) |
| `episode_id` | uuid FK → episodes cascade | episodes (title_id NULL) |
| `status` | enum `ASSET_STATUS { PENDING, VALIDATING, TRANSCODING, READY, FAILED }` | |
| `failure_reason` | text | nullable |
| `license_type` | enum `LICENSE { PUBLIC_DOMAIN, LICENSED, USER_UPLOAD }` | **mandatory** — legality record |
| `license_ref` | text | URL/document id of permission basis |
| `source_key` | text | storage key of original upload |
| `hls_prefix` | text | `hls/<assetId>/` once READY |
| `duration_seconds` | int | from ffprobe |
| `qualities` | text[] | e.g. `{480p,720p,1080p}` |
| `size_bytes` | bigint | original size |
| `checksum_sha256` | text | integrity |
| `uploaded_by` | uuid FK → users | |
| `created_at` / `updated_at` | timestamptz | |

CHECK constraint: exactly one of (`title_id`, `episode_id`). Index `(status)` for admin monitoring.

### 6.6 `subtitle_tracks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `video_asset_id` | uuid FK cascade | |
| `language` | text | BCP-47 |
| `label` | text | "English (SDH)" |
| `source_format` | enum `{SRT, VTT}` | uploads converted to WebVTT |
| `storage_key` | text | converted `.vtt` |
| `is_default` | boolean | |
| `created_at` | timestamptz | |

UNIQUE `(video_asset_id, language)`.

## 7. Reviews (Phase 7)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` / `profile_id` | uuid FKs cascade | |
| `title_id` | uuid FK → titles cascade | reviews attach to local catalog titles |
| `rating` | int | 1–10 CHECK |
| `body` | text | ≤ 2000 chars |
| `contains_spoilers` | boolean | default false |
| `created_at` / `updated_at` | timestamptz | |

UNIQUE `(profile_id, title_id)`. Index `(title_id, created_at DESC)`.

## 8. Prisma Sketch — identity, profiles & personal data (authoritative at Phase 4/5)

```prisma
enum UserRole { USER ADMIN }
enum MediaType { MOVIE TV }
enum ListType  { WATCHLIST FAVORITES }

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String   @map("password_hash")
  displayName  String   @map("display_name")
  role         UserRole @default(USER)
  isDisabled   Boolean  @default(false) @map("is_disabled")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz
  refreshTokens RefreshToken[]
  profiles      Profile[]
  @@map("users")
}

model RefreshToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique @map("token_hash")
  familyId  String    @map("family_id") @db.Uuid
  expiresAt DateTime  @map("expires_at") @db.Timestamptz
  revokedAt DateTime? @map("revoked_at") @db.Timestamptz
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz
  @@index([familyId]) @@index([userId])
  @@map("refresh_tokens")
}

model Profile {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  avatarKey String   @map("avatar_key")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  preferences UserPreference?
  listItems        ListItem[]
  viewingHistory   ViewingHistory[]
  playbackProgress PlaybackProgress[]
  @@index([userId])
  @@map("profiles")
}

model UserPreference {
  profileId        String  @id @map("profile_id") @db.Uuid
  profile          Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  preferredLanguage String @default("en") @map("preferred_language")
  subtitleLanguage String? @map("subtitle_language")
  autoplayNext     Boolean @default(true) @map("autoplay_next")
  @@map("user_preferences")
}

model ListItem {
  id           String    @id @default(uuid()) @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  profileId    String    @map("profile_id") @db.Uuid
  profile      Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  listType     ListType  @map("list_type")
  mediaType    MediaType @map("media_type")
  tmdbId       Int       @map("tmdb_id")
  title        String
  posterPath   String?   @map("poster_path")
  releaseDate  DateTime? @map("release_date") @db.Date
  voteAverage  Decimal?  @map("vote_average") @db.Decimal(3, 1)
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz
  @@unique([profileId, listType, mediaType, tmdbId])
  @@index([profileId, listType, createdAt(sort: Desc)])
  @@map("list_items")
}
// ViewingHistory and PlaybackProgress follow the same pattern per §5.2/§5.3.
// Catalog/media models (§6) land as Prisma models with migration phase6_catalog_media.
```

## 9. Policies

- Migrations are committed; `prisma migrate dev` locally, `prisma migrate deploy` in CI/prod. No hand-applied SQL.
- Deleting a user cascades identity → profiles → all personal data (GDPR-friendly).
- `video_assets` deletion **must** remove storage objects (service-layer responsibility) — DB cascade alone is not enough; Phase 7 acceptance covers it.
- No FK from personal data to TMDB — `(media_type, tmdb_id)` is a soft reference by design.
