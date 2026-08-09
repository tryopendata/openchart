import type {
  ChartSpec,
  GeoMapSpec,
  GraphSpec,
  LayerSpec,
  RangeAnnotation,
  RefLineAnnotation,
  SankeySpec,
  TableSpec,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedGeoMapSpec } from '../../geo/types';
import type { NormalizedSankeySpec } from '../../sankey/types';
import { normalizeSpec } from '../normalize';
import type { NormalizedChartSpec, NormalizedGraphSpec, NormalizedTableSpec } from '../types';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const lineSpec: ChartSpec = {
  mark: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 20, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'GDP Growth',
    subtitle: { text: 'Over time', style: { fontSize: 16 } },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('normalizeSpec', () => {
  describe('chart spec normalization', () => {
    it('fills default values for optionals', () => {
      const warnings: string[] = [];
      const result = normalizeSpec(lineSpec, warnings) as NormalizedChartSpec;

      expect(result.responsive).toBe(true);
      expect(result.darkMode).toBe('off');
      expect(result.annotations).toEqual([]);
      expect(result.theme).toEqual({});
      expect(result.labels).toEqual({
        density: 'auto',
        format: '',
        prefix: '',
        offsets: undefined,
      });
    });

    it('watermark defaults to true when not specified', () => {
      const result = normalizeSpec(lineSpec) as NormalizedChartSpec;
      expect(result.watermark).toBe(true);
    });

    it('watermark respects explicit false', () => {
      const spec: ChartSpec = { ...lineSpec, watermark: false };
      const result = normalizeSpec(spec) as NormalizedChartSpec;
      expect(result.watermark).toBe(false);
    });

    it('preserves explicit values', () => {
      const spec: ChartSpec = {
        ...lineSpec,
        responsive: false,
        darkMode: 'force',
      };
      const result = normalizeSpec(spec) as NormalizedChartSpec;

      expect(result.responsive).toBe(false);
      expect(result.darkMode).toBe('force');
    });

    it('normalizes chrome strings to ChromeText objects', () => {
      const result = normalizeSpec(lineSpec) as NormalizedChartSpec;

      // Plain string becomes ChromeText
      expect(result.chrome.title).toEqual({ text: 'GDP Growth' });
      // ChromeText with style is preserved
      expect(result.chrome.subtitle).toEqual({
        text: 'Over time',
        style: { fontSize: 16 },
      });
      // Undefined fields stay undefined
      expect(result.chrome.source).toBeUndefined();
    });

    it('infers encoding types from data when not specified', () => {
      const warnings: string[] = [];
      const spec: ChartSpec = {
        mark: 'point',
        data: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
        encoding: {
          // No type specified, should be inferred as quantitative
          x: { field: 'x', type: 'quantitative' },
          // biome-ignore lint/suspicious/noExplicitAny: intentionally omitting `type` to test inference
          y: { field: 'y' } as any,
        },
      };

      const result = normalizeSpec(spec, warnings) as NormalizedChartSpec;
      expect(result.encoding.y?.type).toBe('quantitative');
      expect(warnings.some((w) => w.includes('Inferred'))).toBe(true);
    });

    it('infers temporal type from date strings', () => {
      const warnings: string[] = [];
      const spec: ChartSpec = {
        mark: 'line',
        data: [
          { date: '2020-01-01', value: 10 },
          { date: '2021-06-15', value: 20 },
        ],
        encoding: {
          // biome-ignore lint/suspicious/noExplicitAny: intentionally omitting `type` to test inference
          x: { field: 'date' } as any,
          y: { field: 'value', type: 'quantitative' },
        },
      };

      const result = normalizeSpec(spec, warnings) as NormalizedChartSpec;
      expect(result.encoding.x?.type).toBe('temporal');
    });

    it('warns on type mismatch (temporal declared as nominal)', () => {
      const warnings: string[] = [];
      const spec: ChartSpec = {
        mark: 'line',
        data: [
          { date: '2020-01-01', value: 10 },
          { date: '2021-06-15', value: 20 },
        ],
        encoding: {
          x: { field: 'date', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      };

      normalizeSpec(spec, warnings);
      expect(warnings.some((w) => w.includes('looks temporal but was declared as nominal'))).toBe(
        true,
      );
    });

    it('preserves explicit label config', () => {
      const spec: ChartSpec = {
        ...lineSpec,
        labels: { density: 'none', format: ',.0f' },
      };
      const result = normalizeSpec(spec) as NormalizedChartSpec;
      expect(result.labels).toEqual({
        density: 'none',
        format: ',.0f',
        prefix: '',
        offsets: undefined,
      });
    });

    it('fills partial label config with defaults', () => {
      const spec: ChartSpec = {
        ...lineSpec,
        labels: { density: 'endpoints' },
      };
      const result = normalizeSpec(spec) as NormalizedChartSpec;
      expect(result.labels).toEqual({
        density: 'endpoints',
        format: '',
        prefix: '',
        offsets: undefined,
      });
    });

    it('normalizes annotations with default styles', () => {
      const spec: ChartSpec = {
        ...lineSpec,
        annotations: [
          { type: 'refline', y: 15 },
          { type: 'text', x: '2020-01-01', y: 10, text: 'Start' },
          { type: 'range', y1: 10, y2: 20 },
        ],
      };

      const result = normalizeSpec(spec) as NormalizedChartSpec;
      const refline = result.annotations[0] as RefLineAnnotation;
      expect(refline.style).toBe('dashed');
      expect(refline.strokeWidth).toBe(1);

      // Normalize must NOT stamp typography onto text annotations. The
      // annotation layer owns fontSize (DEFAULT_ANNOTATION_FONT_SIZE) and
      // fontWeight (the lede rule, which promotes a subtitle-bearing primary
      // line to bold only when the author left the weight unset). Defaulting
      // them here makes `fontWeight` always defined, so the lede rule can
      // never fire and the size default can never apply.
      const text = result.annotations[1] as TextAnnotation;
      expect(text.fontSize).toBeUndefined();
      expect(text.fontWeight).toBeUndefined();
      expect(text.opacity).toBe(1);

      const range = result.annotations[2] as RangeAnnotation;
      expect(range.opacity).toBe(0.1);
    });

    it('preserves author-set annotation typography through normalization', () => {
      const spec: ChartSpec = {
        ...lineSpec,
        annotations: [
          { type: 'text', x: '2020-01-01', y: 10, text: 'Start', fontSize: 18, fontWeight: 300 },
        ],
      };

      const text = (normalizeSpec(spec) as NormalizedChartSpec).annotations[0] as TextAnnotation;
      expect(text.fontSize).toBe(18);
      expect(text.fontWeight).toBe(300);
    });
  });

  describe('table spec normalization', () => {
    it('fills default values', () => {
      const spec: TableSpec = {
        type: 'table',
        data: [{ name: 'Alice', age: 30 }],
        columns: [{ key: 'name' }, { key: 'age' }],
      };

      const result = normalizeSpec(spec) as NormalizedTableSpec;
      expect(result.search).toBe(false);
      expect(result.pagination).toBe(false);
      expect(result.stickyFirstColumn).toBe(false);
      expect(result.compact).toBe(false);
      expect(result.responsive).toBe(true);
      expect(result.darkMode).toBe('off');
    });

    it('watermark defaults to true when not specified', () => {
      const spec: TableSpec = {
        type: 'table',
        data: [{ name: 'Alice', age: 30 }],
        columns: [{ key: 'name' }, { key: 'age' }],
      };
      const result = normalizeSpec(spec) as NormalizedTableSpec;
      expect(result.watermark).toBe(true);
    });

    it('watermark respects explicit false', () => {
      const spec: TableSpec = {
        type: 'table',
        data: [{ name: 'Alice', age: 30 }],
        columns: [{ key: 'name' }, { key: 'age' }],
        watermark: false,
      };
      const result = normalizeSpec(spec) as NormalizedTableSpec;
      expect(result.watermark).toBe(false);
    });
  });

  describe('graph spec normalization', () => {
    it('fills default values', () => {
      const spec: GraphSpec = {
        type: 'graph',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ source: 'a', target: 'b' }],
      };

      const result = normalizeSpec(spec) as NormalizedGraphSpec;
      expect(result.encoding).toEqual({});
      // Only `type` is defaulted at normalize time; chargeStrength/linkDistance
      // now come from the energy preset in compileGraph (default 'balanced' =
      // -300), so normalize no longer injects them.
      expect(result.layout).toEqual({ type: 'force' });
      expect(result.annotations).toEqual([]);
      expect(result.darkMode).toBe('off');
    });

    it('watermark defaults to true when not specified', () => {
      const spec: GraphSpec = {
        type: 'graph',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ source: 'a', target: 'b' }],
      };
      const result = normalizeSpec(spec) as NormalizedGraphSpec;
      expect(result.watermark).toBe(true);
    });

    it('watermark respects explicit false', () => {
      const spec: GraphSpec = {
        type: 'graph',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ source: 'a', target: 'b' }],
        watermark: false,
      };
      const result = normalizeSpec(spec) as NormalizedGraphSpec;
      expect(result.watermark).toBe(false);
    });

    it('expands the seedNode string shorthand to the object form', () => {
      const spec: GraphSpec = {
        type: 'graph',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ source: 'a', target: 'b' }],
        seedNode: 'a',
      };
      const result = normalizeSpec(spec) as NormalizedGraphSpec;
      expect(result.seedNode).toEqual({ id: 'a' });
    });

    it('preserves the seedNode object form', () => {
      const spec: GraphSpec = {
        type: 'graph',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ source: 'a', target: 'b' }],
        seedNode: { id: 'b', style: { radius: 18 } },
      };
      const result = normalizeSpec(spec) as NormalizedGraphSpec;
      expect(result.seedNode).toEqual({ id: 'b', style: { radius: 18 } });
    });

    it('warns and drops a seedNode id that matches no node', () => {
      const spec: GraphSpec = {
        type: 'graph',
        nodes: [{ id: 'a' }, { id: 'b' }],
        edges: [{ source: 'a', target: 'b' }],
        seedNode: 'zzz',
      };
      const warnings: string[] = [];
      const result = normalizeSpec(spec, warnings) as NormalizedGraphSpec;
      expect(result.seedNode).toBeUndefined();
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('seedNode "zzz"');
    });
  });

  describe('sankey spec normalization', () => {
    const baseSankeySpec: SankeySpec = {
      type: 'sankey',
      data: [{ source: 'A', target: 'B', value: 10 }],
      encoding: {
        source: { field: 'source' },
        target: { field: 'target' },
        value: { field: 'value' },
      },
    };

    it('watermark defaults to true when not specified', () => {
      const result = normalizeSpec(baseSankeySpec) as NormalizedSankeySpec;
      expect(result.watermark).toBe(true);
    });

    it('watermark respects explicit false', () => {
      const spec: SankeySpec = { ...baseSankeySpec, watermark: false };
      const result = normalizeSpec(spec) as NormalizedSankeySpec;
      expect(result.watermark).toBe(false);
    });
  });

  describe('layer spec normalization', () => {
    const baseLeaf: ChartSpec = {
      mark: 'line',
      data: [{ x: 1, y: 2 }],
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    };

    it('watermark defaults to true for layer leaves', () => {
      const layerSpec: LayerSpec = { layer: [baseLeaf] };
      const result = normalizeSpec(layerSpec) as NormalizedChartSpec;
      expect(result.watermark).toBe(true);
    });

    it('layer-level watermark: false propagates to leaves', () => {
      const layerSpec: LayerSpec = { layer: [baseLeaf], watermark: false };
      const result = normalizeSpec(layerSpec) as NormalizedChartSpec;
      expect(result.watermark).toBe(false);
    });

    it('leaf-level watermark overrides layer-level', () => {
      const leaf: ChartSpec = { ...baseLeaf, watermark: true };
      const layerSpec: LayerSpec = { layer: [leaf], watermark: false };
      const result = normalizeSpec(layerSpec) as NormalizedChartSpec;
      // Leaf explicitly sets true, which should be preserved
      expect(result.watermark).toBe(true);
    });
  });

  describe('map spec normalization', () => {
    const mapSpec: GeoMapSpec = {
      type: 'map',
      geo: {
        features: {
          type: 'Topology',
          objects: { x: { type: 'GeometryCollection', geometries: [] } },
          arcs: [],
        },
      },
      data: [],
      encoding: {
        key: { field: 'id', type: 'nominal' },
        color: { field: 'value', type: 'quantitative' },
      },
    };

    it('adds focus: null when not specified', () => {
      const result = normalizeSpec(mapSpec) as NormalizedGeoMapSpec;
      expect(result.geo.focus).toBeNull();
    });

    it('preserves explicit focus value', () => {
      const specWithFocus: GeoMapSpec = {
        ...mapSpec,
        geo: { ...mapSpec.geo, focus: '36' },
      };
      const result = normalizeSpec(specWithFocus) as NormalizedGeoMapSpec;
      expect(result.geo.focus).toBe('36');
    });

    it('preserves focus: null (explicit clear)', () => {
      const specWithNull: GeoMapSpec = {
        ...mapSpec,
        geo: { ...mapSpec.geo, focus: null },
      };
      const result = normalizeSpec(specWithNull) as NormalizedGeoMapSpec;
      expect(result.geo.focus).toBeNull();
    });
  });
});
