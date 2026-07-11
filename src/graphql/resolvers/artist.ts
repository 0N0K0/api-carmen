import { getArtist } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { mapArtist } from './mappers';
import { paginate, parseDbId, sortDirection } from './pagination';

export { mapArtist };

export const artistResolvers = {
  Query: {
    /**
     * Récupère un artiste : d'abord en DB, sinon fallback sur l'API Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Artiste mappé ou null si non trouvé.
     */
    artist: async (_: unknown, args: { id: string }) => {
      try {
        const dbId = parseDbId(args.id);
        if (dbId !== null) {
          const row = await getPrismaClient().artist.findUnique({ where: { id: dbId } });
          if (row) return row;
        }
        const a = await getArtist(args.id);
        return mapArtist(a);
      } catch (err) {
        console.error('[resolver] artist error:', err);
        return null;
      }
    },

    /**
     * Liste les artistes synchronisés en DB, paginés, triés par nom.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number; offset?: number; favoritesOnly?: boolean; pinnedOnly?: boolean; orderBy?: 'ASC' | 'DESC' }} args Arguments de pagination, filtre et tri.
     * @returns {Promise<object>} Page d'artistes avec pagination.
     */
    artists: async (
      _: unknown,
      args: { limit?: number; offset?: number; favoritesOnly?: boolean; pinnedOnly?: boolean; orderBy?: 'ASC' | 'DESC' },
    ) => {
      const prisma = getPrismaClient();
      const where = {
        ...(args.favoritesOnly ? { isFavorite: true } : {}),
        ...(args.pinnedOnly ? { isPinned: true } : {}),
      };
      const direction = sortDirection(args.orderBy);
      return paginate(
        args,
        (limit, offset) =>
          prisma.artist.findMany({ where, skip: offset, take: limit, orderBy: { name: direction } }),
        () => prisma.artist.count({ where }),
      );
    },
  },
};
