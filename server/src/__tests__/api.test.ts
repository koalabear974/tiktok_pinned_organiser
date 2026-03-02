import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../app';
import db from '../db/connection';

const SAMPLE_FILE = path.resolve(__dirname, '..', '..', '..', 'sample-data', '_api_user_collect_item_list_.json');

// Clean slate before tests
beforeAll(() => {
  db.exec('DELETE FROM video_categories');
  db.exec('DELETE FROM video_hashtags');
  db.exec('DELETE FROM videos');
  db.exec('DELETE FROM hashtags');
  db.exec('DELETE FROM categories');
  db.exec('DELETE FROM imports');
});

afterAll(() => {
  db.close();
});

// ─── Import ──────────────────────────────────────────────────

describe('POST /api/import', () => {
  it('should import a valid JSON file', async () => {
    const res = await request(app)
      .post('/api/import')
      .attach('file', SAMPLE_FILE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imported).toBe(16);
    expect(res.body.skipped).toBe(0);
    expect(res.body.errors).toHaveLength(0);
  });

  it('should deduplicate on re-import', async () => {
    const res = await request(app)
      .post('/api/import')
      .attach('file', SAMPLE_FILE);

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(0);
    expect(res.body.skipped).toBe(16);
  });

  it('should reject requests without a file', async () => {
    const res = await request(app).post('/api/import');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/imports', () => {
  it('should list import history', async () => {
    const res = await request(app).get('/api/imports');
    expect(res.status).toBe(200);
    expect(res.body.imports).toBeInstanceOf(Array);
    expect(res.body.imports.length).toBe(2);
    expect(res.body.imports[0]).toHaveProperty('filename');
    expect(res.body.imports[0]).toHaveProperty('items_count');
  });
});

// ─── Videos listing ──────────────────────────────────────────

describe('GET /api/videos', () => {
  it('should return paginated videos', async () => {
    const res = await request(app).get('/api/videos?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.videos).toHaveLength(5);
    expect(res.body.total).toBe(16);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(4); // ceil(16/5)
  });

  it('should return second page', async () => {
    const res = await request(app).get('/api/videos?page=2&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.videos).toHaveLength(5);
    expect(res.body.page).toBe(2);
  });

  it('should return last page with fewer items', async () => {
    const res = await request(app).get('/api/videos?page=4&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.videos).toHaveLength(1); // 16 - 15
  });

  it('should cap limit at 100', async () => {
    const res = await request(app).get('/api/videos?limit=999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });
});

// ─── Sorting ─────────────────────────────────────────────────

describe('GET /api/videos - sorting', () => {
  it('should default sort by save_order desc (most recently saved first)', async () => {
    const res = await request(app).get('/api/videos?limit=16');
    expect(res.status).toBe(200);
    const saveOrders = res.body.videos.map((v: { save_order: number }) => v.save_order);
    // Should be descending
    for (let i = 1; i < saveOrders.length; i++) {
      expect(saveOrders[i]).toBeLessThanOrEqual(saveOrders[i - 1]);
    }
  });

  it('should sort by save_order asc (oldest saved first)', async () => {
    const res = await request(app).get('/api/videos?sort=save_order&order=asc&limit=16');
    expect(res.status).toBe(200);
    const saveOrders = res.body.videos.map((v: { save_order: number }) => v.save_order);
    for (let i = 1; i < saveOrders.length; i++) {
      expect(saveOrders[i]).toBeGreaterThanOrEqual(saveOrders[i - 1]);
    }
  });

  it('should sort by create_time desc', async () => {
    const res = await request(app).get('/api/videos?sort=create_time&order=desc&limit=16');
    expect(res.status).toBe(200);
    const times = res.body.videos.map((v: { create_time: number }) => v.create_time);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    }
  });

  it('should sort by digg_count desc', async () => {
    const res = await request(app).get('/api/videos?sort=digg_count&order=desc&limit=16');
    expect(res.status).toBe(200);
    const counts = res.body.videos.map((v: { digg_count: number }) => v.digg_count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it('should sort by play_count asc', async () => {
    const res = await request(app).get('/api/videos?sort=play_count&order=asc&limit=16');
    expect(res.status).toBe(200);
    const counts = res.body.videos.map((v: { play_count: number }) => v.play_count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });

  it('should fall back to save_order for invalid sort field', async () => {
    const res = await request(app).get('/api/videos?sort=invalid_field&limit=16');
    expect(res.status).toBe(200);
    const saveOrders = res.body.videos.map((v: { save_order: number }) => v.save_order);
    for (let i = 1; i < saveOrders.length; i++) {
      expect(saveOrders[i]).toBeLessThanOrEqual(saveOrders[i - 1]);
    }
  });

  it('save_order should differ from create_time order', async () => {
    const bySave = await request(app).get('/api/videos?sort=save_order&order=desc&limit=16');
    const byCreate = await request(app).get('/api/videos?sort=create_time&order=desc&limit=16');
    const saveIds = bySave.body.videos.map((v: { id: string }) => v.id);
    const createIds = byCreate.body.videos.map((v: { id: string }) => v.id);
    // They should not be identical (save order ≠ creation order in our data)
    expect(saveIds).not.toEqual(createIds);
  });
});

// ─── Filtering ───────────────────────────────────────────────

describe('GET /api/videos - filtering', () => {
  it('should search by description keyword', async () => {
    const res = await request(app).get('/api/videos?search=tutorial');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const v of res.body.videos) {
      const text = (v.description + v.author_nickname + v.author_unique_id).toLowerCase();
      expect(text).toContain('tutorial');
    }
  });

  it('should search by author name', async () => {
    // Get a real author from the data
    const all = await request(app).get('/api/videos?limit=1');
    const author = all.body.videos[0].author_unique_id;

    const res = await request(app).get(`/api/videos?author=${author}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    for (const v of res.body.videos) {
      expect(v.author_unique_id).toBe(author);
    }
  });

  it('should filter by hashtag', async () => {
    // Find a hashtag that exists
    const hashtag = db.prepare('SELECT title FROM hashtags LIMIT 1').get() as { title: string };
    const res = await request(app).get(`/api/videos?hashtag=${hashtag.title}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('should return empty for non-existent search', async () => {
    const res = await request(app).get('/api/videos?search=zzzznonexistent99999');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.videos).toHaveLength(0);
  });
});

// ─── Single video ────────────────────────────────────────────

describe('GET /api/videos/:id', () => {
  let videoId: string;

  beforeAll(async () => {
    const res = await request(app).get('/api/videos?limit=1');
    videoId = res.body.videos[0].id;
  });

  it('should return video details with hashtags', async () => {
    const res = await request(app).get(`/api/videos/${videoId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(videoId);
    expect(res.body).toHaveProperty('description');
    expect(res.body).toHaveProperty('author_unique_id');
    expect(res.body).toHaveProperty('hashtags');
    expect(res.body.hashtags).toBeInstanceOf(Array);
    expect(res.body).toHaveProperty('categories');
    expect(res.body.categories).toBeInstanceOf(Array);
  });

  it('should return 404 for non-existent video', async () => {
    const res = await request(app).get('/api/videos/nonexistent123');
    expect(res.status).toBe(404);
  });
});

// ─── Stats ───────────────────────────────────────────────────

describe('GET /api/videos/stats', () => {
  it('should return correct stats', async () => {
    const res = await request(app).get('/api/videos/stats');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(16);
    expect(res.body.categorized).toBe(0);
    expect(res.body.uncategorized).toBe(16);
    expect(res.body.byCategory).toBeInstanceOf(Array);
  });
});

// ─── Categories CRUD ─────────────────────────────────────────

describe('Categories CRUD', () => {
  let musicCatId: number;
  let techCatId: number;

  it('POST /api/categories - should create a category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'Music', color: '#ef4444', description: 'Music videos' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Music');
    expect(res.body.color).toBe('#ef4444');
    musicCatId = res.body.id;
  });

  it('POST /api/categories - should create a second category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'Tech', color: '#3b82f6' });
    expect(res.status).toBe(201);
    techCatId = res.body.id;
  });

  it('POST /api/categories - should reject duplicate name', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'Music', color: '#000000' });
    expect(res.status).toBe(409);
  });

  it('POST /api/categories - should reject empty name', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: '', color: '#000000' });
    expect(res.status).toBe(400);
  });

  it('GET /api/categories - should list categories with counts', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toBeInstanceOf(Array);
    expect(res.body.categories.length).toBe(2);
    const music = res.body.categories.find((c: { name: string }) => c.name === 'Music');
    expect(music).toBeTruthy();
    expect(music.video_count).toBe(0);
  });

  it('PATCH /api/categories/:id - should update a category', async () => {
    const res = await request(app)
      .patch(`/api/categories/${musicCatId}`)
      .send({ name: 'Music & Audio', color: '#f97316' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Music & Audio');
    expect(res.body.color).toBe('#f97316');
  });

  it('PATCH /api/categories/:id - should 404 for non-existent', async () => {
    const res = await request(app)
      .patch('/api/categories/99999')
      .send({ name: 'Nope' });
    expect(res.status).toBe(404);
  });

  // ─── Category assignment ────────────────────────────────────

  describe('Video category assignment', () => {
    let videoId: string;

    beforeAll(async () => {
      const res = await request(app).get('/api/videos?limit=1');
      videoId = res.body.videos[0].id;
    });

    it('PATCH /api/videos/:id/categories - should assign categories', async () => {
      const res = await request(app)
        .patch(`/api/videos/${videoId}/categories`)
        .send({ categoryIds: [musicCatId, techCatId] });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.categories).toHaveLength(2);
    });

    it('should show category in video detail', async () => {
      const res = await request(app).get(`/api/videos/${videoId}`);
      expect(res.body.categories).toHaveLength(2);
      const catIds = res.body.categories.map((c: { id: number }) => c.id);
      expect(catIds).toContain(musicCatId);
      expect(catIds).toContain(techCatId);
    });

    it('should update stats after assignment', async () => {
      const res = await request(app).get('/api/videos/stats');
      expect(res.body.categorized).toBe(1);
      expect(res.body.uncategorized).toBe(15);
      expect(res.body.byCategory.length).toBe(2);
    });

    it('should update category video_count', async () => {
      const res = await request(app).get('/api/categories');
      const music = res.body.categories.find((c: { id: number }) => c.id === musicCatId);
      expect(music.video_count).toBe(1);
    });

    it('should filter videos by category', async () => {
      const res = await request(app).get(`/api/videos?category=${musicCatId}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.videos[0].id).toBe(videoId);
    });

    it('should filter uncategorized videos', async () => {
      const res = await request(app).get('/api/videos?category=uncategorized');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(15);
    });

    it('PATCH /api/videos/:id/categories - should replace categories', async () => {
      const res = await request(app)
        .patch(`/api/videos/${videoId}/categories`)
        .send({ categoryIds: [techCatId] });
      expect(res.status).toBe(200);
      expect(res.body.categories).toHaveLength(1);
      expect(res.body.categories[0].id).toBe(techCatId);
    });

    it('PATCH /api/videos/:id/categories - should clear all categories', async () => {
      const res = await request(app)
        .patch(`/api/videos/${videoId}/categories`)
        .send({ categoryIds: [] });
      expect(res.status).toBe(200);
      expect(res.body.categories).toHaveLength(0);
    });

    it('should reject invalid categoryIds', async () => {
      const res = await request(app)
        .patch(`/api/videos/${videoId}/categories`)
        .send({ categoryIds: 'not an array' });
      expect(res.status).toBe(400);
    });

    it('should 404 for non-existent video', async () => {
      const res = await request(app)
        .patch('/api/videos/nonexistent/categories')
        .send({ categoryIds: [musicCatId] });
      expect(res.status).toBe(404);
    });
  });

  // ─── Bulk category assignment ──────────────────────────────

  describe('Bulk category assignment', () => {
    let videoIds: string[];
    let bulkCatId: number;

    beforeAll(async () => {
      const res = await request(app).get('/api/videos?limit=5');
      videoIds = res.body.videos.map((v: { id: string }) => v.id);

      const catRes = await request(app)
        .post('/api/categories')
        .send({ name: 'BulkTest', color: '#22c55e' });
      bulkCatId = catRes.body.id;
    });

    it('POST /api/videos/bulk/categories - should assign category to multiple videos', async () => {
      const res = await request(app)
        .post('/api/videos/bulk/categories')
        .send({ videoIds: videoIds.slice(0, 3), categoryId: bulkCatId });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.assigned).toBe(3);
      expect(res.body.total).toBe(3);
    });

    it('should deduplicate on re-assign', async () => {
      const res = await request(app)
        .post('/api/videos/bulk/categories')
        .send({ videoIds: videoIds.slice(0, 3), categoryId: bulkCatId });
      expect(res.status).toBe(200);
      expect(res.body.assigned).toBe(0); // already assigned
    });

    it('should 404 for non-existent category', async () => {
      const res = await request(app)
        .post('/api/videos/bulk/categories')
        .send({ videoIds: videoIds.slice(0, 1), categoryId: 99999 });
      expect(res.status).toBe(404);
    });

    it('should reject empty videoIds', async () => {
      const res = await request(app)
        .post('/api/videos/bulk/categories')
        .send({ videoIds: [], categoryId: bulkCatId });
      expect(res.status).toBe(400);
    });

    it('should reject invalid body', async () => {
      const res = await request(app)
        .post('/api/videos/bulk/categories')
        .send({ videoIds: 'not-array', categoryId: bulkCatId });
      expect(res.status).toBe(400);
    });

    it('should reject missing categoryId', async () => {
      const res = await request(app)
        .post('/api/videos/bulk/categories')
        .send({ videoIds: videoIds.slice(0, 1) });
      expect(res.status).toBe(400);
    });

    afterAll(async () => {
      // Clean up: remove the bulk category
      await request(app).delete(`/api/categories/${bulkCatId}`);
    });
  });

  // ─── Category deletion ─────────────────────────────────────

  it('DELETE /api/categories/:id - should delete a category', async () => {
    // First assign category to a video
    const videosRes = await request(app).get('/api/videos?limit=1');
    const videoId = videosRes.body.videos[0].id;
    await request(app)
      .patch(`/api/videos/${videoId}/categories`)
      .send({ categoryIds: [musicCatId] });

    // Now delete the category
    const res = await request(app).delete(`/api/categories/${musicCatId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Video should have no categories now (cascade)
    const videoRes = await request(app).get(`/api/videos/${videoId}`);
    expect(videoRes.body.categories).toHaveLength(0);
  });

  it('DELETE /api/categories/:id - should 404 for non-existent', async () => {
    const res = await request(app).delete('/api/categories/99999');
    expect(res.status).toBe(404);
  });
});

// ─── Deduplication edge cases ────────────────────────────────

describe('Deduplication', () => {
  it('should not create duplicate videos on re-import', async () => {
    const before = await request(app).get('/api/videos/stats');
    const beforeTotal = before.body.total;

    const res = await request(app)
      .post('/api/import')
      .attach('file', SAMPLE_FILE);

    expect(res.body.imported).toBe(0);
    expect(res.body.skipped).toBe(16);

    const after = await request(app).get('/api/videos/stats');
    expect(after.body.total).toBe(beforeTotal);
  });
});

// ─── Save order ──────────────────────────────────────────────

describe('Save order', () => {
  it('every video should have a save_order', async () => {
    const res = await request(app).get('/api/videos?limit=16');
    for (const v of res.body.videos) {
      expect(v.save_order).toBeGreaterThan(0);
    }
  });

  it('first item in JSON (most recently saved) should have highest save_order', async () => {
    // The first item in the JSON has id 7611553375640882454
    const res = await request(app).get('/api/videos?sort=save_order&order=desc&limit=1');
    expect(res.body.videos[0].id).toBe('7611553375640882454');
  });

  it('last item in JSON (oldest saved) should have lowest save_order', async () => {
    const res = await request(app).get('/api/videos?sort=save_order&order=asc&limit=1');
    expect(res.body.videos[0].id).toBe('7608091087642692896');
  });
});

// ─── Thumbnail sync ──────────────────────────────────────────

describe('POST /api/thumbnails/sync', () => {
  it('should sync existing thumbnail files to DB', async () => {
    // Clear thumbnail_path in DB to simulate the bug
    db.exec("UPDATE videos SET thumbnail_path = NULL");

    const res = await request(app).post('/api/thumbnails/sync');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('synced');
    expect(res.body).toHaveProperty('downloaded');
    expect(res.body).toHaveProperty('failed');

    // After sync, videos should have thumbnail_path set
    const videos = await request(app).get('/api/videos?limit=16');
    const withThumbnails = videos.body.videos.filter(
      (v: { thumbnail_path: string | null }) => v.thumbnail_path !== null
    );
    expect(withThumbnails.length).toBeGreaterThan(0);
  });
});
