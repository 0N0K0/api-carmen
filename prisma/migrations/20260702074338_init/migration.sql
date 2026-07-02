/*
  Warnings:

  - The primary key for the `Folder` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `Folder` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `Folder` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Folder` table. All the data in the column will be lost.
  - The `id` column on the `Folder` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Playlist` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `cover` on the `Playlist` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Playlist` table. All the data in the column will be lost.
  - You are about to drop the column `deezerId` on the `Playlist` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Playlist` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Playlist` table. All the data in the column will be lost.
  - The `folderId` column on the `Playlist` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `PlaylistTrack` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `addedAt` on the `PlaylistTrack` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `PlaylistTrack` table. All the data in the column will be lost.
  - The primary key for the `Track` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `acousticness` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `album` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `analysedAt` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `artist` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `bpm` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `bpmConfidence` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `camelot` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `cover` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `danceability` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `deezerId` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `energy` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `genre` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `instrumentalness` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `keyConfidence` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `liveness` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `loudnessDb` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `mode` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `mood` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `releaseDate` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `speechiness` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the column `valence` on the `Track` table. All the data in the column will be lost.
  - You are about to drop the `ListeningHistory` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `title` to the `Playlist` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Playlist` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `playlistId` on the `PlaylistTrack` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `trackId` on the `PlaylistTrack` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `albumId` to the `Track` table without a default value. This is not possible if the table is not empty.
  - Added the required column `artistId` to the `Track` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Track` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `duration` on table `Track` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ListeningHistory" DROP CONSTRAINT "ListeningHistory_trackId_fkey";

-- DropForeignKey
ALTER TABLE "Playlist" DROP CONSTRAINT "Playlist_folderId_fkey";

-- DropForeignKey
ALTER TABLE "PlaylistTrack" DROP CONSTRAINT "PlaylistTrack_playlistId_fkey";

-- DropForeignKey
ALTER TABLE "PlaylistTrack" DROP CONSTRAINT "PlaylistTrack_trackId_fkey";

-- DropIndex
DROP INDEX "Playlist_deezerId_key";

-- DropIndex
DROP INDEX "PlaylistTrack_playlistId_trackId_key";

-- DropIndex
DROP INDEX "Track_deezerId_key";

-- AlterTable
ALTER TABLE "Folder" DROP CONSTRAINT "Folder_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "position",
DROP COLUMN "updatedAt",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Folder_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Playlist" DROP CONSTRAINT "Playlist_pkey",
DROP COLUMN "cover",
DROP COLUMN "createdAt",
DROP COLUMN "deezerId",
DROP COLUMN "name",
DROP COLUMN "updatedAt",
ADD COLUMN     "title" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" INTEGER NOT NULL,
DROP COLUMN "folderId",
ADD COLUMN     "folderId" INTEGER,
ADD CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PlaylistTrack" DROP CONSTRAINT "PlaylistTrack_pkey",
DROP COLUMN "addedAt",
DROP COLUMN "id",
DROP COLUMN "playlistId",
ADD COLUMN     "playlistId" INTEGER NOT NULL,
DROP COLUMN "trackId",
ADD COLUMN     "trackId" INTEGER NOT NULL,
ADD CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("playlistId", "trackId");

-- AlterTable
ALTER TABLE "Track" DROP CONSTRAINT "Track_pkey",
DROP COLUMN "acousticness",
DROP COLUMN "album",
DROP COLUMN "analysedAt",
DROP COLUMN "artist",
DROP COLUMN "bpm",
DROP COLUMN "bpmConfidence",
DROP COLUMN "camelot",
DROP COLUMN "cover",
DROP COLUMN "createdAt",
DROP COLUMN "danceability",
DROP COLUMN "deezerId",
DROP COLUMN "energy",
DROP COLUMN "genre",
DROP COLUMN "instrumentalness",
DROP COLUMN "key",
DROP COLUMN "keyConfidence",
DROP COLUMN "liveness",
DROP COLUMN "loudnessDb",
DROP COLUMN "mode",
DROP COLUMN "mood",
DROP COLUMN "releaseDate",
DROP COLUMN "speechiness",
DROP COLUMN "updatedAt",
DROP COLUMN "valence",
ADD COLUMN     "albumId" INTEGER NOT NULL,
ADD COLUMN     "artistId" INTEGER NOT NULL,
ADD COLUMN     "isrc" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" INTEGER NOT NULL,
ALTER COLUMN "duration" SET NOT NULL,
ADD CONSTRAINT "Track_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "ListeningHistory";

-- CreateTable
CREATE TABLE "Artist" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "picture" TEXT,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "cover" TEXT,
    "releaseDate" TEXT,
    "artistId" INTEGER NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryEntry" (
    "id" SERIAL NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trackId" INTEGER NOT NULL,

    CONSTRAINT "HistoryEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEntry" ADD CONSTRAINT "HistoryEntry_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
