import type { Artist, Album, Track, PlaylistTrack, Playlist, Genre } from '@prisma/client';
import { DeezerAlbum, DeezerArtist, DeezerGenre, DeezerPlaylist, DeezerTrack } from '../../types/deezer';

/**
 * Mappe un genre Deezer vers le format GraphQL.
 * @param {DeezerGenre} g Genre Deezer brut.
 * @returns {object} Genre au format GraphQL.
 */
export function mapGenre(g: DeezerGenre) {
  return { id: String(g.id), name: g.name, picture: g.picture ?? null };
}

/**
 * Mappe un artiste Deezer vers le format GraphQL.
 * @param {DeezerArtist} a Artiste Deezer brut.
 * @returns {object} Artiste au format GraphQL.
 */
export function mapArtist(a: DeezerArtist) {
  return {
    id: String(a.id),
    name: a.name,
    share: a.share ?? null,
    picture: a.picture ?? null,
    pictureSmall: a.picture_small ?? null,
    pictureMedium: a.picture_medium ?? null,
    pictureBig: a.picture_big ?? null,
    pictureXl: a.picture_xl ?? null,
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
    readable: t.readable ?? null,
    share: t.share ?? null,
    duration: t.duration,
    rank: t.rank ?? null,
    explicitLyrics: t.explicit_lyrics ?? null,
    gain: t.gain ?? null,
    isFavorite: null,
    artist: mapArtist(t.artist),
    contributors: t.contributors?.map(mapArtist) ?? null,
    album: {
      id: String(t.album.id),
      title: t.album.title,
      upc: null,
      share: null,
      cover: t.album.cover ?? null,
      coverSmall: null,
      coverMedium: null,
      coverBig: null,
      coverXl: null,
      releaseDate: null,
      recordType: null,
      available: null,
      isFavorite: null,
      isPinned: false,
      pinnedOrder: null,
      artist: null,
      tracks: null,
      genres: null,
      contributors: null,
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
    share: a.share ?? null,
    cover: a.cover ?? null,
    coverSmall: a.cover_small ?? null,
    coverMedium: a.cover_medium ?? null,
    coverBig: a.cover_big ?? null,
    coverXl: a.cover_xl ?? null,
    releaseDate: a.release_date ?? null,
    recordType: a.record_type ?? null,
    available: a.available ?? null,
    isFavorite: null,
    isPinned: false,
    pinnedOrder: null,
    artist: a.artist ? mapArtist(a.artist) : null,
    tracks: a.tracks?.data.map(mapTrack) ?? null,
    genres: a.genres?.data.map(mapGenre) ?? null,
    contributors: a.contributors?.map(mapArtist) ?? null,
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
    public: p.public ?? null,
    isLovedTrack: p.is_loved_track ?? null,
    collaborative: p.collaborative ?? null,
    share: p.share ?? null,
    picture: p.picture ?? null,
    creatorId: p.creator ? String(p.creator.id) : null,
    creatorName: p.creator?.name ?? null,
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
type PrismaAlbumShape = Album & {
  artist?: Artist | null;
  tracks?: PrismaTrackShape[];
  genres?: Genre[];
  contributors?: Artist[];
};
type PrismaTrackShape = Track & {
  artist?: Artist | null;
  album?: PrismaAlbumShape | null;
  contributors?: Artist[];
};
type PrismaPlaylistShape = Playlist & {
  tracks?: (PlaylistTrack & { track: PrismaTrackShape })[];
};

type GqlArtist = {
  id: string; name: string; share: string | null; picture: string | null;
  pictureSmall: string | null; pictureMedium: string | null; pictureBig: string | null;
  pictureXl: string | null; isFavorite: boolean | null;
  isPinned: boolean; pinnedOrder: number | null;
};
type GqlGenre = { id: string; name: string; picture: string | null };
// `artist`/`tracks`/`genres`/`contributors` sont optionnels ici volontairement : les résolveurs
// de champ (album.ts/track.ts) décident de charger paresseusement via `'x' in parent` — la clé
// ne doit être présente QUE si la relation a réellement été chargée (même à `null`), sinon un
// resync (qui n'inclut pas toujours toutes les relations) ferait croire à tort qu'un champ non
// chargé vaut `null`, et sauterait le lazy-load.
type GqlTrack = {
  id: string; title: string; titleShort: string | null; isrc: string | null;
  readable: boolean | null; share: string | null; duration: number; rank: number | null;
  explicitLyrics: boolean | null;
  gain: number | null; isFavorite: boolean | null; artist?: GqlArtist | null; album?: GqlAlbum | null;
  contributors?: GqlArtist[] | null;
};
type GqlAlbum = {
  id: string; title: string; upc: string | null; share: string | null; cover: string | null;
  coverSmall: string | null; coverMedium: string | null; coverBig: string | null; coverXl: string | null;
  releaseDate: string | null; recordType: string | null; available: boolean | null;
  isFavorite: boolean | null; isPinned: boolean; pinnedOrder: number | null;
  artist?: GqlArtist | null; tracks?: GqlTrack[] | null;
  genres?: GqlGenre[] | null; contributors?: GqlArtist[] | null;
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
    share: a.share,
    picture: a.picture,
    pictureSmall: a.pictureSmall,
    pictureMedium: a.pictureMedium,
    pictureBig: a.pictureBig,
    pictureXl: a.pictureXl,
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
    readable: t.readable,
    share: t.share,
    duration: t.duration,
    rank: t.rank,
    explicitLyrics: t.explicitLyrics,
    gain: t.gain,
    isFavorite: t.isFavorite,
    ...(t.artist !== undefined && { artist: t.artist ? mapPrismaArtist(t.artist) : null }),
    ...(t.album !== undefined && { album: t.album ? mapPrismaAlbum(t.album) : null }),
    ...(t.contributors !== undefined && { contributors: t.contributors.map(mapPrismaArtist) }),
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
    share: a.share,
    cover: a.cover,
    coverSmall: a.coverSmall,
    coverMedium: a.coverMedium,
    coverBig: a.coverBig,
    coverXl: a.coverXl,
    releaseDate: a.releaseDate,
    recordType: a.recordType,
    available: a.available,
    isFavorite: a.isFavorite,
    isPinned: a.isPinned,
    pinnedOrder: a.pinnedOrder,
    ...(a.artist !== undefined && { artist: a.artist ? mapPrismaArtist(a.artist) : null }),
    ...(a.tracks !== undefined && { tracks: a.tracks.map(mapPrismaTrack) }),
    ...(a.genres !== undefined && {
      genres: a.genres.map((g) => ({ id: String(g.id), name: g.name, picture: g.picture })),
    }),
    ...(a.contributors !== undefined && { contributors: a.contributors.map(mapPrismaArtist) }),
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
    public: p.public,
    isLovedTrack: p.isLovedTrack,
    collaborative: p.collaborative,
    share: p.share,
    picture: p.picture,
    creatorId: p.creatorId !== null ? String(p.creatorId) : null,
    creatorName: p.creatorName,
    checksum: p.checksum,
    isPinned: p.isPinned,
    pinnedOrder: p.pinnedOrder,
    ...(p.tracks !== undefined && { tracks: p.tracks.map((pt) => mapPrismaTrack(pt.track)) }),
  };
}
