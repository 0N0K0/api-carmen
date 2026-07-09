import { getPlaylist } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { mapPlaylist, mapPrismaPlaylist } from './mappers';

export { mapPlaylist };

const playlistInclude = {
  tracks: {
    orderBy: { position: 'asc' as const },
    include: { track: { include: { artist: true, album: { include: { artist: true } } } } },
  },
};

export const playlistResolvers = {
  Query: {
    /**
     * Récupère une playlist : d'abord en DB, sinon fallback sur l'API Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Playlist mappée ou null si non trouvée.
     */
    playlist: async (_: unknown, args: { id: string }) => {
      try {
        const dbId = Number(args.id);
        if (!Number.isNaN(dbId)) {
          const row = await getPrismaClient().playlist.findUnique({
            where: { id: dbId },
            include: playlistInclude,
          });
          if (row) return mapPrismaPlaylist(row);
        }
        const p = await getPlaylist(args.id);
        return mapPlaylist(p);
      } catch (err) {
        console.error('[resolver] playlist error:', err);
        return null;
      }
    },

    /**
     * Liste les playlists synchronisées en DB, paginées.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number; offset?: number }} args Arguments de pagination.
     * @returns {Promise<object>} Page de playlists avec pagination.
     */
    playlists: async (_: unknown, args: { limit?: number; offset?: number }) => {
      const limit = args.limit ?? 20;
      const offset = args.offset ?? 0;
      const prisma = getPrismaClient();
      const [rows, total] = await Promise.all([
        prisma.playlist.findMany({
          skip: offset,
          take: limit,
          include: playlistInclude,
          orderBy: { id: 'asc' },
        }),
        prisma.playlist.count(),
      ]);
      return { items: rows.map(mapPrismaPlaylist), pagination: { offset, limit, total } };
    },
  },
};
