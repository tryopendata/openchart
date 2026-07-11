/**
 * Color system barrel export.
 */

export type { ColorBlindnessType } from './colorblind';
export {
  checkPaletteDistinguishability,
  simulateColorBlindness,
} from './colorblind';

export {
  contrastRatio,
  findAccessibleColor,
  isOpaqueColor,
  meetsAA,
  pickLabelColor,
} from './contrast';
export type {
  CategoricalPalette,
  DivergingPalette,
  SequentialPalette,
} from './palettes';
export {
  ACHROMATIC_RAMP,
  CATEGORICAL_PALETTE,
  DIVERGING_BROWN_TEAL,
  DIVERGING_PALETTES,
  DIVERGING_RED_BLUE,
  resolveSchemeName,
  SEQUENTIAL_BLUE,
  SEQUENTIAL_GREEN,
  SEQUENTIAL_ORANGE,
  SEQUENTIAL_PALETTES,
  SEQUENTIAL_PURPLE,
  SUPPORTED_SCHEME_NAMES,
} from './palettes';
