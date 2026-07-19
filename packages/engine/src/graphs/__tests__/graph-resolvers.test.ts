/**
 * Phase 2 engine-resolution tests: graph animation/interaction resolvers,
 * categorical domain ordering, nodeSize/nodeOpacity encoding, energy/settle
 * presets, seed, edge legend, and initialHighlight capture.
 */

import type {
  GraphEdge,
  GraphEncoding,
  GraphNode,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it, vi } from 'vitest';
import { resolveGraphAnimation } from '../animation';
import { compileGraph } from '../compile-graph';
import { resolveCategoricalDomain, resolveNodeVisuals } from '../encoding';
import { resolveGraphInteraction } from '../interaction';

const theme: ResolvedTheme = resolveTheme({});
const compileOptions = { width: 600, height: 400 };

describe('resolveGraphAnimation', () => {
  it('returns full defaults when omitted (default-ON)', () => {
    const r = resolveGraphAnimation(undefined);
    expect(r).toBeDefined();
    expect(r?.enter).toEqual({ duration: 600, ease: 'smooth', stagger: true, cameraFit: true });
    expect(r?.update).toEqual({ duration: 300, ease: 'smooth' });
    expect(r?.exit).toEqual({ duration: 300, ease: 'smooth' });
    expect(r?.camera).toEqual({ duration: 'auto', ease: 'smooth' });
    expect(r?.hover).toEqual({ duration: 150, ease: 'smooth' });
  });

  it('returns undefined for false (no choreography)', () => {
    expect(resolveGraphAnimation(false)).toBeUndefined();
  });

  it('returns full defaults for true', () => {
    expect(resolveGraphAnimation(true)?.enter?.duration).toBe(600);
  });

  it('disables just the named phase when set false', () => {
    const r = resolveGraphAnimation({ hover: false, camera: false });
    expect(r?.hover).toBeNull();
    expect(r?.camera).toBeNull();
    expect(r?.enter).not.toBeNull();
  });

  it('merges partial phase config onto defaults', () => {
    const r = resolveGraphAnimation({ enter: { duration: 1000 } });
    expect(r?.enter).toEqual({ duration: 1000, ease: 'smooth', stagger: true, cameraFit: true });
  });
});

describe('resolveGraphInteraction', () => {
  it('defaults to neighbors / 0.15 / no fly / no physics', () => {
    expect(resolveGraphInteraction(undefined)).toEqual({
      hoverMode: 'neighbors',
      dimOpacity: 0.15,
      selectFlyTo: false,
      cursorRepulsion: null,
      springyDrag: false,
    });
  });

  it('resolves cursorRepulsion: true to defaults', () => {
    expect(resolveGraphInteraction({ cursorRepulsion: true }).cursorRepulsion).toEqual({
      radius: 80,
      strength: 30,
    });
  });

  it('merges cursorRepulsion object', () => {
    expect(resolveGraphInteraction({ cursorRepulsion: { radius: 120 } }).cursorRepulsion).toEqual({
      radius: 120,
      strength: 30,
    });
  });

  it('threads hover mode / dimOpacity / select / springy', () => {
    const r = resolveGraphInteraction({
      hover: { mode: 'category', dimOpacity: 0.3 },
      select: { flyTo: true },
      springyDrag: true,
    });
    expect(r.hoverMode).toBe('category');
    expect(r.dimOpacity).toBe(0.3);
    expect(r.selectFlyTo).toBe(true);
    expect(r.springyDrag).toBe(true);
  });
});

describe('resolveCategoricalDomain', () => {
  const values = ['B', 'A', 'C', 'A', 'B'];

  it('defaults to ascending', () => {
    expect(resolveCategoricalDomain(values, 'ascending')).toEqual(['A', 'B', 'C']);
  });

  it('descending reverses', () => {
    expect(resolveCategoricalDomain(values, 'descending')).toEqual(['C', 'B', 'A']);
  });

  it('null keeps data (first-seen) order', () => {
    expect(resolveCategoricalDomain(values, null)).toEqual(['B', 'A', 'C']);
  });

  it('string[] pins order, appending unknowns', () => {
    expect(resolveCategoricalDomain(values, ['C', 'A'])).toEqual(['C', 'A', 'B']);
  });

  it('scale.domain wins over sort', () => {
    expect(resolveCategoricalDomain(values, 'ascending', ['Z', 'Y'])).toEqual(['Z', 'Y']);
  });
});

describe('nodeSize encoding', () => {
  const nodes: GraphNode[] = [
    { id: 'a', v: 0 },
    { id: 'b', v: 100 },
  ];
  const edges: GraphEdge[] = [{ source: 'a', target: 'b' }];

  it('honors scale.range for the radius extent', () => {
    const enc: GraphEncoding = {
      nodeSize: { field: 'v', type: 'quantitative', scale: { range: [3, 14] } },
    };
    const out = resolveNodeVisuals(nodes, enc, edges, theme);
    expect(Math.max(...out.map((n) => n.radius))).toBeCloseTo(14, 5);
    expect(Math.min(...out.map((n) => n.radius))).toBeCloseTo(3, 5);
  });

  it('scale.type linear ramps the midpoint linearly (unlike sqrt)', () => {
    const mid: GraphNode[] = [
      { id: 'a', v: 0 },
      { id: 'm', v: 50 },
      { id: 'b', v: 100 },
    ];
    const linear = resolveNodeVisuals(
      mid,
      { nodeSize: { field: 'v', type: 'quantitative', scale: { type: 'linear', range: [3, 14] } } },
      edges,
      theme,
    );
    const mLinear = linear.find((n) => n.id === 'm')?.radius as number;
    expect(mLinear).toBeCloseTo(8.5, 5);
  });
});

