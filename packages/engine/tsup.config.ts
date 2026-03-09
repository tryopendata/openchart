import { defineConfig } from 'tsup';
import { bunSymlinkResolver } from '../../scripts/bun-symlink-resolver';

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
