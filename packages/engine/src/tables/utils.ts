/**
 * Shared utilities for table column computations.
 */

import { contrastRatio } from '@openchart/core';

/**
 * Pick a text color (black or white) that meets better contrast against the background.
 */
export function accessibleTextColor(bg: string): string {
  const white = '#ffffff';
  const black = '#000000';
  const whiteRatio = contrastRatio(white, bg);
  const blackRatio = contrastRatio(black, bg);
  return whiteRatio >= blackRatio ? white : black;
}
