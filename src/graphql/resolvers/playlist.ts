import { getPlaylist } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { mapPlaylist } from './mappers';
import { paginate, parseDbId } from './pagination';

export { mapPlaylist };

type PlaylistParent = { id: number | string; tracks?: unknown };

export const playlistResolvers = {
  Query: {
    /**
     * Récupère une playlist : d'abord en DB, sinon fallback sur l'API Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Playlist (ligne Prisma brute ou playlist Deezer mappée), ou null si non trouvée.
     */
    playlist: async (_: unknown, args: { id: string }) => {
      try {
        const dbId = parseDbId(args.id);
        if (dbId !== null) {
          const row = await getPrismaClient().playlist.findUnique({ where: { id: dbId } });
          if (row) return row;
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
      const prisma = getPrismaClient();
      return paginate(
        args,
        (limit, offset) => prisma.playlist.findMany({ skip: offset, take: limit, orderBy: { id: 'asc' } }),
        () => prisma.playlist.count(),
      );
    },
  },

  Playlist: {
    /**
     * Résout les tracks d'une playlist : déjà présents (résultat Deezer) sinon chargés depuis
     * Prisma via `PlaylistTrack`, triés par position, quelle que soit la profondeur de la requête.
     * @param {PlaylistParent} parent Playlist parent (ligne Prisma ou playlist Deezer mappée).
     * @returns {Promise<unknown>} Tracks de la playlist.
     */
    tracks: async (parent: PlaylistParent) => {
      if ('tracks' in parent) return parent.tracks;
      const rows = await getPrismaClient().playlistTrack.findMany({
        where: { playlistId: Number(parent.id) },
        orderBy: { position: 'asc' },
        include: { track: true },
      });
      return rows.map((pt) => pt.track);
    },
  },
};
