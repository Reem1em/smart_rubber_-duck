import express from 'express';
import dotenv from 'dotenv';

import { registerRoutes } from './server/routes/index';
import { mountAssets } from './server/static';
import { initSessionSecret } from './server/auth/session';
import { assertGeminiConfigured } from './server/gemini';
import { jsonErrorHandler } from './server/httpSafety';

dotenv.config();

// A stray AI/library error must never take the process down (Render answers 502 while it restarts).
process.on('uncaughtException', (err) => console.error('[Uncaught Exception]', err));
process.on('unhandledRejection', (reason) => console.error('[Unhandled Rejection]', reason));

// Render (and most PaaS hosts) inject PORT; 3000 is the local default.
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  await initSessionSecret();
  assertGeminiConfigured();

  const app = express();

  app.use(express.json({ limit: '25mb' }));

  registerRoutes(app);
  await mountAssets(app);
  app.use(jsonErrorHandler);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
  // Outlive Render's proxy keep-alive so it never reuses a socket Node already closed (a classic 502 source).
  server.keepAliveTimeout = 120000;
  server.headersTimeout = 125000;
}

startServer().catch((err) => {
  // Boot failures are unrecoverable: exit so the host restarts us instead of leaving a dead port.
  console.error('[Startup Error] server failed to start:', err);
  process.exit(1);
});
