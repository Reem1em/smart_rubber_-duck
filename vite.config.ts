import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy all API and legacy un-prefixed routes to the Express backend on :3000.
      proxy: {
        '/api': { target: 'http://localhost:3000', changeOrigin: true },
        '/generate-code-lab': { target: 'http://localhost:3000', changeOrigin: true },
        '/generate-bug-challenge': { target: 'http://localhost:3000', changeOrigin: true },
        '/evaluate-bug-challenge': { target: 'http://localhost:3000', changeOrigin: true },
        '/review-project': { target: 'http://localhost:3000', changeOrigin: true },
      },
    },
  };
});
