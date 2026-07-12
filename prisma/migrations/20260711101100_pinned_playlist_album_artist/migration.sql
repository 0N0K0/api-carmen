-- AlterTable
ALTER TABLE "Artist" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Album" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Playlist" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
