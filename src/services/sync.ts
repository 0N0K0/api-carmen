import { getPrismaClient } from '../plugins/prisma';
import { DeezerAlbum, DeezerArtist, DeezerTrack } from '../types/deezer';
import { deezerFetchAll, deezerFetchAllFrom, getAlbum, getArtist, getPlaylist, getUserLibrary } from './deezer';

function toArtistData(a: DeezerArtist) {
  return {
    name: a.name,
    link: a.link ?? null,
    picture: a.picture ?? null,
    nbAlbum: a.nb_album ?? null,
    nbFan: a.nb_fan ?? null,
  };
}

function toAlbumData(a: DeezerAlbum, artistId: number) {
  return {
    title: a.title,
    upc: a.upc ?? null,
    link: a.link ?? null,
    cover: a.cover ?? null,
    md5Image: a.md5_image ?? null,
    label: a.label ?? null,
    nbTracks: a.nb_tracks ?? null,
    duration: a.duration ?? null,
    fans: a.fans ?? null,
    releaseDate: a.release_date ?? null,
    recordType: a.record_type ?? null,
    explicitLyrics: a.explicit_lyrics ?? null,
    artistId,
  };
}

function toTrackData(t: DeezerTrack, artistId: number, albumId: number) {
  return {
    title: t.title,
    titleShort: t.title_short ?? null,
    titleVersion: t.title_version ?? null,
    isrc: t.isrc ?? null,
    link: t.link ?? null,
    duration: t.duration,
    trackPosition: t.track_position ?? null,
    diskNumber: t.disk_number ?? null,
    rank: t.rank ?? null,
    releaseDate: t.release_date ?? null,
    explicitLyrics: t.explicit_lyrics ?? null,
    preview: t.preview ?? null,
    bpm: t.bpm ?? null,
    gain: t.gain ?? null,
    artistId,
    albumId,
  };
}

async function upsertArtist(a: DeezerArtist) {
  const data = toArtistData(a);
  await getPrismaClient().artist.upsert({
    where: { id: a.id },
    create: { id: a.id, ...data },
    update: data,
  });
}

async function upsertAlbum(a: DeezerAlbum, artistId: number) {
  const data = toAlbumData(a, artistId);
  await getPrismaClient().album.upsert({
    where: { id: a.id },
    create: { id: a.id, ...data },
    update: data,
  });
}

async function upsertTrack(t: DeezerTrack, artistId: number, albumId: number) {
  const data = toTrackData(t, artistId, albumId);
  await getPrismaClient().track.upsert({
    where: { id: t.id },
    create: { id: t.id, ...data },
    update: data,
  });
}

async function persistTrack(track: DeezerTrack) {
  await upsertArtist(track.artist);
  await upsertAlbum(track.album, track.artist.id);
  await upsertTrack(track, track.artist.id, track.album.id);
}

/**
 * Synchronise une playlist Deezer et ses tracks dans la base de données.
 * Suit la pagination Deezer (`DeezerList.next`) pour récupérer tous les tracks,
 * même au-delà de la première page.
 * Upsert l'artiste, l'album et le track pour chaque entrée de la playlist,
 * puis la playlist elle-même et ses associations PlaylistTrack.
 * @param {number | string} deezerId Identifiant Deezer de la playlist.
 * @returns {Promise<object>} Playlist Prisma avec tracks inclus.
 */
export async function syncPlaylist(deezerId: number | string) {
  const prisma = getPrismaClient();
  const playlist = await getPlaylist(deezerId);
  const tracks = playlist.tracks
    ? await deezerFetchAllFrom<DeezerTrack>(playlist.tracks)
    : await deezerFetchAll<DeezerTrack>(`/playlist/${playlist.id}/tracks`);

  for (const track of tracks) {
    await persistTrack(track);
  }

  const playlistData = {
    title: playlist.title,
    description: playlist.description ?? null,
    duration: playlist.duration ?? null,
    public: playlist.public ?? null,
    isLovedTrack: playlist.is_loved_track ?? null,
    collaborative: playlist.collaborative ?? null,
    fans: playlist.fans ?? null,
    link: playlist.link ?? null,
    picture: playlist.picture ?? null,
    checksum: playlist.checksum ?? null,
  };
  await prisma.playlist.upsert({
    where: { id: playlist.id },
    create: { id: playlist.id, ...playlistData },
    update: playlistData,
  });

  for (let i = 0; i < tracks.length; i++) {
    await prisma.playlistTrack.upsert({
      where: { playlistId_trackId: { playlistId: playlist.id, trackId: tracks[i].id } },
      create: { playlistId: playlist.id, trackId: tracks[i].id, position: i + 1 },
      update: { position: i + 1 },
    });
  }

  // Miroir : un track retiré de la playlist côté Deezer doit disparaître localement,
  // pas juste ne plus être ajouté. Le Track lui-même n'est pas supprimé (catalogue partagé).
  await prisma.playlistTrack.deleteMany({
    where: { playlistId: playlist.id, trackId: { notIn: tracks.map((t) => t.id) } },
  });

  return prisma.playlist.findUniqueOrThrow({
    where: { id: playlist.id },
    include: {
      tracks: {
        orderBy: { position: 'asc' },
        include: { track: { include: { artist: true, album: { include: { artist: true } } } } },
      },
    },
  });
}

