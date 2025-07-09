import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'public/privacypolicy.html'),
        content: resolve(__dirname, 'src/content-script.tsx'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'content' ? 'content-script.js' : '[name].js',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
