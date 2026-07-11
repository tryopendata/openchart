/**
 * Built-in chart renderer registration.
 *
 * Each chart type (line, bar, column, scatter, pie, etc.) has a renderer that
 * produces marks from a normalized spec. This module wires them into the
 * registry. Importing it is a side effect: the built-ins register as soon as
 * it's loaded.
 *
 * Tests that call `clearRenderers()` can call `registerBuiltinRenderers()` to
 * restore the default set rather than leaving the registry empty for later
 * tests in the same process.
 */

import { barRenderer } from './bar';
import { beeswarmRenderer } from './beeswarm';
import { columnRenderer } from './column';
import { dotRenderer } from './dot';
import { areaRenderer, lineRenderer } from './line';
import { donutRenderer, pieRenderer } from './pie';
import { type ChartRenderer, registerChartRenderer } from './registry';
import { ruleRenderer } from './rule';
import { scatterRenderer } from './scatter';
import { textRenderer } from './text';
import { tickRenderer } from './tick';

// Mark type mapping from old chart types:
// - 'bar' -> barRenderer (horizontal bars, old 'bar')
// - 'bar:vertical' is handled by columnRenderer (old 'column')
// - 'arc' -> pieRenderer (old 'pie'); donutRenderer is also registered
// - 'point' -> scatterRenderer (old 'scatter')
// - 'circle' -> dotRenderer (old 'dot')
// - 'line' and 'area' unchanged
// - 'text', 'rule', 'tick' are new Vega-Lite mark types
//
// For 'bar', orientation is resolved at compile time to dispatch to the right
// renderer. We register both barRenderer and columnRenderer; the compile
// function picks based on orientation.
const builtinRenderers: Record<string, ChartRenderer> = {
  line: lineRenderer,
  area: areaRenderer,
  bar: barRenderer, // horizontal bars
  'bar:vertical': columnRenderer, // vertical bars (old 'column')
  point: scatterRenderer, // old 'scatter'
  arc: pieRenderer, // old 'pie' (donut handled via innerRadius)
  'arc:donut': donutRenderer, // old 'donut'
  circle: dotRenderer, // old 'dot'
  lollipop: dotRenderer, // semantic alias for dot/circle
  beeswarm: beeswarmRenderer, // dodged distribution dots
  text: textRenderer,
  rule: ruleRenderer,
  tick: tickRenderer,
  rect: columnRenderer, // rect uses column renderer (RectMark output) as baseline for heatmaps
};

/**
 * Register all built-in chart renderers. Called once on module load; also
 * exported so tests that clear the registry can restore the defaults.
 */
export function registerBuiltinRenderers(): void {
  for (const [type, renderer] of Object.entries(builtinRenderers)) {
    registerChartRenderer(type, renderer);
  }
}

// Side effect: register on first import.
registerBuiltinRenderers();
