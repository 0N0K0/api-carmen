import { getPlaylist } from '../../services/deezer';
import { mapPlaylist } from './mappers';

export { mapPlaylist };

export const playlistResolvers = {
  Query: {
    /**
     * Récupère une playlist par son identifiant Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Playlist mappée ou null si non trouvée.
     */
    playlist: async (_: unknown, args: { id: string }) => {
      try {
        const p = await getPlaylist(args.id);
        return mapPlaylist(p);
      } catch (err) {
        console.error('[resolver] playlist error:', err);
        return null;
      }
    },
  },
};
