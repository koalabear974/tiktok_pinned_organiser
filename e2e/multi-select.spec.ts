import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SAMPLE_FILE = path.resolve(__dirname, '..', 'sample-data', '_api_user_collect_item_list_.json');

/**
 * Seed the database via the API so we have videos + categories to work with.
 * Returns the created category IDs.
 */
async function seed(page: Page) {
  const baseURL = 'http://localhost:3001';

  // Import sample videos via API
  const importRes = await page.request.post(`${baseURL}/api/import`, {
    multipart: {
      file: {
        name: '_api_user_collect_item_list_.json',
        mimeType: 'application/json',
        buffer: fs.readFileSync(SAMPLE_FILE),
      },
    },
  });
  expect(importRes.ok()).toBe(true);

  // Create two categories
  const cat1Res = await page.request.post(`${baseURL}/api/categories`, {
    data: { name: 'E2E Cat A', color: '#ef4444' },
  });
  expect(cat1Res.ok()).toBe(true);
  const cat1 = await cat1Res.json();

  const cat2Res = await page.request.post(`${baseURL}/api/categories`, {
    data: { name: 'E2E Cat B', color: '#3b82f6' },
  });
  expect(cat2Res.ok()).toBe(true);
  const cat2 = await cat2Res.json();

  return { catA: cat1.id as number, catB: cat2.id as number };
}

/**
 * Clean up test categories and video-category assignments.
 */
async function cleanup(page: Page, categoryIds: number[]) {
  const baseURL = 'http://localhost:3001';
  for (const id of categoryIds) {
    await page.request.delete(`${baseURL}/api/categories/${id}`);
  }
}

/**
 * Wait for video cards to load in the grid.
 */
async function waitForVideoCards(page: Page) {
  await page.waitForSelector('[data-testid^="video-card-"]', { timeout: 10_000 });
}

/**
 * Get all video card elements on the page.
 */
function getVideoCards(page: Page) {
  return page.locator('[data-testid^="video-card-"]');
}

/**
 * Get the video ID from a card's testid.
 */
async function getVideoId(page: Page, index: number): Promise<string> {
  const card = getVideoCards(page).nth(index);
  const testId = await card.getAttribute('data-testid');
  return testId!.replace('video-card-', '');
}

