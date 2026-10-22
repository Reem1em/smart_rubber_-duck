import { defineConfig } from 'vitest/config';

// Standalone config so tests don't load the React/Tailwind plugins from vite.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
