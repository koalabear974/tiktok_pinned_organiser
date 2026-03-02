import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

/**
 * GET /api/videos
 * Paginated video listing with filtering and sorting.
 *
 * Query params:
 *   page     - Page number (default: 1)
 *   limit    - Items per page (default: 30, max: 100)
 *   category - Filter by category ID
 *   hashtag  - Filter by hashtag title
 *   search   - Full-text search in description, author nickname
 *   author   - Filter by author uniqueId
 *   type     - Filter by type: "video" or "image"
 *   sort     - Sort field: create_time, play_count, digg_count (default: create_time)
 *   order    - Sort order: desc, asc (default: desc)
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
    const offset = (page - 1) * limit;

    const category = req.query.category as string | undefined;
    const hashtag = req.query.hashtag as string | undefined;
    const search = req.query.search as string | undefined;
    const author = req.query.author as string | undefined;
    const type = req.query.type as string | undefined;
    const sort = req.query.sort as string || 'save_order';
    const order = req.query.order as string || 'desc';

    // Validate sort field
    const allowedSorts = ['save_order', 'create_time', 'play_count', 'digg_count', 'comment_count', 'share_count', 'collect_count'];
    const sortField = allowedSorts.includes(sort) ? sort : 'save_order';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: Record<string, unknown> = {};
    const joins: string[] = [];

    if (category === 'uncategorized') {
      conditions.push('v.id NOT IN (SELECT video_id FROM video_categories)');
    } else if (category) {
      joins.push('INNER JOIN video_categories vc ON v.id = vc.video_id');
      conditions.push('vc.category_id = @category');
      params.category = parseInt(category);
    }

    if (hashtag) {
      joins.push('INNER JOIN video_hashtags vh ON v.id = vh.video_id');
      joins.push('INNER JOIN hashtags h ON vh.hashtag_id = h.id');
      conditions.push('h.title = @hashtag');
      params.hashtag = hashtag;
    }

    if (search) {
      conditions.push('(v.description LIKE @search OR v.author_nickname LIKE @search OR v.author_unique_id LIKE @search)');
      params.search = `%${search}%`;
    }

    if (author) {
      conditions.push('v.author_unique_id = @author');
      params.author = author;
    }

    if (type === 'video') {
      conditions.push('v.is_image_post = 0');
    } else if (type === 'image') {
      conditions.push('v.is_image_post = 1');
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const joinClause = joins.join(' ');

    // Count total
    const countSql = `SELECT COUNT(DISTINCT v.id) as total FROM videos v ${joinClause} ${whereClause}`;
    const totalRow = db.prepare(countSql).get(params) as { total: number };
    const total = totalRow.total;

    // Fetch videos
    const selectSql = `
      SELECT DISTINCT v.*
      FROM videos v
      ${joinClause}
      ${whereClause}
      ORDER BY v.${sortField} ${sortOrder}
      LIMIT @limit OFFSET @offset
    `;

    const videos = db.prepare(selectSql).all({ ...params, limit, offset });

    const totalPages = Math.ceil(total / limit);

    res.json({
      videos,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching videos:', message);
    res.status(500).json({ error: `Failed to fetch videos: ${message}` });
  }
});

/**
 * GET /api/videos/stats
 * Overview statistics.
 */
router.get('/stats', (_req: Request, res: Response): void => {
  try {
    const totalRow = db.prepare('SELECT COUNT(*) as total FROM videos').get() as { total: number };
    const categorizedRow = db.prepare(
      'SELECT COUNT(DISTINCT video_id) as categorized FROM video_categories'
    ).get() as { categorized: number };

    const byCategory = db.prepare(`
      SELECT c.id, c.name, c.color, c.icon, COUNT(vc.video_id) as count
      FROM categories c
      LEFT JOIN video_categories vc ON c.id = vc.category_id
      GROUP BY c.id
      ORDER BY count DESC
    `).all();

    res.json({
      total: totalRow.total,
      categorized: categorizedRow.categorized,
      uncategorized: totalRow.total - categorizedRow.categorized,
      byCategory,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching video stats:', message);
    res.status(500).json({ error: `Failed to fetch stats: ${message}` });
  }
});

/**
 * POST /api/videos/bulk/categories
 * Assign a category to multiple videos at once.
 * Body: { videoIds: string[], categoryId: number }
 */
router.post('/bulk/categories', (req: Request, res: Response): void => {
  try {
    const { videoIds, categoryId } = req.body;

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      res.status(400).json({ error: 'videoIds must be a non-empty array of strings' });
      return;
    }

    if (typeof categoryId !== 'number') {
      res.status(400).json({ error: 'categoryId must be a number' });
      return;
    }

    // Verify category exists
    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const bulkAssign = db.transaction(() => {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO video_categories (video_id, category_id, assigned_by)
        VALUES (?, ?, 'manual')
      `);

      let assigned = 0;
      for (const videoId of videoIds) {
        const result = insert.run(videoId, categoryId);
        assigned += result.changes;
      }
      return assigned;
    });

    const assigned = bulkAssign();

    res.json({ success: true, assigned, total: videoIds.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error bulk assigning categories:', message);
    res.status(500).json({ error: `Failed to bulk assign categories: ${message}` });
  }
});

/**
 * GET /api/videos/:id
 * Get a single video with its categories and hashtags.
 */
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);

    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const categories = db.prepare(`
      SELECT c.id, c.name, c.color, c.icon, c.description, vc.assigned_by, vc.confidence, vc.assigned_at
      FROM categories c
      INNER JOIN video_categories vc ON c.id = vc.category_id
      WHERE vc.video_id = ?
    `).all(req.params.id);

    const hashtags = db.prepare(`
      SELECT h.id, h.title
      FROM hashtags h
      INNER JOIN video_hashtags vh ON h.id = vh.hashtag_id
      WHERE vh.video_id = ?
    `).all(req.params.id);

    res.json({
      ...video as Record<string, unknown>,
      categories,
      hashtags,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching video:', message);
    res.status(500).json({ error: `Failed to fetch video: ${message}` });
  }
});

/**
 * PATCH /api/videos/:id/categories
 * Replace all category assignments for a video.
 * Body: { categoryIds: number[] }
 */
router.patch('/:id/categories', (req: Request, res: Response): void => {
  try {
    const videoId = req.params.id;
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds)) {
      res.status(400).json({ error: 'categoryIds must be an array of numbers' });
      return;
    }

    // Verify video exists
    const video = db.prepare('SELECT id FROM videos WHERE id = ?').get(videoId);
    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const replaceCategories = db.transaction(() => {
      // Remove all existing category assignments
      db.prepare('DELETE FROM video_categories WHERE video_id = ?').run(videoId);

      // Insert new assignments
      const insert = db.prepare(`
        INSERT INTO video_categories (video_id, category_id, assigned_by)
        VALUES (?, ?, 'manual')
      `);

      for (const categoryId of categoryIds) {
        insert.run(videoId, categoryId);
      }
    });

    replaceCategories();

    // Return updated categories
    const categories = db.prepare(`
      SELECT c.id, c.name, c.color, c.icon, c.description, vc.assigned_by, vc.confidence, vc.assigned_at
      FROM categories c
      INNER JOIN video_categories vc ON c.id = vc.category_id
      WHERE vc.video_id = ?
    `).all(videoId);

    res.json({ success: true, categories });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error updating video categories:', message);
    res.status(500).json({ error: `Failed to update categories: ${message}` });
  }
});

export default router;
