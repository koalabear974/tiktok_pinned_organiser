import db from './connection';

export function initializeSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      video_id TEXT,
      description TEXT,
      create_time INTEGER,
      duration INTEGER,
      width INTEGER,
      height INTEGER,
      ratio TEXT,
      format TEXT,
      is_image_post INTEGER DEFAULT 0,
      image_count INTEGER DEFAULT 0,
      category_type INTEGER,
      author_id TEXT,
      author_unique_id TEXT,
      author_nickname TEXT,
      author_avatar_url TEXT,
      music_id TEXT,
      music_title TEXT,
      music_author TEXT,
      music_duration INTEGER,
      music_is_original INTEGER DEFAULT 0,
      play_count INTEGER DEFAULT 0,
      digg_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      collect_count INTEGER DEFAULT 0,
      poi_id TEXT,
      poi_name TEXT,
      poi_address TEXT,
      poi_city TEXT,
      poi_category TEXT,
      thumbnail_path TEXT,
      thumbnail_cached_at TEXT,
      imported_at TEXT DEFAULT (datetime('now')),
      text_language TEXT,
      raw_json TEXT,
      save_order INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_videos_save_order ON videos(save_order);
    CREATE INDEX IF NOT EXISTS idx_videos_create_time ON videos(create_time);
    CREATE INDEX IF NOT EXISTS idx_videos_author_id ON videos(author_id);
    CREATE INDEX IF NOT EXISTS idx_videos_author_unique_id ON videos(author_unique_id);
    CREATE INDEX IF NOT EXISTS idx_videos_play_count ON videos(play_count);
    CREATE INDEX IF NOT EXISTS idx_videos_digg_count ON videos(digg_count);
    CREATE INDEX IF NOT EXISTS idx_videos_category_type ON videos(category_type);
    CREATE INDEX IF NOT EXISTS idx_videos_text_language ON videos(text_language);
    CREATE INDEX IF NOT EXISTS idx_videos_is_image_post ON videos(is_image_post);

    CREATE TABLE IF NOT EXISTS hashtags (
      id TEXT PRIMARY KEY,
      title TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS video_hashtags (
      video_id TEXT NOT NULL,
      hashtag_id TEXT NOT NULL,
      PRIMARY KEY (video_id, hashtag_id),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_video_hashtags_video_id ON video_hashtags(video_id);
    CREATE INDEX IF NOT EXISTS idx_video_hashtags_hashtag_id ON video_hashtags(hashtag_id);

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6366f1',
      icon TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS video_categories (
      video_id TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      assigned_by TEXT DEFAULT 'manual',
      confidence REAL,
      assigned_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (video_id, category_id),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_video_categories_video_id ON video_categories(video_id);
    CREATE INDEX IF NOT EXISTS idx_video_categories_category_id ON video_categories(category_id);

    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      cursor_value INTEGER,
      items_count INTEGER,
      total_reported INTEGER,
      has_more INTEGER,
      imported_at TEXT DEFAULT (datetime('now'))
    );
  `);
}
