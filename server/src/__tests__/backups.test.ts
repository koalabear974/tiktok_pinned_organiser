import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../app';
import db from '../db/connection';

const SAMPLE_FILE = path.resolve(__dirname, '..', '..', '..', 'sample-data', '_api_user_collect_item_list_.json');
const BACKUPS_DIR = path.resolve(__dirname, '..', '..', '..', 'data', 'backups');
const THUMBNAILS_DIR = path.resolve(__dirname, '..', '..', '..', 'data', 'thumbnails');
const BACKUP_NAME = 'vitest-backup-test';
const BACKUP_FILE = path.join(BACKUPS_DIR, `${BACKUP_NAME}.sqlite`);

// Clean slate before tests
beforeAll(async () => {
  db.exec('DELETE FROM video_categories');
  db.exec('DELETE FROM video_hashtags');
  db.exec('DELETE FROM videos');
  db.exec('DELETE FROM hashtags');
  db.exec('DELETE FROM categories');
  db.exec('DELETE FROM imports');

  // Remove backup if left over from a previous run
  if (fs.existsSync(BACKUP_FILE)) fs.unlinkSync(BACKUP_FILE);

  // Import sample data
  await request(app)
    .post('/api/import')
    .attach('file', SAMPLE_FILE)
    .expect(200);
});

afterAll(() => {
  // Clean up backups
  if (fs.existsSync(BACKUP_FILE)) fs.unlinkSync(BACKUP_FILE);
  if (fs.existsSync(BACKUPS_DIR)) {
    for (const f of fs.readdirSync(BACKUPS_DIR)) {
      if (f.startsWith('vitest-')) fs.unlinkSync(path.join(BACKUPS_DIR, f));
    }
  }

  // Restore clean DB state for other test suites
  db.exec('DELETE FROM video_categories');
  db.exec('DELETE FROM video_hashtags');
  db.exec('DELETE FROM videos');
  db.exec('DELETE FROM hashtags');
  db.exec('DELETE FROM categories');
  db.exec('DELETE FROM imports');
});

// ─── Backup CRUD ──────────────────────────────────────────────

describe('Backup CRUD', () => {
  it('POST /api/backups — creates a backup', async () => {
    const res = await request(app)
      .post('/api/backups')
      .send({ name: BACKUP_NAME })
      .expect(201);

    expect(res.body.name).toBe(BACKUP_NAME);
    expect(res.body.size).toBeGreaterThan(0);
    expect(res.body.createdAt).toBeTruthy();

    // File should exist on disk
    expect(fs.existsSync(BACKUP_FILE)).toBe(true);
  });

  it('POST /api/backups — rejects duplicate name', async () => {
    await request(app)
      .post('/api/backups')
      .send({ name: BACKUP_NAME })
      .expect(409);
  });

  it('GET /api/backups — lists backups', async () => {
    const res = await request(app)
      .get('/api/backups')
      .expect(200);

    expect(res.body.backups).toBeInstanceOf(Array);
    const found = res.body.backups.find((b: any) => b.name === BACKUP_NAME);
    expect(found).toBeTruthy();
  });

  it('DELETE /api/backups/:name — deletes a backup', async () => {
    // Create a throwaway backup first
    await request(app)
      .post('/api/backups')
      .send({ name: 'vitest-delete-me' })
      .expect(201);

    await request(app)
      .delete('/api/backups/vitest-delete-me')
      .expect(200);

    const deletedPath = path.join(BACKUPS_DIR, 'vitest-delete-me.sqlite');
    expect(fs.existsSync(deletedPath)).toBe(false);
  });

  it('POST /api/backups — rejects empty name', async () => {
    await request(app)
      .post('/api/backups')
      .send({ name: '' })
      .expect(400);
  });
});

// ─── Restore preserves data ────────────────────────────────────

