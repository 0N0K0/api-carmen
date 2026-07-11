import { getPlaylist } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { mapPlaylist } from './mappers';
import { paginate, parseDbId, sortDirection } from './pagination';
import { loadTracksByPlaylistId } from './loaders';

export { mapPlaylist };

type PlaylistParent = { id: bigint | number | string; tracks?: unknown };

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
     * Liste les playlists synchronisées en DB, paginées, triées par titre.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number; offset?: number; orderBy?: 'ASC' | 'DESC' }} args Arguments de pagination et tri.
     * @returns {Promise<object>} Page de playlists avec pagination.
     */
    playlists: async (_: unknown, args: { limit?: number; offset?: number; orderBy?: 'ASC' | 'DESC' }) => {
      const prisma = getPrismaClient();
      const direction = sortDirection(args.orderBy);
      return paginate(
        args,
        (limit, offset) =>
          prisma.playlist.findMany({ skip: offset, take: limit, orderBy: { title: direction } }),
        () => prisma.playlist.count(),
      );
    },
  },

  Playlist: {
    /**
     * Résout l'id d'une playlist. `Playlist.id` est un `BigInt` côté Prisma (certains ids
     * de playlists Deezer dépassent Int32) — le scalaire `ID` de graphql-js ne sait pas
     * sérialiser un `bigint` nativement, d'où la conversion explicite en string ici.
     * @param {PlaylistParent} parent Playlist parent (ligne Prisma ou playlist Deezer mappée).
     * @returns {string} Id de la playlist.
     */
    id: (parent: PlaylistParent) => String(parent.id),

    /**
     * Résout les tracks d'une playlist : déjà présents (résultat Deezer) sinon chargés depuis
     * Prisma via `PlaylistTrack`, triés par position, quelle que soit la profondeur de la requête.
     * @param {PlaylistParent} parent Playlist parent (ligne Prisma ou playlist Deezer mappée).
     * @returns {Promise<unknown>} Tracks de la playlist.
     */
    tracks: async (parent: PlaylistParent) => {
      if ('tracks' in parent) return parent.tracks;
      const rows = await loadTracksByPlaylistId(Number(parent.id));
      return rows.map((pt) => pt.track);
    },
  },
};
