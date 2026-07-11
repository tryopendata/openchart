/**
 * Small spec helpers shared across gallery pages.
 */

import type { GradientDef } from '@opendata-ai/openchart-core';

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
