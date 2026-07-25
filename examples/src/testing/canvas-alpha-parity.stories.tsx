/**
 * Testing / Canvas-vs-SVG alpha compositing parity harness.
 *
 * Not an editorial demo -- this story exists so the Playwright `invariants`
 * project can compare what the two mark renderers actually put on screen.
 *
 * The bug this guards against: the canvas renderer used to batch every point
 * sharing a (fill, alpha) into ONE `beginPath()` and pay for it with ONE
 * `fill()` at `globalAlpha`. Overlapping circles inside a single path are
 * unioned by the fill rule and then faded once, so a dense cluster of
 * translucent dots came out at the alpha of a SINGLE dot. SVG composites every
 * `<circle>` separately, so the same cluster builds toward opaque. A 5-deep
 * stack at opacity 0.35 landed on 0.65 luminance instead of 0.12 -- dense
 * scatters rendered visibly washed out, while exports (which re-render through
 * real SVG) looked correct.
 *
 * A stubbed 2D context cannot catch this: the call sequence is legal either
 * way and the defect only exists in the rasterizer's output. So both charts
 * mount here, in a real browser, over the SAME data, and the spec reads pixels
 * out of each.
 *
 * Both charts are deliberately given heavily overlapping points -- a tight
 * cluster is where the two compositing models diverge most. Sparse clouds
 * agree even with the bug present, which is exactly why this shipped.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { createChart } from '@opendata-ai/openchart-vanilla';
import { useEffect, useRef } from 'react';

export default { title: 'Testing / Canvas Alpha Parity' };

/** Fill + opacity are fixed so the expected composite is computable by hand. */
const FILL = '#000000';
const OPACITY = 0.35;
/** Deep enough that per-circle compositing is unmistakably darker than one fill. */
const STACK_DEPTH = 6;

const WIDTH = 420;
const HEIGHT = 320;

/**
 * Every point sits at the same data coordinate, so all `STACK_DEPTH` circles
 * land on the same pixel. That makes the assertion a closed-form value rather
 * than a screenshot: correct output is `1 - (1 - 0.35)^6` over white.
 */
function stackedSpec(): ChartSpec {
  return {
    // A settled chart, not a mid-fade one -- entrance alpha would poison the read.
    animation: false,
    width: WIDTH,
    height: HEIGHT,
    mark: {
      type: 'point',
      size: 14,
      opacity: OPACITY,
      fill: FILL,
      // No separator stroke: a stroke over the sample point would be measuring
      // the stroke pass, not the fill compositing under test.
      strokeWidth: 0,
    },
    data: Array.from({ length: STACK_DEPTH }, (_, i) => ({ id: `p${i}`, x: 50, y: 50 })),
    encoding: {
      x: { field: 'x', type: 'quantitative', scale: { domain: [0, 100] } },
      y: { field: 'y', type: 'quantitative', scale: { domain: [0, 100] } },
      key: { field: 'id', type: 'nominal' },
    },
  };
}

function Chart({ render, id }: { render: 'svg' | 'canvas'; id: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, stackedSpec(), { renderer: render });
    return () => chart.destroy();
  }, [render]);

  return <div id={id} ref={ref} style={{ width: WIDTH, height: HEIGHT }} />;
}

/**
 * Two charts over identical data and identical opacity, differing only in
 * which renderer draws the dots. The spec samples the centre pixel of each.
 */
export const StackedTranslucentPoints = () => (
  <div style={{ padding: 16, background: '#ffffff' }}>
    <div id="alpha-parity-ready" data-ready="true" />
    <Chart render="svg" id="parity-svg" />
    <Chart render="canvas" id="parity-canvas" />
  </div>
);
