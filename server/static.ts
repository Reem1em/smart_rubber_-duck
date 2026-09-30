import express, { type Express } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Serves /public, then either the Vite dev middleware or the built SPA.
 * Must be mounted after the API routes so the SPA catch-all stays last.
 *
 * The production bundle (dist/server.cjs) is built with NODE_ENV baked in as
 * "production", so a host that doesn't set NODE_ENV (e.g. Render) never boots the
 * memory-hungry Vite dev server. Vite is imported lazily so it isn't needed at runtime.
 */
export async function mountAssets(app: Express): Promise<void> {
  // Serve static assets from public folder
  app.use(express.static(path.join(process.cwd(), 'public')));

  const distPath = path.join(process.cwd(), 'dist');

  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      return;
    } catch (err) {
      if (!fs.existsSync(path.join(distPath, 'index.html'))) throw err;
      console.warn('[static] Vite dev server unavailable; serving the built app from dist/.', err);
    }
  }

  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
