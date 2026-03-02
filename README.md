# TikTok Pinned Organiser

A local web app to import, browse, and organise your TikTok pinned/saved videos into custom categories.

## Features

- **Import** TikTok data export JSON files (API responses from `/api/user/collect/item_list`)
- **Browse** videos in a responsive grid with cached thumbnails
- **Categorise** videos using drag-and-drop or multi-select bulk assignment
- **Filter** by category via the sidebar
- **Paginated** video grid with search
- **Deduplication** — re-importing the same data won't create duplicates

## Tech Stack

| Layer    | Tech |
|----------|------|
| Backend  | Node.js, Express, TypeScript, SQLite (better-sqlite3) |
| Frontend | React 19, Vite, Tailwind CSS, TanStack Query, dnd-kit |
| Testing  | Vitest, Supertest, Playwright (e2e) |

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install

```bash
npm install
```

### Run (development)

Starts both the API server (port 3001) and the Vite dev server (port 5173) with hot reload:

```bash
npm run dev
```

Then open http://localhost:5173.

### Build & run (production)

```bash
npm run build
npm start
```

The Express server will serve the built client from `client/dist`.

### Test

```bash
# Unit & integration tests
npm test

# End-to-end tests (requires Playwright browsers)
npx playwright install
npm run test:e2e
```

## Project Structure

```
├── client/          # React frontend (Vite)
│   └── src/
│       ├── components/   # UI components (videos, categories, layout)
│       ├── hooks/        # Custom React hooks (useVideos, useCategories, etc.)
│       ├── api/          # API client
│       └── pages/        # Page components
├── server/          # Express API backend
│   └── src/
│       ├── db/           # SQLite connection & schema
│       ├── routes/       # API routes (videos, categories, import, thumbnails)
│       └── services/     # Business logic (importer, thumbnail downloader)
├── e2e/             # Playwright end-to-end tests
├── sample-data/     # Example TikTok export JSON
└── data/            # Runtime data (SQLite DB + thumbnails, gitignored)
```

## How to Get Your TikTok Data

1. Use your browser's developer tools to capture the API response from TikTok's pinned/saved videos endpoint
2. Save the JSON response to a file
3. Import it through the app's import dialog (or place it in `sample-data/`)

## License

MIT
