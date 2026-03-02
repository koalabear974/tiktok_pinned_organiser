import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:3001';
const SAMPLE_FILE = path.resolve(__dirname, '..', 'sample-data', '_api_user_collect_item_list_.json');

/**
 * Seed the database via the API so we have videos + a category to work with.
 */
async function seed(page: Page) {
  const importRes = await page.request.post(`${BASE_URL}/api/import`, {
    multipart: {
      file: {
        name: '_api_user_collect_item_list_.json',
        mimeType: 'application/json',
        buffer: fs.readFileSync(SAMPLE_FILE),
      },
    },
  });
  expect(importRes.ok()).toBe(true);

  // Wait a bit for background thumbnail downloads to finish
  await page.waitForTimeout(3_000);

  const catRes = await page.request.post(`${BASE_URL}/api/categories`, {
    data: { name: 'Backup Test Cat', color: '#10b981' },
  });
  expect(catRes.ok()).toBe(true);
  const cat = await catRes.json();
  return { categoryId: cat.id as number };
}

/**
 * Clean up: delete test category and all backups.
 */
async function cleanup(page: Page, categoryId: number) {
  await page.request.delete(`${BASE_URL}/api/categories/${categoryId}`);

  const backupsRes = await page.request.get(`${BASE_URL}/api/backups`);
  if (backupsRes.ok()) {
    const { backups } = await backupsRes.json();
    for (const b of backups) {
      await page.request.delete(`${BASE_URL}/api/backups/${encodeURIComponent(b.name)}`);
    }
  }
}

async function waitForVideoCards(page: Page) {
  await page.waitForSelector('[data-testid^="video-card-"]', { timeout: 10_000 });
}

