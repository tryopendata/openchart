import type {
  LayoutStrategy,
  PointMark,
  Rect,
  RectMark,
  RuleMarkLayout,
} from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';
import type { NormalizedChartSpec } from '../../../compiler/types';
import { computeScales } from '../../../layout/scales';
import { computeRangeMarks, resolveRangeOrientation } from '../compute';
import { computeRangeLabels, type RangeDotPair } from '../labels';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const chartArea: Rect = { x: 80, y: 20, width: 500, height: 300 };

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

const theme = resolveTheme();

const lifeExpectancy = [
  { country: 'Japan', y2000: 81.1, y2024: 87.9 },
  { country: 'USA', y2000: 79.5, y2024: 81.3 },
  { country: 'Brazil', y2000: 74.1, y2024: 80.3 },
];

/** Data with both increases and decreases for direction coloring. */
const mixedDirection = [
  { source: 'Coal', y2010: 45, y2024: 15 },
  { source: 'Gas', y2010: 24, y2024: 43 },
  { source: 'Wind', y2010: 2, y2024: 11 },
];

function makeHorizontalRangeSpec(
  overrides: Partial<NormalizedChartSpec> = {},
): NormalizedChartSpec {
  return {
    markType: 'range',
    markDef: { type: 'range' },
    data: [...lifeExpectancy],
    encoding: {
      y: { field: 'country', type: 'nominal' },
      x: { field: 'y2000', type: 'quantitative' },
      x2: { field: 'y2024' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
    ...overrides,
  } as NormalizedChartSpec;
}

function makeVerticalRangeSpec(): NormalizedChartSpec {
  return makeHorizontalRangeSpec({
    data: [
      { month: 'Jan', lo: 27, hi: 39 },
      { month: 'Jul', lo: 69, hi: 85 },
    ],
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'lo', type: 'quantitative' },
      y2: { field: 'hi' },
    },
  });
}

function marksFor(spec: NormalizedChartSpec) {
  const scales = computeScales(spec, chartArea, spec.data);
  return computeRangeMarks(spec, scales, chartArea, fullStrategy, theme);
}

// ---------------------------------------------------------------------------
// computeRangeMarks: dumbbell (default)
// ---------------------------------------------------------------------------

