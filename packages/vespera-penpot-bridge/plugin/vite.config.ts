import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { inlinePluginImports } from './scripts/vite-plugin-inline-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    inlinePluginImports(), // Auto-inline imports for Penpot's SES sandbox
  ],
  build: {
    rollupOptions: {
      input: {
        plugin: 'src/plugin/plugin.ts',
        index: './index.html',
      },
      output: {
        entryFileNames: '[name].js',
        // Prevent code splitting - inline everything for plugin.js
        manualChunks: undefined,
      },
    },
  },
  preview: {
    port: 4402,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
});
