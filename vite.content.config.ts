import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: false, // don't wipe popup output
        lib: {
            entry: resolve(__dirname, 'src/content-script.tsx'),
            name: 'CwalContent',
            formats: ['iife'],                 // <-- crucial: not ESM
            fileName: () => 'content-script.js'
        },
        rollupOptions: {
            output: { extend: true },
        },
    },
});
