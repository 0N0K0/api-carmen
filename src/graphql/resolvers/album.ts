import { getAlbum } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { mapAlbum } from './mappers';
import { paginate, parseDbId } from './pagination';
import { loadArtistById, loadTracksByAlbumId } from './loaders';

export { mapAlbum };

type AlbumParent = { id: number | string; artistId?: number; artist?: unknown; tracks?: unknown };

export const albumResolvers = {
  Query: {
    /**
     * Récupère un album : d'abord en DB, sinon fallback sur l'API Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Album (ligne Prisma brute ou album Deezer mappé), ou null si non trouvé.
     */
    album: async (_: unknown, args: { id: string }) => {
      try {
        const dbId = parseDbId(args.id);
        if (dbId !== null) {
          const row = await getPrismaClient().album.findUnique({ where: { id: dbId } });
          if (row) return row;
        }
        const a = await getAlbum(args.id);
        return mapAlbum(a);
      } catch (err) {
        console.error('[resolver] album error:', err);
        return null;
      }
    },

    /**
     * Liste les albums synchronisés en DB, paginés.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number; offset?: number; favoritesOnly?: boolean }} args Arguments de pagination et filtre.
     * @returns {Promise<object>} Page d'albums avec pagination.
     */
    albums: async (_: unknown, args: { limit?: number; offset?: number; favoritesOnly?: boolean }) => {
      const prisma = getPrismaClient();
      const where = args.favoritesOnly ? { isFavorite: true } : {};
      return paginate(
        args,
        (limit, offset) => prisma.album.findMany({ where, skip: offset, take: limit, orderBy: { id: 'asc' } }),
        () => prisma.album.count({ where }),
      );
    },
  },

  Album: {
    /**
     * Résout l'artiste d'un album : déjà présent (résultat Deezer, y compris null si l'album
     * Deezer n'en a pas) sinon chargé depuis Prisma par `artistId` (toujours renseigné en DB),
     * quelle que soit la profondeur de la requête GraphQL.
     * @param {AlbumParent} parent Album parent (ligne Prisma ou album Deezer mappé).
     * @returns {Promise<unknown>} Artiste.
     */
    artist: async (parent: AlbumParent) => {
      if ('artist' in parent) return parent.artist;
      return loadArtistById(parent.artistId as number);
    },

    /**
     * Résout les tracks d'un album : déjà présents (résultat Deezer) sinon chargés depuis Prisma
     * par `albumId`, quelle que soit la profondeur de la requête GraphQL.
     * @param {AlbumParent} parent Album parent (ligne Prisma ou album Deezer mappé).
     * @returns {Promise<unknown>} Tracks de l'album.
     */
    tracks: async (parent: AlbumParent) => {
      if ('tracks' in parent) return parent.tracks;
      return loadTracksByAlbumId(Number(parent.id));
    },
  },
};
