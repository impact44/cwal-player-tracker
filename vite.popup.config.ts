import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true, // clean once
    rollupOptions: {
      input: { popup: resolve(__dirname, 'index.html') },
    },
  },
});
