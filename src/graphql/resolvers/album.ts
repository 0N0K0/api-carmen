import { getAlbum } from '../../services/deezer';
import { DeezerAlbum } from '../../types/deezer';
import { mapArtist } from './artist';
import { mapTrack } from './track';

/**
 * Mappe un album Deezer vers le format GraphQL.
 * @param {DeezerAlbum} a Album Deezer brut.
 * @returns {object} Album au format GraphQL.
 */
export function mapAlbum(a: DeezerAlbum) {
  return {
    id: String(a.id),
    title: a.title,
    upc: a.upc ?? null,
    link: a.link ?? null,
    cover: a.cover ?? null,
    label: a.label ?? null,
    nbTracks: a.nb_tracks ?? null,
    duration: a.duration ?? null,
    fans: a.fans ?? null,
    releaseDate: a.release_date ?? null,
    recordType: a.record_type ?? null,
    explicitLyrics: a.explicit_lyrics ?? null,
    artist: a.artist ? mapArtist(a.artist) : null,
    tracks: a.tracks?.data.map(mapTrack) ?? null,
  };
}

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
      } catch {
        return null;
      }
    },
  },
};
