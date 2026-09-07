import { defineConfig } from 'tsup';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/static.ts',
    'src/story/index.ts',
    'src/export-gif.ts',
    'src/graph-3d/index.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    '@opendata-ai/openchart-engine',
    '@opendata-ai/openchart-core',
    'happy-dom',
    'gifenc',
    // Optional 3D peers: they must never be pulled into the default bundle.
    'three',
    '3d-force-graph',
    'three-spritetext',
  ],
  onSuccess: async () => {
    const src = resolve('node_modules/@opendata-ai/openchart-core/dist/styles.css');
    const dest = resolve('dist/styles.css');
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    if (existsSync(`${src}.map`)) copyFileSync(`${src}.map`, `${dest}.map`);
  },
});
