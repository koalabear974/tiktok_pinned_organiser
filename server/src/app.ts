import express from 'express';
import cors from 'cors';
import path from 'path';
import { initializeSchema } from './db/schema';
import importRouter from './routes/import';
import videosRouter from './routes/videos';
import categoriesRouter from './routes/categories';
import thumbnailsRouter from './routes/thumbnails';

// Initialize database schema
initializeSchema();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/import', importRouter);
app.use('/api/imports', importRouter);
app.use('/api/videos', videosRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/thumbnails', thumbnailsRouter);

// In production, serve the client build
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDistPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

export default app;
