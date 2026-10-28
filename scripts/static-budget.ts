import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { renderStaticSVG } from '../packages/vanilla/src/static';
import { siteSpecs } from '../packages/vanilla/src/__tests__/__fixtures__/static-specs';

// Run with `bun scripts/static-budget.ts` from the repository root.
const start = performance.now();
const figures = ['byPreset', 'byAgent', 'timeToGreen', 'history', 'weekly',
  'stepFailures', 'keptAttach', 'majorShares'] as const;
const cells = ['rateCell', 'countCell', 'sparkCell'] as const;
const output: string[] = [];
function pair(name: keyof typeof siteSpecs, prefix: string): string[] {
  return (['off', 'force'] as const).map((darkMode, i) =>
    renderStaticSVG(siteSpecs[name], {
      width: name.endsWith('Cell') ? 120 : 680,
      height: name.endsWith('Cell') ? 16 : 320, idPrefix: `${prefix}${i}`, darkMode,
    }));
}
for (const [i, name] of figures.entries()) output.push(...pair(name, `figure${i}`));
for (let row = 0; row < 30; row++) {
  for (const name of cells) output.push(...pair(name, `${name}${row}`));
}
const bytes = gzipSync(output.join('')).byteLength;
console.log(`8 figures + 30 rate + 30 count + 30 sparkline cells, each in 2 themes: ${output.length} SVGs`);
console.log(`Combined gzip: ${bytes} / 80000 bytes; render duration: ${(performance.now() - start).toFixed(1)} ms`);
for (const name of cells) {
  const strings = pair(name, `sample${name}`);
  console.log(`${name}: ${strings.map((svg) => gzipSync(svg).byteLength).join(' / ')} gzip bytes (light / dark); two-theme pair ${gzipSync(strings.join('')).byteLength} bytes`);
}
if (bytes > 80_000) throw new Error(`Static chart allocation exceeded by ${bytes - 80_000} bytes`);
