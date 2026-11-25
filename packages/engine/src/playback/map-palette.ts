/**
 * The colors a map playback paints, for seeding a GIF palette so the colors that carry
 * meaning (legend classes, the no-data fill, tile shades) come out exact instead of dithered.
 */
import { isOpaqueColor, type ResolvedTheme } from '@opendata-ai/openchart-core';
import { interpolateRgb } from 'd3-interpolate';
import type { GeoMapFrozenScales, MapFillFrame, MapPointFrame } from './map-types';

/** Distinct colors in order, leaving out pattern references a palette can't hold. */
function distinctSolidColors(colors: Iterable<string>): string[] {
  return [...new Set(colors)].filter((color) => !color.startsWith('url('));
}

/** Point fills over every period; points are few, and a color channel can vary per period. */
function pointFills(periodCount: number, pointsAt: (t: number) => MapPointFrame[]): string[] {
  const fills: string[] = [];
  for (let period = 0; period < periodCount; period += 1) {
    for (const point of pointsAt(period)) fills.push(point.fill);
  }
  return fills;
}

/**
 * A geo map's palette: the legend's class colors first, then the no-data fill, then the
 * points' fills.
 */
export function geoPaletteColors(
  scales: GeoMapFrozenScales,
  periodCount: number,
  pointsAt: (t: number) => MapPointFrame[],
): string[] {
  return distinctSolidColors([
    ...(scales.classScale?.colors ?? []),
    scales.neutralFill,
    ...pointFills(periodCount, pointsAt),
  ]);
}

/** The surface tiles composite over: the theme background when opaque, else its surface gray. */
function tileSurface(theme: ResolvedTheme): string {
  const { background, neutral } = theme.colors;
  return isOpaqueColor(background) ? background : neutral.surface;
}

/**
 * A tile map's palette: every period's tile shades as drawn. A sequential tile map paints
 * one color at varying fill opacity, so each shade is that color composited at its opacity
 * over the surface, the pixel the GIF actually shows.
 */
export function tilePaletteColors(
  theme: ResolvedTheme,
  periodCount: number,
  fillsAt: (t: number) => MapFillFrame[],
): string[] {
  const surface = tileSurface(theme);
  const shades: string[] = [];
  for (let period = 0; period < periodCount; period += 1) {
    for (const { fill, fillOpacity = 1 } of fillsAt(period)) {
      if (fill.startsWith('url(')) continue;
      shades.push(fillOpacity >= 1 ? fill : interpolateRgb(surface, fill)(fillOpacity));
    }
  }
  return distinctSolidColors(shades);
}
