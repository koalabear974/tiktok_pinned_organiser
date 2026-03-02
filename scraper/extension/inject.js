// Injected into the page's MAIN world via <script> tag.
// Wraps window.fetch with a Proxy to intercept TikTok API responses
// without modifying behavior. Sends captured data back via postMessage.

(function () {
  const TARGET = '/api/user/collect/item_list';
  const originalFetch = window.fetch;

  window.fetch = new Proxy(originalFetch, {
    apply: async function (target, thisArg, args) {
      const response = await Reflect.apply(target, thisArg, args);
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

      if (url.includes(TARGET)) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          window.postMessage({
            type: '__tiktok_scraper_data__',
            payload: JSON.stringify(data),
          }, '*');
        } catch (e) {
          // Response wasn't JSON or clone failed — ignore
        }
      }

      return response;
    },
  });
})();
