import path from 'node:path';
import { defineConfig } from 'vitest/config';

const packages = path.resolve(__dirname, '..');

// Tests of the built `dist/static.js` in worker threads. Not part of the root
// `bun run test`; run `bun run build` and then `bun run test:static`.
export default defineConfig({
  resolve: {
    alias: [
      { find: '@opendata-ai/openchart-core', replacement: `${packages}/core/src/index.ts` },
      { find: '@opendata-ai/openchart-engine', replacement: `${packages}/engine/src/index.ts` },
    ],
  },
  test: {
    name: 'vanilla-static',
    environment: 'node',
    include: ['src/**/*.dist.test.ts'],
  },
});
