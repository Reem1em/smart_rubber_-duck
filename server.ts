import express from 'express';
import dotenv from 'dotenv';

import { registerRoutes } from './server/routes/index';
import { mountAssets } from './server/static';
import { initSessionSecret } from './server/auth/session';

dotenv.config();

const PORT = 3000;

async function startServer() {
  await initSessionSecret();

  const app = express();

  app.use(express.json({ limit: '25mb' }));

  registerRoutes(app);
  await mountAssets(app);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
