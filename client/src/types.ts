export interface Video {
  id: string;
  video_id: string | null;
  description: string;
  create_time: number;
  duration: number;
  width: number;
  height: number;
  ratio: string;
  format: string;
  is_image_post: boolean;
  image_count: number;
  category_type: number | null;
  author_id: string;
  author_unique_id: string;
  author_nickname: string;
  author_avatar_url: string | null;
  music_id: string | null;
  music_title: string | null;
  music_author: string | null;
  music_duration: number;
  music_is_original: boolean;
  play_count: number;
  digg_count: number;
  comment_count: number;
  share_count: number;
  collect_count: number;
  poi_id: string | null;
  poi_name: string | null;
  poi_address: string | null;
  poi_city: string | null;
  poi_category: string | null;
  thumbnail_url: string | null;
  thumbnail_cached_at: string | null;
  imported_at: string;
  text_language: string | null;
  raw_json: string;
  save_order: number;
  // Joined fields (present on single video detail)
  categories?: Category[];
  hashtags?: { id: string; title: string }[];
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  video_count?: number;
  created_at: number;
  updated_at: number;
}

export interface VideoStats {
  total: number;
  categorized: number;
  uncategorized: number;
  byCategory: { id: number; name: string; color: string; icon: string | null; count: number }[];
}

export interface VideosResponse {
  videos: Video[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export interface VideosParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  category?: number | 'uncategorized' | null;
}
