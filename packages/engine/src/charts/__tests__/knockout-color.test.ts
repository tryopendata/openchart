/**
 * Knockout rings resolve from the *resolved theme background*, not a light
 * token or a literal white.
 *
 * The `terminal` preset carries its own near-black background in both modes,
 * so every mark that separates itself from its neighbours by drawing a ring in
 * the canvas color has to pick that background up. A hardcoded `#ffffff` shows
 * up as a bright halo grid on the preset's dark canvas.
 */

import { resolveTheme, terminal } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { resolveKnockoutColor } from '../utils';

const TERMINAL_BG = '#0b0f14';

const terminalTheme = resolveTheme(terminal);

const lineSpec = {
  animation: false,
  mark: { type: 'line', point: true },
  data: [
    { year: 2019, region: 'Euro area', rate: 1.2 },
    { year: 2020, region: 'Euro area', rate: 0.3 },
    { year: 2021, region: 'Euro area', rate: 2.6 },
    { year: 2019, region: 'United States', rate: 1.8 },
    { year: 2020, region: 'United States', rate: 1.2 },
    { year: 2021, region: 'United States', rate: 4.7 },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'rate', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
  },
};

describe('resolveKnockoutColor', () => {
  it('uses the resolved background when it is opaque', () => {
    expect(resolveKnockoutColor(terminalTheme)).toBe(TERMINAL_BG);
  });

  it('falls back to the mode surface when the background is not opaque', () => {
    expect(resolveKnockoutColor({ colors: { background: 'transparent' } })).toBe('#ffffff');
    expect(resolveKnockoutColor({ colors: { background: 'transparent' }, isDark: true })).toBe(
      '#18181b',
    );
  });
});

describe('terminal preset knockouts', () => {
  it('strokes line point dots with the preset background, not white', () => {
    const layout = compileChart(lineSpec, { width: 800, height: 400, theme: terminalTheme });
    const points = layout.marks.filter((m) => m.type === 'point');
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(p.stroke).toBe(TERMINAL_BG);
    }
  });

  it('fills the endpoint dot with the preset background, not white', () => {
    const layout = compileChart(lineSpec, { width: 800, height: 400, theme: terminalTheme });
    const markers = (layout.endpointLabels?.entries ?? [])
      .map((e) => e.marker)
      .filter((m) => m !== undefined);
    expect(markers.length).toBeGreaterThan(0);
    for (const m of markers) {
      expect(m.fill).toBe(TERMINAL_BG);
    }
  });

  it('seams pie slices with the preset background, not white', () => {
    const layout = compileChart(
      {
        animation: false,
        mark: { type: 'arc' },
        data: [
          { source: 'Wind', share: 24.1 },
          { source: 'Solar', share: 16.9 },
          { source: 'Nuclear', share: 22.8 },
        ],
        encoding: {
          theta: { field: 'share', type: 'quantitative' },
          color: { field: 'source', type: 'nominal' },
        },
      },
      { width: 600, height: 400, theme: terminalTheme },
    );
    const arcs = layout.marks.filter((m) => m.type === 'arc');
    expect(arcs.length).toBeGreaterThan(0);
    for (const a of arcs) {
      expect(a.stroke).toBe(TERMINAL_BG);
    }
  });

  it('strokes scatter dots with the preset background, not white', () => {
    const layout = compileChart(
      {
        animation: false,
        mark: { type: 'point' },
        data: [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
          { x: 3, y: 3 },
        ],
        encoding: {
          x: { field: 'x', type: 'quantitative' },
          y: { field: 'y', type: 'quantitative' },
        },
      },
      { width: 600, height: 400, theme: terminalTheme },
    );
    const points = layout.marks.filter((m) => m.type === 'point');
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(p.stroke).toBe(TERMINAL_BG);
    }
  });

  it('strokes dot-plot dots with the preset background, not white', () => {
    const layout = compileChart(
      {
        animation: false,
        mark: { type: 'lollipop' },
        data: [
          { metric: 'Alpha', value: 12 },
          { metric: 'Beta', value: 20 },
          { metric: 'Gamma', value: 7 },
        ],
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'metric', type: 'nominal' },
        },
      },
      { width: 600, height: 400, theme: terminalTheme },
    );
    const points = layout.marks.filter((m) => m.type === 'point');
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(p.stroke).toBe(TERMINAL_BG);
    }
  });
});
