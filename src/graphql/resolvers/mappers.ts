import type { Artist, Album, Track, PlaylistTrack, Playlist } from '@prisma/client';
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
    isFavorite: null,
    isPinned: false,
    pinnedOrder: null,
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
    isFavorite: null,
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
      isFavorite: null,
      isPinned: false,
      pinnedOrder: null,
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
    isFavorite: null,
    isPinned: false,
    pinnedOrder: null,
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
    isPinned: false,
    pinnedOrder: null,
    tracks: p.tracks?.data.map(mapTrack) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Mappers Prisma → GraphQL
// ---------------------------------------------------------------------------

type PrismaArtistShape = Artist;
type PrismaAlbumShape = Album & { artist?: Artist | null; tracks?: PrismaTrackShape[] };
type PrismaTrackShape = Track & { artist?: Artist | null; album?: PrismaAlbumShape | null };
type PrismaPlaylistShape = Playlist & {
  tracks?: (PlaylistTrack & { track: PrismaTrackShape })[];
};

type GqlArtist = {
  id: string; name: string; link: string | null; picture: string | null;
  nbAlbum: number | null; nbFan: number | null; isFavorite: boolean | null;
  isPinned: boolean; pinnedOrder: number | null;
};
type GqlTrack = {
  id: string; title: string; titleShort: string | null; isrc: string | null;
  link: string | null; duration: number; rank: number | null; releaseDate: string | null;
  explicitLyrics: boolean | null; preview: string | null; bpm: number | null;
  gain: number | null; isFavorite: boolean | null; artist: GqlArtist | null; album: GqlAlbum | null;
};
type GqlAlbum = {
  id: string; title: string; upc: string | null; link: string | null; cover: string | null;
  label: string | null; nbTracks: number | null; duration: number | null; fans: number | null;
  releaseDate: string | null; recordType: string | null; explicitLyrics: boolean | null;
  isFavorite: boolean | null; isPinned: boolean; pinnedOrder: number | null;
  artist: GqlArtist | null; tracks: GqlTrack[] | null;
};

/**
 * Mappe un artiste Prisma vers le format GraphQL.
 * @param {PrismaArtistShape} a Artiste Prisma.
 * @returns {object} Artiste au format GraphQL.
 */
export function mapPrismaArtist(a: PrismaArtistShape): GqlArtist {
  return {
    id: String(a.id),
    name: a.name,
    link: a.link,
    picture: a.picture,
    nbAlbum: a.nbAlbum,
    nbFan: a.nbFan,
    isFavorite: a.isFavorite,
    isPinned: a.isPinned,
    pinnedOrder: a.pinnedOrder,
  };
}

/**
 * Mappe un track Prisma vers le format GraphQL.
 * @param {PrismaTrackShape} t Track Prisma (avec artist et album optionnels).
 * @returns {object} Track au format GraphQL.
 */
export function mapPrismaTrack(t: PrismaTrackShape): GqlTrack {
  return {
    id: String(t.id),
    title: t.title,
    titleShort: t.titleShort,
    isrc: t.isrc,
    link: t.link,
    duration: t.duration,
    rank: t.rank,
    releaseDate: t.releaseDate,
    explicitLyrics: t.explicitLyrics,
    preview: t.preview,
    bpm: t.bpm,
    gain: t.gain,
    isFavorite: t.isFavorite,
    artist: t.artist ? mapPrismaArtist(t.artist) : null,
    album: t.album ? mapPrismaAlbum(t.album) : null,
  };
}

/**
 * Mappe un album Prisma vers le format GraphQL.
 * @param {PrismaAlbumShape} a Album Prisma (avec artist et tracks optionnels).
 * @returns {object} Album au format GraphQL.
 */
export function mapPrismaAlbum(a: PrismaAlbumShape): GqlAlbum {
  return {
    id: String(a.id),
    title: a.title,
    upc: a.upc,
    link: a.link,
    cover: a.cover,
    label: a.label,
    nbTracks: a.nbTracks,
    duration: a.duration,
    fans: a.fans,
    releaseDate: a.releaseDate,
    recordType: a.recordType,
    explicitLyrics: a.explicitLyrics,
    isFavorite: a.isFavorite,
    isPinned: a.isPinned,
    pinnedOrder: a.pinnedOrder,
    artist: a.artist ? mapPrismaArtist(a.artist) : null,
    tracks: a.tracks?.map(mapPrismaTrack) ?? null,
  };
}

/**
 * Mappe une playlist Prisma vers le format GraphQL.
 * @param {PrismaPlaylistShape} p Playlist Prisma (avec tracks optionnels via PlaylistTrack).
 * @returns {object} Playlist au format GraphQL.
 */
export function mapPrismaPlaylist(p: PrismaPlaylistShape) {
  return {
    id: String(p.id),
    title: p.title,
    description: p.description,
    duration: p.duration,
    public: p.public,
    isLovedTrack: p.isLovedTrack,
    collaborative: p.collaborative,
    fans: p.fans,
    link: p.link,
    picture: p.picture,
    checksum: p.checksum,
    isPinned: p.isPinned,
    pinnedOrder: p.pinnedOrder,
    tracks: p.tracks?.map((pt) => mapPrismaTrack(pt.track)) ?? null,
  };
}
