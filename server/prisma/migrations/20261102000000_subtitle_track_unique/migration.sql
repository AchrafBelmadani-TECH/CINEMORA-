-- CreateIndex
CREATE UNIQUE INDEX "subtitle_tracks_videoAssetId_language_key" ON "subtitle_tracks"("video_asset_id", "language");
