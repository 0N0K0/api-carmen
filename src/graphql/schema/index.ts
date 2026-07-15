import { createSchema } from 'graphql-yoga';
import { artistResolvers } from '../resolvers/artist';
import { albumResolvers } from '../resolvers/album';
import { trackResolvers } from '../resolvers/track';
import { playlistResolvers } from '../resolvers/playlist';
import { syncResolvers } from '../resolvers/sync';
import { userResolvers } from '../resolvers/user';
import { pinResolvers } from '../resolvers/pin';

const typeDefs = /* GraphQL */ `
  type Artist {
    id: ID!
    name: String!
    share: String
    picture: String
    pictureSmall: String
    pictureMedium: String
    pictureBig: String
    pictureXl: String
    isFavorite: Boolean
    isPinned: Boolean!
    pinnedOrder: Int
  }

  type Album {
    id: ID!
    title: String!
    upc: String
    share: String
    cover: String
    coverSmall: String
    coverMedium: String
    coverBig: String
    coverXl: String
    releaseDate: String
    recordType: String
    available: Boolean
    isFavorite: Boolean
    isPinned: Boolean!
    pinnedOrder: Int
    artist: Artist
    tracks: [Track!]
    genres: [Genre!]
    contributors: [Artist!]
  }

  type Genre {
    id: ID!
    name: String!
    picture: String
  }

  type Track {
    id: ID!
    title: String!
    titleShort: String
    isrc: String
    readable: Boolean
    share: String
    duration: Int!
    rank: Int
    explicitLyrics: Boolean
    gain: Float
    isFavorite: Boolean
    artist: Artist!
    album: Album!
    contributors: [Artist!]
  }

  type Playlist {
    id: ID!
    title: String!
    description: String
    public: Boolean
    isLovedTrack: Boolean
    collaborative: Boolean
    share: String
    picture: String
    creatorId: ID
    creatorName: String
    checksum: String
    isPinned: Boolean!
    pinnedOrder: Int
    tracks(limit: Int, offset: Int): TrackPage!
  }

  enum PinnableType {
    PLAYLIST
    ALBUM
    ARTIST
  }

  union PinnedItem = Playlist | Album | Artist

  input PinnedItemInput {
    type: PinnableType!
    id: ID!
  }

  type Folder {
    id: ID!
    name: String!
  }

  type SearchResults {
    tracks: [Track!]
    albums: [Album!]
    artists: [Artist!]
    playlists: [Playlist!]
  }

  enum SearchType {
    TRACK
    ALBUM
    ARTIST
    PLAYLIST
  }

  enum SortOrder {
    ASC
    DESC
  }

  type Pagination {
    offset: Int!
    limit: Int!
    total: Int!
  }

  type TrackPage {
    items: [Track!]!
    pagination: Pagination!
  }

  type AlbumPage {
    items: [Album!]!
    pagination: Pagination!
  }

  type ArtistPage {
    items: [Artist!]!
    pagination: Pagination!
  }

  type PlaylistPage {
    items: [Playlist!]!
    pagination: Pagination!
  }

  type CurrentUser {
    id: ID!
    name: String!
    email: String
  }

  type FavoriteContributor {
    id: ID!
    name: String!
  }

  type FavoritePlaylistOwner {
    id: ID!
    name: String!
  }

  type FavoritePlaylist {
    id: ID!
    title: String!
    estimatedTracksCount: Int
    isFavorite: Boolean
    description: String
    owner: FavoritePlaylistOwner
  }

  type FavoriteAlbum {
    id: ID!
    displayTitle: String!
    releaseDate: String
    isExplicit: Boolean
    isFavorite: Boolean
    contributors: [FavoriteContributor!]!
  }

  type FavoriteArtist {
    id: ID!
    name: String!
    fansCount: Int
    isFavorite: Boolean
  }

  type FavoriteTrackAlbum {
    id: ID!
    displayTitle: String!
  }

  type FavoriteTrack {
    id: ID!
    title: String!
    duration: Int!
    isrc: String
    isExplicit: Boolean
    isFavorite: Boolean
    album: FavoriteTrackAlbum
    artists: [FavoriteContributor!]!
  }

  type UserLibrary {
    tracks: [FavoriteTrack!]!
    albums: [FavoriteAlbum!]!
    artists: [FavoriteArtist!]!
    playlists: [FavoritePlaylist!]!
  }

  type SyncLibraryError {
    type: String!
    deezerId: ID!
    message: String!
  }

  type SyncLibrarySummary {
    playlistsSynced: Int!
    playlistsRemoved: Int!
    albumsSynced: Int!
    artistsSynced: Int!
    tracksSynced: Int!
    errors: [SyncLibraryError!]!
  }

  type SyncTypeSummary {
    synced: Int!
    removed: Int
    errors: [SyncLibraryError!]!
  }

  type LibraryStats {
    tracksTotal: Int!
    favoriteTracksTotal: Int!
    playlistsTotal: Int!
    favoriteArtistsTotal: Int!
    favoriteAlbumsTotal: Int!
    totalDurationMs: Float!
  }

  type Query {
    track(id: ID!): Track
    artist(id: ID!): Artist
    album(id: ID!): Album
    playlist(id: ID!): Playlist
    tracks(limit: Int, offset: Int): TrackPage!
    albums(limit: Int, offset: Int, favoritesOnly: Boolean, pinnedOnly: Boolean, orderBy: SortOrder): AlbumPage!
    artists(limit: Int, offset: Int, favoritesOnly: Boolean, pinnedOnly: Boolean, orderBy: SortOrder): ArtistPage!
    playlists(limit: Int, offset: Int, pinnedOnly: Boolean, orderBy: SortOrder): PlaylistPage!
    search(query: String!, type: SearchType, limit: Int): SearchResults!
    currentUser: CurrentUser
    userLibrary(limit: Int): UserLibrary!
    libraryStats: LibraryStats!
    pinnedItems: [PinnedItem!]!
  }

  type Mutation {
    getStreamUrl(trackId: ID!): String!
    syncPlaylist(deezerId: ID!, force: Boolean): Playlist!
    syncAlbum(deezerId: ID!): Album!
    syncArtist(deezerId: ID!, limit: Int): Artist!
    syncFavoriteTracks(limit: Int): [Track!]!
    syncFavoriteAlbums(limit: Int): SyncTypeSummary!
    syncFavoriteArtists(limit: Int): SyncTypeSummary!
    syncPlaylists(limit: Int): SyncTypeSummary!
    syncUserLibrary(limit: Int): SyncLibrarySummary!
    pinPlaylist(id: ID!): Playlist!
    unpinPlaylist(id: ID!): Playlist!
    pinAlbum(id: ID!): Album!
    unpinAlbum(id: ID!): Album!
    pinArtist(id: ID!): Artist!
    unpinArtist(id: ID!): Artist!
    reorderPinnedItems(items: [PinnedItemInput!]!): [PinnedItem!]!
  }
`;

export const schema = createSchema({
  typeDefs,
  resolvers: {
    Query: {
      ...trackResolvers.Query,
      ...artistResolvers.Query,
      ...albumResolvers.Query,
      ...playlistResolvers.Query,
      ...userResolvers.Query,
      ...pinResolvers.Query,
    },
    PinnedItem: pinResolvers.PinnedItem,
    Mutation: {
      ...trackResolvers.Mutation,
      ...syncResolvers.Mutation,
      ...userResolvers.Mutation,
      ...pinResolvers.Mutation,
    },
    Track: trackResolvers.Track,
    Album: albumResolvers.Album,
    Playlist: playlistResolvers.Playlist,
  },
});
