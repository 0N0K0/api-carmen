import { getPlaylist } from '../../services/deezer';
import { DeezerPlaylist } from '../../types/deezer';
import { mapTrack } from './track';

/**
 * Mappe une playlist Deezer vers le format GraphQL.
 * @param {DeezerPlaylist} p Playlist Deezer brute.
 * @returns {object} Playlist au format GraphQL.
 */
export function mapPlaylist(p: DeezerPlaylist) {
  return {
    id: String(p.id),
    title: p.title,
    description: p.description ?? null,
    duration: p.duration ?? null,
    public: p.public ?? null,
    isLovedTrack: p.is_loved_track ?? null,
    collaborative: p.collaborative ?? null,
    fans: p.fans ?? null,
    link: p.link ?? null,
    picture: p.picture ?? null,
    checksum: p.checksum ?? null,
    tracks: p.tracks?.data.map(mapTrack) ?? null,
  };
}

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
      } catch {
        return null;
      }
    },
  },
};
