-- Postgres' default collation (en_US.utf8, glibc) sorts all uppercase/digit-initial
-- strings before ALL lowercase-initial strings, instead of interleaving them the way
-- a "natural" alphabetical sort would (e.g. "against commercial" ends up after "Zouk"
-- instead of near the start). Fixed at the column level via a non-deterministic ICU
-- collation (level 2 = case-insensitive, accent-sensitive), so existing `ORDER BY title
-- ASC/DESC` queries sort correctly without any application code change.
CREATE COLLATION IF NOT EXISTS case_insensitive (provider = icu, locale = 'und-u-ks-level2', deterministic = false);

-- AlterTable
ALTER TABLE "Playlist" ALTER COLUMN "title" TYPE TEXT COLLATE "case_insensitive";
ALTER TABLE "Album" ALTER COLUMN "title" TYPE TEXT COLLATE "case_insensitive";
ALTER TABLE "Artist" ALTER COLUMN "name" TYPE TEXT COLLATE "case_insensitive";
