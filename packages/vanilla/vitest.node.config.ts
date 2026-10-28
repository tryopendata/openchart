import path from 'node:path';
import { defineConfig } from 'vitest/config';

const packages = path.resolve(__dirname, '..');

// Static rendering from source with no DOM environment.
export default defineConfig({
  resolve: {
    alias: [
      { find: '@opendata-ai/openchart-core', replacement: `${packages}/core/src/index.ts` },
      { find: '@opendata-ai/openchart-engine', replacement: `${packages}/engine/src/index.ts` },
    ],
  },
  test: {
    name: 'vanilla-node',
    environment: 'node',
    include: ['src/**/*.node.test.ts', 'src/__tests__/site-contract.test.ts'],
  },
});
