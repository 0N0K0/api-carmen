import { getTrack, getStreamUrl, searchDeezer } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { mapTrack, mapAlbum, mapArtist, mapPlaylist } from './mappers';
import { paginate, parseDbId } from './pagination';
import { loadArtistById, loadAlbumById } from './loaders';

export { mapTrack };

type TrackParent = { artistId?: number; albumId?: number; artist?: unknown; album?: unknown };

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
     * @returns {Promise<object | null>} Track (ligne Prisma brute ou track Deezer mappé), ou null si non trouvé.
     */
    track: async (_: unknown, args: { id: string }) => {
      try {
        const dbId = parseDbId(args.id);
        if (dbId !== null) {
          const row = await getPrismaClient().track.findUnique({ where: { id: dbId } });
          if (row) return row;
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
      const prisma = getPrismaClient();
      return paginate(
        args,
        (limit, offset) => prisma.track.findMany({ skip: offset, take: limit, orderBy: { id: 'asc' } }),
        () => prisma.track.count(),
      );
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

  Track: {
    /**
     * Résout l'artiste d'un track : déjà présent (résultat Deezer) sinon chargé depuis Prisma
     * par `artistId`, quelle que soit la profondeur de la requête GraphQL.
     * @param {TrackParent} parent Track parent (ligne Prisma ou track Deezer mappé).
     * @returns {Promise<unknown>} Artiste.
     */
    artist: async (parent: TrackParent) => {
      if ('artist' in parent) return parent.artist;
      return loadArtistById(parent.artistId as number);
    },

    /**
     * Résout l'album d'un track : déjà présent (résultat Deezer) sinon chargé depuis Prisma
     * par `albumId`, quelle que soit la profondeur de la requête GraphQL.
     * @param {TrackParent} parent Track parent (ligne Prisma ou track Deezer mappé).
     * @returns {Promise<unknown>} Album.
     */
    album: async (parent: TrackParent) => {
      if ('album' in parent) return parent.album;
      return loadAlbumById(parent.albumId as number);
    },
  },
};
