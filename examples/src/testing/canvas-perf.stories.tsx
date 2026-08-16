/**
 * Testing / Canvas scatter perf harness.
 *
 * Not an editorial demo -- this story exists so the Playwright `perf` project
 * can measure real frame pacing during a canvas update transition. happy-dom
 * has no rAF clock worth timing and no compositor at all, so the only honest
 * measurement is in a browser.
 *
 * It mounts a 5,000-point canvas scatter, samples inter-frame deltas across one
 * `.update()`, and writes `{ frames, mean, p95 }` to `#perf-result`.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { createChart } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef, useState } from 'react';

export default { title: 'Testing / Canvas Perf' };

const POINT_COUNT = 5000;

/** Deterministic PRNG so the cloud, and the work per frame, is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatterSpec(seed: number): ChartSpec {
  const rand = mulberry32(seed);
  return {
    // Entrance off: it would still be running when the update fires, and gate 5
    // would veto the very transition this harness exists to measure.
    animation: { enter: false, update: true },
    mark: 'point',
    data: Array.from({ length: POINT_COUNT }, (_, i) => ({
      id: `p${i}`,
      x: Math.round(rand() * 1000) / 10,
      y: Math.round(rand() * 1000) / 10,
    })),
    encoding: {
      x: { field: 'x', type: 'quantitative', scale: { domain: [0, 100] } },
      y: { field: 'y', type: 'quantitative', scale: { domain: [0, 100] } },
      key: { field: 'id', type: 'nominal' },
    },
  };
}

/** Sample inter-frame deltas until `stop()` is called. */
function sampleFrames() {
  const deltas: number[] = [];
  let last: number | null = null;
  let running = true;

  const tick = (now: number) => {
    if (!running) return;
    if (last !== null) deltas.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      return deltas;
    },
  };
}

export const CanvasUpdatePerf = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState('pending');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Dimensions come from the host element, which is sized below.
    const chart = createChart(host, scatterSpec(1), { renderer: 'canvas' });
    const sampler = sampleFrames();

    // One frame of settle before the update, so the initial render's cost does
    // not land in the sample.
    const started = requestAnimationFrame(() => {
      chart.update(scatterSpec(2));
      window.setTimeout(() => {
        const deltas = sampler.stop();
        // Drop the first delta: it spans the gap from mount to first frame,
        // not any work the transition did.
        const body = deltas.slice(1);
        if (body.length === 0) {
          setResult(JSON.stringify({ error: 'no frames sampled' }));
          return;
        }
        const sorted = [...body].sort((a, b) => a - b);
        const mean = body.reduce((s, d) => s + d, 0) / body.length;
        const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        setResult(
          JSON.stringify({
            frames: body.length,
            mean: Math.round(mean * 100) / 100,
            p95: Math.round(p95 * 100) / 100,
          }),
        );
      }, 1200);
    });

    return () => {
      cancelAnimationFrame(started);
      sampler.stop();
      chart.destroy();
    };
  }, []);

  return (
    <div>
      <div ref={hostRef} style={{ width: 900, height: 600 }} />
      <div id="perf-result" data-result={result}>
        {result}
      </div>
    </div>
  );
};
