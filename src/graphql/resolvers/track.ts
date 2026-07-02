import { getTrack, searchDeezer } from '../../services/deezer';
import { DeezerTrack } from '../../types/deezer';
import { mapArtist } from './artist';

/**
 * Mappe un track Deezer vers le format GraphQL.
 * @param {DeezerTrack} t Track Deezer brut.
 * @returns {object} Track au format GraphQL.
 */
export function mapTrack(t: DeezerTrack) {
  return {
    id: String(t.id),
    title: t.title,
    titleShort: t.title_short ?? null,
    isrc: t.isrc ?? null,
    link: t.link ?? null,
    duration: t.duration,
    rank: t.rank ?? null,
    releaseDate: t.release_date ?? null,
    explicitLyrics: t.explicit_lyrics ?? null,
    preview: t.preview ?? null,
    bpm: t.bpm ?? null,
    gain: t.gain ?? null,
    artist: mapArtist(t.artist),
    album: {
      id: String(t.album.id),
      title: t.album.title,
      upc: null,
      link: t.album.link ?? null,
      cover: t.album.cover ?? null,
      label: null,
      nbTracks: null,
      duration: null,
      fans: null,
      releaseDate: null,
      recordType: null,
      explicitLyrics: null,
      artist: null,
      tracks: null,
    },
  };
}

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
      } catch {
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
      const results = await searchDeezer(args.query, type, args.limit ?? 25);
      return {
        tracks: results.tracks?.data.map(mapTrack) ?? null,
        albums:
          results.albums?.data.map((a) => ({
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
            tracks: null,
          })) ?? null,
        artists:
          results.artists?.data.map(mapArtist) ?? null,
        playlists:
          results.playlists?.data.map((p) => ({
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
            tracks: null,
          })) ?? null,
      };
    },
  },
};
