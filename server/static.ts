import express, { type Express } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

/**
 * Serves /public, then either the Vite dev middleware or the built SPA.
 * Must be mounted after the API routes so the SPA catch-all stays last.
 */
export async function mountAssets(app: Express): Promise<void> {
  // Serve static assets from public folder
  app.use(express.static(path.join(process.cwd(), 'public')));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}