describe('computeRangeMarks', () => {
  describe('dumbbell style (default)', () => {
    it('emits a connector rule plus start/end dots per row', () => {
      const marks = marksFor(makeHorizontalRangeSpec());

      const rules = marks.filter((m): m is RuleMarkLayout => m.type === 'rule');
      const points = marks.filter((m): m is PointMark => m.type === 'point');
      expect(rules).toHaveLength(3);
      expect(points).toHaveLength(6);
    });

    it('positions dots at the start and end values on the x scale', () => {
      const spec = makeHorizontalRangeSpec();
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeRangeMarks(spec, scales, chartArea, fullStrategy, theme);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const japanStart = points.find((m) => m.key === 'Japan|start')!;
      const japanEnd = points.find((m) => m.key === 'Japan|end')!;

      // 2024 value is larger, so the end dot sits further right
      expect(japanEnd.cx).toBeGreaterThan(japanStart.cx);

      // Both dots share the band-center y
      expect(japanEnd.cy).toBe(japanStart.cy);

      // Connector spans exactly between the dots
      const connector = marks.find(
        (m): m is RuleMarkLayout => m.type === 'rule' && m.key === 'Japan|range',
      )!;
      expect(connector.x1).toBe(japanStart.cx);
      expect(connector.x2).toBe(japanEnd.cx);
    });

    it('mutes the start dot and puts the accent on the end dot', () => {
      const marks = marksFor(makeHorizontalRangeSpec());
      const points = marks.filter((m): m is PointMark => m.type === 'point');

      const start = points.find((m) => m.key === 'Japan|start')!;
      const end = points.find((m) => m.key === 'Japan|end')!;
      expect(start.fill).toBe(theme.colors.neutral[400]);
      expect(end.fill).not.toBe(theme.colors.neutral[400]);
    });

    it('draws the undirected connector from the neutral ramp at 0.6 stroke opacity', () => {
      const marks = marksFor(makeHorizontalRangeSpec());
      const connector = marks.find(
        (m): m is RuleMarkLayout => m.type === 'rule' && m.key === 'Japan|range',
      )!;
      expect(connector.stroke).toBe(theme.colors.neutral[400]);
      expect(connector.strokeOpacity).toBe(0.6);
    });

    it('skips rows with non-finite endpoint values', () => {
      const spec = makeHorizontalRangeSpec({
        data: [
          { country: 'Japan', y2000: 81.1, y2024: 87.9 },
          { country: 'Nowhere', y2000: null, y2024: 87 },
        ],
      });
      const marks = marksFor(spec);
      expect(marks.filter((m) => m.type === 'point')).toHaveLength(2);
    });

    it('colors connector and end dot by an explicit color encoding, keeping the start dot muted', () => {
      const spec = makeHorizontalRangeSpec({
        data: [
          { country: 'Japan', y2000: 81.1, y2024: 87.9, region: 'Asia' },
          { country: 'USA', y2000: 79.5, y2024: 81.3, region: 'Americas' },
        ],
        encoding: {
          y: { field: 'country', type: 'nominal' },
          x: { field: 'y2000', type: 'quantitative' },
          x2: { field: 'y2024' },
          color: { field: 'region', type: 'nominal' },
        },
      });
      const scales = computeScales(spec, chartArea, spec.data);
      const colorScale = scales.color!.scale as (v: string) => string;
      const marks = computeRangeMarks(spec, scales, chartArea, fullStrategy, theme);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      const japanEnd = points.find((m) => m.key === 'Japan|end')!;
      const japanStart = points.find((m) => m.key === 'Japan|start')!;
      const connector = marks.find(
        (m): m is RuleMarkLayout => m.type === 'rule' && m.key === 'Japan|range',
      )!;

      expect(japanEnd.fill).toBe(colorScale('Asia'));
      expect(connector.stroke).toBe(colorScale('Asia'));
      expect(japanStart.fill).toBe(theme.colors.neutral[400]);
      // A colored connector carries the series color at full strength: the
      // 0.6 softening is only for the neutral, undirected default.
      expect(connector.strokeOpacity).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Arrow style
  // -------------------------------------------------------------------------

  describe('arrow style', () => {
    it('emits shaft plus two arrowhead segments per row, no dots', () => {
      const spec = makeHorizontalRangeSpec({ markDef: { type: 'range', style: 'arrow' } });
      const marks = marksFor(spec);

      expect(marks.filter((m) => m.type === 'point')).toHaveLength(0);
      const rules = marks.filter((m): m is RuleMarkLayout => m.type === 'rule');
      expect(rules).toHaveLength(9); // 3 rows x (shaft + 2 head segments)
    });

    it('puts the arrowhead tip at the x2 end', () => {
      const spec = makeHorizontalRangeSpec({ markDef: { type: 'range', style: 'arrow' } });
      const marks = marksFor(spec);

      const shaft = marks.find(
        (m): m is RuleMarkLayout => m.type === 'rule' && m.key === 'Japan|range',
      )!;
      const headLeft = marks.find(
        (m): m is RuleMarkLayout => m.type === 'rule' && m.key === 'Japan|head-left',
      )!;
      const headRight = marks.find(
        (m): m is RuleMarkLayout => m.type === 'rule' && m.key === 'Japan|head-right',
      )!;

      // Both head segments converge on the shaft's end point
      expect(headLeft.x2).toBe(shaft.x2);
      expect(headLeft.y2).toBe(shaft.y2);
      expect(headRight.x2).toBe(shaft.x2);
      expect(headRight.y2).toBe(shaft.y2);

      // Head segments are decorative for screen readers (the shaft carries the label)
      expect(headLeft.aria.decorative).toBe(true);
      expect(headRight.aria.decorative).toBe(true);
    });

    it('colors increases positive and decreases negative with colorByDirection', () => {
      const spec = makeHorizontalRangeSpec({
        markDef: { type: 'range', style: 'arrow', colorByDirection: true },
        data: [...mixedDirection],
        encoding: {
          y: { field: 'source', type: 'nominal' },
          x: { field: 'y2010', type: 'quantitative' },
          x2: { field: 'y2024' },
        },
      });
      const marks = marksFor(spec);

      const coal = marks.find(
        (m): m is RuleMarkLayout => m.type === 'rule' && m.key === 'Coal|range',
      )!;
      const gas = marks.find(
        (m): m is RuleMarkLayout => m.type === 'rule' && m.key === 'Gas|range',
      )!;
      expect(coal.stroke).toBe(theme.colors.negative); // 45 -> 15
      expect(gas.stroke).toBe(theme.colors.positive); // 24 -> 43
    });

    it('lets a field-based color encoding win over colorByDirection', () => {
      const spec = makeHorizontalRangeSpec({
        markDef: { type: 'range', style: 'arrow', colorByDirection: true },
        data: [{ source: 'Coal', y2010: 45, y2024: 15, kind: 'fossil' }],
        encoding: {
          y: { field: 'source', type: 'nominal' },
          x: { field: 'y2010', type: 'quantitative' },
          x2: { field: 'y2024' },
          color: { field: 'kind', type: 'nominal' },
        },
      });
      const scales = computeScales(spec, chartArea, spec.data);
      const colorScale = scales.color!.scale as (v: string) => string;
      const marks = computeRangeMarks(spec, scales, chartArea, fullStrategy, theme);

      const shaft = marks.find(
        (m): m is RuleMarkLayout => m.type === 'rule' && m.key === 'Coal|range',
      )!;
      expect(shaft.stroke).toBe(colorScale('fossil'));
      expect(shaft.stroke).not.toBe(theme.colors.negative);
    });
  });

  // -------------------------------------------------------------------------
  // Bar style
  // -------------------------------------------------------------------------

  describe('bar style', () => {
    it('emits one floating rect per row spanning start to end', () => {
      const spec = makeHorizontalRangeSpec({ markDef: { type: 'range', style: 'bar' } });
      const scales = computeScales(spec, chartArea, spec.data);
      const marks = computeRangeMarks(spec, scales, chartArea, fullStrategy, theme);

      const rects = marks.filter((m): m is RectMark => m.type === 'rect');
      expect(rects).toHaveLength(3);
      expect(marks.filter((m) => m.type === 'point')).toHaveLength(0);
      expect(marks.filter((m) => m.type === 'rule')).toHaveLength(0);

      const japan = rects.find((m) => m.key === 'Japan')!;
      const xScale = scales.x!.scale as (v: number) => number;
      expect(japan.x).toBeCloseTo(Math.min(xScale(81.1), xScale(87.9)));
      expect(japan.width).toBeCloseTo(Math.abs(xScale(87.9) - xScale(81.1)));
    });
  });

  // -------------------------------------------------------------------------
  // Vertical orientation (y + y2, nominal x)
  // -------------------------------------------------------------------------

  describe('vertical orientation', () => {
    it('resolves orientation from the band scale axis', () => {
      const hSpec = makeHorizontalRangeSpec();
      const hScales = computeScales(hSpec, chartArea, hSpec.data);
      expect(resolveRangeOrientation(hScales)).toBe('horizontal');

      const vSpec = makeVerticalRangeSpec();
      const vScales = computeScales(vSpec, chartArea, vSpec.data);
      expect(resolveRangeOrientation(vScales)).toBe('vertical');
    });

    it('spans dots vertically at the band center x', () => {
      const spec = makeVerticalRangeSpec();
      const marks = marksFor(spec);

      const points = marks.filter((m): m is PointMark => m.type === 'point');
      expect(points).toHaveLength(4);

      const janStart = points.find((m) => m.key === 'Jan|start')!;
      const janEnd = points.find((m) => m.key === 'Jan|end')!;
      // Same band center on x; the higher value has a smaller (inverted) y
      expect(janEnd.cx).toBe(janStart.cx);
      expect(janEnd.cy).toBeLessThan(janStart.cy);
    });
  });
});

// ---------------------------------------------------------------------------
// computeRangeLabels
// ---------------------------------------------------------------------------

describe('computeRangeLabels', () => {
  function dotPairsFor(spec: NormalizedChartSpec): RangeDotPair[] {
    const marks = marksFor(spec);
    const dots = marks.filter((m): m is PointMark => m.type === 'point');
    const pairs: RangeDotPair[] = [];
    for (let i = 0; i + 1 < dots.length; i += 2) {
      pairs.push({ start: dots[i], end: dots[i + 1] });
    }
    return pairs;
  }

  it('produces two labels per pair with density all', () => {
    const pairs = dotPairsFor(makeHorizontalRangeSpec());
    const labels = computeRangeLabels(pairs, true, 'all', '', '', 'y2000', 'y2024');
    expect(labels).toHaveLength(6);
    expect(labels.every((l) => l.visible)).toBe(true);
  });

  it('places the lower-value label left of its dot and the higher right', () => {
    const pairs = dotPairsFor(makeHorizontalRangeSpec());
    const labels = computeRangeLabels(pairs, true, 'all', '', '', 'y2000', 'y2024');

    const startLabel = labels.find((l) => l.index === 0)!;
    const endLabel = labels.find((l) => l.index === 1)!;
    expect(startLabel.x).toBeLessThan(pairs[0].start.cx);
    expect(endLabel.x).toBeGreaterThan(pairs[0].end.cx);
  });

  it('returns nothing for density none', () => {
    const pairs = dotPairsFor(makeHorizontalRangeSpec());
    expect(computeRangeLabels(pairs, true, 'none', '', '', 'y2000', 'y2024')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// compileChart integration (spec in, layout out)
// ---------------------------------------------------------------------------

describe('compileChart with range marks', () => {
  const baseSpec = {
    mark: 'range' as const,
    data: [...lifeExpectancy],
    encoding: {
      y: { field: 'country', type: 'nominal' as const },
      x: { field: 'y2000', type: 'quantitative' as const },
      x2: { field: 'y2024' },
    },
  };

  it('renders horizontal dumbbells sorted by the end value', () => {
    const layout = compileChart(
      {
        ...baseSpec,
        encoding: {
          ...baseSpec.encoding,
          y: {
            field: 'country',
            type: 'nominal' as const,
            sort: { field: 'y2024', order: 'descending' as const },
          },
        },
      },
      { width: 600, height: 400 },
    );

    const points = layout.marks.filter((m): m is PointMark => m.type === 'point');
    expect(points).toHaveLength(6);

    // Descending sort by y2024 resolves to band domain [Japan, USA, Brazil].
    // Band domain[0] maps to the bottom of the inverted y range (same
    // convention horizontal bars follow), so Japan gets the largest cy.
    const japanEnd = points.find((m) => m.key === 'Japan|end')!;
    const usaEnd = points.find((m) => m.key === 'USA|end')!;
    const brazilEnd = points.find((m) => m.key === 'Brazil|end')!;
    expect(japanEnd.cy).toBeGreaterThan(usaEnd.cy);
    expect(usaEnd.cy).toBeGreaterThan(brazilEnd.cy);
  });

  it('produces tooltips with start, end, and signed delta on every range mark', () => {
    const layout = compileChart(baseSpec, { width: 600, height: 400 });

    const pointIndex = layout.marks.findIndex(
      (m) => m.type === 'point' && (m as PointMark).key === 'Japan|end',
    );
    expect(pointIndex).toBeGreaterThanOrEqual(0);

    const content = layout.tooltipDescriptors.get(`point-${pointIndex}`)!;
    expect(content).toBeDefined();
    expect(content.title).toBe('Japan');
    const labels = content.fields.map((f) => f.label);
    expect(labels).toEqual(['y2000', 'y2024', 'Change']);
    const delta = content.fields[2].value;
    expect(delta.startsWith('+')).toBe(true);

    // The connector rule shares the same tooltip content
    const ruleIndex = layout.marks.findIndex(
      (m) => m.type === 'rule' && (m as RuleMarkLayout).key === 'Japan|range',
    );
    expect(layout.tooltipDescriptors.get(`rule-${ruleIndex}`)).toBeDefined();
  });

  it('compiles the vertical form with y/y2 and nominal x', () => {
    const layout = compileChart(
      {
        mark: 'range',
        data: [
          { month: 'Jan', lo: 27, hi: 39 },
          { month: 'Jul', lo: 69, hi: 85 },
        ],
        encoding: {
          x: { field: 'month', type: 'nominal' },
          y: { field: 'lo', type: 'quantitative' },
          y2: { field: 'hi' },
        },
      },
      { width: 600, height: 400 },
    );

    const points = layout.marks.filter((m): m is PointMark => m.type === 'point');
    expect(points).toHaveLength(4);
    const julStart = points.find((m) => m.key === 'Jul|start')!;
    const julEnd = points.find((m) => m.key === 'Jul|end')!;
    expect(julEnd.cy).toBeLessThan(julStart.cy);
  });

  it('extends the quantitative domain to cover x2 values', () => {
    const layout = compileChart(baseSpec, { width: 600, height: 400 });

    // Japan's end dot (87.9, the data max, only present in the x2 field) must
    // sit inside the chart area, not clip past its right edge.
    const points = layout.marks.filter((m): m is PointMark => m.type === 'point');
    const japanEnd = points.find((m) => m.key === 'Japan|end')!;
    expect(japanEnd.cx).toBeLessThanOrEqual(layout.area.x + layout.area.width);
  });

  it('renders arrows with direction coloring end to end', () => {
    const layout = compileChart(
      {
        mark: { type: 'range', style: 'arrow', colorByDirection: true },
        data: [...mixedDirection],
        encoding: {
          y: { field: 'source', type: 'nominal' },
          x: { field: 'y2010', type: 'quantitative' },
          x2: { field: 'y2024' },
        },
      },
      { width: 600, height: 400 },
    );

    const rules = layout.marks.filter((m): m is RuleMarkLayout => m.type === 'rule');
    expect(rules).toHaveLength(9);
    const coal = rules.find((m) => m.key === 'Coal|range')!;
    const gas = rules.find((m) => m.key === 'Gas|range')!;
    expect(coal.stroke).not.toBe(gas.stroke);
  });

  it('rejects a horizontal range spec without x2, naming encoding.x2', () => {
    expect(() =>
      compileChart(
        {
          mark: 'range',
          data: [...lifeExpectancy],
          encoding: {
            y: { field: 'country', type: 'nominal' },
            x: { field: 'y2000', type: 'quantitative' },
          },
        },
        { width: 600, height: 400 },
      ),
    ).toThrow(/encoding\.x2/);
  });
});
