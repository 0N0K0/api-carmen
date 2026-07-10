/**
 * Tests d'intégration Deezer — appellent les vraies APIs.
 * Tests publics : pas d'auth requise.
 * Tests authentifiés : nécessitent DEEZER_ARL dans .env.
 *
 * Lancer avec : npx vitest run --reporter=verbose src/services/deezer.integration.test.ts
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import {
  getTrack,
  getArtist,
  getArtistTopTracks,
  getAlbum,
  getPlaylist,
  getTrackPreviewUrl,
  getCurrentUser,
  getUserTracks,
  getUserAlbums,
  getUserArtists,
  getUserPlaylists,
  getUserLibrary,
} from './deezer';

// Ressources Daft Punk — stables, bien connues
const DAFT_PUNK_ARTIST_ID = '27';
const DAFT_PUNK_TRACK_ID = '3135556'; // Harder, Better, Faster, Stronger
const DAFT_PUNK_ALBUM_ID = '302127';  // Discovery
const DAFT_PUNK_PLAYLIST_ID = '1338887';

const hasArl = !!process.env.DEEZER_ARL;

// ---------------------------------------------------------------------------
// Endpoints publics
// ---------------------------------------------------------------------------

describe('deezer public endpoints', () => {
  it('getTrack — retourne Harder, Better, Faster, Stronger', async () => {
    const track = await getTrack(DAFT_PUNK_TRACK_ID);
    expect(track.id).toBeTruthy();
    expect(track.title).toContain('Harder');
    expect(track.duration).toBeGreaterThan(0);
    expect(track.artist.name).toContain('Daft Punk');
  });

  it('getArtist — retourne Daft Punk', async () => {
    const artist = await getArtist(DAFT_PUNK_ARTIST_ID);
    expect(artist.id).toBeTruthy();
    expect(artist.name).toBe('Daft Punk');
  });

  it('getArtistTopTracks — retourne des tracks', async () => {
    const list = await getArtistTopTracks(DAFT_PUNK_ARTIST_ID, 5);
    expect(list.data).toBeInstanceOf(Array);
    expect(list.data.length).toBeGreaterThan(0);
    expect(list.data.length).toBeLessThanOrEqual(5);
  });

  it('getAlbum — retourne Discovery', async () => {
    const album = await getAlbum(DAFT_PUNK_ALBUM_ID);
    expect(album.id).toBeTruthy();
    expect(album.title).toContain('Discovery');
  });

  it('getPlaylist — retourne la playlist', async () => {
    const playlist = await getPlaylist(DAFT_PUNK_PLAYLIST_ID);
    expect(playlist.id).toBeTruthy();
    expect(playlist.title).toBeTruthy();
  });

  it('getTrackPreviewUrl — retourne une URL CDN', async () => {
    const url = await getTrackPreviewUrl(DAFT_PUNK_TRACK_ID);
    expect(url).toMatch(/^https?:\/\//);
  });
});

// ---------------------------------------------------------------------------
// Endpoints authentifiés (Pipe API)
// ---------------------------------------------------------------------------

describe.skipIf(!hasArl)('deezer authenticated endpoints (Pipe API)', () => {
  it('getCurrentUser — retourne le profil de l\'utilisateur', async () => {
    const user = await getCurrentUser();
    expect(user.id).toBeTruthy();
    expect(user.name).toBeTruthy();
  });

  // getUser{Tracks,Albums,Artists,Playlists} suivent maintenant toute la pagination
  // (plus de plafond via le paramètre, qui ne contrôle que la taille de page) — un compte
  // avec beaucoup de favoris/playlists peut prendre plus que le timeout par défaut (5s).

  it('getUserTracks — retourne les tracks favoris', async () => {
    const tracks = await getUserTracks(100);
    expect(tracks).toBeInstanceOf(Array);
    if (tracks.length > 0) {
      expect(tracks[0].id).toBeTruthy();
      expect(tracks[0].title).toBeTruthy();
      expect(tracks[0].duration).toBeGreaterThan(0);
    }
  }, 30000);

  it('getUserAlbums — retourne les albums favoris', async () => {
    const albums = await getUserAlbums(100);
    expect(albums).toBeInstanceOf(Array);
    if (albums.length > 0) {
      expect(albums[0].id).toBeTruthy();
      expect(albums[0].displayTitle).toBeTruthy();
    }
  }, 30000);

  it('getUserArtists — retourne les artistes favoris', async () => {
    const artists = await getUserArtists(100);
    expect(artists).toBeInstanceOf(Array);
    if (artists.length > 0) {
      expect(artists[0].id).toBeTruthy();
      expect(artists[0].name).toBeTruthy();
    }
  }, 30000);

  it('getUserPlaylists — retourne les playlists favorites', async () => {
    const playlists = await getUserPlaylists(100);
    expect(playlists).toBeInstanceOf(Array);
    if (playlists.length > 0) {
      expect(playlists[0].id).toBeTruthy();
      expect(playlists[0].title).toBeTruthy();
    }
  }, 30000);

  it('getUserLibrary — retourne la bibliothèque complète', async () => {
    const library = await getUserLibrary(100);
    expect(library).toMatchObject({
      tracks: expect.any(Array),
      albums: expect.any(Array),
      artists: expect.any(Array),
      playlists: expect.any(Array),
    });
  }, 30000);
});
