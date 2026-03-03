import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    '@opendata-ai/openchart-core',
    '@opendata-ai/openchart-engine',
    '@opendata-ai/openchart-vanilla',
    'vue',
  ],
});