test.describe('Multi-select & Drag-and-Drop', () => {
  let catIds: { catA: number; catB: number };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    catIds = await seed(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanup(page, [catIds.catA, catIds.catB]);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Clear all video-category assignments before each test
    const baseURL = 'http://localhost:3001';
    const videosRes = await page.request.get(`${baseURL}/api/videos?limit=100`);
    const videosData = await videosRes.json();
    for (const video of videosData.videos) {
      await page.request.patch(`${baseURL}/api/videos/${video.id}/categories`, {
        data: { categoryIds: [] },
      });
    }

    await page.goto('/');
    await waitForVideoCards(page);
  });

  // ─── Selection ───────────────────────────────────────────────

  test('clicking a video card checkbox selects it and shows selection toolbar', async ({ page }) => {
    const videoId = await getVideoId(page, 0);
    const checkbox = page.getByTestId(`video-checkbox-${videoId}`);

    // Force-click the checkbox (it's hidden until hover)
    await checkbox.click({ force: true });

    // Card should be marked selected
    const card = page.getByTestId(`video-card-${videoId}`);
    await expect(card).toHaveAttribute('data-selected', 'true');

    // Selection toolbar should appear
    await expect(page.getByTestId('selection-toolbar')).toBeVisible();
    await expect(page.getByTestId('selection-count')).toHaveText('1 selected');
  });

  test('clicking same card again in selection mode deselects it', async ({ page }) => {
    const videoId = await getVideoId(page, 0);
    const card = page.getByTestId(`video-card-${videoId}`);

    // Select
    await page.getByTestId(`video-checkbox-${videoId}`).click({ force: true });
    await expect(card).toHaveAttribute('data-selected', 'true');

    // Now in selection mode, clicking the card itself toggles selection
    await card.click();
    await expect(card).not.toHaveAttribute('data-selected');

    // Toolbar should disappear
    await expect(page.getByTestId('selection-toolbar')).not.toBeVisible();
  });

  test('clicking multiple checkboxes selects multiple cards without modifier keys', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const id1 = await getVideoId(page, 1);
    const id2 = await getVideoId(page, 2);

    // Click checkboxes one by one (no modifier keys)
    await page.getByTestId(`video-checkbox-${id0}`).click({ force: true });
    await page.getByTestId(`video-checkbox-${id1}`).click({ force: true });
    await page.getByTestId(`video-checkbox-${id2}`).click({ force: true });

    // All three should be selected
    await expect(page.getByTestId(`video-card-${id0}`)).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId(`video-card-${id1}`)).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId(`video-card-${id2}`)).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('selection-count')).toHaveText('3 selected');
  });

  test('clicking a selected checkbox deselects just that card', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const id1 = await getVideoId(page, 1);

    // Select two cards
    await page.getByTestId(`video-checkbox-${id0}`).click({ force: true });
    await page.getByTestId(`video-checkbox-${id1}`).click({ force: true });
    await expect(page.getByTestId('selection-count')).toHaveText('2 selected');

    // Deselect the first one by clicking its checkbox again
    await page.getByTestId(`video-checkbox-${id0}`).click({ force: true });
    await expect(page.getByTestId(`video-card-${id0}`)).not.toHaveAttribute('data-selected');
    await expect(page.getByTestId(`video-card-${id1}`)).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('selection-count')).toHaveText('1 selected');
  });

  test('clicking cards in selection mode adds to selection', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const id1 = await getVideoId(page, 1);
    const id2 = await getVideoId(page, 2);

    // Start by selecting one via checkbox
    await page.getByTestId(`video-checkbox-${id0}`).click({ force: true });
    await expect(page.getByTestId('selection-count')).toHaveText('1 selected');

    // In selection mode, clicking other cards (not checkbox) should add them
    await page.getByTestId(`video-card-${id1}`).click();
    await page.getByTestId(`video-card-${id2}`).click();

    await expect(page.getByTestId(`video-card-${id0}`)).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId(`video-card-${id1}`)).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId(`video-card-${id2}`)).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('selection-count')).toHaveText('3 selected');
  });

  test('Ctrl/Meta+click toggles individual cards', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const id1 = await getVideoId(page, 1);
    const id2 = await getVideoId(page, 2);

    const card0 = page.getByTestId(`video-card-${id0}`);
    const card1 = page.getByTestId(`video-card-${id1}`);
    const card2 = page.getByTestId(`video-card-${id2}`);

    // Ctrl+click first three cards
    await card0.click({ modifiers: ['Meta'] });
    await card1.click({ modifiers: ['Meta'] });
    await card2.click({ modifiers: ['Meta'] });

    await expect(card0).toHaveAttribute('data-selected', 'true');
    await expect(card1).toHaveAttribute('data-selected', 'true');
    await expect(card2).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('selection-count')).toHaveText('3 selected');

    // Ctrl+click the second card to deselect it
    await card1.click({ modifiers: ['Meta'] });
    await expect(card1).not.toHaveAttribute('data-selected');
    await expect(page.getByTestId('selection-count')).toHaveText('2 selected');
  });

  test('Shift+click selects a range', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const id4 = await getVideoId(page, 4);

    const card0 = page.getByTestId(`video-card-${id0}`);
    const card4 = page.getByTestId(`video-card-${id4}`);

    // Click first card normally (selects just that one)
    await page.getByTestId(`video-checkbox-${id0}`).click({ force: true });

    // Shift+click fifth card to range-select
    await card4.click({ modifiers: ['Shift'] });

    // All 5 cards should be selected
    await expect(page.getByTestId('selection-count')).toHaveText('5 selected');

    for (let i = 0; i <= 4; i++) {
      const vid = await getVideoId(page, i);
      await expect(page.getByTestId(`video-card-${vid}`)).toHaveAttribute('data-selected', 'true');
    }
  });

  test('Escape clears selection', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const id1 = await getVideoId(page, 1);

    await page.getByTestId(`video-card-${id0}`).click({ modifiers: ['Meta'] });
    await page.getByTestId(`video-card-${id1}`).click({ modifiers: ['Meta'] });
    await expect(page.getByTestId('selection-count')).toHaveText('2 selected');

    // Press Escape
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('selection-toolbar')).not.toBeVisible();
    await expect(page.getByTestId(`video-card-${id0}`)).not.toHaveAttribute('data-selected');
    await expect(page.getByTestId(`video-card-${id1}`)).not.toHaveAttribute('data-selected');
  });

  test('Clear button in toolbar clears selection', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    await page.getByTestId(`video-checkbox-${id0}`).click({ force: true });
    await expect(page.getByTestId('selection-toolbar')).toBeVisible();

    await page.getByTestId('clear-selection').click();

    await expect(page.getByTestId('selection-toolbar')).not.toBeVisible();
  });

  test('clicking a sidebar category filter clears selection', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    await page.getByTestId(`video-checkbox-${id0}`).click({ force: true });
    await expect(page.getByTestId('selection-toolbar')).toBeVisible();

    // Click a sidebar category to change filter
    await page.getByTestId(`sidebar-category-${catIds.catA}`).click();

    // Selection should be cleared after filter change and page re-render
    await expect(page.getByTestId('selection-toolbar')).not.toBeVisible();
  });

  // ─── Bulk Assignment via Toolbar ─────────────────────────────

  test('bulk assign via toolbar dropdown assigns category to selected videos', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const id1 = await getVideoId(page, 1);
    const id2 = await getVideoId(page, 2);

    // Select 3 videos
    await page.getByTestId(`video-card-${id0}`).click({ modifiers: ['Meta'] });
    await page.getByTestId(`video-card-${id1}`).click({ modifiers: ['Meta'] });
    await page.getByTestId(`video-card-${id2}`).click({ modifiers: ['Meta'] });
    await expect(page.getByTestId('selection-count')).toHaveText('3 selected');

    // Open "Assign to..." dropdown
    await page.getByTestId('assign-to-button').click();

    // Click category A
    await page.getByTestId(`assign-category-${catIds.catA}`).click();

    // Toolbar should disappear (selection cleared on success)
    await expect(page.getByTestId('selection-toolbar')).not.toBeVisible();

    // Verify via API that the 3 videos are now in category A
    const baseURL = 'http://localhost:3001';
    const res = await page.request.get(`${baseURL}/api/videos?category=${catIds.catA}`);
    const data = await res.json();
    expect(data.total).toBe(3);
    const assignedIds = data.videos.map((v: { id: string }) => v.id);
    expect(assignedIds).toContain(id0);
    expect(assignedIds).toContain(id1);
    expect(assignedIds).toContain(id2);
  });

  test('sidebar category count updates after bulk assignment', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const id1 = await getVideoId(page, 1);

    // Check initial count
    const catButton = page.getByTestId(`sidebar-category-${catIds.catB}`);
    await expect(catButton).toContainText('0');

    // Select and assign 2 videos
    await page.getByTestId(`video-card-${id0}`).click({ modifiers: ['Meta'] });
    await page.getByTestId(`video-card-${id1}`).click({ modifiers: ['Meta'] });

    await page.getByTestId('assign-to-button').click();
    await page.getByTestId(`assign-category-${catIds.catB}`).click();

    // Wait for refetch and check count updated
    await expect(catButton).toContainText('2');
  });

  // ─── Without selection, clicking opens modal ─────────────────

  test('clicking a card without selection mode opens the video modal', async ({ page }) => {
    const card = getVideoCards(page).first();
    await card.click();

    // The video modal should be visible
    await expect(page.locator('.fixed.inset-0').first()).toBeVisible();
  });

  // ─── Drag and Drop ──────────────────────────────────────────
  // @dnd-kit uses PointerSensor with 8px activation distance.
  // We use page.mouse with the draggable wrapper element (which has the
  // onPointerDown listener) for reliable activation.

  async function performDrag(page: Page, draggableTestId: string, target: ReturnType<Page['locator']>) {
    const source = page.getByTestId(draggableTestId);
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).toBeTruthy();
    expect(targetBox).toBeTruthy();

    // Start from the top-right area of the card to avoid the checkbox
    const startX = sourceBox!.x + sourceBox!.width * 0.75;
    const startY = sourceBox!.y + 30;
    const endX = targetBox!.x + targetBox!.width / 2;
    const endY = targetBox!.y + targetBox!.height / 2;

    // Step 1: Move to start and press down
    await page.mouse.move(startX, startY);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Step 2: Move slowly past activation distance (8px threshold)
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(startX, startY - i * 5, { steps: 2 });
      await page.waitForTimeout(50);
    }

    // Step 3: Move to target in steps
    const curX = startX;
    const curY = startY - 25;
    const steps = 15;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await page.mouse.move(
        curX + (endX - curX) * t,
        curY + (endY - curY) * t,
        { steps: 1 }
      );
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(200);

    // Step 4: Release
    await page.mouse.up();
    await page.waitForTimeout(500);
  }

  test('drag a single card onto a sidebar category assigns it', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const dropTarget = page.getByTestId(`sidebar-category-${catIds.catA}`);

    await performDrag(page, `draggable-${id0}`, dropTarget);

    // Verify via API
    const baseURL = 'http://localhost:3001';
    const res = await page.request.get(`${baseURL}/api/videos?category=${catIds.catA}`);
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(1);
    const assignedIds = data.videos.map((v: { id: string }) => v.id);
    expect(assignedIds).toContain(id0);
  });

  test('drag selected cards onto category assigns all of them', async ({ page }) => {
    const id0 = await getVideoId(page, 0);
    const id1 = await getVideoId(page, 1);
    const id2 = await getVideoId(page, 2);

    // Select 3 cards
    await page.getByTestId(`video-card-${id0}`).click({ modifiers: ['Meta'] });
    await page.getByTestId(`video-card-${id1}`).click({ modifiers: ['Meta'] });
    await page.getByTestId(`video-card-${id2}`).click({ modifiers: ['Meta'] });
    await expect(page.getByTestId('selection-count')).toHaveText('3 selected');

    const dropTarget = page.getByTestId(`sidebar-category-${catIds.catB}`);
    await performDrag(page, `draggable-${id0}`, dropTarget);

    // Verify via API that all 3 are assigned
    const baseURL = 'http://localhost:3001';
    const res = await page.request.get(`${baseURL}/api/videos?category=${catIds.catB}`);
    const data = await res.json();
    expect(data.total).toBe(3);
  });
});
