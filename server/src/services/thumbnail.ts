import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import db from '../db/connection';

const THUMBNAILS_DIR = path.resolve(__dirname, '..', '..', '..', 'data', 'thumbnails');

// Ensure thumbnails directory exists
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

export class ThumbnailService {
  /**
   * Downloads a thumbnail image from the given cover URL and saves it
   * to data/thumbnails/{videoId}.jpg
   */
  async downloadThumbnail(videoId: string, coverUrl: string): Promise<string | null> {
    if (!coverUrl) return null;

    const filename = `${videoId}.jpg`;
    const filePath = path.join(THUMBNAILS_DIR, filename);

    // If file already exists on disk, just ensure DB is updated
    if (fs.existsSync(filePath)) {
      db.prepare(`
        UPDATE videos SET thumbnail_path = ?, thumbnail_cached_at = COALESCE(thumbnail_cached_at, strftime('%s', 'now'))
        WHERE id = ? AND thumbnail_path IS NULL
      `).run(filename, videoId);
      return filename;
    }

    try {
      await this.fetchAndSave(coverUrl, filePath);

      db.prepare(`
        UPDATE videos SET thumbnail_path = ?, thumbnail_cached_at = strftime('%s', 'now')
        WHERE id = ?
      `).run(filename, videoId);

      return filename;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to download thumbnail for ${videoId}: ${message}`);
      // Clean up partial file
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore cleanup errors */ }
      }
      return null;
    }
  }

  /**
   * Downloads all thumbnails with a concurrency limit of 5.
   */
  async downloadAllThumbnails(videos: Array<{ id: string; coverUrl: string }>): Promise<void> {
    const concurrencyLimit = 5;
    let index = 0;
    let completed = 0;
    const total = videos.length;

    if (total === 0) return;

    console.log(`Starting thumbnail download for ${total} videos...`);

    const runNext = async (): Promise<void> => {
      while (index < total) {
        const current = index++;
        const video = videos[current];
        await this.downloadThumbnail(video.id, video.coverUrl);
        completed++;
        if (completed % 10 === 0 || completed === total) {
          console.log(`Thumbnails: ${completed}/${total} downloaded`);
        }
      }
    };

    // Launch up to `concurrencyLimit` workers
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrencyLimit, total); i++) {
      workers.push(runNext());
    }

    await Promise.all(workers);
    console.log(`Thumbnail download complete: ${completed}/${total}`);
  }

  /**
   * Syncs thumbnail_path in the DB for any files already on disk.
   * Returns the number of records updated.
   */
  syncExistingFiles(): number {
    const videos = db.prepare(
      'SELECT id FROM videos WHERE thumbnail_path IS NULL'
    ).all() as { id: string }[];

    let synced = 0;
    for (const { id } of videos) {
      const filePath = path.join(THUMBNAILS_DIR, `${id}.jpg`);
      if (fs.existsSync(filePath)) {
        db.prepare(`
          UPDATE videos SET thumbnail_path = ?, thumbnail_cached_at = strftime('%s', 'now')
          WHERE id = ?
        `).run(`${id}.jpg`, id);
        synced++;
      }
    }
    return synced;
  }

  /**
   * Fetches a URL and saves the response body to a file.
   * Handles both http and https, and follows redirects (up to 5).
   */
  private fetchAndSave(url: string, filePath: string, redirectCount = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      if (redirectCount > 5) {
        return reject(new Error('Too many redirects'));
      }

      const client = url.startsWith('https') ? https : http;

      const request = client.get(url, { timeout: 15000 }, (response) => {
        // Follow redirects
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume(); // consume data to free up memory
          return this.fetchAndSave(response.headers.location, filePath, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode && response.statusCode !== 200) {
          response.resume();
          return reject(new Error(`HTTP ${response.statusCode}`));
        }

        const fileStream = fs.createWriteStream(filePath);
        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlink(filePath, () => { /* ignore */ });
          reject(err);
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timed out'));
      });
    });
  }
}

export default new ThumbnailService();
