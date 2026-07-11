import { describe, expect, it } from 'vitest';
import type {
  Annotation,
  ChartSpec,
  GraphSpec,
  RangeAnnotation,
  TableSpec,
  VizSpec,
} from '../spec';
import {
  CHART_TYPES,
  isChartSpec,
  isGraphSpec,
  isRangeAnnotation,
  isRefLineAnnotation,
  isTableSpec,
  isTextAnnotation,
  MARK_TYPES,
} from '../spec';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeChartSpec(): ChartSpec {
  return {
    mark: 'line',
    data: [
      { date: '2020-01', value: 42 },
      { date: '2020-02', value: 45 },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
  };
}

function makeTableSpec(overrides?: Partial<TableSpec>): TableSpec {
  return {
    type: 'table',
    data: [
      { name: 'US', gdp: 21000 },
      { name: 'China', gdp: 14700 },
    ],
    columns: [
      { key: 'name', label: 'Country' },
      { key: 'gdp', label: 'GDP (B$)', format: ',.0f' },
    ],
    ...overrides,
  };
}

function makeGraphSpec(overrides?: Partial<GraphSpec>): GraphSpec {
  return {
    type: 'graph',
    nodes: [
      { id: 'a', label: 'Node A' },
      { id: 'b', label: 'Node B' },
    ],
    edges: [{ source: 'a', target: 'b', weight: 1 }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Spec type guard tests
// ---------------------------------------------------------------------------

describe('isChartSpec', () => {
  it('returns true for all mark types', () => {
    // isChartSpec is a runtime guard that only checks for the presence of `mark`.
    // Use `as ChartSpec` here since we're testing the guard, not encoding validity.
    for (const markType of MARK_TYPES) {
      const spec = { mark: markType, data: [], encoding: {} } as ChartSpec;
      expect(isChartSpec(spec)).toBe(true);
    }
  });

  it('returns false for table specs', () => {
    const spec: VizSpec = makeTableSpec();
    expect(isChartSpec(spec)).toBe(false);
  });

  it('returns false for graph specs', () => {
    const spec: VizSpec = makeGraphSpec();
    expect(isChartSpec(spec)).toBe(false);
  });
});

describe('isTableSpec', () => {
  it('returns true for table specs', () => {
    const spec: VizSpec = makeTableSpec();
    expect(isTableSpec(spec)).toBe(true);
  });

  it('returns false for chart specs', () => {
    const spec: VizSpec = makeChartSpec();
    expect(isTableSpec(spec)).toBe(false);
  });

  it('returns false for graph specs', () => {
    const spec: VizSpec = makeGraphSpec();
    expect(isTableSpec(spec)).toBe(false);
  });
});

describe('isGraphSpec', () => {
  it('returns true for graph specs', () => {
    const spec: VizSpec = makeGraphSpec();
    expect(isGraphSpec(spec)).toBe(true);
  });

  it('returns false for chart specs', () => {
    const spec: VizSpec = makeChartSpec();
    expect(isGraphSpec(spec)).toBe(false);
  });

  it('returns false for table specs', () => {
    const spec: VizSpec = makeTableSpec();
    expect(isGraphSpec(spec)).toBe(false);
  });
});

describe('type guard mutual exclusivity', () => {
  it('exactly one guard returns true for each spec type', () => {
    const specs: VizSpec[] = [makeChartSpec(), makeTableSpec(), makeGraphSpec()];

    for (const spec of specs) {
      const guards = [isChartSpec(spec), isTableSpec(spec), isGraphSpec(spec)];
      const trueCount = guards.filter(Boolean).length;
      expect(trueCount).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// MARK_TYPES constant tests
// ---------------------------------------------------------------------------

describe('MARK_TYPES', () => {
  it('contains all 12 mark types', () => {
    expect(MARK_TYPES.size).toBe(12);
  });

  it('contains expected types', () => {
    const expected = [
      'line',
      'area',
      'bar',
      'point',
      'circle',
      'arc',
      'text',
      'rule',
      'tick',
      'rect',
      'lollipop',
      'beeswarm',
    ];
    for (const t of expected) {
      expect(MARK_TYPES.has(t)).toBe(true);
    }
  });

  it('does not contain non-mark types', () => {
    expect(MARK_TYPES.has('table')).toBe(false);
    expect(MARK_TYPES.has('graph')).toBe(false);
    expect(MARK_TYPES.has('map')).toBe(false);
  });

  it('CHART_TYPES is an alias for MARK_TYPES', () => {
    expect(CHART_TYPES).toBe(MARK_TYPES);
  });
});

// ---------------------------------------------------------------------------
// Annotation type guard tests
// ---------------------------------------------------------------------------

describe('isTextAnnotation', () => {
  it('returns true for text annotations', () => {
    const annotation: Annotation = {
      type: 'text',
      x: '2020-06',
      y: 42,
      text: 'Peak value',
    };
    expect(isTextAnnotation(annotation)).toBe(true);
  });

  it('returns false for range annotations', () => {
    const annotation: Annotation = {
      type: 'range',
      x1: '2020-03',
      x2: '2020-09',
      label: 'Recession',
    };
    expect(isTextAnnotation(annotation)).toBe(false);
  });

  it('returns false for refline annotations', () => {
    const annotation: Annotation = {
      type: 'refline',
      y: 0,
      label: 'Zero',
    };
    expect(isTextAnnotation(annotation)).toBe(false);
  });
});

describe('isRangeAnnotation', () => {
  it('returns true for range annotations', () => {
    const annotation: Annotation = {
      type: 'range',
      x1: '2020-03',
      x2: '2020-09',
      fill: '#fee2e2',
    };
    expect(isRangeAnnotation(annotation)).toBe(true);
  });

  it('returns false for text annotations', () => {
    const annotation: Annotation = {
      type: 'text',
      x: 10,
      y: 20,
      text: 'Hello',
    };
    expect(isRangeAnnotation(annotation)).toBe(false);
  });
});

describe('isRefLineAnnotation', () => {
  it('returns true for refline annotations', () => {
    const annotation: Annotation = {
      type: 'refline',
      y: 0,
      label: 'Baseline',
      style: 'dashed',
    };
    expect(isRefLineAnnotation(annotation)).toBe(true);
  });

  it('returns false for text annotations', () => {
    const annotation: Annotation = {
      type: 'text',
      x: 10,
      y: 20,
      text: 'Hello',
    };
    expect(isRefLineAnnotation(annotation)).toBe(false);
  });

  it('returns false for range annotations', () => {
    const annotation: RangeAnnotation = {
      type: 'range',
      y1: 0,
      y2: 100,
    };
    expect(isRefLineAnnotation(annotation)).toBe(false);
  });
});

describe('annotation type guard mutual exclusivity', () => {
  it('exactly one annotation guard returns true for each annotation type', () => {
    const annotations: Annotation[] = [
      { type: 'text', x: 0, y: 0, text: 'test' },
      { type: 'range', x1: 0, x2: 10 },
      { type: 'refline', y: 0 },
    ];

    for (const annotation of annotations) {
      const guards = [
        isTextAnnotation(annotation),
        isRangeAnnotation(annotation),
        isRefLineAnnotation(annotation),
      ];
      const trueCount = guards.filter(Boolean).length;
      expect(trueCount).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Type-level tests (compile-time verification)
// ---------------------------------------------------------------------------

describe('type-level spec construction', () => {
  it('allows a fully featured chart spec', () => {
    const spec: ChartSpec = {
      mark: 'line',
      data: [{ date: '2020-01', value: 42, series: 'US' }],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: {
          field: 'value',
          type: 'quantitative',
          axis: { title: 'GDP Growth (%)' },
          scale: { zero: true, nice: true },
        },
        color: { field: 'series', type: 'nominal' },
      },
      chrome: {
        title: 'GDP Growth Rate',
        subtitle: { text: 'Quarterly, seasonally adjusted', style: { fontSize: 14 } },
        source: 'World Bank',
        byline: 'OpenData',
        footer: 'Last updated: Jan 2024',
      },
      annotations: [
        {
          type: 'range',
          x1: '2020-03',
          x2: '2020-09',
          label: 'COVID-19',
          fill: '#fee2e2',
        },
        {
          type: 'text',
          x: '2021-06',
          y: 45,
          text: 'Recovery begins',
        },
        {
          type: 'refline',
          y: 0,
          label: 'Zero growth',
          style: 'dashed',
        },
      ],
      responsive: true,
      theme: {
        colors: { categorical: ['#2563eb', '#dc2626'] },
        fonts: { family: 'Inter' },
      },
      darkMode: 'auto',
    };

    // If this compiles and type-checks, the types are correct.
    expect(spec.mark).toBe('line');
    expect(spec.data).toHaveLength(1);
    expect(spec.encoding.x?.field).toBe('date');
    expect(spec.annotations).toHaveLength(3);
  });

  it('allows a chart spec with mark object', () => {
    const spec: ChartSpec = {
      mark: { type: 'line', interpolate: 'step', point: true },
      data: [{ x: 1, y: 2 }],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    };

    expect(typeof spec.mark).toBe('object');
  });

  it('allows a table spec with column configs', () => {
    const spec: TableSpec = {
      type: 'table',
      data: [{ country: 'US', gdp: 21000, trend: [20000, 20500, 21000] }],
      columns: [
        { key: 'country', label: 'Country', sortable: true },
        { key: 'gdp', label: 'GDP (B$)', format: ',.0f', align: 'right' },
        {
          key: 'trend',
          label: 'Trend',
          sparkline: { type: 'line', valuesField: 'trend', color: '#2563eb' },
        },
      ],
      chrome: { title: 'GDP by Country' },
      search: true,
      pagination: { pageSize: 25 },
      stickyFirstColumn: true,
      compact: false,
      darkMode: 'off',
    };

    expect(spec.type).toBe('table');
    expect(spec.columns).toHaveLength(3);
    expect(spec.search).toBe(true);
  });

  it('allows a graph spec with encoding and layout', () => {
    const spec: GraphSpec = {
      type: 'graph',
      nodes: [
        { id: 'a', name: 'Alice', dept: 'Engineering' },
        { id: 'b', name: 'Bob', dept: 'Design' },
      ],
      edges: [{ source: 'a', target: 'b', weight: 5, type: 'collaboration' }],
      encoding: {
        nodeColor: { field: 'dept', type: 'nominal' },
        nodeLabel: { field: 'name' },
        edgeWidth: { field: 'weight', type: 'quantitative' },
      },
      layout: {
        type: 'force',
        clustering: { field: 'dept' },
        chargeStrength: -100,
        linkDistance: 50,
      },
      chrome: {
        title: 'Team Collaboration Network',
        source: 'HR Data',
      },
      darkMode: 'auto',
    };

    expect(spec.type).toBe('graph');
    expect(spec.nodes).toHaveLength(2);
    expect(spec.edges).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative type tests (compile-time rejection verification)
//
// Each variable below is annotated with @ts-expect-error on the line that
// should be rejected. If any @ts-expect-error becomes "unused" (no error),
// TypeScript will fail the build — meaning the type guarantee regressed.
// ---------------------------------------------------------------------------

describe('type-level rejection', () => {
  it('compiles with @ts-expect-error annotations intact (runtime no-op)', () => {
    // Arc requires y + color. Missing color must error.
    const _arcMissingColor: ChartSpec = {
      mark: 'arc',
      data: [],
      // @ts-expect-error ArcEncoding requires color channel
      encoding: {
        y: { field: 'value', type: 'quantitative' },
      },
    };

    // Text mark requires text channel. Missing text must error.
    const _textMissingText: ChartSpec = {
      mark: 'text',
      data: [],
      // @ts-expect-error TextEncoding requires text channel
      encoding: {},
    };

    // Typed spec: field typo must error when TData is provided.
    type SalesRow = { date: string; revenue: number };
    const _typoField: ChartSpec<SalesRow> = {
      mark: 'line',
      data: [],
      encoding: {
        // @ts-expect-error 'dat' is not a key of SalesRow — did you mean 'date'?
        x: { field: 'dat', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    // Valid typed spec must compile without errors.
    const _validTyped: ChartSpec<SalesRow> = {
      mark: 'line',
      data: [{ date: '2024-01', revenue: 100 }],
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'revenue', type: 'quantitative' },
      },
    };

    // Arc without theta must compile (theta is optional per MARK_ENCODING_RULES).
    const _arcNoTheta: ChartSpec = {
      mark: 'arc',
      data: [],
      encoding: {
        y: { field: 'value', type: 'quantitative' },
        color: { field: 'category', type: 'nominal' },
      },
    };

    // Untyped spec (no TData param) must compile — no migration cost.
    const _untypedSpec: ChartSpec = {
      mark: 'line',
      data: [],
      encoding: {
        x: { field: 'anything', type: 'temporal' },
        y: { field: 'anything', type: 'quantitative' },
      },
    };

    void _arcMissingColor;
    void _textMissingText;
    void _typoField;
    void _validTyped;
    void _arcNoTheta;
    void _untypedSpec;
    expect(true).toBe(true);
  });
});
