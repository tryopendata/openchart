/**
 * SVG renderer integration tests.
 *
 * Tests the full pipeline: spec -> compileChart -> renderChartSVG -> DOM.
 * Verifies that each chart type produces the correct SVG mark elements,
 * and that chart furniture (chrome, axes, legend, gridlines) renders properly.
 */

import { AXIS_TITLE_GAP, estimateTextWidth, TICK_LABEL_OFFSET } from '@opendata-ai/openchart-core';
import type { ChartSpec, CompileOptions } from '@opendata-ai/openchart-engine';
import { compileChart, compileLayer } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import {
  rectMarkGeometries,
  rectMarkGeometry,
  rectMarkShape,
} from '../__test-fixtures__/rect-geometry';
import {
  barSpec,
  columnSpec,
  lineSpec,
  multiSeriesBarSpec,
  pieSpec,
  scatterSpec,
  singleSeriesLineSpec,
} from '../__test-fixtures__/specs';
import { renderChartSVG } from '../svg-renderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPILE_OPTS: CompileOptions = { width: 600, height: 400 };

/**
 * Compile a spec and render into a fresh container.
 * Returns both the SVG element and the container for querying.
 */
function renderSpec(spec: ChartSpec, opts: CompileOptions = COMPILE_OPTS) {
  const container = createContainer(opts.width, opts.height);
  const layout = compileChart(spec, opts);
  const svg = renderChartSVG(layout, container);
  return { svg, container, layout };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Line chart marks
// ---------------------------------------------------------------------------

describe('line chart SVG rendering', () => {
  it('renders <path> elements with valid d attribute for each series', () => {
    const { svg } = renderSpec(lineSpec);
    const paths = svg.querySelectorAll('.oc-mark-line path');
    expect(paths.length).toBeGreaterThan(0);

    for (const path of paths) {
      const d = path.getAttribute('d');
      expect(d).not.toBeNull();
      // d attribute should start with M (moveTo) and contain curve commands
      expect(d).toMatch(/^M/);
      expect(d!.length).toBeGreaterThan(5);
    }
  });

  it('creates a mark group per series in multi-series line chart', () => {
    const { svg } = renderSpec(lineSpec);
    const lineGroups = svg.querySelectorAll('.oc-mark-line');
    // lineSpec has 2 series (US and UK)
    expect(lineGroups.length).toBe(2);
  });

  it('each line mark group has a data-mark-id attribute', () => {
    const { svg } = renderSpec(lineSpec);
    const lineGroups = svg.querySelectorAll('.oc-mark-line');
    for (const group of lineGroups) {
      const markId = group.getAttribute('data-mark-id');
      expect(markId).not.toBeNull();
      expect(markId).toMatch(/^line-/);
    }
  });

  it('each line mark group has a data-series attribute', () => {
    const { svg } = renderSpec(lineSpec);
    const lineGroups = svg.querySelectorAll('.oc-mark-line');
    const seriesNames = new Set<string>();
    for (const group of lineGroups) {
      const series = group.getAttribute('data-series');
      expect(series).not.toBeNull();
      seriesNames.add(series!);
    }
    expect(seriesNames.has('US')).toBe(true);
    expect(seriesNames.has('UK')).toBe(true);
  });

  it('paths have stroke color and non-zero stroke width', () => {
    const { svg } = renderSpec(lineSpec);
    const paths = svg.querySelectorAll('.oc-mark-line path');
    for (const path of paths) {
      const stroke = path.getAttribute('stroke');
      expect(stroke).not.toBeNull();
      expect(stroke).not.toBe('none');
      const strokeWidth = Number(path.getAttribute('stroke-width'));
      expect(strokeWidth).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Bar chart marks
// ---------------------------------------------------------------------------

describe('bar chart SVG rendering', () => {
  it('renders a shape element for each data point', () => {
    const { svg } = renderSpec(barSpec);
    // Value-end rounding means the shape is a <path>, not a <rect>.
    const shapes = svg.querySelectorAll('.oc-mark-rect :is(rect, path)');
    // barSpec has 3 data points
    expect(shapes.length).toBe(3);
  });

  it('rect marks have width and height > 0', () => {
    const { svg } = renderSpec(barSpec);
    for (const geom of rectMarkGeometries(svg)) {
      expect(geom.width).toBeGreaterThan(0);
      expect(geom.height).toBeGreaterThan(0);
    }
  });

  it('rect marks have data-mark-id attributes', () => {
    const { svg } = renderSpec(barSpec);
    const markGroups = svg.querySelectorAll('.oc-mark-rect');
    for (const group of markGroups) {
      const markId = group.getAttribute('data-mark-id');
      expect(markId).not.toBeNull();
      expect(markId).toMatch(/^rect-/);
    }
  });

  it('bar marks are oriented horizontally (width varies, y is categorical)', () => {
    const { svg } = renderSpec(barSpec);
    const widths = rectMarkGeometries(svg).map((g) => g.width);
    // Different data values should produce different widths
    const uniqueWidths = new Set(widths);
    expect(uniqueWidths.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Column chart marks
// ---------------------------------------------------------------------------

describe('column chart SVG rendering', () => {
  it('renders a shape element per column, oriented vertically', () => {
    const { svg } = renderSpec(columnSpec);
    const shapes = svg.querySelectorAll('.oc-mark-rect :is(rect, path)');
    expect(shapes.length).toBe(3);
  });

  it('column marks have varying heights (vertical orientation)', () => {
    const { svg } = renderSpec(columnSpec);
    const heights = rectMarkGeometries(svg).map((g) => g.height);
    // Different revenue values should produce different heights
    const uniqueHeights = new Set(heights);
    expect(uniqueHeights.size).toBeGreaterThan(1);
    // All heights should be positive
    for (const h of heights) {
      expect(h).toBeGreaterThan(0);
    }
  });

  it('column marks have positive width', () => {
    const { svg } = renderSpec(columnSpec);
    for (const geom of rectMarkGeometries(svg)) {
      expect(geom.width).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Scatter chart marks
// ---------------------------------------------------------------------------

describe('scatter chart SVG rendering', () => {
  it('renders <circle> elements for each data point', () => {
    const { svg } = renderSpec(scatterSpec);
    const circles = svg.querySelectorAll('.oc-mark-point');
    // scatterSpec has 4 data points
    expect(circles.length).toBe(4);
  });

  it('circles have valid cx, cy, and r attributes', () => {
    const { svg } = renderSpec(scatterSpec);
    const circles = svg.querySelectorAll('.oc-mark-point');
    for (const circle of circles) {
      const cx = Number(circle.getAttribute('cx'));
      const cy = Number(circle.getAttribute('cy'));
      const r = Number(circle.getAttribute('r'));
      expect(cx).toBeTypeOf('number');
      expect(cy).toBeTypeOf('number');
      expect(r).toBeGreaterThan(0);
      // cx and cy should be within the SVG dimensions
      expect(cx).toBeGreaterThanOrEqual(0);
      expect(cy).toBeGreaterThanOrEqual(0);
    }
  });

  it('scatter marks have data-mark-id attributes', () => {
    const { svg } = renderSpec(scatterSpec);
    const circles = svg.querySelectorAll('.oc-mark-point');
    for (const circle of circles) {
      const markId = circle.getAttribute('data-mark-id');
      expect(markId).not.toBeNull();
      expect(markId).toMatch(/^point-/);
    }
  });
});

// ---------------------------------------------------------------------------
// Pie chart marks
// ---------------------------------------------------------------------------

describe('pie chart SVG rendering', () => {
  it('renders <path> arc segments for each slice', () => {
    const { svg } = renderSpec(pieSpec);
    const arcGroups = svg.querySelectorAll('.oc-mark-arc');
    // pieSpec has 3 categories
    expect(arcGroups.length).toBe(3);
  });

  it('arc paths have valid d attribute with arc commands', () => {
    const { svg } = renderSpec(pieSpec);
    const paths = svg.querySelectorAll('.oc-mark-arc path');
    for (const path of paths) {
      const d = path.getAttribute('d');
      expect(d).not.toBeNull();
      // Arc paths should contain A (arc) commands
      expect(d).toMatch(/[AaLl]/);
      expect(d!.length).toBeGreaterThan(5);
    }
  });

  it('arc groups are translated to the pie center', () => {
    const { svg } = renderSpec(pieSpec);
    const arcGroups = svg.querySelectorAll('.oc-mark-arc');
    for (const group of arcGroups) {
      const transform = group.getAttribute('transform');
      expect(transform).not.toBeNull();
      expect(transform).toMatch(/translate\(\d+/);
    }
  });

  it('arc marks have fill colors', () => {
    const { svg } = renderSpec(pieSpec);
    const paths = svg.querySelectorAll('.oc-mark-arc path');
    for (const path of paths) {
      const fill = path.getAttribute('fill');
      expect(fill).not.toBeNull();
      expect(fill).not.toBe('none');
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-series: correct grouping and distinct colors
// ---------------------------------------------------------------------------

describe('multi-series rendering', () => {
  it('multi-series line chart has distinct stroke colors per series', () => {
    const { svg } = renderSpec(lineSpec);
    const paths = svg.querySelectorAll('.oc-mark-line path');
    const strokes = new Set<string>();
    for (const path of paths) {
      const stroke = path.getAttribute('stroke');
      if (stroke) strokes.add(stroke);
    }
    // US and UK should have different colors
    expect(strokes.size).toBe(2);
  });

  it('multi-series scatter chart has distinct fill colors per group', () => {
    const { svg } = renderSpec(scatterSpec);
    const circles = svg.querySelectorAll('.oc-mark-point');
    const fills = new Set<string>();
    for (const circle of circles) {
      const fill = circle.getAttribute('fill');
      if (fill) fills.add(fill);
    }
    // group A and B should have different fill colors
    expect(fills.size).toBe(2);
  });

  it('multi-series bar chart renders data-series attributes on rect marks', () => {
    const { svg } = renderSpec(multiSeriesBarSpec);
    const marks = svg.querySelectorAll('.oc-mark-rect[data-series]');
    const seriesNames = new Set<string>();
    for (const mark of marks) {
      const s = mark.getAttribute('data-series');
      if (s) seriesNames.add(s);
    }
    // Should have marks with series info
    expect(seriesNames.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Chrome elements (title, subtitle, source)
// ---------------------------------------------------------------------------

describe('chart chrome rendering', () => {
  it('renders title text with correct content', () => {
    const { svg } = renderSpec(lineSpec);
    const title = svg.querySelector('.oc-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('GDP Growth');
  });

  it('renders subtitle text with correct content', () => {
    const { svg } = renderSpec(lineSpec);
    const subtitle = svg.querySelector('.oc-subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle!.textContent).toBe('US vs UK over time');
  });

  it('renders source text with correct content', () => {
    const { svg } = renderSpec(lineSpec);
    const source = svg.querySelector('.oc-source');
    expect(source).not.toBeNull();
    expect(source!.textContent).toBe('World Bank');
  });

  it('chrome elements are inside a .oc-chrome group', () => {
    const { svg } = renderSpec(lineSpec);
    const chromeGroup = svg.querySelector('.oc-chrome');
    expect(chromeGroup).not.toBeNull();
    expect(chromeGroup!.querySelector('.oc-title')).not.toBeNull();
  });

  it('title has font styling applied', () => {
    const { svg } = renderSpec(lineSpec);
    const title = svg.querySelector('.oc-title') as SVGElement & ElementCSSInlineStyle;
    expect(title).not.toBeNull();
    const fontFamily = title.style.getPropertyValue('font-family');
    const fontSize = title.style.getPropertyValue('font-size');
    expect(fontFamily).not.toBe('');
    expect(parseFloat(fontSize)).toBeGreaterThan(0);
  });

  it('wraps long title text into tspan elements at narrow widths', () => {
    const longTitleSpec: ChartSpec = {
      mark: 'bar',
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
      ],
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
      },
      chrome: {
        title: 'This is a very long chart title that should definitely wrap at narrow widths',
      },
    };
    // Render at a very narrow width to force wrapping
    const { svg } = renderSpec(longTitleSpec, { width: 250, height: 300 });
    const title = svg.querySelector('.oc-title');
    expect(title).not.toBeNull();
    const tspans = title!.querySelectorAll('tspan');
    expect(tspans.length).toBeGreaterThan(1);
    // Full text should be preserved across tspans
    const fullText = Array.from(tspans)
      .map((t) => t.textContent)
      .join(' ');
    expect(fullText).toBe(
      'This is a very long chart title that should definitely wrap at narrow widths',
    );
  });

  it('does not wrap short title text', () => {
    const { svg } = renderSpec(lineSpec);
    const title = svg.querySelector('.oc-title');
    expect(title).not.toBeNull();
    // Short title should have no tspan children, just direct textContent
    const tspans = title!.querySelectorAll('tspan');
    expect(tspans.length).toBe(0);
    expect(title!.textContent).toBe('GDP Growth');
  });

  it('splits subtitle on newline into multiple tspan lines', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
      ],
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
      },
      chrome: {
        title: 'Title',
        subtitle: 'Line one\nLine two',
      },
    };
    const { svg } = renderSpec(spec, { width: 600, height: 400 });
    const subtitle = svg.querySelector('.oc-subtitle');
    expect(subtitle).not.toBeNull();
    const tspans = subtitle!.querySelectorAll('tspan');
    // Should produce at least 2 tspans for the two lines
    expect(tspans.length).toBeGreaterThanOrEqual(2);
    const fullText = Array.from(tspans)
      .map((t) => t.textContent)
      .join('\n');
    expect(fullText).toContain('Line one');
    expect(fullText).toContain('Line two');
  });

  it('handles short text with newline that would fit on one line without it', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
      ],
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
      },
      chrome: {
        title: 'Hi\nThere',
      },
    };
    // Wide enough that "Hi There" would fit on one line, but \n forces two
    const { svg } = renderSpec(spec, { width: 600, height: 400 });
    const title = svg.querySelector('.oc-title');
    expect(title).not.toBeNull();
    const tspans = title!.querySelectorAll('tspan');
    expect(tspans.length).toBe(2);
    expect(tspans[0].textContent).toBe('Hi');
    expect(tspans[1].textContent).toBe('There');
  });

  it('handles consecutive newlines producing empty line segments', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
      ],
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
      },
      chrome: {
        title: 'Above\n\nBelow',
      },
    };
    const { svg } = renderSpec(spec, { width: 600, height: 400 });
    const title = svg.querySelector('.oc-title');
    expect(title).not.toBeNull();
    const tspans = title!.querySelectorAll('tspan');
    // 3 segments: "Above", "", "Below"
    expect(tspans.length).toBe(3);
    expect(tspans[0].textContent).toBe('Above');
    expect(tspans[1].textContent).toBe('');
    expect(tspans[2].textContent).toBe('Below');
  });

  it('chart with no chrome specified renders no chrome text elements', () => {
    const noChrome: ChartSpec = {
      mark: 'bar',
      data: [{ name: 'A', value: 10 }],
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'name', type: 'nominal' },
      },
    };
    const { svg } = renderSpec(noChrome);
    const chromeGroup = svg.querySelector('.oc-chrome');
    expect(chromeGroup).not.toBeNull();
    // No title/subtitle/source should be in the chrome group
    expect(chromeGroup!.querySelector('.oc-title')).toBeNull();
    expect(chromeGroup!.querySelector('.oc-subtitle')).toBeNull();
    expect(chromeGroup!.querySelector('.oc-source')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Axes and tick labels
// ---------------------------------------------------------------------------

describe('axis rendering', () => {
  it('renders x-axis and y-axis groups', () => {
    const { svg } = renderSpec(lineSpec);
    const xAxis = svg.querySelector('.oc-axis-x');
    const yAxis = svg.querySelector('.oc-axis-y');
    expect(xAxis).not.toBeNull();
    expect(yAxis).not.toBeNull();
  });

  it('x-axis has tick labels as text elements', () => {
    const { svg } = renderSpec(lineSpec);
    const xAxis = svg.querySelector('.oc-axis-x');
    const labels = xAxis!.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
    // Each label should have text content
    for (const label of labels) {
      expect(label.textContent!.length).toBeGreaterThan(0);
    }
  });

  it('y-axis has tick labels as text elements', () => {
    const { svg } = renderSpec(barSpec);
    const yAxis = svg.querySelector('.oc-axis-y');
    const labels = yAxis!.querySelectorAll('text');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('x-axis has a baseline line element for grounded marks', () => {
    const { svg } = renderSpec(barSpec);
    const xAxis = svg.querySelector('.oc-axis-x');
    const line = xAxis!.querySelector('line');
    expect(line).not.toBeNull();
  });

  it('x-axis hides baseline for non-grounded marks', () => {
    const { svg } = renderSpec(lineSpec);
    const xAxis = svg.querySelector('.oc-axis-x');
    const line = xAxis!.querySelector('line');
    expect(line).toBeNull();
  });

  it('x-tick labels hang below the axis line by the label padding (no hugging)', () => {
    const { svg, layout } = renderSpec(barSpec);
    const xAxis = svg.querySelector('.oc-axis-x')!;
    const axisLineY = Number(xAxis.querySelector('line')!.getAttribute('y2'));
    const labels = Array.from(xAxis.querySelectorAll('text.oc-axis-tick'));
    expect(labels.length).toBeGreaterThan(0);

    const pad = layout.theme.spacing.xAxisLabelPadding;
    const fontSize = layout.axes.x.tickLabelStyle.fontSize;
    for (const label of labels) {
      // No dominant-baseline: the renderer positions the alphabetic baseline
      // directly (WebKit mishandles hanging). The label TOP still sits a full
      // padding gap below the axis line; the baseline is that top + ascent.
      expect(label.getAttribute('dominant-baseline')).toBeNull();
      expect(Number(label.getAttribute('y'))).toBeCloseTo(axisLineY + pad + fontSize * 0.8, 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Gridlines
// ---------------------------------------------------------------------------

describe('gridline rendering', () => {
  it('renders gridlines as line elements within axis groups', () => {
    const { svg } = renderSpec(lineSpec);
    // y-axis gridlines are horizontal lines
    const yAxis = svg.querySelector('.oc-axis-y');
    const gridlines = yAxis!.querySelectorAll('line');
    expect(gridlines.length).toBeGreaterThan(0);
  });

  it('gridlines have stroke-opacity for subtlety', () => {
    const { svg } = renderSpec(lineSpec);
    const yAxis = svg.querySelector('.oc-axis-y');
    const gridlines = yAxis!.querySelectorAll('line');
    for (const gl of gridlines) {
      const opacity = gl.getAttribute('stroke-opacity');
      if (opacity) {
        // Gridlines should be subtle (less than 1.0 opacity)
        expect(Number(opacity)).toBeLessThan(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

describe('legend rendering', () => {
  /** Legend is auto-suppressed for line charts with endpoint labels; force it on for these tests. */
  const lineSpecWithLegend = { ...lineSpec, legend: { show: true } };

  it('multi-series chart renders legend entries', () => {
    const { svg } = renderSpec(lineSpecWithLegend);
    const legend = svg.querySelector('.oc-legend');
    expect(legend).not.toBeNull();
    const entries = legend!.querySelectorAll('.oc-legend-entry');
    // lineSpec has US and UK series
    expect(entries.length).toBe(2);
  });

  it('legend entries have labels with series names', () => {
    const { svg } = renderSpec(lineSpecWithLegend);
    const entries = svg.querySelectorAll('.oc-legend-entry');
    const labels: string[] = [];
    for (const entry of entries) {
      const text = entry.querySelector('text');
      if (text?.textContent) labels.push(text.textContent);
    }
    expect(labels).toContain('US');
    expect(labels).toContain('UK');
  });

  it('legend entries have data-legend-label attribute', () => {
    const { svg } = renderSpec(lineSpecWithLegend);
    const entries = svg.querySelectorAll('.oc-legend-entry');
    for (const entry of entries) {
      expect(entry.getAttribute('data-legend-label')).not.toBeNull();
    }
  });

  it('legend has ARIA attributes for accessibility', () => {
    const { svg } = renderSpec(lineSpecWithLegend);
    const legend = svg.querySelector('.oc-legend');
    expect(legend!.getAttribute('role')).toBe('list');
    expect(legend!.getAttribute('aria-label')).toBe('Chart legend');
    const entries = legend!.querySelectorAll('.oc-legend-entry');
    for (const entry of entries) {
      expect(entry.getAttribute('role')).toBe('listitem');
    }
  });

  it('single-series chart has no legend entries', () => {
    const { svg } = renderSpec(singleSeriesLineSpec);
    const entries = svg.querySelectorAll('.oc-legend-entry');
    expect(entries.length).toBe(0);
  });

  it('pie chart omits the legend when slice labels name each slice', () => {
    // Leader-line labels already identify every slice, so a legend would just
    // restate them. See the arc redundancy rule in engine legend/compute.ts.
    const { svg } = renderSpec(pieSpec);
    const entries = svg.querySelectorAll('.oc-legend-entry');
    expect(entries.length).toBe(0);
  });

  it('pie chart renders legend entries when slice labels are off', () => {
    // No slice labels means the legend is the only thing naming the slices.
    const { svg } = renderSpec({ ...pieSpec, labels: { density: 'none' } } as ChartSpec);
    const entries = svg.querySelectorAll('.oc-legend-entry');
    expect(entries.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// SVG root structure
// ---------------------------------------------------------------------------

describe('SVG root structure', () => {
  it('SVG has correct viewBox matching dimensions', () => {
    const { svg } = renderSpec(lineSpec);
    const viewBox = svg.getAttribute('viewBox');
    expect(viewBox).toBe('0 0 600 400');
  });

  it('SVG has accessibility role and aria-label', () => {
    const { svg } = renderSpec(lineSpec);
    expect(svg.getAttribute('role')).toBe('img');
    const ariaLabel = svg.getAttribute('aria-label');
    expect(ariaLabel).not.toBeNull();
    expect(ariaLabel!.length).toBeGreaterThan(0);
  });

  it('SVG has oc-chart class', () => {
    const { svg } = renderSpec(lineSpec);
    expect(svg.getAttribute('class')).toBe('oc-chart');
  });

  it('SVG has a background rect as first child', () => {
    const { svg } = renderSpec(lineSpec);
    const firstChild = svg.children[0];
    expect(firstChild.tagName.toLowerCase()).toBe('rect');
    expect(Number(firstChild.getAttribute('width'))).toBe(600);
    expect(Number(firstChild.getAttribute('height'))).toBe(400);
  });

  it('SVG has a defs element with clip path', () => {
    const { svg } = renderSpec(lineSpec);
    const defs = svg.querySelector('defs');
    expect(defs).not.toBeNull();
    const clipPath = defs!.querySelector('clipPath');
    expect(clipPath).not.toBeNull();
    expect(clipPath!.getAttribute('id')).toMatch(/^oc-clip-/);
  });

  it('marks group is clipped via clip-path attribute', () => {
    const { svg } = renderSpec(lineSpec);
    const clippedGroup = svg.querySelector('[clip-path]');
    expect(clippedGroup).not.toBeNull();
    expect(clippedGroup!.getAttribute('clip-path')).toMatch(/url\(#oc-clip-/);
  });
});

// ---------------------------------------------------------------------------
// Inline snapshot for a critical mark element
// ---------------------------------------------------------------------------

describe('targeted mark snapshots', () => {
  it('line mark group has expected structure', () => {
    const { svg } = renderSpec(singleSeriesLineSpec);
    const lineGroup = svg.querySelector('.oc-mark-line');
    expect(lineGroup).not.toBeNull();
    expect(lineGroup!.getAttribute('class')).toBe('oc-mark oc-mark-line');
    expect(lineGroup!.getAttribute('data-mark-id')).toMatch(/^line-/);

    const path = lineGroup!.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('fill')).toBe('none');
    expect(path!.getAttribute('stroke')).not.toBeNull();
    expect(Number(path!.getAttribute('stroke-width'))).toBeGreaterThan(0);
    expect(path!.getAttribute('d')).toMatch(/^M/);
  });

  it('rect mark group has expected structure', () => {
    const { svg } = renderSpec(barSpec);
    const rectGroup = svg.querySelector('.oc-mark-rect');
    expect(rectGroup).not.toBeNull();
    expect(rectGroup!.getAttribute('class')).toBe('oc-mark oc-mark-rect');
    expect(rectGroup!.getAttribute('data-mark-id')).toMatch(/^rect-/);

    const shape = rectMarkShape(rectGroup);
    expect(shape).not.toBeNull();
    const geom = rectMarkGeometry(rectGroup)!;
    expect(geom.width).toBeGreaterThan(0);
    expect(geom.height).toBeGreaterThan(0);
    expect(shape!.getAttribute('fill')).not.toBeNull();
  });

  it('point mark has expected attributes', () => {
    const { svg } = renderSpec(scatterSpec);
    const point = svg.querySelector('.oc-mark-point');
    expect(point).not.toBeNull();
    expect(point!.tagName.toLowerCase()).toBe('circle');
    expect(point!.getAttribute('class')).toBe('oc-mark oc-mark-point');
    expect(point!.getAttribute('data-mark-id')).toMatch(/^point-/);
    expect(Number(point!.getAttribute('r'))).toBeGreaterThan(0);
    expect(point!.getAttribute('fill')).not.toBeNull();
  });

  it('arc mark group has expected structure', () => {
    const { svg } = renderSpec(pieSpec);
    const arcGroup = svg.querySelector('.oc-mark-arc');
    expect(arcGroup).not.toBeNull();
    expect(arcGroup!.getAttribute('class')).toBe('oc-mark oc-mark-arc');
    expect(arcGroup!.getAttribute('data-mark-id')).toMatch(/^arc-/);
    expect(arcGroup!.getAttribute('transform')).toMatch(/translate\(/);

    const path = arcGroup!.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('fill')).not.toBeNull();
    expect(path!.getAttribute('d')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Brand watermark
// ---------------------------------------------------------------------------

describe('brand watermark', () => {
  it('renders "OpenData" as a single text element', () => {
    const { svg } = renderSpec(lineSpec);
    const brandLink = svg.querySelector('.oc-chrome-ref');
    expect(brandLink).not.toBeNull();
    const text = brandLink!.querySelector('text')!;
    expect(text.textContent).toBe('OpenData');
  });

  it('links to tryopendata.ai', () => {
    const { svg } = renderSpec(lineSpec);
    const links = svg.querySelectorAll('a[href="https://tryopendata.ai"]');
    expect(links.length).toBe(1);
  });

  it('is a direct child of SVG root', () => {
    const { svg } = renderSpec(lineSpec);
    const brandLink = svg.querySelector('.oc-chrome-ref');
    expect(brandLink!.parentElement).toBe(svg);
  });

  it('renders after chrome (in the footer row)', () => {
    const { svg } = renderSpec(lineSpec);
    const children = Array.from(svg.children);
    const chromeIdx = children.findIndex((el) => el.classList.contains('oc-chrome'));
    const brandIdx = children.findIndex((el) => el.classList.contains('oc-chrome-ref'));
    expect(brandIdx).toBeGreaterThan(chromeIdx);
  });

  it('skips watermark on very small charts', () => {
    const { svg } = renderSpec(lineSpec, { width: 100, height: 80 });
    const brandLink = svg.querySelector('.oc-chrome-ref');
    expect(brandLink).toBeNull();
  });

  it('does not render brand when layout.watermark is false', () => {
    const spec: ChartSpec = { ...lineSpec, watermark: false };
    const { svg } = renderSpec(spec);
    const brandLink = svg.querySelector('.oc-chrome-ref');
    expect(brandLink).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Y-axis title spacing (regression for the title overlapping the tick labels)
// ---------------------------------------------------------------------------

describe('left y-axis title spacing', () => {
  // Builds a chart with a left y-axis title and reads back the real geometry to
  // compute the horizontal clearance between the widest tick label's far (left)
  // edge and the rotated title's near (right) edge. A non-negative clearance
  // means they don't overlap; the bug was a negative one at large font sizes.
  const yTitleSpec = (axisTitleSize: number, values: number[]): ChartSpec => ({
    mark: { type: 'line' },
    data: values.map((v, i) => ({ year: String(2018 + i), pct: v })),
    encoding: {
      x: { field: 'year', type: 'ordinal' },
      y: {
        field: 'pct',
        type: 'quantitative',
        // Force gutter ticks: this suite measures title-vs-gutter-label
        // clearance, which only exists when tick labels sit in a left gutter.
        // Line charts default to inline ticks (rendered inside the plot), where
        // there is no gutter label to clear — that case is guarded separately by
        // the "inline y-axis title inside the container" test in the engine.
        axis: { title: 'Spring 2026 pass rate', format: '.0f%', tickPosition: 'gutter' },
      },
    },
    chrome: { title: 'Pass rate' },
    // The deck renders axis titles via theme.fonts.sizes.body; vary it to
    // reproduce the large-font overlap.
    theme: { fonts: { sizes: { body: axisTitleSize } } },
  });

  // Clearance = (widest tick label's left edge) - (title glyph's right edge).
  // Tick labels: text-anchor=end at x = area.x - 6, so left edge = anchorX - width.
  // Title: text-anchor=middle, rotated, center at the title's x attr; its glyph
  // box extends fontSize/2 toward the labels (the +x direction).
  const measureClearance = (axisTitleSize: number, values: number[]): number => {
    const container = createContainer(700, 450);
    const layout = compileChart(yTitleSpec(axisTitleSize, values), {
      width: 700,
      height: 450,
    });
    const svg = renderChartSVG(layout, container);

    const title = svg.querySelector('.oc-axis-title') as SVGTextElement | null;
    expect(title).not.toBeNull();
    const titleCenterX = Number(title!.getAttribute('x'));
    const titleNearEdge = titleCenterX + axisTitleSize / 2;

    const tickStyle = layout.axes.y!.tickLabelStyle;
    const tickAnchorX = layout.area.x - TICK_LABEL_OFFSET;
    let widestLeftEdge = tickAnchorX;
    for (const t of layout.axes.y!.ticks) {
      const w = estimateTextWidth(t.label, tickStyle.fontSize, tickStyle.fontWeight ?? 400);
      widestLeftEdge = Math.min(widestLeftEdge, tickAnchorX - w);
    }

    return widestLeftEdge - titleNearEdge;
  };

  const PASS_RATES = [38, 41, 46, 52, 49, 61]; // labels like "38%" ... "61%"
  // Require real breathing room, not just non-overlap. At the deck font size the
  // old code left only ~3.5px (glyphs visibly touching), which this floor rejects.
  const MIN_CLEARANCE = AXIS_TITLE_GAP - 1;

  it('keeps the title clear of the tick labels at the default font size', () => {
    expect(measureClearance(13, PASS_RATES)).toBeGreaterThanOrEqual(MIN_CLEARANCE);
  });

  it('keeps the title clear of the tick labels at a large (deck) font size', () => {
    // The slide deck uses body=21 for axis titles. Under the old fixed gap this
    // left only ~3.5px and the title glyphs touched the labels (the reported bug).
    expect(measureClearance(21, PASS_RATES)).toBeGreaterThanOrEqual(MIN_CLEARANCE);
  });

  it('does not lose clearance as the title font size grows', () => {
    // The original bug: clearance shrank ~1px per font-size point as the title's
    // half-glyph ate the fixed gap, so big titles overlapped (negative clearance
    // at body=36). Now the half-glyph is folded into the offset, so clearance
    // holds at ~AXIS_TITLE_GAP across the whole font range instead of collapsing.
    const sizes = [13, 18, 21, 28, 36];
    for (const s of sizes) {
      expect(measureClearance(s, PASS_RATES)).toBeGreaterThanOrEqual(MIN_CLEARANCE);
    }
  });
});

// ---------------------------------------------------------------------------
// Dual-axis (y2) mark rendering
// ---------------------------------------------------------------------------

describe('dual-axis mark rendering', () => {
  // Every pre-existing dual-axis assertion stops at engine layout (axes.y2
  // exists, title on the right). This one follows the pixels into the DOM: the
  // y2-scaled line must be RENDERED at the right-hand scale's positions, not
  // the left's.
  it("renders a yScale: 'y2' line at the right-hand scale's pixel positions", () => {
    const spec = {
      resolve: { scale: { y: 'independent' as const } },
      layer: [
        {
          mark: 'bar' as const,
          data: [
            { year: '2025', revenue: 10_000_000 },
            { year: '2026', revenue: 15_000_000 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'revenue', type: 'quantitative' as const },
          },
        },
        {
          mark: 'line' as const,
          data: [
            { year: '2025', enrollment: 30_000 },
            { year: '2026', enrollment: 40_000 },
          ],
          encoding: {
            x: { field: 'year', type: 'ordinal' as const },
            y: { field: 'enrollment', type: 'quantitative' as const },
          },
        },
      ],
    };

    const container = createContainer(600, 400);
    const layout = compileLayer(spec, COMPILE_OPTS);
    const svg = renderChartSVG(layout, container);

    const lineMark = layout.marks.find(
      (m): m is Extract<typeof m, { type: 'line' }> => m.type === 'line',
    );
    expect(lineMark).toBeDefined();
    expect(lineMark!.yScale).toBe('y2');

    // The rendered path starts at the layout's first point (the engine's y2
    // pixel position), proving the renderer did not re-derive geometry.
    const path = svg.querySelector('.oc-mark-line path') as SVGPathElement;
    expect(path).toBeTruthy();
    const d = path.getAttribute('d') ?? '';
    const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const [renderedX, renderedY] = nums;
    expect(renderedX).toBeCloseTo(lineMark!.points[0].x, 3);
    expect(renderedY).toBeCloseTo(lineMark!.points[0].y, 3);

    // And that position is the RIGHT scale's, not the left's: map the same
    // data value (30,000) through the left y-axis via linear interpolation of
    // its tick positions. On the revenue scale (domain to ~15M), 30k sits at
    // the very bottom; on the enrollment scale it sits mid-chart.
    const yTicks = layout.axes.y!.ticks;
    const [t0, t1] = [yTicks[0], yTicks[yTicks.length - 1]];
    const leftY =
      (t0.position as number) +
      ((30_000 - Number(t0.value)) / (Number(t1.value) - Number(t0.value))) *
        ((t1.position as number) - (t0.position as number));
    expect(Math.abs(renderedY - leftY)).toBeGreaterThan(20);
  });
});
