/** Keep the optional authoring product out of every published library package. */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const forbidden =
  /(?:from|import\s*\()\s*['"](?:[^'"]*(?:apps\/studio|examples\/src)|motion(?:\/[^'"]*)?|d3-dsv|world-atlas|@opendata-ai\/studio)['"]/;
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (['node_modules', 'dist', '__tests__'].includes(entry.name)) continue;
    const file = join(path, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(?:tsx?|json)$/.test(file) && forbidden.test(await readFile(file, 'utf8')))
      throw new Error(`Product dependency in library: ${file}`);
  }
}
await walk('packages');
for (const name of await readdir('packages')) {
  const manifest = JSON.parse(await readFile(`packages/${name}/package.json`, 'utf8'));
  for (const dependency of Object.keys({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
  })) {
    if (
      ['motion', 'framer-motion', 'd3-dsv', 'world-atlas', '@opendata-ai/studio'].includes(
        dependency,
      )
    )
      throw new Error(`Product dependency ${dependency} in ${manifest.name}`);
  }
}
const app = JSON.parse(await readFile('apps/studio/package.json', 'utf8'));
if (!app.private) throw new Error('Studio must remain a private, separately built app.');
for (const config of ['vite.config.ts', 'vitest.config.ts', 'tsconfig.json']) {
  if (/(?:alias\s*:|\.\.\/|packages\/)/.test(await readFile(`apps/studio/${config}`, 'utf8')))
    throw new Error(`Studio configuration crosses its package boundary: ${config}`);
}
console.log('Library/product boundary verified. Studio consumes public package exports.');
