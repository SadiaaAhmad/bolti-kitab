/**
 * Bolti Kitab — Playback Module Domain Types
 */

export interface PlaybackChapterInfo {
  id: string;
  chapter_num: number;
  title: string;
  title_urdu: string | null;
  start_ms: number;
  duration_ms: number;
  is_preview_free: boolean;
  is_approved: boolean;
}

export interface ListeningProgressDto {
  user_id: string;
  book_id: string;
  chapter_id: string;
  position_ms: number;
  update_seq: number;
  is_completed: boolean;
  updated_at: string;
}

export interface BookPlaybackOverview {
  book_id: string;
  title: string;
  title_urdu: string;
  is_entitled: boolean;
  chapters: PlaybackChapterInfo[];
  progress: ListeningProgressDto | null;
}

export interface PlaybackTokenResponse {
  book_id: string;
  chapter_id: string;
  chapter_num: number;
  title: string;
  title_urdu: string | null;
  start_ms: number;
  duration_ms: number;
  playback_url: string;
  expires_at: string;
  format: string;
}

export interface UpdateProgressInput {
  chapter_id: string;
  position_ms: number;
  update_seq?: number | undefined;
  is_completed?: boolean | undefined;
}
