import fs from 'fs';
import path from 'path';
import { launchChrome } from './session';
import { startCollector } from './collector';

const IMPORT_URL = 'http://localhost:3001/api/import';

const noImport = process.argv.includes('--no-import');

async function autoImport(files: string[]): Promise<void> {
  if (files.length === 0) {
    console.log('No files to import.');
    return;
  }

  console.log(`\nAuto-importing ${files.length} file(s) to ${IMPORT_URL}...`);

  for (const filepath of files) {
    const filename = path.basename(filepath);
    try {
      const fileBuffer = fs.readFileSync(filepath);
      const blob = new Blob([fileBuffer], { type: 'application/json' });

      const form = new FormData();
      form.append('file', blob, filename);

      const response = await fetch(IMPORT_URL, { method: 'POST', body: form });
      const result = (await response.json()) as {
        success?: boolean;
        imported?: number;
        skipped?: number;
        errors?: number;
        error?: string;
      };

      if (response.ok && result.success) {
        console.log(
          `  ${filename}: imported=${result.imported}, skipped=${result.skipped}, errors=${result.errors}`
        );
      } else {
        console.error(`  ${filename}: FAILED — ${result.error || response.statusText}`);
      }
    } catch (err) {
      console.error(`  ${filename}: FAILED — ${err}`);
    }
  }
}

async function main(): Promise<void> {
  console.log(`Auto-import: ${noImport ? 'disabled' : 'enabled'}\n`);

  // Start the local collector server (receives data from the extension)
  const { state, close } = await startCollector();

  // Launch real Chrome with our extension (no automation flags)
  const chromeProcess = launchChrome('https://www.tiktok.com/favorites');

  console.log('\n--- Chrome launched ---');
  console.log('The extension will automatically intercept and scroll.');
  console.log('If not logged in, log in first — the extension starts when you reach /favorites.');
  console.log('Close Chrome when done (or it will stop after scrolling completes).\n');

  // Wait for Chrome to exit
  await new Promise<void>((resolve) => {
    chromeProcess.on('exit', () => {
      console.log('\nChrome closed.');
      resolve();
    });
  });

  close();

  console.log(`\nCaptured ${state.pages.length} pages, ${state.totalItems} items total.`);

  if (!noImport) {
    await autoImport(state.pages);
  }
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  process.exit(1);
});