test.describe('Database Backup & Restore', () => {
  let categoryId: number;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const result = await seed(page);
    categoryId = result.categoryId;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanup(page, categoryId);
    await page.close();
  });

  test('can create a backup via the UI', async ({ page }) => {
    await page.goto('/');
    await waitForVideoCards(page);

    await page.click('[data-testid="save-db-btn"]');

    const savePrompt = page.locator('[data-testid="save-prompt"]');
    await expect(savePrompt).toBeVisible();

    const input = page.locator('[data-testid="save-name-input"]');
    await expect(input).toBeFocused();

    await input.fill('e2e-test-backup');
    await page.click('[data-testid="save-confirm-btn"]');

    await expect(savePrompt).not.toBeVisible({ timeout: 5_000 });

    // Verify via API
    const backupsRes = await page.request.get(`${BASE_URL}/api/backups`);
    expect(backupsRes.ok()).toBe(true);
    const { backups } = await backupsRes.json();
    const found = backups.find((b: any) => b.name === 'e2e-test-backup');
    expect(found).toBeTruthy();
  });

  test('backup appears in the load menu', async ({ page }) => {
    await page.goto('/');
    await waitForVideoCards(page);

    await page.click('[data-testid="load-db-btn"]');
    const loadMenu = page.locator('[data-testid="load-menu"]');
    await expect(loadMenu).toBeVisible();

    const item = page.locator('[data-testid="backup-item-e2e-test-backup"]');
    await expect(item).toBeVisible();
    expect(await item.textContent()).toContain('e2e-test-backup');
  });

  test('restore reverts category video assignments', async ({ page }) => {
    // Assign a video to the category via API
    const videosRes = await page.request.get(`${BASE_URL}/api/videos?limit=1`);
    const { videos } = await videosRes.json();
    const videoId = videos[0].id;

    await page.request.patch(`${BASE_URL}/api/videos/${videoId}/categories`, {
      data: { categoryIds: [categoryId] },
    });

    // Verify assignment via API
    const statsAfterAssign = await page.request.get(`${BASE_URL}/api/videos/stats`);
    const afterAssign = await statsAfterAssign.json();

    // Restore the backup (taken BEFORE the assignment)
    page.on('dialog', dialog => dialog.accept());
    await page.goto('/');
    await waitForVideoCards(page);

    await page.click('[data-testid="load-db-btn"]');
    await page.locator('[data-testid="load-menu"]').waitFor({ state: 'visible' });
    await page.click('[data-testid="restore-btn-e2e-test-backup"]');

    // Wait for restore + UI refresh
    await page.waitForTimeout(2_000);

    // Verify via API that the assignment was reverted
    const statsAfterRestore = await page.request.get(`${BASE_URL}/api/videos/stats`);
    const afterRestore = await statsAfterRestore.json();
    expect(afterRestore.uncategorized).toBeGreaterThan(afterAssign.uncategorized);
  });

  test('categories retain correct video counts after restore', async ({ page }) => {
    // Assign 3 videos to the category
    const videosRes = await page.request.get(`${BASE_URL}/api/videos?limit=3`);
    const { videos } = await videosRes.json();
    const ids = videos.map((v: any) => v.id);

    await page.request.post(`${BASE_URL}/api/videos/bulk/categories`, {
      data: { videoIds: ids, categoryId },
    });

    // Verify count = 3
    let catsRes = await page.request.get(`${BASE_URL}/api/categories`);
    let cats = await catsRes.json();
    let cat = cats.categories.find((c: any) => c.name === 'Backup Test Cat');
    expect(cat.video_count).toBe(3);

    // Create a new backup with 3 videos assigned
    await page.request.post(`${BASE_URL}/api/backups`, {
      data: { name: 'e2e-cat-count-backup' },
    });

    // Now assign 2 more
    const moreRes = await page.request.get(`${BASE_URL}/api/videos?limit=5`);
    const moreVids = await moreRes.json();
    const allIds = moreVids.videos.map((v: any) => v.id);
    await page.request.post(`${BASE_URL}/api/videos/bulk/categories`, {
      data: { videoIds: allIds, categoryId },
    });

    // Verify count went up
    catsRes = await page.request.get(`${BASE_URL}/api/categories`);
    cats = await catsRes.json();
    cat = cats.categories.find((c: any) => c.name === 'Backup Test Cat');
    expect(cat.video_count).toBeGreaterThan(3);

    // Restore — should go back to exactly 3
    await page.request.post(`${BASE_URL}/api/backups/restore`, {
      data: { name: 'e2e-cat-count-backup' },
    });

    catsRes = await page.request.get(`${BASE_URL}/api/categories`);
    cats = await catsRes.json();
    cat = cats.categories.find((c: any) => c.name === 'Backup Test Cat');
    expect(cat).toBeTruthy();
    expect(cat.video_count).toBe(3);

    // Cleanup
    await page.request.delete(`${BASE_URL}/api/backups/e2e-cat-count-backup`);
  });

  test('thumbnails still load after restore', async ({ page }) => {
    // Get a video that has a thumbnail
    const videosRes = await page.request.get(`${BASE_URL}/api/videos?limit=1`);
    const { videos } = await videosRes.json();
    const thumbnailPath = videos[0].thumbnail_path;

    // If there's a thumbnail, verify it loads
    if (thumbnailPath) {
      const thumbRes = await page.request.get(`${BASE_URL}/api/thumbnails/${thumbnailPath}`);
      expect(thumbRes.ok()).toBe(true);
    }

    // Restore
    await page.request.post(`${BASE_URL}/api/backups/restore`, {
      data: { name: 'e2e-test-backup' },
    });

    // Re-fetch video (might have different thumbnail_path after restore + sync)
    const restoredRes = await page.request.get(`${BASE_URL}/api/videos?limit=1`);
    const restoredVideos = (await restoredRes.json()).videos;
    const restoredThumbPath = restoredVideos[0].thumbnail_path;

    // thumbnail_path should be set (either from backup or re-synced from disk)
    if (thumbnailPath) {
      expect(restoredThumbPath).toBeTruthy();

      // The thumbnail endpoint should serve the file
      const thumbRes = await page.request.get(`${BASE_URL}/api/thumbnails/${restoredThumbPath}`);
      expect(thumbRes.ok()).toBe(true);
      expect(thumbRes.headers()['content-type']).toContain('image/');
    }
  });

  test('UI shows thumbnails after restore', async ({ page }) => {
    // Restore first
    await page.request.post(`${BASE_URL}/api/backups/restore`, {
      data: { name: 'e2e-test-backup' },
    });

    await page.goto('/');
    await waitForVideoCards(page);

    // Check that at least some video cards have visible thumbnail images
    const images = page.locator('[data-testid^="video-card-"] img');
    const count = await images.count();

    if (count > 0) {
      // At least one image should have a valid src containing /api/thumbnails/
      const firstSrc = await images.first().getAttribute('src');
      expect(firstSrc).toContain('/api/thumbnails/');

      // The image should be naturally loaded (not broken)
      const isLoaded = await images.first().evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
      );
      expect(isLoaded).toBe(true);
    }
  });

  test('can delete a backup', async ({ page }) => {
    await page.goto('/');
    await waitForVideoCards(page);

    page.on('dialog', dialog => dialog.accept());

    await page.click('[data-testid="load-db-btn"]');
    await page.locator('[data-testid="load-menu"]').waitFor({ state: 'visible' });

    await page.click('[data-testid="delete-btn-e2e-test-backup"]');

    await expect(page.locator('[data-testid="backup-item-e2e-test-backup"]')).not.toBeVisible({ timeout: 5_000 });

    const backupsRes = await page.request.get(`${BASE_URL}/api/backups`);
    const { backups } = await backupsRes.json();
    expect(backups.find((b: any) => b.name === 'e2e-test-backup')).toBeUndefined();
  });

  test('save via Enter key works', async ({ page }) => {
    await page.goto('/');
    await waitForVideoCards(page);

    await page.click('[data-testid="save-db-btn"]');
    const input = page.locator('[data-testid="save-name-input"]');
    await input.fill('e2e-enter-key-backup');
    await input.press('Enter');

    await expect(page.locator('[data-testid="save-prompt"]')).not.toBeVisible({ timeout: 5_000 });

    const backupsRes = await page.request.get(`${BASE_URL}/api/backups`);
    const { backups } = await backupsRes.json();
    expect(backups.find((b: any) => b.name === 'e2e-enter-key-backup')).toBeTruthy();

    // Cleanup
    await page.request.delete(`${BASE_URL}/api/backups/e2e-enter-key-backup`);
  });

  test('Escape key dismisses save prompt', async ({ page }) => {
    await page.goto('/');
    await waitForVideoCards(page);

    await page.click('[data-testid="save-db-btn"]');
    await expect(page.locator('[data-testid="save-prompt"]')).toBeVisible();

    await page.locator('[data-testid="save-name-input"]').press('Escape');
    await expect(page.locator('[data-testid="save-prompt"]')).not.toBeVisible();
  });

  test('duplicate backup name shows error', async ({ page }) => {
    await page.goto('/');
    await waitForVideoCards(page);

    // Create a backup
    await page.click('[data-testid="save-db-btn"]');
    await page.locator('[data-testid="save-name-input"]').fill('e2e-duplicate-test');
    await page.click('[data-testid="save-confirm-btn"]');
    await expect(page.locator('[data-testid="save-prompt"]')).not.toBeVisible({ timeout: 5_000 });

    // Try duplicate
    await page.click('[data-testid="save-db-btn"]');
    await page.locator('[data-testid="save-name-input"]').fill('e2e-duplicate-test');
    await page.click('[data-testid="save-confirm-btn"]');

    const error = page.locator('[data-testid="save-prompt"] .text-red-500');
    await expect(error).toBeVisible({ timeout: 5_000 });

    // Cleanup
    await page.request.delete(`${BASE_URL}/api/backups/e2e-duplicate-test`);
  });
});
