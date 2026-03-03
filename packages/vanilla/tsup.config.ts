import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@opendata-ai/openchart-engine', '@opendata-ai/openchart-core', 'd3-force', 'd3-quadtree'],
});
