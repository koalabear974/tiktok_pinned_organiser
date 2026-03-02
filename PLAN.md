# TikTok Saved Videos Manager - Implementation Plan

## Context

You have 1,317 saved TikTok videos and a JSON export from TikTok's API (`_api_user_collect_item_list_.json`). The goal is to build a local web app to import, browse, preview, and categorize these videos. Categorization can be manual (user-defined categories like Art, Food, Tech) or automated via a local LLM (Ollama). The app runs entirely locally with a file-based database.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Shadcn/ui
- **Database**: SQLite via `better-sqlite3` (synchronous, file-based)
- **Data fetching**: TanStack Query (React Query)
- **LLM** (Phase 2): Ollama REST API

## Project Structure

```
tiktok_extractor/
├── package.json              # npm workspaces root
├── data/                     # Runtime data (git-ignored)
│   ├── db.sqlite
│   └── thumbnails/
├── server/
│   ├── src/
│   │   ├── index.ts          # Express entry point
│   │   ├── db/
│   │   │   ├── connection.ts # SQLite singleton
│   │   │   └── schema.ts    # CREATE TABLE statements
│   │   ├── routes/
│   │   │   ├── videos.ts
│   │   │   ├── categories.ts
│   │   │   ├── import.ts
│   │   │   └── llm.ts
│   │   ├── services/
│   │   │   ├── importer.ts   # JSON parsing + DB insert
│   │   │   ├── thumbnail.ts  # Download & cache covers
│   │   │   └── llm.ts        # Ollama client
│   │   └── types/
│   │       └── tiktok.ts     # TikTok API interfaces
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/client.ts     # Fetch wrapper
│   │   ├── hooks/            # React Query hooks
│   │   ├── components/
│   │   │   ├── layout/       # AppShell, Sidebar, Header
│   │   │   ├── videos/       # VideoGrid, VideoCard, VideoModal
│   │   │   ├── categories/   # CategoryList, CategoryManager, CategoryAssigner
│   │   │   └── import/       # ImportDialog, ImportProgress
│   │   └── pages/Home.tsx
└── sample-data/              # Original JSON files
```

## Database Schema (SQLite)

### videos table
Core table with denormalized author/music/location fields, stats snapshot, and `thumbnail_path` for cached cover images. Stores `raw_json` for each item to preserve all original data.

```sql
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,                      -- TikTok video ID
    video_id TEXT,                            -- TikTok internal videoID
    description TEXT NOT NULL DEFAULT '',
    create_time INTEGER NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    width INTEGER,
    height INTEGER,
    ratio TEXT,
    format TEXT,
    is_image_post INTEGER NOT NULL DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    category_type INTEGER,

    -- Author info (denormalized)
    author_id TEXT NOT NULL,
    author_unique_id TEXT NOT NULL,
    author_nickname TEXT NOT NULL,
    author_avatar_url TEXT,

    -- Music info
    music_id TEXT,
    music_title TEXT,
    music_author TEXT,
    music_duration INTEGER,
    music_is_original INTEGER DEFAULT 0,

    -- Stats (snapshot at import time)
    play_count INTEGER DEFAULT 0,
    digg_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    collect_count INTEGER DEFAULT 0,

    -- Location (from poi)
    poi_id TEXT,
    poi_name TEXT,
    poi_address TEXT,
    poi_city TEXT,
    poi_category TEXT,

    -- Thumbnail caching
    thumbnail_path TEXT,
    thumbnail_cached_at INTEGER,

    -- Metadata
    imported_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    text_language TEXT,
    raw_json TEXT
);

CREATE INDEX idx_videos_create_time ON videos(create_time);
CREATE INDEX idx_videos_author ON videos(author_unique_id);
CREATE INDEX idx_videos_imported_at ON videos(imported_at);
```

### hashtags + video_hashtags tables
Extracted from TikTok `challenges[]` array. Many-to-many.

```sql
CREATE TABLE IF NOT EXISTS hashtags (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS video_hashtags (
    video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    hashtag_id TEXT NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (video_id, hashtag_id)
);

CREATE INDEX idx_video_hashtags_hashtag ON video_hashtags(hashtag_id);
```

### categories + video_categories tables
User-defined categories (name, color, icon). Many-to-many with videos. `assigned_by` tracks manual vs LLM assignment.

```sql
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1',
    icon TEXT,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS video_categories (
    video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    assigned_by TEXT NOT NULL DEFAULT 'manual',
    confidence REAL,
    assigned_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (video_id, category_id)
);

CREATE INDEX idx_video_categories_category ON video_categories(category_id);
```

### imports table
```sql
CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    cursor_value TEXT,
    items_count INTEGER NOT NULL,
    total_reported INTEGER,
    has_more INTEGER,
    imported_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

## API Endpoints

### Import
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/import` | Upload TikTok JSON files (multipart/form-data). Parses, deduplicates by video ID, inserts into DB, downloads thumbnails. Returns `{ imported, skipped, errors }` |
| GET | `/api/imports` | List past imports |

### Videos
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/videos` | List videos with pagination (`page`, `limit`), filtering (`category`, `hashtag`, `search`, `author`, `type`), sorting (`sort`, `order`) |
| GET | `/api/videos/:id` | Single video with full details, categories, hashtags |
| PATCH | `/api/videos/:id/categories` | Update category assignments. Body: `{ categoryIds: number[] }` |
| GET | `/api/videos/stats` | Aggregate stats: total count, by category, uncategorized count |

### Categories
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/categories` | List all categories with video counts |
| POST | `/api/categories` | Create category. Body: `{ name, color?, icon?, description? }` |
| PATCH | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category (removes all assignments) |

