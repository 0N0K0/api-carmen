-- AlterTable
ALTER TABLE "Album" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "explicitLyrics" BOOLEAN,
ADD COLUMN     "fans" INTEGER,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "md5Image" TEXT,
ADD COLUMN     "nbTracks" INTEGER,
ADD COLUMN     "recordType" TEXT,
ADD COLUMN     "upc" TEXT;

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "link" TEXT,
ADD COLUMN     "nbAlbum" INTEGER,
ADD COLUMN     "nbFan" INTEGER;

-- AlterTable
ALTER TABLE "Playlist" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "collaborative" BOOLEAN,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "fans" INTEGER,
ADD COLUMN     "isLovedTrack" BOOLEAN,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "picture" TEXT,
ADD COLUMN     "public" BOOLEAN;

-- AlterTable
ALTER TABLE "PlaylistTrack" ADD COLUMN     "timeAdd" INTEGER;

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "bpm" DOUBLE PRECISION,
ADD COLUMN     "diskNumber" INTEGER,
ADD COLUMN     "explicitLyrics" BOOLEAN,
ADD COLUMN     "gain" DOUBLE PRECISION,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "rank" INTEGER,
ADD COLUMN     "releaseDate" TEXT,
ADD COLUMN     "titleShort" TEXT,
ADD COLUMN     "titleVersion" TEXT,
ADD COLUMN     "trackPosition" INTEGER;
