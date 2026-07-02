import { getTrack, searchDeezer } from '../../services/deezer';
import { mapTrack, mapAlbum, mapArtist, mapPlaylist } from './mappers';

export { mapTrack };

export const trackResolvers = {
  Query: {
    /**
     * Récupère un track par son identifiant Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ id: string }} args Arguments de la query.
     * @returns {Promise<object | null>} Track mappé ou null si non trouvé.
     */
    track: async (_: unknown, args: { id: string }) => {
      try {
        const t = await getTrack(args.id);
        return mapTrack(t);
      } catch (err) {
        console.error('[resolver] track error:', err);
        return null;
      }
    },

    /**
     * Recherche dans le catalogue Deezer.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ query: string; type?: string; limit?: number }} args Arguments de la query.
     * @returns {Promise<object>} Résultats de recherche mappés.
     */
    search: async (
      _: unknown,
      args: { query: string; type?: string; limit?: number },
    ) => {
      const type = (args.type?.toLowerCase() ?? 'track') as
        | 'track'
        | 'album'
        | 'artist'
        | 'playlist';
      try {
        const results = await searchDeezer(args.query, type, args.limit ?? 25);
        return {
          tracks: results.tracks?.data.map(mapTrack) ?? null,
          albums: results.albums?.data.map(mapAlbum) ?? null,
          artists: results.artists?.data.map(mapArtist) ?? null,
          playlists: results.playlists?.data.map(mapPlaylist) ?? null,
        };
      } catch (err) {
        console.error('[resolver] search error:', err);
        return { tracks: null, albums: null, artists: null, playlists: null };
      }
    },
  },
};
