-- Playlist: drop fields not needed by Carmen (duration, fans, link),
-- add share and creator (Deezer user, no dedicated User model).
ALTER TABLE "Playlist" DROP COLUMN "duration";
ALTER TABLE "Playlist" DROP COLUMN "fans";
ALTER TABLE "Playlist" DROP COLUMN "link";
ALTER TABLE "Playlist" ADD COLUMN "share" TEXT;
ALTER TABLE "Playlist" ADD COLUMN "creatorId" BIGINT;
ALTER TABLE "Playlist" ADD COLUMN "creatorName" TEXT;

-- Folder: Artist/Album/Playlist can each belong to several folders (many-to-many),
-- replacing Playlist's single folderId FK.
ALTER TABLE "Playlist" DROP CONSTRAINT IF EXISTS "Playlist_folderId_fkey";
ALTER TABLE "Playlist" DROP COLUMN IF EXISTS "folderId";

CREATE TABLE "ArtistFolder" (
  "artistId" INTEGER NOT NULL,
  "folderId" INTEGER NOT NULL,
  CONSTRAINT "ArtistFolder_pkey" PRIMARY KEY ("artistId", "folderId")
);
ALTER TABLE "ArtistFolder" ADD CONSTRAINT "ArtistFolder_artistId_fkey"
  FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtistFolder" ADD CONSTRAINT "ArtistFolder_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AlbumFolder" (
  "albumId" INTEGER NOT NULL,
  "folderId" INTEGER NOT NULL,
  CONSTRAINT "AlbumFolder_pkey" PRIMARY KEY ("albumId", "folderId")
);
ALTER TABLE "AlbumFolder" ADD CONSTRAINT "AlbumFolder_albumId_fkey"
  FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlbumFolder" ADD CONSTRAINT "AlbumFolder_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlaylistFolder" (
  "playlistId" BIGINT NOT NULL,
  "folderId" INTEGER NOT NULL,
  CONSTRAINT "PlaylistFolder_pkey" PRIMARY KEY ("playlistId", "folderId")
);
ALTER TABLE "PlaylistFolder" ADD CONSTRAINT "PlaylistFolder_playlistId_fkey"
  FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistFolder" ADD CONSTRAINT "PlaylistFolder_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
