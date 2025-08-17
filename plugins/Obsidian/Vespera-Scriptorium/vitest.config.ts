import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    exclude: [
      'tests/ui/**', // Ignore Playwright UI tests
      'node_modules/**',
    ],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    deps: {
      inline: ['obsidian'],
    },
    mockReset: true,
    globals: true,
    alias: {
      '@src': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests'),
    },
  },
  resolve: {
    alias: [
      {
        find: 'obsidian',
        replacement: resolve(__dirname, './tests/mocks/obsidian.mock.ts'),
      },
      {
        find: '@',
        replacement: resolve(__dirname, './src'),
      },
      {
        find: '@src',
        replacement: resolve(__dirname, './src'),
      },
      {
        find: '@tests',
        replacement: resolve(__dirname, './tests'),
      },
    ],
  },
});
