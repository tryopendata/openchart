import { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { barSpec } from '../__test-fixtures__/specs';
import { renderStaticSVG } from '../static';

// Runs against the built package (`bun run build` first): `bun run test:static`.
describe('built static entry', () => {
  it('renders forty specs deterministically in eight built-JavaScript workers', async () => {
    const specs = Array.from({ length: 40 }, (_, i) => ({
      ...barSpec,
      chrome: { title: `Worker figure ${i}` },
    }));
    const expected = specs.map((spec) => renderStaticSVG(spec));
    const entry = new URL('../../dist/static.js', import.meta.url).href;
    const batches = await Promise.all(
      Array.from(
        { length: 8 },
        () =>
          new Promise<string[]>((resolve, reject) => {
            const worker = new Worker(
              `const { parentPort, workerData } = require('node:worker_threads'); import(workerData.entry).then(({renderStaticSVG}) => parentPort.postMessage(workerData.specs.map(spec => renderStaticSVG(spec)))).catch(error => { throw error });`,
              { eval: true, workerData: { specs, entry } },
            );
            worker.once('message', resolve);
            worker.once('error', reject);
            worker.once('exit', (code) => {
              if (code) reject(new Error(`Worker exited ${code}`));
            });
          }),
      ),
    );
    for (const batch of batches) expect(batch).toEqual(expected);
    expect(new Set(batches.flat()).size).toBe(40);
  }, 30000);
});
