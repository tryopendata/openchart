/**
 * Testing / Canvas-mode export correctness harness.
 *
 * Not an editorial demo -- this story exists so the Playwright `perf` project
 * can exercise canvas-mode SVG export in a real browser. happy-dom cannot
 * decode an `Image`, so the raster-marks path (which round-trips the mark
 * canvas through `toDataURL` into an `<image>`) is only truly checkable here.
 *
 * It mounts two canvas-mode scatters -- one below `VECTOR_EXPORT_MAX_POINTS`
 * and one above -- exports each to SVG, and writes the shape of both results
 * to `#canvas-export-result`.
 *
 * The claim under test: a canvas-mode chart shows no dots, no gridlines and no
 * background in its live SVG (the canvas owns them), yet exporting it must
 * still produce a complete picture.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { createChart } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef, useState } from 'react';

export default { title: 'Testing / Canvas Export' };

/** Below the 5,000-point vector cap. */
const SMALL_N = 400;
/** Above it, so the marks come back as a single raster <image>. */
const LARGE_N = 6000;

/** Deterministic PRNG so both charts are reproducible run to run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatterSpec(n: number): ChartSpec {
  const rand = mulberry32(11);
  return {
    // No entrance: the export must capture a settled chart, not a mid-fade one.
    animation: false,
    mark: { type: 'point', render: 'canvas' },
    data: Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      x: Math.round(rand() * 1000) / 10,
      y: Math.round(rand() * 1000) / 10,
    })),
    encoding: {
      x: { field: 'x', type: 'quantitative', scale: { domain: [0, 100] } },
      y: { field: 'y', type: 'quantitative', scale: { domain: [0, 100] } },
    },
  };
}

/**
 * Count what actually made it into an exported SVG string.
 *
 * The background rect carries no class (see `svg-renderer.ts`), so it is
 * detected structurally: a full-bleed `<rect>` at the origin, which only the
 * background emits.
 */
function describeSVG(svg: string) {
  const count = (re: RegExp) => (svg.match(re) ?? []).length;
  return {
    bytes: svg.length,
    circles: count(/class="[^"]*oc-mark-point/g),
    images: count(/<image\b/g),
    gridlines: count(/class="[^"]*oc-gridline/g),
    hasBackground: /<rect[^>]*\bx="0"[^>]*\by="0"[^>]*\bfill="/.test(svg),
  };
}

export const CanvasExportCorrectness = () => {
  const smallRef = useRef<HTMLDivElement>(null);
  const largeRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState('pending');

  useEffect(() => {
    const smallHost = smallRef.current;
    const largeHost = largeRef.current;
    if (!smallHost || !largeHost) return;

    const small = createChart(smallHost, scatterSpec(SMALL_N));
    const large = createChart(largeHost, scatterSpec(LARGE_N));

    try {
      setResult(
        JSON.stringify({
          small: describeSVG(small.export('svg')),
          large: describeSVG(large.export('svg')),
        }),
      );
    } catch (err) {
      setResult(JSON.stringify({ error: String(err) }));
    }

    return () => {
      small.destroy();
      large.destroy();
    };
  }, []);

  return (
    <div>
      <div ref={smallRef} style={{ width: 600, height: 400 }} />
      <div ref={largeRef} style={{ width: 600, height: 400 }} />
      <div id="canvas-export-result" data-result={result}>
        {result}
      </div>
    </div>
  );
};
