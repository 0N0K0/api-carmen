-- Track: drop fields not needed by Carmen (releaseDate, link, preview, bpm),
-- add readable and share.
ALTER TABLE "Track" DROP COLUMN "releaseDate";
ALTER TABLE "Track" DROP COLUMN "link";
ALTER TABLE "Track" DROP COLUMN "preview";
ALTER TABLE "Track" DROP COLUMN "bpm";
ALTER TABLE "Track" ADD COLUMN "readable" BOOLEAN;
ALTER TABLE "Track" ADD COLUMN "share" TEXT;

-- TrackContributor: relation many-to-many Track <-> Artist (contributeurs, avec rôle Deezer).
CREATE TABLE "TrackContributor" (
  "trackId" BIGINT NOT NULL,
  "artistId" INTEGER NOT NULL,
  "role" TEXT,
  CONSTRAINT "TrackContributor_pkey" PRIMARY KEY ("trackId", "artistId")
);
ALTER TABLE "TrackContributor" ADD CONSTRAINT "TrackContributor_trackId_fkey"
  FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackContributor" ADD CONSTRAINT "TrackContributor_artistId_fkey"
  FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
