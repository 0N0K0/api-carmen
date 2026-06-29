-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "deezerId" TEXT,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT,
    "duration" INTEGER,
    "preview" TEXT,
    "cover" TEXT,
    "releaseDate" TIMESTAMP(3),
    "bpm" DOUBLE PRECISION,
    "bpmConfidence" DOUBLE PRECISION,
    "key" TEXT,
    "keyConfidence" DOUBLE PRECISION,
    "mode" INTEGER,
    "camelot" TEXT,
    "energy" DOUBLE PRECISION,
    "danceability" DOUBLE PRECISION,
    "valence" DOUBLE PRECISION,
    "acousticness" DOUBLE PRECISION,
    "instrumentalness" DOUBLE PRECISION,
    "liveness" DOUBLE PRECISION,
    "speechiness" DOUBLE PRECISION,
    "loudnessDb" DOUBLE PRECISION,
    "mood" TEXT,
    "genre" TEXT,
    "analysedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cover" TEXT,
    "deezerId" TEXT,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistTrack" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningHistory" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,

    CONSTRAINT "ListeningHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Track_deezerId_key" ON "Track"("deezerId");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_deezerId_key" ON "Playlist"("deezerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistTrack_playlistId_trackId_key" ON "PlaylistTrack"("playlistId", "trackId");

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningHistory" ADD CONSTRAINT "ListeningHistory_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
