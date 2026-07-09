import { getTrack, getStreamUrl, searchDeezer } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { mapTrack, mapAlbum, mapArtist, mapPlaylist, mapPrismaTrack } from './mappers';

export { mapTrack };

const trackInclude = { artist: true, album: { include: { artist: true } } };

export const trackResolvers = {
  Mutation: {
    /**
     * Résout l'URL de stream complète d'un track Deezer via l'ARL.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ trackId: string }} args Arguments de la mutation.
     * @returns {Promise<string>} URL de stream CDN.
     * @throws {Error} Si l'ARL est expiré, le quota dépassé, ou aucune URL disponible.
     */
    getStreamUrl: async (_: unknown, args: { trackId: string }) => {
      return getStreamUrl(args.trackId);
    },
  },

  Query: {
    /**
     * Récupère un track : d'abord en DB, sinon fallback sur l'API Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Track mappé ou null si non trouvé.
     */
    track: async (_: unknown, args: { id: string }) => {
      try {
        const dbId = Number(args.id);
        if (!Number.isNaN(dbId)) {
          const row = await getPrismaClient().track.findUnique({
            where: { id: dbId },
            include: trackInclude,
          });
          if (row) return mapPrismaTrack(row);
        }
        const t = await getTrack(args.id);
        return mapTrack(t);
      } catch (err) {
        console.error('[resolver] track error:', err);
        return null;
      }
    },

    /**
     * Liste les tracks synchronisés en DB, paginés.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number; offset?: number }} args Arguments de pagination.
     * @returns {Promise<object>} Page de tracks avec pagination.
     */
    tracks: async (_: unknown, args: { limit?: number; offset?: number }) => {
      const limit = args.limit ?? 20;
      const offset = args.offset ?? 0;
      const prisma = getPrismaClient();
      const [rows, total] = await Promise.all([
        prisma.track.findMany({
          skip: offset,
          take: limit,
          include: trackInclude,
          orderBy: { id: 'asc' },
        }),
        prisma.track.count(),
      ]);
      return { items: rows.map(mapPrismaTrack), pagination: { offset, limit, total } };
    },

    /**
     * Recherche dans le catalogue Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ query: string; type?: string; limit?: number }} args Arguments de la query.
     * @returns {Promise<object>} Résultats de recherche mappés.
     */
    search: async (
      _: unknown,
      args: { query: string; type?: string; limit?: number },
    ) => {
      const type = (args.type?.toLowerCase() ?? 'track') as
        | 'track'
        | 'album'
        | 'artist'
        | 'playlist';
      try {
        const results = await searchDeezer(args.query, type, args.limit ?? 25);
        return {
          tracks: results.tracks?.data.map(mapTrack) ?? null,
          albums: results.albums?.data.map(mapAlbum) ?? null,
          artists: results.artists?.data.map(mapArtist) ?? null,
          playlists: results.playlists?.data.map(mapPlaylist) ?? null,
        };
      } catch (err) {
        console.error('[resolver] search error:', err);
        return { tracks: null, albums: null, artists: null, playlists: null };
      }
    },
  },
};