### Thumbnails
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/thumbnails/:filename` | Serve locally cached thumbnail files |

### LLM (Phase 2)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/llm/status` | Check if Ollama is running and available models |
| POST | `/api/llm/categorize` | Start auto-categorization job. Body: `{ videoIds?, model?, categories }` |
| GET | `/api/llm/categorize/:jobId` | Poll job status and results |

## UI Component Hierarchy

```
<App>
  <QueryClientProvider>
    <AppShell>
      <Sidebar>
        <ImportButton />               Opens ImportDialog
        <SearchInput />                 Global search
        <CategoryList>
          <AllVideosItem />
          <UncategorizedItem />
          <CategoryItem />             Name + count + color dot (repeated)
        </CategoryList>
        <CategoryManager />            "Manage categories" button -> dialog
        <LlmPanel />                   Phase 2: LLM categorize controls
      </Sidebar>

      <MainContent>
        <Header>
          <ViewToggle />               Grid / List toggle
          <SortDropdown />             Sort by: date, likes, views
          <FilterChips />              Active filters as dismissible chips
          <VideoCount />               "Showing 42 of 1317 videos"
        </Header>

        <VideoGrid>                    CSS Grid, responsive columns
          <VideoCard />                Thumbnail + stats overlay + badges (repeated)
        </VideoGrid>

        <Pagination />
      </MainContent>

      <VideoModal>                     Full detail view (on card click)
        <VideoEmbed />                 TikTok iframe player
        <VideoDetails />              Description, author, music, stats, hashtags, location
        <CategoryAssigner />          Multi-select category dropdown
      </VideoModal>

      <ImportDialog>
        <DropZone />                   Drag-and-drop file upload
        <ImportProgress />             Progress bar + results summary
      </ImportDialog>

      <CategoryManager>
        <CategoryForm />              Name, color picker, icon
        <CategoryTable />             Edit/delete existing categories
      </CategoryManager>
    </AppShell>
  </QueryClientProvider>
</App>
```

## Key Design Decisions

1. **Thumbnails cached at import time** - TikTok CDN URLs expire (~24h), so we download cover images locally (~26MB for 1317 videos). Without this, the grid would show broken images.

2. **TikTok iframe player** for video preview - Use `<iframe src="https://www.tiktok.com/player/v1/{videoId}" />` rather than oEmbed HTML injection. Simpler and more reliable in React.

3. **Synchronous better-sqlite3** - No async complexity for a single-user local app. Transactions are trivial. Fastest SQLite binding for Node.js.

4. **Denormalized author data** - Author info stored directly on videos table. With ~1317 records, a join table adds complexity without benefit.

5. **URL search params for filters** - Makes views bookmarkable, browser back/forward works naturally with filter changes.

6. **Raw JSON stored per item** - Preserves all original TikTok data (~50MB total) for potential future re-processing.

7. **In-memory job queue for LLM** - Sufficient for single-user; no Redis needed. Job state lost on restart is acceptable.

8. **Single-process production deployment** - Express serves both API and Vite build output. No nginx needed.

## Implementation Order

### Phase 1: Foundation
1. Project scaffolding (npm workspaces, TypeScript configs, .gitignore)
2. Database layer (better-sqlite3 connection, schema auto-creation)
3. TikTok TypeScript type definitions (matching the actual JSON structure)
4. Import service (JSON parsing, DB insertion, deduplication, thumbnail download)
5. Express server setup + import route

### Phase 2: API + Core UI
6. Videos & categories API routes (with pagination, filtering, sorting)
7. Client setup (Vite + React + Tailwind + Shadcn/ui + TanStack Query)
8. App shell layout (sidebar + main content area)
9. Video grid with cards (cached thumbnails, hover stats, duration badge)
10. Video detail modal with TikTok iframe embed

### Phase 3: Categories & Polish
11. Category sidebar list with counts + "All" and "Uncategorized" filters
12. Category CRUD dialog (create, edit, delete with color picker)
13. Category assignment on video modal + bulk assign from grid
14. Search input, hashtag/author click-to-filter
15. Sorting, view modes (grid/list), loading skeletons, empty states, toasts
16. Dark mode support

### Phase 4: LLM Auto-categorization
17. Ollama integration service (check availability, generate categorization)
18. LLM route with async job processing and progress tracking
19. LLM UI panel (model selector, progress bar, review suggestions with confidence scores)

## LLM Categorization Strategy (Phase 2)

For each video, construct a prompt using available metadata:
```
Given the following TikTok video metadata, assign it to one or more of these categories: [Art, Food, Tech, Music, ...].

Video description: "{desc}"
Hashtags: {#hashtag1, #hashtag2}
Author: {nickname} (@{handle})
Music: "{title}" by {artist}
Location: {poi_name}, {poi_city}
Duration: {duration}s

Respond with JSON: { "categories": ["cat1", "cat2"], "confidence": { "cat1": 0.9, "cat2": 0.7 } }
```

Use Ollama's `/api/generate` endpoint with `format: "json"` for structured output. Process in batches with concurrency limit of 2-3 requests.

## Verification

1. `npm run dev` starts both client (Vite, port 5173) and server (Express, port 3001)
2. Import sample JSON via the Import dialog - verify videos appear in grid with thumbnails
3. Create categories (e.g., Art, Food, Tech) - verify they appear in sidebar with counts
4. Assign categories to videos via modal - verify filtering works
5. Test search by keyword, filter by hashtag/author
6. Click a video card - verify TikTok embed plays in modal
7. (Phase 2) Start Ollama, run auto-categorization, review and accept/reject suggestions
