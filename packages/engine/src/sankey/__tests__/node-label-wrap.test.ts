/**
 * Characterization test for sankey node-label wrapping at narrow widths.
 *
 * Part of refactor/v7-cohesion step 1. The sankey engine computes a label's
 * `maxWidth` based on available horizontal space from the label anchor to the
 * container edge (see computeNodeLabel in compile-sankey.ts around line 137).
 * When the container is narrow and node labels are long, the computed
 * `maxWidth` falls below the estimated text width — the adapter then wraps the
 * label into multiple lines via its own wrapText routine.
 *
 * Step 3 of the v7 plan extracts `wrapText` to core while keeping the sankey
 * path heuristic-only. This test guards the engine's responsibility: produce a
 * label `maxWidth` that forces wrapping on long-label narrow-width sankeys.
 */

import { estimateTextWidth, wrapText } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileSankey } from '../../compile';

describe('sankey node-label wrapping', () => {
  it('produces at least one node whose label maxWidth forces wrapping at narrow widths', () => {
    const spec = {
      type: 'sankey' as const,
      data: [
        {
          from: 'Renewable Energy Sources International',
          to: 'Grid Transmission Network',
          amount: 100,
        },
        { from: 'Grid Transmission Network', to: 'Residential Consumption Households', amount: 60 },
        { from: 'Grid Transmission Network', to: 'Commercial Industrial Facilities', amount: 40 },
      ],
      encoding: {
        source: { field: 'from', type: 'nominal' as const },
        target: { field: 'to', type: 'nominal' as const },
        value: { field: 'amount', type: 'quantitative' as const },
      },
    };

    // 300px wide total is cramped for the labels above across 3 columns,
    // forcing per-label maxWidth to be well below the longest text width.
    const layout = compileSankey(spec, { width: 300, height: 300 });

    // Every node should have a finite maxWidth set (a proxy for "engine
    // participated in wrap geometry") when overflow-compression kicked in.
    const withMaxWidth = layout.nodes.filter(
      (n) => typeof n.label.maxWidth === 'number' && (n.label.maxWidth as number) >= 0,
    );
    expect(withMaxWidth.length).toBe(layout.nodes.length);

    // At least one node label requires wrapping: its natural text width
    // exceeds the engine-assigned maxWidth at the same font size/weight.
    const wrapsRequired = withMaxWidth.filter((n) => {
      const tw = estimateTextWidth(
        n.label.text,
        n.label.style.fontSize,
        n.label.style.fontWeight ?? 400,
      );
      return tw > (n.label.maxWidth as number);
    });
    expect(wrapsRequired.length).toBeGreaterThanOrEqual(1);
  });

  it('does not force wrapping at generous widths for the same long-label spec', () => {
    // Control: the same spec at a comfortable width does not require wrapping.
    const spec = {
      type: 'sankey' as const,
      data: [
        {
          from: 'Renewable Energy Sources International',
          to: 'Grid Transmission Network',
          amount: 100,
        },
        { from: 'Grid Transmission Network', to: 'Residential Consumption Households', amount: 60 },
      ],
      encoding: {
        source: { field: 'from', type: 'nominal' as const },
        target: { field: 'to', type: 'nominal' as const },
        value: { field: 'amount', type: 'quantitative' as const },
      },
    };

    const layout = compileSankey(spec, { width: 1600, height: 300 });

    const wrapsRequired = layout.nodes.filter((n) => {
      if (typeof n.label.maxWidth !== 'number') return false;
      const tw = estimateTextWidth(
        n.label.text,
        n.label.style.fontSize,
        n.label.style.fontWeight ?? 400,
      );
      return tw > (n.label.maxWidth as number);
    });
    expect(wrapsRequired.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Pinned behavior (refactor/v7-cohesion code review item 1):
  // The shared wrapText in core/src/layout/text-wrap.ts splits on `\n` before
  // word-wrapping. The previous sankey-local wrapText did not. Pin the new
  // behavior so anyone relying on `\n` in node labels sees the multi-line break.
  // ---------------------------------------------------------------------------
  it('honors explicit `\\n` in node labels by producing multi-line wrap output', () => {
    const lines = wrapText('First line\nSecond line', 12, 400, 1000);

    expect(lines).toEqual(['First line', 'Second line']);
  });

  it('preserves blank lines between consecutive `\\n` characters', () => {
    const lines = wrapText('A\n\nB', 12, 400, 1000);

    expect(lines).toEqual(['A', '', 'B']);
  });
});
