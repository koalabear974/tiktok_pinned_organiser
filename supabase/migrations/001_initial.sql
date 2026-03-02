-- ============================================================
-- TikTok Extractor: SQLite → Supabase PostgreSQL migration
-- ============================================================

-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  video_id TEXT,
  description TEXT,
  create_time BIGINT,
  duration INTEGER,
  width INTEGER,
  height INTEGER,
  ratio TEXT,
  format TEXT,
  is_image_post BOOLEAN DEFAULT FALSE,
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
  music_is_original BOOLEAN DEFAULT FALSE,
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
  thumbnail_url TEXT,
  thumbnail_cached_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  text_language TEXT,
  raw_json JSONB,
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
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  hashtag_id TEXT NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_video_hashtags_video_id ON video_hashtags(video_id);
CREATE INDEX IF NOT EXISTS idx_video_hashtags_hashtag_id ON video_hashtags(hashtag_id);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_categories (
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  assigned_by TEXT DEFAULT 'manual',
  confidence REAL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (video_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_video_categories_video_id ON video_categories(video_id);
CREATE INDEX IF NOT EXISTS idx_video_categories_category_id ON video_categories(category_id);

CREATE TABLE IF NOT EXISTS imports (
  id SERIAL PRIMARY KEY,
  filename TEXT,
  cursor_value BIGINT,
  items_count INTEGER,
  total_reported INTEGER,
  has_more BOOLEAN,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);


-- 2. RPC FUNCTIONS
-- ============================================================

-- get_videos: paginated listing with dynamic filters
CREATE OR REPLACE FUNCTION get_videos(
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 30,
  p_sort TEXT DEFAULT 'save_order',
  p_order TEXT DEFAULT 'desc',
  p_category TEXT DEFAULT NULL,
  p_hashtag TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_author TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_offset INTEGER;
  v_total INTEGER;
  v_total_pages INTEGER;
  v_sort_field TEXT;
  v_sort_order TEXT;
  v_result JSON;
  v_videos JSON;
BEGIN
  -- Sanitize pagination
  IF p_page < 1 THEN p_page := 1; END IF;
  IF p_limit < 1 THEN p_limit := 1; END IF;
  IF p_limit > 100 THEN p_limit := 100; END IF;
  v_offset := (p_page - 1) * p_limit;

  -- Sanitize sort
  IF p_sort NOT IN ('save_order', 'create_time', 'play_count', 'digg_count', 'comment_count', 'share_count', 'collect_count') THEN
    v_sort_field := 'save_order';
  ELSE
    v_sort_field := p_sort;
  END IF;

  IF LOWER(p_order) = 'asc' THEN
    v_sort_order := 'ASC';
  ELSE
    v_sort_order := 'DESC';
  END IF;

  -- Count total
  EXECUTE format(
    'SELECT COUNT(DISTINCT v.id) FROM videos v %s %s',
    -- joins
    CASE
      WHEN p_category IS NOT NULL AND p_category <> 'uncategorized'
        THEN 'INNER JOIN video_categories vc ON v.id = vc.video_id'
      ELSE ''
    END ||
    CASE
      WHEN p_hashtag IS NOT NULL
        THEN ' INNER JOIN video_hashtags vh ON v.id = vh.video_id INNER JOIN hashtags h ON vh.hashtag_id = h.id'
      ELSE ''
    END,
    -- where
    CASE
      WHEN (p_category IS NOT NULL AND p_category = 'uncategorized')
           OR (p_category IS NOT NULL AND p_category <> 'uncategorized')
           OR p_hashtag IS NOT NULL
           OR p_search IS NOT NULL
           OR p_author IS NOT NULL
           OR p_type IS NOT NULL
        THEN 'WHERE ' || array_to_string(ARRAY[
          CASE WHEN p_category = 'uncategorized'
            THEN 'v.id NOT IN (SELECT video_id FROM video_categories)' END,
          CASE WHEN p_category IS NOT NULL AND p_category <> 'uncategorized'
            THEN format('vc.category_id = %s', p_category::INTEGER) END,
          CASE WHEN p_hashtag IS NOT NULL
            THEN format('h.title = %L', p_hashtag) END,
          CASE WHEN p_search IS NOT NULL
            THEN format('(v.description ILIKE %L OR v.author_nickname ILIKE %L OR v.author_unique_id ILIKE %L)',
                         '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%') END,
          CASE WHEN p_author IS NOT NULL
            THEN format('v.author_unique_id = %L', p_author) END,
          CASE WHEN p_type = 'video'
            THEN 'v.is_image_post = FALSE' END,
          CASE WHEN p_type = 'image'
            THEN 'v.is_image_post = TRUE' END
        ] - NULL::TEXT, ' AND ')
      ELSE ''
    END
  ) INTO v_total;

  v_total_pages := GREATEST(1, CEIL(v_total::NUMERIC / p_limit));

  -- Fetch videos (exclude raw_json for list view — it's large)
  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (
      SELECT DISTINCT v.id, v.video_id, v.description, v.create_time, v.duration,
        v.width, v.height, v.ratio, v.format, v.is_image_post, v.image_count,
        v.category_type, v.author_id, v.author_unique_id, v.author_nickname,
        v.author_avatar_url, v.music_id, v.music_title, v.music_author,
        v.music_duration, v.music_is_original, v.play_count, v.digg_count,
        v.comment_count, v.share_count, v.collect_count, v.poi_id, v.poi_name,
        v.poi_address, v.poi_city, v.poi_category, v.thumbnail_url,
        v.thumbnail_cached_at, v.imported_at, v.text_language, v.save_order
      FROM videos v %s %s
      ORDER BY v.%I %s
      LIMIT %s OFFSET %s
    ) t',
    -- joins
    CASE
      WHEN p_category IS NOT NULL AND p_category <> 'uncategorized'
        THEN 'INNER JOIN video_categories vc ON v.id = vc.video_id'
      ELSE ''
    END ||
    CASE
      WHEN p_hashtag IS NOT NULL
        THEN ' INNER JOIN video_hashtags vh ON v.id = vh.video_id INNER JOIN hashtags h ON vh.hashtag_id = h.id'
      ELSE ''
    END,
    -- where
    CASE
      WHEN (p_category IS NOT NULL AND p_category = 'uncategorized')
           OR (p_category IS NOT NULL AND p_category <> 'uncategorized')
           OR p_hashtag IS NOT NULL
           OR p_search IS NOT NULL
           OR p_author IS NOT NULL
           OR p_type IS NOT NULL
        THEN 'WHERE ' || array_to_string(ARRAY[
          CASE WHEN p_category = 'uncategorized'
            THEN 'v.id NOT IN (SELECT video_id FROM video_categories)' END,
          CASE WHEN p_category IS NOT NULL AND p_category <> 'uncategorized'
            THEN format('vc.category_id = %s', p_category::INTEGER) END,
          CASE WHEN p_hashtag IS NOT NULL
            THEN format('h.title = %L', p_hashtag) END,
          CASE WHEN p_search IS NOT NULL
            THEN format('(v.description ILIKE %L OR v.author_nickname ILIKE %L OR v.author_unique_id ILIKE %L)',
                         '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%') END,
          CASE WHEN p_author IS NOT NULL
            THEN format('v.author_unique_id = %L', p_author) END,
          CASE WHEN p_type = 'video'
            THEN 'v.is_image_post = FALSE' END,
          CASE WHEN p_type = 'image'
            THEN 'v.is_image_post = TRUE' END
        ] - NULL::TEXT, ' AND ')
      ELSE ''
    END,
    v_sort_field,
    v_sort_order,
    p_limit,
    v_offset
  ) INTO v_videos;

  RETURN json_build_object(
    'videos', v_videos,
    'total', v_total,
    'page', p_page,
    'limit', p_limit,
    'totalPages', v_total_pages
  );
END;
$$;

-- get_video_stats: overview statistics
CREATE OR REPLACE FUNCTION get_video_stats()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INTEGER;
  v_categorized INTEGER;
  v_by_category JSON;
BEGIN
  SELECT COUNT(*) INTO v_total FROM videos;

  SELECT COUNT(DISTINCT video_id) INTO v_categorized FROM video_categories;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_by_category
  FROM (
    SELECT c.id, c.name, c.color, c.icon, COUNT(vc.video_id) as count
    FROM categories c
    LEFT JOIN video_categories vc ON c.id = vc.category_id
    GROUP BY c.id
    ORDER BY count DESC
  ) t;

  RETURN json_build_object(
    'total', v_total,
    'categorized', v_categorized,
    'uncategorized', v_total - v_categorized,
    'byCategory', v_by_category
  );
END;
$$;

-- import_videos: atomic import of TikTok JSON data
CREATE OR REPLACE FUNCTION import_videos(
  p_items JSONB,
  p_filename TEXT DEFAULT 'unknown',
  p_cursor BIGINT DEFAULT NULL,
  p_total INTEGER DEFAULT NULL,
  p_has_more BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_imported INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_item JSONB;
  v_max_order INTEGER;
  v_next_order INTEGER;
  v_item_count INTEGER;
  v_id TEXT;
  v_is_image_post BOOLEAN;
  v_image_count INTEGER;
  v_challenge JSONB;
  v_result INTEGER;
BEGIN
  v_item_count := jsonb_array_length(p_items);

  -- Get current max save_order
  SELECT COALESCE(MAX(save_order), 0) INTO v_max_order FROM videos;
  v_next_order := v_max_order + v_item_count;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_id := v_item->>'id';
      v_is_image_post := (v_item->'imagePost') IS NOT NULL AND (v_item->'imagePost')::TEXT <> 'null';
      v_image_count := CASE
        WHEN v_is_image_post AND v_item->'imagePost'->'images' IS NOT NULL
          THEN jsonb_array_length(v_item->'imagePost'->'images')
        ELSE 0
      END;

      INSERT INTO videos (
        id, video_id, description, create_time, duration, width, height,
        ratio, format, is_image_post, image_count, category_type,
        author_id, author_unique_id, author_nickname, author_avatar_url,
        music_id, music_title, music_author, music_duration, music_is_original,
        play_count, digg_count, comment_count, share_count, collect_count,
        poi_id, poi_name, poi_address, poi_city, poi_category,
        thumbnail_url, text_language, raw_json, save_order
      ) VALUES (
        v_id,
        v_item->'video'->>'videoID',
        COALESCE(v_item->>'desc', ''),
        (v_item->>'createTime')::BIGINT,
        COALESCE((v_item->'video'->>'duration')::INTEGER, 0),
        COALESCE((v_item->'video'->>'width')::INTEGER, 0),
        COALESCE((v_item->'video'->>'height')::INTEGER, 0),
        COALESCE(v_item->'video'->>'ratio', ''),
        COALESCE(v_item->'video'->>'format', ''),
        v_is_image_post,
        v_image_count,
        (v_item->>'CategoryType')::INTEGER,
        v_item->'author'->>'id',
        v_item->'author'->>'uniqueId',
        v_item->'author'->>'nickname',
        v_item->'author'->>'avatarThumb',
        v_item->'music'->>'id',
        v_item->'music'->>'title',
        v_item->'music'->>'authorName',
        COALESCE((v_item->'music'->>'duration')::INTEGER, 0),
        COALESCE((v_item->'music'->>'original')::BOOLEAN, FALSE),
        COALESCE((v_item->'stats'->>'playCount')::INTEGER, 0),
        COALESCE((v_item->'stats'->>'diggCount')::INTEGER, 0),
        COALESCE((v_item->'stats'->>'commentCount')::INTEGER, 0),
        COALESCE((v_item->'stats'->>'shareCount')::INTEGER, 0),
        COALESCE((v_item->'stats'->>'collectCount')::INTEGER, 0),
        v_item->'poi'->>'id',
        v_item->'poi'->>'name',
        v_item->'poi'->>'address',
        v_item->'poi'->>'city',
        v_item->'poi'->>'category',
        NULL, -- thumbnail_url set later by batch download
        v_item->>'textLanguage',
        v_item,
        v_next_order
      )
      ON CONFLICT (id) DO NOTHING;

      GET DIAGNOSTICS v_result = ROW_COUNT;
      IF v_result > 0 THEN
        v_imported := v_imported + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;

      v_next_order := v_next_order - 1;

      -- Insert hashtags from challenges
      IF v_item->'challenges' IS NOT NULL AND jsonb_typeof(v_item->'challenges') = 'array' THEN
        FOR v_challenge IN SELECT * FROM jsonb_array_elements(v_item->'challenges')
        LOOP
          INSERT INTO hashtags (id, title)
          VALUES (v_challenge->>'id', v_challenge->>'title')
          ON CONFLICT DO NOTHING;

          INSERT INTO video_hashtags (video_id, hashtag_id)
          VALUES (v_id, v_challenge->>'id')
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, format('Error importing item %s: %s', v_id, SQLERRM));
    END;
  END LOOP;

  -- Record the import
  INSERT INTO imports (filename, cursor_value, items_count, total_reported, has_more)
  VALUES (p_filename, p_cursor, v_item_count, p_total, p_has_more);

  RETURN json_build_object(
    'imported', v_imported,
    'skipped', v_skipped,
    'errors', to_json(v_errors)
  );
END;
$$;

-- 3. STORAGE (run these via Supabase dashboard or API, not plain SQL)
-- INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
-- VALUES ('thumbnails', 'thumbnails', true, ARRAY['image/jpeg', 'image/png', 'image/webp']);
