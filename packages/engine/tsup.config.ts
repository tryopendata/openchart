import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    '@openchart/core',
    'd3-array',
    'd3-format',
    'd3-interpolate',
    'd3-scale',
    'd3-shape',
  ],
});
