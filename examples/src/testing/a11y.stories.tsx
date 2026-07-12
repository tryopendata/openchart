/**
 * Testing / A11y — accessibility hardening stories pinned by the Playwright
 * visual suite (plan 06).
 *
 * Covers opt-in pattern fills (mark.fillPattern: 'auto') in light, dark, and
 * compact/mobile containers, plus the colorblind palette audit: the default
 * categorical palette rendered through the simulation utilities for the four
 * common color vision deficiency types. Palette changes get reviewed against
 * these baselines.
 */

import type { Story } from '@ladle/react';
import type { ChartSpec, ColorBlindnessType } from '@opendata-ai/openchart-core';
import { CATEGORICAL_PALETTE, simulateColorBlindness } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / A11y' };

// ---------------------------------------------------------------------------
// Pattern fills: 4-series stacked column
// ---------------------------------------------------------------------------

const energyData = [
  { quarter: 'Q1', source: 'Solar', twh: 30 },
  { quarter: 'Q1', source: 'Wind', twh: 45 },
  { quarter: 'Q1', source: 'Hydro', twh: 25 },
  { quarter: 'Q1', source: 'Gas', twh: 60 },
  { quarter: 'Q2', source: 'Solar', twh: 35 },
  { quarter: 'Q2', source: 'Wind', twh: 50 },
  { quarter: 'Q2', source: 'Hydro', twh: 22 },
  { quarter: 'Q2', source: 'Gas', twh: 55 },
  { quarter: 'Q3', source: 'Solar', twh: 42 },
  { quarter: 'Q3', source: 'Wind', twh: 48 },
  { quarter: 'Q3', source: 'Hydro', twh: 20 },
  { quarter: 'Q3', source: 'Gas', twh: 50 },
  { quarter: 'Q4', source: 'Solar', twh: 38 },
  { quarter: 'Q4', source: 'Wind', twh: 55 },
  { quarter: 'Q4', source: 'Hydro', twh: 24 },
  { quarter: 'Q4', source: 'Gas', twh: 52 },
];

const patternStackedSpec: ChartSpec = {
  mark: { type: 'bar', fillPattern: 'auto' },
  data: energyData,
  animation: false,
  encoding: {
    x: { field: 'quarter', type: 'nominal' },
    y: { field: 'twh', type: 'quantitative', stack: 'zero' },
    color: { field: 'source', type: 'nominal' },
  },
  chrome: {
    title: 'Electricity generation by source',
    subtitle: 'TWh per quarter, patterns reinforce series color',
    source: 'Source: synthetic fixture data',
  },
  description:
    'Stacked column chart of quarterly electricity generation for solar, wind, hydro, and gas, with per-series fill patterns.',
};

export const PatternFillsStacked = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={patternStackedSpec} />
  </div>
);

export const PatternFillsStackedDark = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={{ ...patternStackedSpec, darkMode: 'force' }} />
  </div>
);

/** 360px mobile-width container: patterns at compact scale, thin segments fall back to solid. */
export const PatternFillsCompact = () => (
  <div className="tfix-chart tfix-h-400" style={{ maxWidth: 360 }}>
    <Chart spec={patternStackedSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Pattern fills: donut (includes a sliver below the minimum-area rule)
// ---------------------------------------------------------------------------

const patternDonutSpec: ChartSpec = {
  mark: { type: 'arc', innerRadius: 60, fillPattern: 'auto' },
  data: [
    { browser: 'Chrome', share: 64 },
    { browser: 'Safari', share: 19 },
    { browser: 'Edge', share: 12 },
    { browser: 'Firefox', share: 4.6 },
    { browser: 'Other', share: 0.4 },
  ],
  animation: false,
  encoding: {
    color: { field: 'browser', type: 'nominal' },
    y: { field: 'share', type: 'quantitative' },
  },
  chrome: {
    title: 'Browser market share',
    subtitle: 'The sub-1% sliver keeps a solid fill (minimum-area rule)',
  },
};

export const PatternFillsDonut = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={patternDonutSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Colorblind palette audit
// ---------------------------------------------------------------------------

const DEFICIENCIES: Array<{ type: ColorBlindnessType | 'normal'; label: string }> = [
  { type: 'normal', label: 'Normal vision' },
  { type: 'protanopia', label: 'Protanopia (no red cones)' },
  { type: 'deuteranopia', label: 'Deuteranopia (no green cones)' },
  { type: 'tritanopia', label: 'Tritanopia (no blue cones)' },
  { type: 'achromatopsia', label: 'Achromatopsia (no color)' },
];

/**
 * The default categorical palette under each simulated deficiency. Adjacent
 * swatches in a row should remain distinguishable; if a palette change makes
 * two neighbors merge in any row, this baseline catches it.
 */
export const ColorblindPaletteAudit: Story = () => (
  <div
    className="story-chart"
    style={{ padding: 24, maxWidth: 720, fontFamily: 'system-ui, sans-serif' }}
  >
    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
      Default categorical palette
    </div>
    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
      Simulated with the core colorblind utilities. Each row must stay pairwise distinguishable.
    </div>
    {DEFICIENCIES.map(({ type, label }) => (
      <div key={type} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {CATEGORICAL_PALETTE.map((color) => (
            // SVG rects (not divs) so the visual-test readiness probe, which
            // waits for a rendered shape inside the story root, sees this story.
            <svg key={color} width={56} height={36} role="img" aria-label={color}>
              <title>{color}</title>
              <rect
                width={56}
                height={36}
                rx={3}
                fill={type === 'normal' ? color : simulateColorBlindness(color, type)}
              />
            </svg>
          ))}
        </div>
      </div>
    ))}
  </div>
);
