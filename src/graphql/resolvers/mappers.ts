import { DeezerAlbum, DeezerArtist, DeezerPlaylist, DeezerTrack } from '../../types/deezer';

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

/**
 * Mappe un track Deezer vers le format GraphQL.
 * Le champ album est un objet partiel (l'endpoint /track ne retourne pas l'album complet).
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
