import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import thumbnailService from '../services/thumbnail';
import importService from '../services/importer';

const router = Router();

const THUMBNAILS_DIR = path.resolve(__dirname, '..', '..', '..', 'data', 'thumbnails');

/**
 * POST /api/thumbnails/sync
 * Syncs thumbnail_path in DB for files already on disk,
 * then attempts to download any still missing thumbnails.
 */
router.post('/sync', async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Sync existing files on disk → DB
    const synced = thumbnailService.syncExistingFiles();

    // 2. Try to download any still missing
    const missing = importService.getVideosForThumbnails();
    let downloaded = 0;
    let failed = 0;

    if (missing.length > 0) {
      for (const video of missing) {
        const result = await thumbnailService.downloadThumbnail(video.id, video.coverUrl);
        if (result) downloaded++;
        else failed++;
      }
    }

    res.json({
      synced,
      downloaded,
      failed,
      stillMissing: failed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Thumbnail sync error:', message);
    res.status(500).json({ error: `Thumbnail sync failed: ${message}` });
  }
});

/**
 * GET /api/thumbnails/:filename
 * Serves thumbnail image files from the data/thumbnails/ directory.
 */
router.get('/:filename', (req: Request<{ filename: string }>, res: Response): void => {
  try {
    const filename = req.params.filename;

    // Sanitize filename to prevent directory traversal
    const sanitized = path.basename(filename);
    const filePath = path.join(THUMBNAILS_DIR, sanitized);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Thumbnail not found' });
      return;
    }

    // Determine content type from extension
    const ext = path.extname(sanitized).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };

    const contentType = contentTypes[ext] || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('Error streaming thumbnail:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to serve thumbnail' });
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error serving thumbnail:', message);
    res.status(500).json({ error: `Failed to serve thumbnail: ${message}` });
  }
});

export default router;
