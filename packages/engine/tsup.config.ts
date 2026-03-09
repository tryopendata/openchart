import { defineConfig } from 'tsup';
import { bunSymlinkResolver } from '../../build/bun-symlink-resolver';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@opendata-ai/openchart-core'],
  noExternal: [/^d3-/, 'internmap'],
  esbuildPlugins: [bunSymlinkResolver()],
});
