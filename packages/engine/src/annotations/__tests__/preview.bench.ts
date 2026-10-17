import { expect, test } from 'vitest';
import { annotationCrowdedSpec } from '../../../../../examples/src/gallery/features-annotations.demos';
import { compileChart } from '../../compile';
import { createAnnotationEditContext, previewAnnotationMove } from '../edit-context';

const spec = annotationCrowdedSpec;
const layout = compileChart(spec, { width: 1280, height: 800 });
const ctx = createAnnotationEditContext(layout, spec);
// Vitest 5 exposes benchmarks through the test context.
test('1,000 compiled annotation previews stay within one frame', async ({ bench }) => {
  let i = 0;
  const result = await bench('previewAnnotationMove', () => {
    previewAnnotationMove(
      ctx,
      { type: 'annotation', index: 12, id: 'crowded-12' },
      { dx: Math.sin(i++) * 50, dy: Math.cos(i) * 30 },
    );
  }).run({ iterations: 1000, time: 0, warmup: false, retainSamples: true });
  const p95 = result.latency.samples![949];
  console.log(
    JSON.stringify({ moves: result.latency.samplesCount, p50ms: result.latency.p50, p95ms: p95 }),
  );
  expect(p95).toBeLessThan(16);
});
