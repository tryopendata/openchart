import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The graph-3d subpath does its work at import time (it registers the WebGL
 * renderer). Bundlers honour `sideEffects` when tree-shaking, so an entry
 * missing from the list is dropped to an empty chunk in production builds and
 * `createGraph()` throws "dimensions: 3 requires import ..." even though the
 * consumer imported the subpath. This happened on the first opendata deploy.
 */
describe('graph-3d subpath is declared side-effectful', () => {
  const packages = ['vanilla', 'react', 'vue', 'svelte'];

  it.each(packages)('%s lists its ./graph-3d export in sideEffects', (pkg) => {
    const manifest = JSON.parse(
      readFileSync(resolve(__dirname, '../../../..', pkg, 'package.json'), 'utf8'),
    ) as { exports: Record<string, { import: string }>; sideEffects: string[] };
    const entry = manifest.exports['./graph-3d'].import;
    expect(manifest.sideEffects).toContain(entry);
  });
});
