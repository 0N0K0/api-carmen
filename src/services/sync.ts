import { getPrismaClient } from '../plugins/prisma';
import { DeezerAlbum, DeezerArtist, DeezerTrack } from '../types/deezer';
import {
  deezerFetchAll,
  deezerFetchAllFrom,
  getAlbum,
  getArtist,
  getPlaylist,
  getPlaylistTrackIds,
  getTrack,
  getUserLibrary,
  getUserTracks,
} from './deezer';

function toArtistData(a: DeezerArtist) {
  return {
    name: a.name,
    share: a.share ?? null,
    picture: a.picture ?? null,
    pictureSmall: a.picture_small ?? null,
    pictureMedium: a.picture_medium ?? null,
    pictureBig: a.picture_big ?? null,
    pictureXl: a.picture_xl ?? null,
  };
}

function toAlbumData(a: DeezerAlbum, artistId: number) {
  return {
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
    artistId,
  };
}

function toTrackData(t: DeezerTrack, artistId: number, albumId: number) {
  return {
    title: t.title,
    titleShort: t.title_short ?? null,
    titleVersion: t.title_version ?? null,
    isrc: t.isrc ?? null,
    readable: t.readable ?? null,
    share: t.share ?? null,
    duration: t.duration,
    trackPosition: t.track_position ?? null,
    diskNumber: t.disk_number ?? null,
    rank: t.rank ?? null,
    explicitLyrics: t.explicit_lyrics ?? null,
    gain: t.gain ?? null,
    artistId,
    albumId,
  };
}

/**
 * Retire les clés à `null` d'un objet de données de sync. Certains endpoints Deezer
 * renvoient des sous-objets allégés (ex. l'artiste imbriqué dans `/album/{id}/tracks`
 * ou `/artist/{id}/top` n'a pas de `picture` ; ce dernier n'a pas non plus `isrc` sur
 * ses tracks) — sans ce filtre, un `update` déclenché par un endpoint allégé écraserait
 * avec `null` une donnée déjà connue et correcte issue d'un sync précédent plus complet.
 * @param {T} data Données à écrire.
 * @returns {Partial<T>} Mêmes données, sans les clés dont la valeur est `null`.
 */
function compactForUpdate<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null)) as Partial<T>;
}

async function upsertArtist(a: DeezerArtist) {
  const data = toArtistData(a);
  await getPrismaClient().artist.upsert({
    where: { id: a.id },
    create: { id: a.id, ...data },
    update: compactForUpdate(data),
  });
}

async function upsertAlbumGenres(albumId: number, genres: DeezerAlbum['genres']) {
  if (!genres) return;
  const prisma = getPrismaClient();
  for (const g of genres.data) {
    await prisma.genre.upsert({
      where: { id: g.id },
      create: { id: g.id, name: g.name, picture: g.picture ?? null },
      update: compactForUpdate({ name: g.name, picture: g.picture ?? null }),
    });
    await prisma.albumGenre.upsert({
      where: { albumId_genreId: { albumId, genreId: g.id } },
      create: { albumId, genreId: g.id },
      update: {},
    });
  }
}

async function upsertAlbumContributors(albumId: number, contributors: DeezerAlbum['contributors']) {
  if (!contributors) return;
  const prisma = getPrismaClient();
  for (const c of contributors) {
    await upsertArtist(c);
    await prisma.albumContributor.upsert({
      where: { albumId_artistId: { albumId, artistId: c.id } },
      create: { albumId, artistId: c.id, role: c.role ?? null },
      update: { role: c.role ?? null },
    });
  }
}

async function upsertAlbum(a: DeezerAlbum, artistId: number) {
  const data = toAlbumData(a, artistId);
  await getPrismaClient().album.upsert({
    where: { id: a.id },
    create: { id: a.id, ...data },
    update: compactForUpdate(data),
  });
  // genres/contributors ne sont présents que sur l'album complet (getAlbum), pas sur le
  // stub allégé imbriqué dans un track de playlist — on ne les touche pas sinon.
  await upsertAlbumGenres(a.id, a.genres);
  await upsertAlbumContributors(a.id, a.contributors);
}

