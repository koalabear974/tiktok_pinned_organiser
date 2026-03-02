import { initializeSchema } from './db/schema';
import thumbnailService from './services/thumbnail';
import importService from './services/importer';

initializeSchema();

async function main() {
  // 1. Sync files already on disk → DB
  console.log('Syncing existing thumbnail files to database...');
  const synced = thumbnailService.syncExistingFiles();
  console.log(`  Synced ${synced} existing files.`);

  // 2. Download missing thumbnails
  const missing = importService.getVideosForThumbnails();
  if (missing.length === 0) {
    console.log('All thumbnails are available.');
    return;
  }

  console.log(`Downloading ${missing.length} missing thumbnails...`);
  await thumbnailService.downloadAllThumbnails(missing);

  // 3. Final check
  const stillMissing = importService.getVideosForThumbnails();
  if (stillMissing.length === 0) {
    console.log('Done. All thumbnails are now available.');
  } else {
    console.log(`Done. ${stillMissing.length} thumbnails still missing (CDN URLs may have expired).`);
  }
}

main().catch(console.error);
