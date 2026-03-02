import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db/connection';
import importService from '../services/importer';
import thumbnailService from '../services/thumbnail';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.resolve(__dirname, '..', '..', '..', 'data', 'uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || path.extname(file.originalname).toLowerCase() === '.json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  },
});

/**
 * POST /api/import
 * Upload a TikTok JSON export file and import it into the database.
 */
router.post('/', upload.single('file'), (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Please upload a JSON file.' });
      return;
    }

    const filePath = req.file.path;
    const result = importService.importFromJson(filePath);

    // Clean up the uploaded temp file
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore cleanup errors
    }

    // Kick off thumbnail download in the background
    const videosForThumbnails = importService.getVideosForThumbnails();
    if (videosForThumbnails.length > 0) {
      thumbnailService.downloadAllThumbnails(videosForThumbnails).catch((err) => {
        console.error('Background thumbnail download error:', err);
      });
    }

    res.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Import error:', message);
    res.status(500).json({ error: `Import failed: ${message}` });
  }
});

/**
 * GET /api/imports
 * List all past imports.
 */
router.get('/', (_req: Request, res: Response): void => {
  try {
    const imports = db.prepare(`
      SELECT id, filename, cursor_value, items_count, total_reported, has_more, imported_at
      FROM imports
      ORDER BY imported_at DESC
    `).all();

    res.json({ imports });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error fetching imports:', message);
    res.status(500).json({ error: `Failed to fetch imports: ${message}` });
  }
});

export default router;
