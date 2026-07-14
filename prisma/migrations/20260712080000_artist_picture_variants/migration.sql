-- Artist: drop Deezer fields not needed by Carmen (link, nbAlbum, nbFan),
-- add share and the picture size variants (small/medium/big/xl).
ALTER TABLE "Artist" DROP COLUMN "link";
ALTER TABLE "Artist" DROP COLUMN "nbAlbum";
ALTER TABLE "Artist" DROP COLUMN "nbFan";
ALTER TABLE "Artist" ADD COLUMN "share" TEXT;
ALTER TABLE "Artist" ADD COLUMN "pictureSmall" TEXT;
ALTER TABLE "Artist" ADD COLUMN "pictureMedium" TEXT;
ALTER TABLE "Artist" ADD COLUMN "pictureBig" TEXT;
ALTER TABLE "Artist" ADD COLUMN "pictureXl" TEXT;