describe('Restore preserves categories and video assignments', () => {
  let categoryId: number;
  let videoId: string;

  beforeAll(async () => {
    // Create a category and assign a video to it
    const catRes = await request(app)
      .post('/api/categories')
      .send({ name: 'Backup Cat', color: '#ef4444' })
      .expect(201);
    categoryId = catRes.body.id;

    // Get the first video
    const videosRes = await request(app)
      .get('/api/videos?limit=1')
      .expect(200);
    videoId = videosRes.body.videos[0].id;

    // Assign video to category
    await request(app)
      .patch(`/api/videos/${videoId}/categories`)
      .send({ categoryIds: [categoryId] })
      .expect(200);

    // Verify assignment exists
    const statsRes = await request(app).get('/api/videos/stats').expect(200);
    expect(statsRes.body.uncategorized).toBeLessThan(statsRes.body.total);

    // Create a backup WITH the assignment
    if (fs.existsSync(BACKUP_FILE)) fs.unlinkSync(BACKUP_FILE);
    await request(app)
      .post('/api/backups')
      .send({ name: BACKUP_NAME })
      .expect(201);
  });

  it('restore reverts removed video-category assignments', async () => {
    // Remove the category assignment
    await request(app)
      .patch(`/api/videos/${videoId}/categories`)
      .send({ categoryIds: [] })
      .expect(200);

    // Verify the category now has 0 videos
    const catsBefore = await request(app).get('/api/categories').expect(200);
    const catBefore = catsBefore.body.categories.find((c: any) => c.id === categoryId);
    expect(catBefore.video_count).toBe(0);

    // Restore the backup
    const restoreRes = await request(app)
      .post('/api/backups/restore')
      .send({ name: BACKUP_NAME })
      .expect(200);
    expect(restoreRes.body.success).toBe(true);

    // Verify the category has its video back
    const catsAfter = await request(app).get('/api/categories').expect(200);
    const catAfter = catsAfter.body.categories.find((c: any) => c.name === 'Backup Cat');
    expect(catAfter).toBeTruthy();
    expect(catAfter.video_count).toBe(1);
  });

  it('restore reverts added video-category assignments', async () => {
    // Assign more videos to the category
    const videosRes = await request(app).get('/api/videos?limit=5').expect(200);
    const ids = videosRes.body.videos.map((v: any) => v.id);

    await request(app)
      .post('/api/videos/bulk/categories')
      .send({ videoIds: ids, categoryId: categoryId })
      .expect(200);

    // Verify category now has >1 videos
    const catsBefore = await request(app).get('/api/categories').expect(200);
    const catBefore = catsBefore.body.categories.find((c: any) => c.name === 'Backup Cat');
    expect(catBefore.video_count).toBeGreaterThan(1);

    // Restore
    await request(app)
      .post('/api/backups/restore')
      .send({ name: BACKUP_NAME })
      .expect(200);

    // Should be back to exactly 1
    const catsAfter = await request(app).get('/api/categories').expect(200);
    const catAfter = catsAfter.body.categories.find((c: any) => c.name === 'Backup Cat');
    expect(catAfter.video_count).toBe(1);
  });

  it('restore preserves all video records', async () => {
    // Restore and check all videos are still there
    await request(app)
      .post('/api/backups/restore')
      .send({ name: BACKUP_NAME })
      .expect(200);

    const statsRes = await request(app).get('/api/videos/stats').expect(200);
    expect(statsRes.body.total).toBe(16); // sample data has 16 videos
  });
});

// ─── Restore preserves thumbnail paths ─────────────────────────

