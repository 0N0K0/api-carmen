import { getAlbum } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { mapAlbum, mapPrismaAlbum } from './mappers';
import { paginate, parseDbId } from './pagination';

export { mapAlbum };

const albumInclude = {
  artist: true,
  tracks: {
    include: { artist: true, album: { include: { artist: true } } },
    orderBy: { trackPosition: 'asc' as const },
  },
};

export const albumResolvers = {
  Query: {
    /**
     * Récupère un album : d'abord en DB, sinon fallback sur l'API Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Album mappé ou null si non trouvé.
     */
    album: async (_: unknown, args: { id: string }) => {
      try {
        const dbId = parseDbId(args.id);
        if (dbId !== null) {
          const row = await getPrismaClient().album.findUnique({
            where: { id: dbId },
            include: albumInclude,
          });
          if (row) return mapPrismaAlbum(row);
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
     * @param {{ limit?: number; offset?: number }} args Arguments de pagination.
     * @returns {Promise<object>} Page d'albums avec pagination.
     */
    albums: async (_: unknown, args: { limit?: number; offset?: number }) => {
      const prisma = getPrismaClient();
      return paginate(
        args,
        (limit, offset) =>
          prisma.album.findMany({ skip: offset, take: limit, include: albumInclude, orderBy: { id: 'asc' } }),
        () => prisma.album.count(),
      );
    },
  },
};
