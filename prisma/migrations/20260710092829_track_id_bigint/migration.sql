-- Deezer track ids can exceed the Int32 range (> 2 147 483 647).
-- AlterTable
ALTER TABLE "Track" ALTER COLUMN "id" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "PlaylistTrack" ALTER COLUMN "trackId" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "HistoryEntry" ALTER COLUMN "trackId" SET DATA TYPE BIGINT;
