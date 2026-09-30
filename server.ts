import express from 'express';
import dotenv from 'dotenv';

import { registerRoutes } from './server/routes/index';
import { mountAssets } from './server/static';
import { initSessionSecret } from './server/auth/session';
import { assertGeminiConfigured } from './server/gemini';

dotenv.config();

// Render (and most PaaS hosts) inject PORT; 3000 is the local default.
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  await initSessionSecret();
  assertGeminiConfigured();

  const app = express();

  app.use(express.json({ limit: '25mb' }));

  registerRoutes(app);
  await mountAssets(app);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
