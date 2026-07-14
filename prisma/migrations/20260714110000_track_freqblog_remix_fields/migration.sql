-- Track (freqblog): drop unused fields (fbFeatureSource, fbRepresentativeSegmentStart),
-- add remix metadata (fbIsRemix, fbMixName, fbRemixer, fbRemixOfIsrc).
ALTER TABLE "Track" DROP COLUMN "fbFeatureSource";
ALTER TABLE "Track" DROP COLUMN "fbRepresentativeSegmentStart";
ALTER TABLE "Track" ADD COLUMN "fbIsRemix" BOOLEAN;
ALTER TABLE "Track" ADD COLUMN "fbMixName" TEXT;
ALTER TABLE "Track" ADD COLUMN "fbRemixer" TEXT;
ALTER TABLE "Track" ADD COLUMN "fbRemixOfIsrc" TEXT;
