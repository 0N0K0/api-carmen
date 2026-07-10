import { getPrismaClient } from '../../plugins/prisma';
import { createBatcher, createGroupBatcher } from './batch';

/**
 * Charge un artiste par id, en regroupant les appels concurrents en un seul `findMany`.
 */
export const loadArtistById = createBatcher(
  (ids: number[]) => getPrismaClient().artist.findMany({ where: { id: { in: ids } } }),
  (a) => a.id,
);

/**
 * Charge un album par id, en regroupant les appels concurrents en un seul `findMany`.
 */
export const loadAlbumById = createBatcher(
  (ids: number[]) => getPrismaClient().album.findMany({ where: { id: { in: ids } } }),
  (a) => a.id,
);

/**
 * Charge les tracks d'un album (triés par position), en regroupant les appels concurrents
 * en un seul `findMany`.
 */
export const loadTracksByAlbumId = createGroupBatcher(
  (albumIds: number[]) =>
    getPrismaClient().track.findMany({
      where: { albumId: { in: albumIds } },
      orderBy: { trackPosition: 'asc' },
    }),
  (t) => t.albumId,
);

/**
 * Charge les tracks d'une playlist (triés par position), en regroupant les appels concurrents
 * en un seul `findMany` sur `PlaylistTrack`.
 */
export const loadTracksByPlaylistId = createGroupBatcher(
  (playlistIds: number[]) =>
    getPrismaClient().playlistTrack.findMany({
      where: { playlistId: { in: playlistIds } },
      orderBy: { position: 'asc' },
      include: { track: true },
    }),
  (pt) => Number(pt.playlistId),
);
