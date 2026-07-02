import { getAlbum } from '../../services/deezer';
import { mapAlbum } from './mappers';

export { mapAlbum };

export const albumResolvers = {
  Query: {
    /**
     * Récupère un album par son identifiant Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Album mappé ou null si non trouvé.
     */
    album: async (_: unknown, args: { id: string }) => {
      try {
        const a = await getAlbum(args.id);
        return mapAlbum(a);
      } catch (err) {
        console.error('[resolver] album error:', err);
        return null;
      }
    },
  },
};
