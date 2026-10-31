-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'TV');

-- CreateEnum
CREATE TYPE "ListType" AS ENUM ('WATCHLIST', 'FAVORITES');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'PROCESSING', 'EXPIRED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('PUBLIC_DOMAIN', 'CREATIVE_COMMONS', 'LICENSED', 'USER_UPLOAD');

-- CreateEnum
CREATE TYPE "VideoFormat" AS ENUM ('HLS', 'MP4', 'WEBM');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'VALIDATING', 'TRANSCODING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "is_disabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "profile_id" UUID NOT NULL,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "subtitle_language" TEXT,
    "autoplay_next" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "titles" (
    "id" UUID NOT NULL,
    "tmdb_id" INTEGER,
    "tmdb_type" "MediaType",
    "kind" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "overview" TEXT,
    "poster_path" TEXT,
    "backdrop_path" TEXT,
    "release_date" DATE,
    "vote_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "popularity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runtime_minutes" INTEGER,
    "status" TEXT,
    "original_language" TEXT,
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'UNAVAILABLE',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tmdb_type" "MediaType" NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id","tmdb_type")
);

-- CreateTable
CREATE TABLE "title_genres" (
    "title_id" UUID NOT NULL,
    "genreId" INTEGER NOT NULL,
    "tmdb_type" "MediaType" NOT NULL,

    CONSTRAINT "title_genres_pkey" PRIMARY KEY ("title_id","genreId","tmdb_type")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "title_id" UUID NOT NULL,
    "season_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "overview" TEXT,
    "poster_path" TEXT,
    "air_date" DATE,
    "episode_count" INTEGER NOT NULL DEFAULT 0,
    "last_synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "overview" TEXT,
    "still_path" TEXT,
    "air_date" DATE,
    "runtime_minutes" INTEGER,
    "vote_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_sources" (
    "id" UUID NOT NULL,
    "title_id" UUID,
    "episode_id" UUID,
    "provider" TEXT NOT NULL,
    "external_url" TEXT,
    "storage_key" TEXT,
    "format" "VideoFormat" NOT NULL,
    "resolution" TEXT,
    "license_type" "LicenseType" NOT NULL,
    "license_ref" TEXT,
    "territories" TEXT[] DEFAULT ARRAY['ALL']::TEXT[],
    "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ,
    "added_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "video_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" UUID NOT NULL,
    "title_id" UUID,
    "episode_id" UUID,
    "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "source_key" TEXT,
    "hls_prefix" TEXT,
    "duration_seconds" INTEGER,
    "qualities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "size_bytes" BIGINT,
    "checksum_sha256" TEXT,
    "license_type" "LicenseType" NOT NULL,
    "license_ref" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtitle_tracks" (
    "id" UUID NOT NULL,
    "video_source_id" UUID,
    "video_asset_id" UUID,
    "language" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'vtt',
    "storage_key" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtitle_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "list_type" "ListType" NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "poster_path" TEXT,
    "release_date" DATE,
    "vote_average" DECIMAL(3,1),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viewing_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "poster_path" TEXT,
    "release_date" DATE,
    "vote_average" DECIMAL(3,1),
    "watched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viewing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playback_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "video_asset_id" UUID NOT NULL,
    "position_seconds" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "playback_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "pages_requested" INTEGER NOT NULL DEFAULT 1,
    "pages_completed" INTEGER NOT NULL DEFAULT 0,
    "items_seen" INTEGER NOT NULL DEFAULT 0,
    "items_created" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "last_page" INTEGER,
    "message" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "title_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "contains_spoilers" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "profiles_user_id_idx" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "titles_kind_popularity_idx" ON "titles"("kind", "popularity" DESC);

-- CreateIndex
CREATE INDEX "titles_availability_idx" ON "titles"("availability");

-- CreateIndex
CREATE INDEX "titles_release_date_idx" ON "titles"("release_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "titles_tmdb_type_tmdb_id_key" ON "titles"("tmdb_type", "tmdb_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_title_id_season_number_key" ON "seasons"("title_id", "season_number");

-- CreateIndex
CREATE INDEX "episodes_season_id_idx" ON "episodes"("season_id");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_season_id_episode_number_key" ON "episodes"("season_id", "episode_number");

-- CreateIndex
CREATE INDEX "video_sources_title_id_idx" ON "video_sources"("title_id");

-- CreateIndex
CREATE INDEX "video_sources_episode_id_idx" ON "video_sources"("episode_id");

-- CreateIndex
CREATE INDEX "video_sources_status_idx" ON "video_sources"("status");

-- CreateIndex
CREATE INDEX "video_assets_status_idx" ON "video_assets"("status");

-- CreateIndex
CREATE INDEX "video_assets_title_id_idx" ON "video_assets"("title_id");

-- CreateIndex
CREATE INDEX "video_assets_episode_id_idx" ON "video_assets"("episode_id");

-- CreateIndex
CREATE INDEX "list_items_profile_id_list_type_created_at_idx" ON "list_items"("profile_id", "list_type", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "list_items_profile_id_list_type_media_type_tmdb_id_key" ON "list_items"("profile_id", "list_type", "media_type", "tmdb_id");

-- CreateIndex
CREATE INDEX "viewing_history_profile_id_watched_at_idx" ON "viewing_history"("profile_id", "watched_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "viewing_history_profile_id_media_type_tmdb_id_key" ON "viewing_history"("profile_id", "media_type", "tmdb_id");

-- CreateIndex
CREATE INDEX "playback_progress_profile_id_updated_at_idx" ON "playback_progress"("profile_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "playback_progress_profile_id_video_asset_id_key" ON "playback_progress"("profile_id", "video_asset_id");

-- CreateIndex
CREATE INDEX "import_jobs_status_started_at_idx" ON "import_jobs"("status", "started_at" DESC);

-- CreateIndex
CREATE INDEX "reviews_title_id_created_at_idx" ON "reviews"("title_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_profile_id_title_id_key" ON "reviews"("profile_id", "title_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_genres" ADD CONSTRAINT "title_genres_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "title_genres" ADD CONSTRAINT "title_genres_genreId_tmdb_type_fkey" FOREIGN KEY ("genreId", "tmdb_type") REFERENCES "genres"("id", "tmdb_type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_sources" ADD CONSTRAINT "video_sources_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_sources" ADD CONSTRAINT "video_sources_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtitle_tracks" ADD CONSTRAINT "subtitle_tracks_video_source_id_fkey" FOREIGN KEY ("video_source_id") REFERENCES "video_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtitle_tracks" ADD CONSTRAINT "subtitle_tracks_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viewing_history" ADD CONSTRAINT "viewing_history_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_progress" ADD CONSTRAINT "playback_progress_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
