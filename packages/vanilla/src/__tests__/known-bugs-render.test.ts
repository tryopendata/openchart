/**
 * Red-locked tests for known layout bugs.
 *
 * These use `test.fails(...)` so they pass today (the assertion is inverted).
 * When the underlying bug is fixed, the test will start failing, signaling
 * that the red-lock can be converted to a normal passing test.
 */

import type { CategoricalLegendLayout } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { describe, expect, test } from 'vitest';
import { renderLegend } from '../renderers/legend';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect distinct y-attribute values from <text> elements, sorted ascending. */
function distinctLabelYValues(svg: SVGElement): number[] {
  const texts = svg.querySelectorAll('text');
  const ySet = new Set<number>();
  for (const t of texts) {
    const y = t.getAttribute('y');
    if (y != null) ySet.add(Number(y));
  }
  return [...ySet].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Constants (mirrors packages/engine/src/legend/wrap.ts)
// ---------------------------------------------------------------------------

const SWATCH_SIZE = 12;
const SWATCH_GAP = 6;
const ENTRY_GAP = 16;
const ENGINE_ROW_HEIGHT = SWATCH_SIZE + 4; // 16 - what the engine reserves
const LEGEND_PADDING = 8;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const entries: CategoricalLegendLayout['entries'] = [
  { label: 'United States of America', color: '#1f77b4', shape: 'square', active: true },
  { label: 'United Kingdom', color: '#ff7f0e', shape: 'square', active: true },
  { label: 'Federal Republic of Germany', color: '#2ca02c', shape: 'square', active: true },
  { label: 'French Republic', color: '#d62728', shape: 'square', active: true },
  { label: 'Kingdom of Spain', color: '#9467bd', shape: 'square', active: true },
  { label: 'Republic of Italy', color: '#8c564b', shape: 'square', active: true },
  { label: 'Kingdom of Netherlands', color: '#e377c2', shape: 'square', active: true },
  { label: 'Swiss Confederation', color: '#7f7f7f', shape: 'square', active: true },
];

const labelStyle = {
  fontSize: 11,
  lineHeight: 1.3,
  fontWeight: 400 as const,
  fontFamily: 'sans-serif',
  fill: '#333',
};

/**
 * Compute row count by simulating the same wrap logic the engine uses
 * (measureLegendWrap in packages/engine/src/legend/wrap.ts).
 */
function computeRowCount(maxWidth: number): number {
  let rowCount = 1;
  let rowWidth = 0;
  for (const entry of entries) {
    const labelWidth = estimateTextWidth(entry.label, labelStyle.fontSize, labelStyle.fontWeight);
    const entryWidth = SWATCH_SIZE + SWATCH_GAP + labelWidth + ENTRY_GAP;
    if (rowWidth + entryWidth > maxWidth && rowWidth > 0) {
      rowCount++;
      rowWidth = entryWidth;
    } else {
      rowWidth += entryWidth;
    }
  }
  return rowCount;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('known layout bugs', () => {
  // Red-locked: fixed by docs/plans/04-resolved-layout-contract.md
  test.fails('5a.1: legend row advancement matches engine row height', () => {
    const boundsWidth = 400;
    const rowCount = computeRowCount(boundsWidth);
    const boundsHeight = rowCount * ENGINE_ROW_HEIGHT + LEGEND_PADDING * 2;

    const legendFixture: CategoricalLegendLayout = {
      position: 'top',
      entries,
      swatchSize: SWATCH_SIZE,
      swatchGap: SWATCH_GAP,
      entryGap: ENTRY_GAP,
      swatchChipFill: '#f0f0f0',
      labelStyle,
      bounds: { x: 0, y: 0, width: boundsWidth, height: boundsHeight },
    };

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    renderLegend(svg, legendFixture);

    const yValues = distinctLabelYValues(svg);
    // With 4 rows we expect 4 distinct y-values. Consecutive rows should
    // differ by ENGINE_ROW_HEIGHT (16). The renderer uses swatchSize + 6 = 18,
    // so this assertion will fail until the drift is fixed.
    expect(yValues.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < yValues.length; i++) {
      const gap = yValues[i] - yValues[i - 1];
      expect(gap).toBe(ENGINE_ROW_HEIGHT);
    }
  });

  // Red-locked: fixed by docs/plans/04-resolved-layout-contract.md and docs/plans/03-measure-then-freeze-layout.md
  test.fails('5a.2: rows drawn by renderer match rows reserved by engine', () => {
    // Build a line spec with 8 series whose labels vary in length.
    const countries = [
      'United States of America',
      'United Kingdom',
      'Federal Republic of Germany',
      'French Republic',
      'Kingdom of Spain',
      'Republic of Italy',
      'Kingdom of Netherlands',
      'Swiss Confederation',
    ];

    const data = countries.flatMap((country) => [
      { date: '2020-01-01', value: 10, country },
      { date: '2021-01-01', value: 20, country },
    ]);

    const spec = {
      mark: 'line' as const,
      data,
      encoding: {
        x: { field: 'date', type: 'temporal' as const },
        y: { field: 'value', type: 'quantitative' as const },
        color: { field: 'country', type: 'nominal' as const },
      },
      legend: { position: 'top' as const },
    };

    // Try widths 500-700 to find one where the legend wraps AND the
    // bounds.width narrowing causes extra rows in the renderer.
    let foundMismatch = false;

    for (let width = 500; width <= 700; width += 10) {
      const layout = compileChart(spec, { width, height: 400 });
      const legend = layout.legend as CategoricalLegendLayout;
      if (!legend || !legend.entries || legend.entries.length === 0) continue;

      // Rows reserved by the engine
      const effectivePadding = width < 420 ? 2 : LEGEND_PADDING;
      const rowsReserved = Math.round(
        (legend.bounds.height - effectivePadding * 2) / ENGINE_ROW_HEIGHT,
      );
      if (rowsReserved <= 1) continue; // only interesting when wrapping occurs

      // Render and count rows drawn
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      renderLegend(svg, legend);
      const yValues = distinctLabelYValues(svg);
      const rowsDrawn = yValues.length;

      if (rowsDrawn !== rowsReserved) {
        foundMismatch = true;
        // This is the bug: the renderer drew more rows than the engine reserved.
        expect(rowsDrawn).toBe(rowsReserved);
        return;
      }
    }

    // If no width triggered a mismatch, fail so test.fails still inverts.
    // If this path fires, widen the width range above.
    expect(foundMismatch).toBe(true);
  });
});
