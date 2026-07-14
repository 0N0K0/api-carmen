-- Album: drop Deezer fields not needed by Carmen (link, label, nbTracks, duration,
-- fans, md5Image, explicitLyrics), add share, cover size variants, and available.
ALTER TABLE "Album" DROP COLUMN "link";
ALTER TABLE "Album" DROP COLUMN "label";
ALTER TABLE "Album" DROP COLUMN "nbTracks";
ALTER TABLE "Album" DROP COLUMN "duration";
ALTER TABLE "Album" DROP COLUMN "fans";
ALTER TABLE "Album" DROP COLUMN "md5Image";
ALTER TABLE "Album" DROP COLUMN "explicitLyrics";
ALTER TABLE "Album" ADD COLUMN "share" TEXT;
ALTER TABLE "Album" ADD COLUMN "coverSmall" TEXT;
ALTER TABLE "Album" ADD COLUMN "coverMedium" TEXT;
ALTER TABLE "Album" ADD COLUMN "coverBig" TEXT;
ALTER TABLE "Album" ADD COLUMN "coverXl" TEXT;
ALTER TABLE "Album" ADD COLUMN "available" BOOLEAN;

-- Genre: référentiel des genres Deezer (id stable côté Deezer, ex. 132 = Pop).
CREATE TABLE "Genre" (
  "id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "picture" TEXT,
  CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- AlbumGenre: relation many-to-many Album <-> Genre.
CREATE TABLE "AlbumGenre" (
  "albumId" INTEGER NOT NULL,
  "genreId" INTEGER NOT NULL,
  CONSTRAINT "AlbumGenre_pkey" PRIMARY KEY ("albumId", "genreId")
);
ALTER TABLE "AlbumGenre" ADD CONSTRAINT "AlbumGenre_albumId_fkey"
  FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumGenre" ADD CONSTRAINT "AlbumGenre_genreId_fkey"
  FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlbumContributor: relation many-to-many Album <-> Artist (contributeurs, avec rôle Deezer).
CREATE TABLE "AlbumContributor" (
  "albumId" INTEGER NOT NULL,
  "artistId" INTEGER NOT NULL,
  "role" TEXT,
  CONSTRAINT "AlbumContributor_pkey" PRIMARY KEY ("albumId", "artistId")
);
ALTER TABLE "AlbumContributor" ADD CONSTRAINT "AlbumContributor_albumId_fkey"
  FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumContributor" ADD CONSTRAINT "AlbumContributor_artistId_fkey"
  FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
