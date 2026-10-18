import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

// `npm run build:standalone` produces one self-contained HTML file that can be opened
// directly from disk (double-click) — handy for presentations without a server.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'standalone' ? [viteSingleFile()] : [])],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173, open: true },
  build: {
    chunkSizeWarningLimit: 3000,
    outDir: mode === 'standalone' ? 'standalone' : 'dist',
  },
}));
