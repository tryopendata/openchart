/**
 * Small spec helpers shared across gallery pages.
 */

import type { ChartSpecOverride, GradientDef } from '@opendata-ai/openchart-core';

/** Replace the Big Tech endpoint column with a full-width plot and a keyed legend on phones. */
export const narrowRevenueLegend: ChartSpecOverride = {
  endpointLabels: false,
  legend: { show: true, position: 'top', maxRows: 3 },
  encoding: {
    color: {
      scale: { range: ['#0e7490', '#c2410c', '#7c3aed', '#15803d', '#be185d'] },
    },
  },
};

/** Horizontal-bar fill: a left-to-right linear gradient fading in from the base. */
export const hBarGradient = (color: string): GradientDef => ({
  gradient: 'linear',
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 0,
  stops: [
    { offset: 0, color, opacity: 0.4 },
    { offset: 1, color },
  ],
});

/** Vertical-column fill: a bottom-to-top linear gradient fading in from the base. */
export const vBarGradient = (color: string): GradientDef => ({
  gradient: 'linear',
  x1: 0,
  y1: 1,
  x2: 0,
  y2: 0,
  stops: [
    { offset: 0, color, opacity: 0.4 },
    { offset: 1, color },
  ],
});
