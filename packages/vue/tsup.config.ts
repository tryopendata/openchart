import { defineConfig } from 'tsup';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

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
  onSuccess: async () => {
    // Copy core styles so consumers can import from this package directly
    const src = resolve('node_modules/@opendata-ai/openchart-core/dist/styles.css');
    const dest = resolve('dist/styles.css');
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    if (existsSync(`${src}.map`)) copyFileSync(`${src}.map`, `${dest}.map`);
  },
});
