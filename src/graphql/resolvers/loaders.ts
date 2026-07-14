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
 * Charge les genres d'un album, en regroupant les appels concurrents en un seul `findMany`.
 */
export const loadGenresByAlbumId = createGroupBatcher(
  (albumIds: number[]) =>
    getPrismaClient().albumGenre.findMany({
      where: { albumId: { in: albumIds } },
      include: { genre: true },
    }),
  (ag) => ag.albumId,
);

/**
 * Charge les contributeurs (artistes) d'un album, en regroupant les appels concurrents
 * en un seul `findMany`.
 */
export const loadContributorsByAlbumId = createGroupBatcher(
  (albumIds: number[]) =>
    getPrismaClient().albumContributor.findMany({
      where: { albumId: { in: albumIds } },
      include: { artist: true },
    }),
  (ac) => ac.albumId,
);

/**
 * Charge les contributeurs (artistes) d'un track, en regroupant les appels concurrents
 * en un seul `findMany`.
 */
export const loadContributorsByTrackId = createGroupBatcher(
  (trackIds: bigint[]) =>
    getPrismaClient().trackContributor.findMany({
      where: { trackId: { in: trackIds } },
      include: { artist: true },
    }),
  (tc) => tc.trackId,
);
