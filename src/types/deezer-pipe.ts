/** Artiste léger depuis la Pipe API Deezer. */
export interface PipeArtist {
  id: string;
  name: string;
}

/** Album léger depuis la Pipe API Deezer. */
export interface PipeAlbum {
  id: string;
  displayTitle: string;
  releaseDate: string | null;
  isExplicit: boolean | null;
  isFavorite: boolean | null;
  contributors: PipeArtist[];
}

/** Track depuis la Pipe API Deezer. */
export interface PipeTrack {
  id: string;
  title: string;
  duration: number;
  isrc: string | null;
  isExplicit: boolean | null;
  isFavorite: boolean | null;
  album: { id: string; displayTitle: string } | null;
  artists: PipeArtist[];
}

/** Playlist depuis la Pipe API Deezer. */
export interface PipePlaylist {
  id: string;
  title: string;
  estimatedTracksCount: number | null;
  isFavorite: boolean | null;
  description: string | null;
  owner: { id: string; name: string } | null;
}

/** Artiste depuis la Pipe API Deezer (favoris). */
export interface PipeFavoriteArtist {
  id: string;
  name: string;
  fansCount: number | null;
  isFavorite: boolean | null;
}

/** Profil de l'utilisateur authentifié. */
export interface PipeUser {
  id: string;
  name: string;
  email: string | null;
}

/** Bibliothèque complète de l'utilisateur. */
export interface PipeUserLibrary {
  tracks: PipeTrack[];
  albums: PipeAlbum[];
  artists: PipeFavoriteArtist[];
  playlists: PipePlaylist[];
}
