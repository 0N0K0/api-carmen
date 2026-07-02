import { getArtist } from '../../services/deezer';
import { DeezerArtist } from '../../types/deezer';

/**
 * Mappe un artiste Deezer vers le format GraphQL.
 * @param {DeezerArtist} a Artiste Deezer brut.
 * @returns {object} Artiste au format GraphQL.
 */
export function mapArtist(a: DeezerArtist) {
  return {
    id: String(a.id),
    name: a.name,
    link: a.link ?? null,
    picture: a.picture ?? null,
    nbAlbum: a.nb_album ?? null,
    nbFan: a.nb_fan ?? null,
  };
}

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
      } catch {
        return null;
      }
    },
  },
};
