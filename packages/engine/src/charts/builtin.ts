/**
 * Built-in chart renderers. The registry installs them on the first lookup.
 */

import { barRenderer } from './bar';
import { computeMirrorMarks } from './bar/mirror';
import { beeswarmRenderer } from './beeswarm';
import { binnedBarRenderer } from './binned-bar';
import { calendarRenderer } from './calendar';
import { columnRenderer } from './column';
import { dotRenderer } from './dot';
import { errorbarRenderer } from './errorbar';
import { areaRenderer, lineRenderer } from './line';
import { parliamentRenderer } from './parliament';
import { donutRenderer, pieRenderer } from './pie';
import { rangeRenderer } from './range';
import { rectRenderer } from './rect';
import type { ChartRenderer } from './registry';
import { ruleRenderer } from './rule';
import { scatterRenderer } from './scatter';
import { textRenderer } from './text';
import { tickRenderer } from './tick';
import { waffleRenderer } from './waffle';

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
export const builtinRenderers: Record<string, ChartRenderer> = {
  errorbar: errorbarRenderer,
  line: lineRenderer,
  area: areaRenderer,
  bar: barRenderer, // horizontal bars
  'bar:vertical': columnRenderer, // vertical bars (old 'column')
  'bar:binned': binnedBarRenderer, // histogram: rects sized from a linear x scale via x2
  'bar-mirror': computeMirrorMarks, // mirrored bars (population pyramid): halves around a gutter
  // Safety net. `compileChart` always expands sugar before dispatch, so these
  // keys should be unreachable — but an unregistered key yields zero marks
  // with no error, i.e. a silently blank chart, which is the exact failure
  // this whole mark family exists to remove.
  histogram: binnedBarRenderer,
  density: areaRenderer,
  point: scatterRenderer, // old 'scatter'
  arc: pieRenderer, // old 'pie' (donut handled via innerRadius)
  'arc:donut': donutRenderer, // old 'donut'
  circle: dotRenderer, // old 'dot'
  lollipop: dotRenderer, // semantic alias for dot/circle
  beeswarm: beeswarmRenderer, // dodged distribution dots
  text: textRenderer,
  rule: ruleRenderer,
  tick: tickRenderer,
  rect: rectRenderer, // heatmap cells (band x band); see charts/rect
  range: rangeRenderer, // dumbbell / arrow / range bar (orientation resolved internally)
  waffle: waffleRenderer, // unit grid for part-to-whole counts
  calendar: calendarRenderer, // weeks x weekdays daily heatmap (no positional scales)
  parliament: parliamentRenderer, // hemicycle seat dots (no positional scales)
};