/**
 * Synchronise un album Deezer et ses tracks dans la base de données.
 * Suit la pagination Deezer (`DeezerList.next`) pour récupérer tous les tracks
 * de l'album, même au-delà de la première page.
 * @param {number | string} deezerId Identifiant Deezer de l'album.
 * @returns {Promise<object>} Album Prisma avec artist et tracks inclus.
 */
export async function syncAlbum(deezerId: number | string) {
  const prisma = getPrismaClient();
  const album = await getAlbum(deezerId);
  const artist = album.artist ?? album.contributors?.[0];
  if (!artist) throw new Error(`Album ${deezerId} has no artist`);

  await upsertArtist(artist);
  await upsertAlbum(album, artist.id);

  const tracks = album.tracks
    ? await deezerFetchAllFrom<DeezerTrack>(album.tracks)
    : await deezerFetchAll<DeezerTrack>(`/album/${album.id}/tracks`);
  for (const track of tracks) {
    const trackArtist = track.artist ?? artist;
    await upsertArtist(trackArtist);
    await upsertTrack(
      { ...track, artist: trackArtist, album } as DeezerTrack,
      trackArtist.id,
      album.id,
    );
  }

  return prisma.album.findUniqueOrThrow({
    where: { id: album.id },
    include: { artist: true, tracks: { include: { artist: true }, orderBy: { trackPosition: 'asc' } } },
  });
}

/**
 * Synchronise les top tracks d'un artiste Deezer dans la base de données.
 * Suit la pagination Deezer (`DeezerList.next`) pour récupérer toutes les pages
 * de top tracks, même au-delà de la première page.
 * @param {number | string} deezerId Identifiant Deezer de l'artiste.
 * @param {number} [limit=50] Nombre maximum de tracks par page.
 * @returns {Promise<object>} Artiste Prisma.
 */
export async function syncArtist(deezerId: number | string, limit = 50) {
  const prisma = getPrismaClient();
  const [artist, topTracks] = await Promise.all([
    getArtist(deezerId),
    deezerFetchAll<DeezerTrack>(`/artist/${deezerId}/top?limit=${limit}`),
  ]);

  await upsertArtist(artist);

  for (const track of topTracks) {
    await persistTrack(track);
  }

  return prisma.artist.findUniqueOrThrow({ where: { id: artist.id } });
}

export interface SyncLibraryError {
  type: 'playlist' | 'album' | 'artist';
  deezerId: string;
  message: string;
}

export interface SyncLibrarySummary {
  playlistsSynced: number;
  playlistsRemoved: number;
  albumsSynced: number;
  artistsSynced: number;
  errors: SyncLibraryError[];
}

/**
 * Synchronise en une fois toute la bibliothèque Deezer de l'utilisateur (playlists,
 * albums, artistes favoris) dans la base de données. Nécessite `DEEZER_ARL`.
 * Chaque élément est synchronisé indépendamment : l'échec d'un élément (playlist,
 * album ou artiste) n'interrompt pas la synchronisation des autres, il est
 * simplement consigné dans `errors`.
 * @param {number} [limit=50] Nombre maximum d'éléments par catégorie à synchroniser.
 * @returns {Promise<SyncLibrarySummary>} Nombre d'éléments synchronisés par catégorie et erreurs rencontrées.
 */
export async function syncUserLibrary(limit = 50): Promise<SyncLibrarySummary> {
  const library = await getUserLibrary(limit);
  const errors: SyncLibraryError[] = [];
  let playlistsSynced = 0;
  let albumsSynced = 0;
  let artistsSynced = 0;

  for (const playlist of library.playlists) {
    try {
      await syncPlaylist(playlist.id);
      playlistsSynced += 1;
    } catch (err) {
      errors.push({ type: 'playlist', deezerId: playlist.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Miroir : une playlist supprimée (ou plus possédée) côté Deezer doit disparaître
  // localement. Garde-fou : ne jamais purger sur une liste vide — une réponse Deezer
  // vide/transitoire ne doit pas être interprétée comme "l'utilisateur n'a plus rien".
  let playlistsRemoved = 0;
  if (library.playlists.length > 0) {
    const currentIds = library.playlists.map((p) => Number(p.id));
    const deleted = await getPrismaClient().playlist.deleteMany({
      where: { id: { notIn: currentIds } },
    });
    playlistsRemoved = deleted.count;
  }

  for (const album of library.albums) {
    try {
      await syncAlbum(album.id);
      albumsSynced += 1;
    } catch (err) {
      errors.push({ type: 'album', deezerId: album.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  for (const artist of library.artists) {
    try {
      await syncArtist(artist.id);
      artistsSynced += 1;
    } catch (err) {
      errors.push({ type: 'artist', deezerId: artist.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { playlistsSynced, playlistsRemoved, albumsSynced, artistsSynced, errors };
}
