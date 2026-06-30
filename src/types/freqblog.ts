export interface FreqblogAudioFeatures {
  track_name: string;
  artist_name: string;
  album_name: string | null;
  itunes_track_id: string | null;
  isrc: string | null;
  mbid: string | null;
  release_date: string | null;
  duration_ms: number | null;
  explicit: boolean | null;
  source: string;
  first_ingested_at: string | null;
  bpm: number | null;
  bpm_alt: number | null;
  bpm_confidence: number | null;
  key: string | null;
  key_confidence: number | null;
  mode: number | null;
  key_int: number | null;
  camelot: string | null;
  open_key: string | null;
  loudness_db: number | null;
  time_signature: number | null;
  mood: string | null;
  genre: string | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  liveness: number | null;
  speechiness: number | null;
  mood_vector: unknown | null;
  representative_segment_start: number | null;
  onset_rate: number | null;
  dynamic_complexity: number | null;
  tuning_frequency: number | null;
  average_loudness: number | null;
  feature_source: string | null;
  backfill_status: string | null;
  backfill_notification_id: string | null;
}

export interface FreqblogTrackRef {
  track: string;
  artist: string;
  isrc?: string;
}
