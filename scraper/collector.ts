import http from 'http';
import fs from 'fs';
import path from 'path';

const SCRAPES_DIR = path.resolve(__dirname, '..', 'data', 'scrapes');
const PORT = 3456;

export interface CollectorState {
  pages: string[];
  totalItems: number;
  done: boolean;
}

export function startCollector(): Promise<{ state: CollectorState; close: () => void }> {
  fs.mkdirSync(SCRAPES_DIR, { recursive: true });

  const state: CollectorState = { pages: [], totalItems: 0, done: false };
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/capture') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const pageNum = state.pages.length + 1;
            const filename = `scrape-${timestamp}-page${pageNum}.json`;
            const filepath = path.join(SCRAPES_DIR, filename);

            fs.writeFileSync(filepath, body);
            state.pages.push(filepath);

            const items = data.itemList?.length || 0;
            state.totalItems += items;

            if (!data.hasMore) state.done = true;

            console.log(
              `  Page ${pageNum}: ${items} items (${state.totalItems} total). hasMore=${data.hasMore}`
            );

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, page: pageNum }));
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return;
      }

      if (req.url === '/done') {
        state.done = true;
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${PORT} already in use. Is another scrape session running?`));
      } else {
        reject(err);
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Collector listening on http://127.0.0.1:${PORT}`);
      resolve({
        state,
        close: () => server.close(),
      });
    });
  });
}
