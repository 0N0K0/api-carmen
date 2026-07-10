-- Deleting a Playlist must cascade-delete its PlaylistTrack rows, so a deleted
-- Deezer playlist can be mirrored (removed) locally without an FK violation.
-- AlterTable
ALTER TABLE "PlaylistTrack" DROP CONSTRAINT "PlaylistTrack_playlistId_fkey";
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_playlistId_fkey"
  FOREIGN KEY ("playlistId") REFERENCES "Playlist"(id) ON DELETE CASCADE ON UPDATE CASCADE;