describe('nodeOpacity encoding', () => {
  it('maps quantitative field to [0.25, 1] by default', () => {
    const nodes: GraphNode[] = [
      { id: 'a', w: 0 },
      { id: 'b', w: 100 },
    ];
    const out = resolveNodeVisuals(
      nodes,
      { nodeOpacity: { field: 'w', type: 'quantitative' } },
      [{ source: 'a', target: 'b' }],
      theme,
    );
    expect(out.find((n) => n.id === 'a')?.opacity).toBeCloseTo(0.25, 5);
    expect(out.find((n) => n.id === 'b')?.opacity).toBeCloseTo(1, 5);
  });

  it('defaults opacity to 1 when no encoding', () => {
    const out = resolveNodeVisuals([{ id: 'a' }], {}, [], theme);
    expect(out[0].opacity).toBe(1);
  });
});

describe('edge legend + sort', () => {
  it('builds an edge legend for nominal edgeColor with >1 category, sort-ordered', () => {
    const spec = {
      type: 'graph' as const,
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { source: 'a', target: 'b', rel: 'cite' },
        { source: 'b', target: 'c', rel: 'author' },
      ],
      encoding: { edgeColor: { field: 'rel', type: 'nominal' as const } },
    };
    const result = compileGraph(spec, compileOptions);
    expect(result.edgeLegend).toBeDefined();
    expect(result.edgeLegend?.map((e) => e.label)).toEqual(['author', 'cite']);
    expect(result.edgeLegend?.[0].shape).toBe('line');
    expect(result.edgeLegend?.[0].count).toBe(1);
  });

  it('validates a field present only on a later edge (full-union)', () => {
    const spec = {
      type: 'graph' as const,
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
        { source: 'c', target: 'd', kind: 'sparse' },
      ],
      encoding: { edgeColor: { field: 'kind', type: 'nominal' as const } },
    };
    expect(() => compileGraph(spec, compileOptions)).not.toThrow();
  });
});

describe('layout presets + seed + highlight', () => {
  const base = {
    type: 'graph' as const,
    nodes: [
      { id: 'a', g: 'X' },
      { id: 'b', g: 'Y' },
    ],
    edges: [{ source: 'a', target: 'b' }],
  };

  it('energy energetic sets chargeStrength -600 unless raw set', () => {
    const r = compileGraph(
      { ...base, layout: { type: 'force', energy: 'energetic' } },
      compileOptions,
    );
    expect(r.simulationConfig.chargeStrength).toBe(-600);
    expect(r.simulationConfig.velocityDecay).toBe(0.3);
  });

  it('raw chargeStrength wins over the energy preset', () => {
    const r = compileGraph(
      { ...base, layout: { type: 'force', energy: 'energetic', chargeStrength: -42 } },
      compileOptions,
    );
    expect(r.simulationConfig.chargeStrength).toBe(-42);
  });

  it('settle thorough sets alphaDecay 0.01', () => {
    const r = compileGraph(
      { ...base, layout: { type: 'force', settle: 'thorough' } },
      compileOptions,
    );
    expect(r.simulationConfig.alphaDecay).toBe(0.01);
  });

  it('seed lands in simulationConfig', () => {
    const r = compileGraph({ ...base, layout: { type: 'force', seed: 7 } }, compileOptions);
    expect(r.simulationConfig.seed).toBe(7);
  });

  it('warmup: true resolves to 100 ticks with a 250ms budget', () => {
    const r = compileGraph({ ...base, layout: { type: 'force', warmup: true } }, compileOptions);
    expect(r.simulationConfig.warmupTicks).toBe(100);
    expect(r.simulationConfig.warmupBudgetMs).toBe(250);
  });

  it('warmup defaults ON when omitted (100 ticks)', () => {
    const r = compileGraph(base, compileOptions);
    expect(r.simulationConfig.warmupTicks).toBe(100);
    expect(r.simulationConfig.warmupBudgetMs).toBe(250);
  });

  it('warmup: false disables warmup', () => {
    const r = compileGraph({ ...base, layout: { type: 'force', warmup: false } }, compileOptions);
    expect(r.simulationConfig.warmupTicks).toBe(0);
  });

  it('captures nodeColor.highlight into initialHighlight against the resolved domain', () => {
    const r = compileGraph(
      { ...base, encoding: { nodeColor: { field: 'g', type: 'nominal', highlight: ['X'] } } },
      compileOptions,
    );
    expect(r.initialHighlight).toEqual({ field: 'g', values: ['X'] });
    expect(r.legendField).toBe('g');
  });

  it('resolves animation (default-ON) and interaction on the compilation', () => {
    const r = compileGraph(base, compileOptions);
    expect(r.animation?.enter?.duration).toBe(600);
    expect(r.interaction.hoverMode).toBe('neighbors');
  });

  it('animation false yields undefined animation', () => {
    const r = compileGraph({ ...base, animation: false }, compileOptions);
    expect(r.animation).toBeUndefined();
  });

  it('warns (not errors) on sort over a quantitative color field', () => {
    const onWarn = vi.fn();
    compileGraph(
      {
        type: 'graph' as const,
        nodes: [
          { id: 'a', score: 1 },
          { id: 'b', score: 2 },
        ],
        edges: [{ source: 'a', target: 'b' }],
        encoding: { nodeColor: { field: 'score', type: 'quantitative', sort: 'ascending' } },
      },
      { ...compileOptions, onWarn },
    );
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('sort is ignored'));
  });
});
