import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    '@openchart/core',
    '@openchart/engine',
    '@openchart/vanilla',
    'vue',
  ],
});
