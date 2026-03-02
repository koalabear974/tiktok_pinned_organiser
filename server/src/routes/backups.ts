import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { backupDatabase, restoreDatabase, reopenDatabase } from '../db/connection';
import { initializeSchema } from '../db/schema';
import thumbnailService from '../services/thumbnail';
import importService from '../services/importer';

const router = Router();

const DATA_DIR = path.resolve(__dirname, '..', '..', '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_. ]/g, '').trim();
}

/**
 * GET /api/backups
 * List available backup files.
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    ensureBackupsDir();
    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.sqlite'));

    const backups = files.map(f => {
      const stat = fs.statSync(path.join(BACKUPS_DIR, f));
      return {
        name: f.replace(/\.sqlite$/, ''),
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({ backups });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error listing backups:', message);
    res.status(500).json({ error: `Failed to list backups: ${message}` });
  }
});

/**
 * POST /api/backups
 * Create a new backup using SQLite's Online Backup API.
 * Body: { name: string }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Backup name is required' });
      return;
    }

    const safeName = sanitizeName(name);
    if (safeName.length === 0) {
      res.status(400).json({ error: 'Invalid backup name' });
      return;
    }

    ensureBackupsDir();
    const destPath = path.join(BACKUPS_DIR, `${safeName}.sqlite`);

    if (fs.existsSync(destPath)) {
      res.status(409).json({ error: 'A backup with this name already exists' });
      return;
    }

    // Use SQLite's Online Backup API — handles WAL correctly
    await backupDatabase(destPath);

    const stat = fs.statSync(destPath);
    res.status(201).json({
      name: safeName,
      size: stat.size,
      createdAt: stat.birthtime.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error creating backup:', message);
    res.status(500).json({ error: `Failed to create backup: ${message}` });
  }
});

/**
 * POST /api/backups/restore
 * Restore from a backup.
 * Body: { name: string }
 */
router.post('/restore', (req: Request, res: Response): void => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Backup name is required' });
      return;
    }

    const safeName = sanitizeName(name);
    const srcPath = path.join(BACKUPS_DIR, `${safeName}.sqlite`);

    if (!fs.existsSync(srcPath)) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }

    // Close DB, delete WAL/SHM, copy backup, reopen
    restoreDatabase(srcPath);

    // Ensure schema exists (no-op if backup is current)
    initializeSchema();

    // Invalidate prepared statement caches so they rebind to the new connection
    importService.reset();

    // Re-link thumbnail files on disk with the restored DB
    thumbnailService.syncExistingFiles();

    res.json({ success: true, restored: safeName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error restoring backup:', message);
    // Try to reopen so the server isn't left without a DB
    try { reopenDatabase(); } catch { /* ignore */ }
    res.status(500).json({ error: `Failed to restore backup: ${message}` });
  }
});

/**
 * DELETE /api/backups/:name
 * Delete a backup file.
 */
router.delete('/:name', (req: Request<{ name: string }>, res: Response): void => {
  try {
    const safeName = sanitizeName(req.params.name);
    const filePath = path.join(BACKUPS_DIR, `${safeName}.sqlite`);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, deleted: safeName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error deleting backup:', message);
    res.status(500).json({ error: `Failed to delete backup: ${message}` });
  }
});

export default router;
