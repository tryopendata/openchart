import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

const packages = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [svelte({ hot: false }), svelteTesting()],
  resolve: {
    alias: [
      // Workspace packages -> source (so side-effect imports fire)
      { find: '@opendata-ai/openchart-core', replacement: `${packages}/core/src/index.ts` },
      { find: '@opendata-ai/openchart-engine', replacement: `${packages}/engine/src/index.ts` },
      { find: '@opendata-ai/openchart-vanilla', replacement: `${packages}/vanilla/src/index.ts` },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
