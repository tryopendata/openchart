import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    '@opendata-ai/core',
    '@opendata-ai/engine',
    '@opendata-ai/vanilla',
    'react',
    'react-dom',
    'react/jsx-runtime',
  ],
});
