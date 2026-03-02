// Content script — runs in ISOLATED world on tiktok.com pages.
// 1. Injects fetch interceptor into the page's main world
// 2. Receives intercepted data via postMessage
// 3. Sends data to the local collector server
// 4. Auto-scrolls on /favorites

const COLLECTOR_URL = 'http://127.0.0.1:3456';

let pageCount = 0;
let totalItems = 0;
let done = false;

// --- Inject the fetch interceptor into the page context ---
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(script);

// --- Listen for intercepted API responses ---
window.addEventListener('message', async (event) => {
  if (event.data?.type !== '__tiktok_scraper_data__') return;

  pageCount++;
  const payload = event.data.payload;

  try {
    const data = JSON.parse(payload);
    const items = data.itemList?.length || 0;
    totalItems += items;

    if (!data.hasMore) done = true;

    console.log(
      `[TikTok Scraper] Page ${pageCount}: ${items} items ` +
      `(${totalItems} total). hasMore=${data.hasMore}`
    );
  } catch (e) {
    // Count it anyway
  }

  // Send to collector server
  try {
    await fetch(`${COLLECTOR_URL}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
  } catch (e) {
    console.warn('[TikTok Scraper] Collector unreachable:', e.message);
  }
});

// --- Auto-scroll on the favorites page ---
if (window.location.pathname.startsWith('/favorites')) {
  // Wait for page to settle before scrolling
  setTimeout(() => {
    console.log('[TikTok Scraper] Starting auto-scroll on favorites...');

    let staleCount = 0;
    let lastPageCount = 0;

    function doScroll() {
      if (done) {
        console.log(
          `[TikTok Scraper] Done! ${totalItems} items in ${pageCount} pages.`
        );
        fetch(`${COLLECTOR_URL}/done`).catch(() => {});
        return;
      }

      window.scrollBy(0, 800);

      if (pageCount > lastPageCount) {
        staleCount = 0;
        lastPageCount = pageCount;
      } else {
        staleCount++;
      }

      if (staleCount >= 10) {
        console.log(
          '[TikTok Scraper] No new data after 10 scrolls. Stopping.'
        );
        fetch(`${COLLECTOR_URL}/done`).catch(() => {});
        return;
      }

      const jitter = 2000 + Math.random() * 1000;
      setTimeout(doScroll, jitter);
    }

    doScroll();
  }, 5000);
}
