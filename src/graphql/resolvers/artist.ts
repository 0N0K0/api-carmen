import { getArtist } from '../../services/deezer';
import { mapArtist } from './mappers';

export { mapArtist };

export const artistResolvers = {
  Query: {
    /**
     * Récupère un artiste par son identifiant Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Artiste mappé ou null si non trouvé.
     */
    artist: async (_: unknown, args: { id: string }) => {
      try {
        const a = await getArtist(args.id);
        return mapArtist(a);
      } catch (err) {
        console.error('[resolver] artist error:', err);
        return null;
      }
    },
  },
};