async function upsertTrackContributors(trackId: number, contributors: DeezerTrack['contributors']) {
  if (!contributors) return;
  const prisma = getPrismaClient();
  for (const c of contributors) {
    await upsertArtist(c);
    await prisma.trackContributor.upsert({
      where: { trackId_artistId: { trackId, artistId: c.id } },
      create: { trackId, artistId: c.id, role: c.role ?? null },
      update: { role: c.role ?? null },
    });
  }
}

async function upsertTrack(t: DeezerTrack, artistId: number, albumId: number) {
  const data = toTrackData(t, artistId, albumId);
  await getPrismaClient().track.upsert({
    where: { id: t.id },
    create: { id: t.id, ...data },
    update: compactForUpdate(data),
  });
  // contributors n'est présent que sur un track complet, pas sur tous les stubs allégés
  // (ex. les tracks embarqués dans une playlist/album en ont, /artist/{id}/top non).
  await upsertTrackContributors(t.id, t.contributors);
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
 * @param {{ force?: boolean }} [options] `force: true` ignore le `checksum` et resynchronise
 *   entièrement les tracks même si Deezer indique que le contenu n'a pas changé.
 * @returns {Promise<object>} Playlist Prisma avec tracks inclus.
 */
export async function syncPlaylist(deezerId: number | string, options?: { force?: boolean }) {
  const prisma = getPrismaClient();
  const playlist = await getPlaylist(deezerId);

  // `checksum` change dès que le contenu de la playlist change côté Deezer (tracks ou ordre) ;
  // s'il est identique à celui déjà en base, la playlist est déjà à jour — inutile de refaire
  // tout le travail de pagination/upsert des tracks. `force` permet de l'ignorer explicitement.
  if (!options?.force && playlist.checksum) {
    const existing = await prisma.playlist.findUnique({
      where: { id: playlist.id },
      select: { checksum: true },
    });
    if (existing?.checksum === playlist.checksum) {
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
  }

  // Le champ `tracks` embarqué dans /playlist/{id} est parfois plafonné (constaté à 400
  // éléments sur une playlist qui en a 5000+) avec `next` à `null` alors qu'il en reste —
  // un bug/quirk de l'API Deezer, pas une vraie fin de liste. La sous-ressource dédiée
  // /playlist/{id}/tracks, elle, pagine correctement. On ne fait confiance au seed embarqué
  // que si Deezer donne un `next` réel, ou si son nombre de tracks couvre déjà `nb_tracks`.
  const embeddedCount = playlist.tracks?.data.length ?? 0;
  const canTrustEmbeddedTracks =
    playlist.tracks !== undefined &&
    (Boolean(playlist.tracks.next) || playlist.nb_tracks === undefined || embeddedCount >= playlist.nb_tracks);

  let tracks = canTrustEmbeddedTracks
    ? await deezerFetchAllFrom<DeezerTrack>(playlist.tracks!)
    : await deezerFetchAll<DeezerTrack>(`/playlist/${playlist.id}/tracks`);

  // L'API publique REST plafonne elle-même `nb_tracks` ET la pagination de
  // /playlist/{id}/tracks à 5000 (constaté en réel : une playlist de 7573 titres
  // renvoie total=5000 des deux côtés) — au-delà, seule la Pipe API authentifiée par
  // ARL pagine correctement. On ne s'en sert que pour compléter les tracks manquants
  // au-delà du plafond REST, en réutilisant `getTrack` pour une hydratation complète
  // (même niveau de détail que le reste du sync, cf. compactForUpdate plus haut).
  const REST_TRACK_LIST_CAP = 5000;
  if (tracks.length >= REST_TRACK_LIST_CAP) {
    try {
      const pipeTrackIds = await getPlaylistTrackIds(playlist.id);
      if (pipeTrackIds.length > tracks.length) {
        const byId = new Map(tracks.map((t) => [String(t.id), t]));
        const missingIds = pipeTrackIds.filter((id) => !byId.has(id));
        const hydrated = await Promise.all(missingIds.map((id) => getTrack(id)));
        for (const t of hydrated) byId.set(String(t.id), t);
        tracks = pipeTrackIds
          .map((id) => byId.get(id))
          .filter((t): t is DeezerTrack => t !== undefined);
      }
    } catch {
      // Pipe API indisponible (DEEZER_ARL absent, etc.) — on garde la liste REST
      // plafonnée, moins bonne que la Pipe API mais toujours mieux que rien.
    }
  }

  for (const track of tracks) {
    await persistTrack(track);
  }

  const playlistData = {
    title: playlist.title,
    description: playlist.description ?? null,
    public: playlist.public ?? null,
    isLovedTrack: playlist.is_loved_track ?? null,
    collaborative: playlist.collaborative ?? null,
    share: playlist.share ?? null,
    picture: playlist.picture ?? null,
    creatorId: playlist.creator ? BigInt(playlist.creator.id) : null,
    creatorName: playlist.creator?.name ?? null,
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

  // Même garde-fou que syncPlaylist : le `tracks` embarqué peut être plafonné par
  // Deezer avec `next` à `null` alors qu'il en reste — on ne s'y fie que si `next`
  // est réel ou si son compte couvre déjà `nb_tracks`.
  const embeddedTrackCount = album.tracks?.data.length ?? 0;
  const canTrustEmbeddedTracks =
    album.tracks !== undefined &&
    (Boolean(album.tracks.next) || album.nb_tracks === undefined || embeddedTrackCount >= album.nb_tracks);

  const tracks = canTrustEmbeddedTracks
    ? await deezerFetchAllFrom<DeezerTrack>(album.tracks!)
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

/**
 * Upsert complet (artiste/album/track) d'un favori, re-fetché via l'API REST (`getTrack`)
 * pour obtenir les données complètes (bpm, gain, isrc...) — la Pipe API ne renvoie qu'un
 * sous-ensemble de champs — puis marqué `isFavorite: true`.
 * @param {string} deezerId Identifiant Deezer du track favori.
 * @returns {Promise<number | null>} Id DB du track synchronisé, ou `null` si l'appel a échoué
 * (consigné en `console.error`, n'interrompt pas le reste d'un batch).
 */
async function persistFavoriteTrack(deezerId: string): Promise<number | null> {
  try {
    const track = await getTrack(deezerId);
    await persistTrack(track);
    await getPrismaClient().track.update({ where: { id: track.id }, data: { isFavorite: true } });
    return track.id;
  } catch (err) {
    console.error(`[sync] favorite track ${deezerId} failed:`, err);
    return null;
  }
}

/**
 * Démarque (`isFavorite: false`) les tracks marqués favoris en DB mais absents de la
 * liste de favoris Deezer courante — jamais supprimés (catalogue partagé, potentiellement
 * référencé par des playlists synchronisées indépendamment).
 * Garde-fou : ne démarque rien si `currentFavoriteIds` est vide (réponse Deezer
 * transitoire/vide ne doit pas être interprétée comme "plus aucun favori").
 * Basé sur la liste Deezer déclarée, pas sur le succès d'écriture individuel : un favori
 * dont le re-fetch a échoué ce tour-ci reste marqué favori (pas de faux négatif).
 * @param {number[]} currentFavoriteIds Ids Deezer actuellement favoris.
 * @returns {Promise<void>}
 */
async function pruneUnfavoritedTracks(currentFavoriteIds: number[]): Promise<void> {
  if (currentFavoriteIds.length === 0) return;
  await getPrismaClient().track.updateMany({
    where: { isFavorite: true, id: { notIn: currentFavoriteIds } },
    data: { isFavorite: false },
  });
}

/**
 * Synchronise les tracks favoris Deezer de l'utilisateur dans la base de données.
 * Nécessite `DEEZER_ARL`. Miroir : un track retiré des favoris côté Deezer est démarqué
 * localement (voir `pruneUnfavoritedTracks`), pas supprimé.
 * @param {number} [limit=50] Taille de page Pipe API pour la liste des favoris.
 * @returns {Promise<object[]>} Tracks actuellement favoris, avec artist et album inclus.
 */
export async function syncFavoriteTracks(limit = 50) {
  const favorites = await getUserTracks(limit);

  for (const fav of favorites) {
    await persistFavoriteTrack(fav.id);
  }
  await pruneUnfavoritedTracks(favorites.map((f) => Number(f.id)));

  return getPrismaClient().track.findMany({
    where: { isFavorite: true },
    orderBy: { id: 'asc' },
    include: { artist: true, album: { include: { artist: true } } },
  });
}

export interface SyncLibraryError {
  type: 'playlist' | 'album' | 'artist' | 'track';
  deezerId: string;
  message: string;
}

export interface SyncLibrarySummary {
  playlistsSynced: number;
  playlistsRemoved: number;
  albumsSynced: number;
  artistsSynced: number;
  tracksSynced: number;
  errors: SyncLibraryError[];
}

/**
 * Synchronise en une fois toute la bibliothèque Deezer de l'utilisateur (playlists,
 * albums, artistes, tracks favoris) dans la base de données. Nécessite `DEEZER_ARL`.
 * Chaque élément est synchronisé indépendamment : l'échec d'un élément (playlist,
 * album, artiste ou track) n'interrompt pas la synchronisation des autres, il est
 * simplement consigné dans `errors`.
 * @param {number} [limit=50] Nombre maximum d'éléments par catégorie à synchroniser.
 * @returns {Promise<SyncLibrarySummary>} Nombre d'éléments synchronisés par catégorie et erreurs rencontrées.
 */
export async function syncUserLibrary(limit = 50): Promise<SyncLibrarySummary> {
  const prisma = getPrismaClient();
  const library = await getUserLibrary(limit);
  const errors: SyncLibraryError[] = [];
  let playlistsSynced = 0;
  let albumsSynced = 0;
  let artistsSynced = 0;
  let tracksSynced = 0;

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
    const deleted = await prisma.playlist.deleteMany({
      where: { id: { notIn: currentIds } },
    });
    playlistsRemoved = deleted.count;
  }

  for (const album of library.albums) {
    try {
      const synced = await syncAlbum(album.id);
      await prisma.album.update({ where: { id: synced.id }, data: { isFavorite: true } });
      albumsSynced += 1;
    } catch (err) {
      errors.push({ type: 'album', deezerId: album.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
  // Miroir : un album retiré des favoris côté Deezer est démarqué localement (pas
  // supprimé — catalogue partagé, potentiellement référencé par des tracks synchronisés
  // indépendamment). Garde-fou sur liste vide, même logique que pour les tracks favoris.
  if (library.albums.length > 0) {
    await prisma.album.updateMany({
      where: { isFavorite: true, id: { notIn: library.albums.map((a) => Number(a.id)) } },
      data: { isFavorite: false },
    });
  }

  for (const artist of library.artists) {
    try {
      const synced = await syncArtist(artist.id);
      await prisma.artist.update({ where: { id: synced.id }, data: { isFavorite: true } });
      artistsSynced += 1;
    } catch (err) {
      errors.push({ type: 'artist', deezerId: artist.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
  // Miroir : même logique pour les artistes retirés des favoris.
  if (library.artists.length > 0) {
    await prisma.artist.updateMany({
      where: { isFavorite: true, id: { notIn: library.artists.map((a) => Number(a.id)) } },
      data: { isFavorite: false },
    });
  }

  for (const track of library.tracks) {
    const id = await persistFavoriteTrack(track.id);
    if (id !== null) {
      tracksSynced += 1;
    } else {
      errors.push({ type: 'track', deezerId: track.id, message: 'failed to sync favorite track' });
    }
  }
  // Miroir : un track retiré des favoris côté Deezer est démarqué localement (pas
  // supprimé). Basé sur la liste Deezer déclarée par `library.tracks`, pas sur le
  // succès d'écriture ci-dessus (voir pruneUnfavoritedTracks).
  await pruneUnfavoritedTracks(library.tracks.map((t) => Number(t.id)));

  return { playlistsSynced, playlistsRemoved, albumsSynced, artistsSynced, tracksSynced, errors };
}