describe('Restore preserves thumbnail paths', () => {
  it('thumbnail_path is preserved or re-synced after restore', async () => {
    // Manually set a thumbnail_path and create a dummy file so syncExistingFiles() works
    const videosRes = await request(app).get('/api/videos?limit=1').expect(200);
    const videoId = videosRes.body.videos[0].id;
    const filename = `${videoId}.jpg`;
    const filePath = path.join(THUMBNAILS_DIR, filename);

    // Ensure thumbnail dir and a dummy file exist
    if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, 'fake-thumbnail-data');

    // Set the thumbnail_path in the DB
    db.prepare('UPDATE videos SET thumbnail_path = ? WHERE id = ?').run(filename, videoId);

    // Create a backup with the thumbnail_path set
    const backupName = 'vitest-thumb-test';
    const backupPath = path.join(BACKUPS_DIR, `${backupName}.sqlite`);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

    await request(app)
      .post('/api/backups')
      .send({ name: backupName })
      .expect(201);

    // Clear thumbnail_path to simulate it being null
    db.prepare('UPDATE videos SET thumbnail_path = NULL WHERE id = ?').run(videoId);

    // Verify it's null now
    const row = db.prepare('SELECT thumbnail_path FROM videos WHERE id = ?').get(videoId) as any;
    expect(row.thumbnail_path).toBeNull();

    // Restore
    await request(app)
      .post('/api/backups/restore')
      .send({ name: backupName })
      .expect(200);

    // After restore, thumbnail_path should be set (either from backup data or syncExistingFiles)
    const restored = db.prepare('SELECT thumbnail_path FROM videos WHERE id = ?').get(videoId) as any;
    expect(restored.thumbnail_path).toBe(filename);

    // The thumbnail endpoint should serve the file
    const thumbRes = await request(app).get(`/api/thumbnails/${filename}`);
    expect(thumbRes.status).toBe(200);

    // Clean up
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  });

  it('syncExistingFiles re-links thumbnails with null paths after restore', async () => {
    // Get a video and create a fake thumbnail file for it
    const videosRes = await request(app).get('/api/videos?limit=1&page=2').expect(200);
    if (videosRes.body.videos.length === 0) return; // skip if no page 2
    const videoId = videosRes.body.videos[0].id;
    const filename = `${videoId}.jpg`;
    const filePath = path.join(THUMBNAILS_DIR, filename);

    if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, 'fake-data');

    // Ensure thumbnail_path is NULL in the DB
    db.prepare('UPDATE videos SET thumbnail_path = NULL WHERE id = ?').run(videoId);

    // Create a backup where thumbnail_path is NULL
    const backupName = 'vitest-sync-test';
    const backupPath = path.join(BACKUPS_DIR, `${backupName}.sqlite`);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);

    await request(app)
      .post('/api/backups')
      .send({ name: backupName })
      .expect(201);

    // Restore (syncExistingFiles runs after restore)
    await request(app)
      .post('/api/backups/restore')
      .send({ name: backupName })
      .expect(200);

    // After restore + sync, the thumbnail_path should be set because the file exists on disk
    const restored = db.prepare('SELECT thumbnail_path FROM videos WHERE id = ?').get(videoId) as any;
    expect(restored.thumbnail_path).toBe(filename);

    // Clean up
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  });
});

// ─── Restore + subsequent operations work ──────────────────────

describe('Subsequent operations work after restore', () => {
  it('can create categories after restore', async () => {
    // Restore first
    await request(app)
      .post('/api/backups/restore')
      .send({ name: BACKUP_NAME })
      .expect(200);

    // Create a new category
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'Post-Restore Cat', color: '#22c55e' })
      .expect(201);
    expect(res.body.name).toBe('Post-Restore Cat');

    // Clean up
    await request(app).delete(`/api/categories/${res.body.id}`).expect(200);
  });

  it('can assign videos to categories after restore', async () => {
    await request(app)
      .post('/api/backups/restore')
      .send({ name: BACKUP_NAME })
      .expect(200);

    const videosRes = await request(app).get('/api/videos?limit=1').expect(200);
    const videoId = videosRes.body.videos[0].id;

    const catsRes = await request(app).get('/api/categories').expect(200);
    if (catsRes.body.categories.length === 0) return;
    const catId = catsRes.body.categories[0].id;

    const res = await request(app)
      .patch(`/api/videos/${videoId}/categories`)
      .send({ categoryIds: [catId] })
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  it('can import after restore (prepared statement cache invalidated)', async () => {
    await request(app)
      .post('/api/backups/restore')
      .send({ name: BACKUP_NAME })
      .expect(200);

    // Re-import should work (deduplication means 0 new imports, but no crash)
    const res = await request(app)
      .post('/api/import')
      .attach('file', SAMPLE_FILE)
      .expect(200);

    expect(res.body.success).toBe(true);
    // All 16 already exist, so they should be skipped
    expect(res.body.skipped).toBe(16);
  });
});
