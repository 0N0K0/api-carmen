export interface DeezerArtist {
  id: number;
  name: string;
  link: string;
  picture: string;
  picture_small: string;
  picture_medium: string;
  picture_big: string;
  picture_xl: string;
  nb_album?: number;
  nb_fan?: number;
  radio?: boolean;
  tracklist: string;
  type: 'artist';
}

export interface DeezerAlbum {
  id: number;
  title: string;
  upc?: string;
  link: string;
  cover: string;
  cover_small: string;
  cover_medium: string;
  cover_big: string;
  cover_xl: string;
  md5_image?: string;
  genre_id?: number;
  genres?: DeezerList<DeezerGenre>;
  label?: string;
  nb_tracks?: number;
  duration?: number;
  fans?: number;
  release_date?: string;
  record_type?: string;
  available?: boolean;
  tracklist: string;
  explicit_lyrics?: boolean;
  explicit_content_lyrics?: number;
  explicit_content_cover?: number;
  contributors?: DeezerArtist[];
  artist?: DeezerArtist;
  tracks?: DeezerList<DeezerTrack>;
  type: 'album';
}

export interface DeezerGenre {
  id: number;
  name: string;
  picture?: string;
  type: 'genre';
}

export interface DeezerTrack {
  id: number;
  readable?: boolean;
  title: string;
  title_short?: string;
  title_version?: string;
  isrc?: string;
  link: string;
  duration: number;
  track_position?: number;
  disk_number?: number;
  rank?: number;
  release_date?: string;
  explicit_lyrics?: boolean;
  explicit_content_lyrics?: number;
  explicit_content_cover?: number;
  preview?: string;
  bpm?: number;
  gain?: number;
  available_countries?: string[];
  contributors?: DeezerArtist[];
  md5_image?: string;
  artist: DeezerArtist;
  album: DeezerAlbum;
  type: 'track';
}

export interface DeezerPlaylist {
  id: number;
  title: string;
  description?: string;
  duration?: number;
  public?: boolean;
  is_loved_track?: boolean;
  collaborative?: boolean;
  nb_tracks?: number;
  fans?: number;
  link: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  checksum?: string;
  tracklist: string;
  creation_date?: string;
  md5_image?: string;
  picture_type?: string;
  creator?: DeezerUser;
  tracks?: DeezerList<DeezerTrack>;
  type: 'playlist';
}

export interface DeezerUser {
  id: number;
  name: string;
  lastname?: string;
  firstname?: string;
  email?: string;
  status?: number;
  birthday?: string;
  inscription_date?: string;
  gender?: string;
  link: string;
  picture?: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  country?: string;
  lang?: string;
  is_kid?: boolean;
  explicit_content_level?: string;
  explicit_content_levels_available?: string[];
  tracklist?: string;
  type: 'user';
}

export interface DeezerList<T> {
  data: T[];
  total?: number;
  next?: string;
  prev?: string;
}

export interface DeezerSearchResults {
  tracks?: DeezerList<DeezerTrack>;
  albums?: DeezerList<DeezerAlbum>;
  artists?: DeezerList<DeezerArtist>;
  playlists?: DeezerList<DeezerPlaylist>;
}

export interface DeezerError {
  error: {
    type: string;
    message: string;
    code: number;
  };
}

export type DeezerSearchType = 'track' | 'album' | 'artist' | 'playlist' | 'user' | 'radio' | 'podcast';

export interface DeezerUserLibrary {
  tracks: DeezerList<DeezerTrack>;
  albums: DeezerList<DeezerAlbum>;
  artists: DeezerList<DeezerArtist>;
  playlists: DeezerList<DeezerPlaylist>;
}
