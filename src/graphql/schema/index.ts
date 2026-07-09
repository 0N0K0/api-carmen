import { createSchema } from 'graphql-yoga';
import { artistResolvers } from '../resolvers/artist';
import { albumResolvers } from '../resolvers/album';
import { trackResolvers } from '../resolvers/track';
import { playlistResolvers } from '../resolvers/playlist';
import { syncResolvers } from '../resolvers/sync';

const typeDefs = /* GraphQL */ `
  type Artist {
    id: ID!
    name: String!
    link: String
    picture: String
    nbAlbum: Int
    nbFan: Int
  }

  type Album {
    id: ID!
    title: String!
    upc: String
    link: String
    cover: String
    label: String
    nbTracks: Int
    duration: Int
    fans: Int
    releaseDate: String
    recordType: String
    explicitLyrics: Boolean
    artist: Artist
    tracks: [Track!]
  }

  type Track {
    id: ID!
    title: String!
    titleShort: String
    isrc: String
    link: String
    duration: Int!
    rank: Int
    releaseDate: String
    explicitLyrics: Boolean
    preview: String
    bpm: Float
    gain: Float
    artist: Artist!
    album: Album!
  }

  type Playlist {
    id: ID!
    title: String!
    description: String
    duration: Int
    public: Boolean
    isLovedTrack: Boolean
    collaborative: Boolean
    fans: Int
    link: String
    picture: String
    checksum: String
    tracks: [Track!]
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

  type Query {
    track(id: ID!): Track
    artist(id: ID!): Artist
    album(id: ID!): Album
    playlist(id: ID!): Playlist
    tracks(limit: Int, offset: Int): TrackPage!
    albums(limit: Int, offset: Int): AlbumPage!
    artists(limit: Int, offset: Int): ArtistPage!
    playlists(limit: Int, offset: Int): PlaylistPage!
    search(query: String!, type: SearchType, limit: Int): SearchResults!
  }

  type Mutation {
    getStreamUrl(trackId: ID!): String!
    syncPlaylist(deezerId: ID!): Playlist!
    syncAlbum(deezerId: ID!): Album!
    syncArtist(deezerId: ID!, limit: Int): Artist!
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
    },
    Mutation: {
      ...trackResolvers.Mutation,
      ...syncResolvers.Mutation,
    },
    Track: trackResolvers.Track,
    Album: albumResolvers.Album,
    Playlist: playlistResolvers.Playlist,
  },
});
