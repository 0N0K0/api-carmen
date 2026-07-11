import { getCurrentUser, getUserLibrary } from '../../services/deezer';
import { getPrismaClient } from '../../plugins/prisma';
import { syncUserLibrary } from '../../services/sync';

export const userResolvers = {
  Query: {
    /**
     * Récupère le profil de l'utilisateur Deezer authentifié (nécessite `DEEZER_ARL`).
     * Ne catch pas les erreurs d'auth (ARL expiré, etc.) : elles remontent telles quelles
     * pour que le client puisse afficher la vraie cause, contrairement aux lookups publics.
     * @param {unknown} _ Parent (non utilisé).
     * @returns {Promise<object>} Profil utilisateur.
     */
    currentUser: async () => {
      return getCurrentUser();
    },

    /**
     * Récupère la bibliothèque Deezer complète de l'utilisateur authentifié (tracks,
     * albums, artistes et playlists favoris) — nécessaire pour lister ce qu'il y a à
     * synchroniser avant d'appeler `syncPlaylist`/`syncAlbum`/`syncArtist`.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number }} args Nombre maximum d'éléments par catégorie.
     * @returns {Promise<object>} Tracks, albums, artistes et playlists favoris.
     */
    userLibrary: async (_: unknown, args: { limit?: number }) => {
      return getUserLibrary(args.limit);
    },

    /**
     * Compte, sans charger les données, ce qu'il y a en DB : tracks (total et favoris),
     * playlists, artistes favoris, albums favoris.
     * @returns {Promise<object>} Les cinq compteurs.
     */
    libraryStats: async () => {
      const prisma = getPrismaClient();
      const [tracksTotal, favoriteTracksTotal, playlistsTotal, favoriteArtistsTotal, favoriteAlbumsTotal] =
        await Promise.all([
          prisma.track.count(),
          prisma.track.count({ where: { isFavorite: true } }),
          prisma.playlist.count(),
          prisma.artist.count({ where: { isFavorite: true } }),
          prisma.album.count({ where: { isFavorite: true } }),
        ]);
      return { tracksTotal, favoriteTracksTotal, playlistsTotal, favoriteArtistsTotal, favoriteAlbumsTotal };
    },
  },

  Mutation: {
    /**
     * Synchronise en une fois toute la bibliothèque Deezer de l'utilisateur (playlists,
     * albums, artistes favoris) dans la base de données — le "tout synchroniser en un clic".
     * L'échec d'un élément n'interrompt pas les autres ; le détail est renvoyé dans `errors`.
     * @param {unknown} _ Parent (non utilisé).
     * @param {{ limit?: number }} args Nombre maximum d'éléments par catégorie à synchroniser.
     * @returns {Promise<object>} Nombre d'éléments synchronisés par catégorie et erreurs rencontrées.
     */
    syncUserLibrary: async (_: unknown, args: { limit?: number }) => {
      return syncUserLibrary(args.limit);
    },
  },
};
