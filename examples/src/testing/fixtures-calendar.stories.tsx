/**
 * Testing / Fixtures: calendar heatmap pinned e2e stories.
 *
 * New pinned stories for the calendar mark (plan 16), covering the three
 * canonical layouts: one-year diverging (temperature anomaly with a few
 * missing days), two-year sequential (daily counts, stacked year bands with
 * one shared legend), and a compact mobile container where the cell-size
 * floor engages inside a horizontal scroll wrapper. Pinned by the Playwright
 * visual suite. Do not restyle: this content is a pixel-baseline contract.
 *
 * Data: generated at module load from a seeded mulberry32 PRNG plus
 * integer/triangle-wave arithmetic only (no Math.random, no transcendental
 * functions), so every run on every platform produces identical values.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// Deterministic data generation (seeded PRNG, arithmetic-only seasonality)
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32): bit ops and imul only. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86400000;

/** ISO yyyy-mm-dd for `start + i` days (UTC). */
function isoDay(startMs: number, i: number): string {
  return new Date(startMs + i * DAY_MS).toISOString().slice(0, 10);
}

/** Triangle wave in [-1, 1] peaking mid-year (day ~182 of 365). */
function seasonal(dayOfYear: number): number {
  const phase = (dayOfYear % 365) / 365; // 0..1
  return 1 - Math.abs(phase * 4 - 2); // -1 at Jan 1, +1 at mid-year
}

/**
 * One year (2023) of daily temperature anomalies in degrees C: a warm bias
 * plus seasonal swing and noise, rounded to one decimal. Every 61st day is
 * dropped to exercise the missing-day empty-cell treatment.
 */
function anomalyDays(): Array<{ date: string; anomaly: number }> {
  const rand = mulberry32(20230101);
  const start = Date.UTC(2023, 0, 1);
  const rows: Array<{ date: string; anomaly: number }> = [];
  for (let i = 0; i < 365; i++) {
    const value = 0.4 + seasonal(i) * 1.1 + (rand() - 0.5) * 2.6;
    if (i % 61 === 30) continue; // deterministic gaps (6 missing days)
    rows.push({ date: isoDay(start, i), anomaly: Math.round(value * 10) / 10 });
  }
  return rows;
}

/**
 * Two years (2023-2024) of daily counts: weekday-heavy activity with a slow
 * upward trend and noise, clamped at zero. Complete coverage (731 days).
 */
function countDays(): Array<{ date: string; reports: number }> {
  const rand = mulberry32(42);
  const start = Date.UTC(2023, 0, 1);
  const rows: Array<{ date: string; reports: number }> = [];
  for (let i = 0; i < 731; i++) {
    // Jan 1, 2023 is a Sunday; weekday boost on Mon-Fri (dow 1..5).
    const dow = (i + 0) % 7; // 0 = Sunday
    const weekday = dow >= 1 && dow <= 5 ? 9 : 0;
    const trend = i / 60;
    const value = Math.max(0, Math.round(6 + weekday + trend + (rand() - 0.5) * 10));
    rows.push({ date: isoDay(start, i), reports: value });
  }
  return rows;
}

const anomalyData = anomalyDays();
const countData = countDays();

// ---------------------------------------------------------------------------
// CalendarDivergingYear: one year, diverging scale, missing-day gaps
// ---------------------------------------------------------------------------

const calendarDivergingSpec: ChartSpec = {
  mark: 'calendar',
  data: anomalyData,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    color: {
      field: 'anomaly',
      type: 'quantitative',
      scale: { scheme: 'redBlue' },
      format: '+.1f',
    },
  },
  chrome: {
    title: 'A Year Running Warm',
    subtitle:
      'Daily temperature anomaly vs the 1991-2020 normal, degrees C. Gray cells are days without a reading.',
    source: 'Source: Synthetic fixture data',
  },
};

export const CalendarDivergingYear = () => (
  <div className="tfix-chart tfix-h-360">
    <Chart spec={calendarDivergingSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// CalendarSequentialTwoYears: stacked year bands, one shared legend
// ---------------------------------------------------------------------------

const calendarTwoYearSpec: ChartSpec = {
  mark: 'calendar',
  data: countData,
  encoding: {
    x: { field: 'date', type: 'temporal' },
    color: { field: 'reports', type: 'quantitative' },
  },
  chrome: {
    title: 'Weekday Reports Keep Climbing',
    subtitle: 'Daily incident reports, 2023-2024. Both years share one color scale.',
    source: 'Source: Synthetic fixture data',
  },
};

export const CalendarSequentialTwoYears = () => (
  <div className="tfix-chart tfix-h-550">
    <Chart spec={calendarTwoYearSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// CalendarCompact: mobile-width scroll host, 7px cell floor engaged
// ---------------------------------------------------------------------------

const calendarCompactSpec: ChartSpec = {
  ...calendarDivergingSpec,
  chrome: {
    title: 'A Year Running Warm',
    subtitle: 'Daily temperature anomaly, degrees C',
    source: 'Source: Synthetic fixture data',
  },
};

/**
 * The recommended host pattern below the mobile breakpoint: the engine
 * floors day cells at 7px (never illegible), and the host provides a
 * horizontal scroll wrapper with a min-width inner container so the full
 * 53-column grid stays reachable instead of shrinking.
 */
export const CalendarCompact = () => (
  <div className="tfix-chart tfix-debug-border" style={{ maxWidth: 360, overflowX: 'auto' }}>
    <div style={{ minWidth: 520, height: 400 }}>
      <Chart spec={calendarCompactSpec} />
    </div>
  </div>
);
