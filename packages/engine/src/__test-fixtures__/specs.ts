/**
 * Shared test fixtures for engine tests.
 *
 * Factory functions for NormalizedChartSpec and shared layout objects.
 * Each factory returns a fresh object to prevent cross-test contamination.
 */

import type { LayoutStrategy, Rect } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';

// ---------------------------------------------------------------------------
// Shared layout objects
// ---------------------------------------------------------------------------

/** Standard chart area used across engine tests. */
export function makeChartArea(): Rect {
  return { x: 50, y: 20, width: 500, height: 300 };
}

/** Full-width layout strategy (labels visible, legend on right). */
export function makeFullStrategy(): LayoutStrategy {
  return {
    labelMode: 'all',
    legendPosition: 'right',
    annotationPosition: 'inline',
    axisLabelDensity: 'full',
    chromeMode: 'full',
    legendMaxHeight: -1,
  };
}

/** Compact layout strategy (no labels, legend on top). */
export function makeCompactStrategy(): LayoutStrategy {
  return {
    labelMode: 'none',
    legendPosition: 'top',
    annotationPosition: 'tooltip-only',
    axisLabelDensity: 'minimal',
    chromeMode: 'full',
    legendMaxHeight: -1,
  };
}

// ---------------------------------------------------------------------------
// Line chart spec factories
// ---------------------------------------------------------------------------

/** Single-series line chart with temporal x-axis. */
export function makeLineSpec(): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line' },
    data: [
      { date: '2020-01-01', value: 10, country: 'US' },
      { date: '2021-01-01', value: 40, country: 'US' },
      { date: '2020-01-01', value: 15, country: 'UK' },
      { date: '2021-01-01', value: 35, country: 'UK' },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'country', type: 'nominal' },
    },
    chrome: {
      title: { text: 'GDP Growth' },
      subtitle: { text: 'US vs UK over time' },
      source: { text: 'World Bank' },
    },
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '', prefix: '' },
    hiddenSeries: [],
    seriesStyles: {},
    watermark: true,
  };
}

// ---------------------------------------------------------------------------
// Bar chart spec factories
// ---------------------------------------------------------------------------

/** Basic bar chart (horizontal) with nominal y and quantitative x. */
export function makeBarSpec(): NormalizedChartSpec {
  return {
    markType: 'bar',
    markDef: { type: 'bar' },
    data: [
      { name: 'A', value: 10 },
      { name: 'B', value: 30 },
      { name: 'C', value: 20 },
    ],
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'name', type: 'nominal' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '', prefix: '' },
    hiddenSeries: [],
    seriesStyles: {},
    watermark: true,
  };
}

// ---------------------------------------------------------------------------
// Scatter chart spec factories
// ---------------------------------------------------------------------------

/** Basic scatter chart with quantitative x and y. */
export function makeScatterSpec(): NormalizedChartSpec {
  return {
    markType: 'point',
    markDef: { type: 'point' },
    data: [
      { x: 10, y: 20 },
      { x: 30, y: 50 },
      { x: 50, y: 40 },
      { x: 70, y: 80 },
      { x: 90, y: 60 },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
    chrome: {},
    annotations: [],
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '', prefix: '' },
    hiddenSeries: [],
    seriesStyles: {},
    watermark: true,
  };
}
