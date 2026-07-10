-- Deezer playlist ids can exceed the Int32 range (> 2 147 483 647).
-- AlterTable
ALTER TABLE "Playlist" ALTER COLUMN "id" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "PlaylistTrack" ALTER COLUMN "playlistId" SET DATA TYPE BIGINT;
