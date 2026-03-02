import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

/**
 * GET /api/categories
 * List all categories with video counts.
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    const categories = db.prepare(`
      SELECT c.id, c.name, c.color, c.icon, c.description, c.created_at, c.updated_at,
             COUNT(vc.video_id) as video_count
      FROM categories c
      LEFT JOIN video_categories vc ON c.id = vc.category_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all();

    res.json({ categories });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching categories:', message);
    res.status(500).json({ error: `Failed to fetch categories: ${message}` });
  }
});

/**
 * POST /api/categories
 * Create a new category.
 * Body: { name: string, color?: string, icon?: string, description?: string }
 */
router.post('/', (req: Request, res: Response): void => {
  try {
    const { name, color, icon, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO categories (name, color, icon, description)
      VALUES (@name, @color, @icon, @description)
    `).run({
      name: name.trim(),
      color: color || '#6366f1',
      icon: icon || null,
      description: description || null,
    });

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(category);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'A category with this name already exists' });
      return;
    }
    console.error('Error creating category:', message);
    res.status(500).json({ error: `Failed to create category: ${message}` });
  }
});

/**
 * PATCH /api/categories/:id
 * Update an existing category.
 * Body: { name?, color?, icon?, description? }
 */
router.patch('/:id', (req: Request<{ id: string }>, res: Response): void => {
  try {
    const categoryId = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const { name, color, icon, description } = req.body;
    const updates: string[] = [];
    const params: Record<string, unknown> = { id: categoryId };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Category name cannot be empty' });
        return;
      }
      updates.push('name = @name');
      params.name = name.trim();
    }

    if (color !== undefined) {
      updates.push('color = @color');
      params.color = color;
    }

    if (icon !== undefined) {
      updates.push('icon = @icon');
      params.icon = icon;
    }

    if (description !== undefined) {
      updates.push('description = @description');
      params.description = description;
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push("updated_at = strftime('%s', 'now')");

    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = @id`).run(params);

    const updated = db.prepare(`
      SELECT c.*, COUNT(vc.video_id) as video_count
      FROM categories c
      LEFT JOIN video_categories vc ON c.id = vc.category_id
      WHERE c.id = ?
      GROUP BY c.id
    `).get(categoryId);

    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'A category with this name already exists' });
      return;
    }
    console.error('Error updating category:', message);
    res.status(500).json({ error: `Failed to update category: ${message}` });
  }
});

/**
 * DELETE /api/categories/:id
 * Delete a category. All video_categories associations are removed via CASCADE.
 */
router.delete('/:id', (req: Request<{ id: string }>, res: Response): void => {
  try {
    const categoryId = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);

    res.json({ success: true, deleted: existing });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error deleting category:', message);
    res.status(500).json({ error: `Failed to delete category: ${message}` });
  }
});

export default router;
