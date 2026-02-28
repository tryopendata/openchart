import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@openchart/engine', '@openchart/core', 'd3-force', 'd3-quadtree'],
});
