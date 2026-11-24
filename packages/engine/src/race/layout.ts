import {
  adaptTheme,
  type CompileOptions,
  computeChrome,
  estimateTextWidth,
  type MeasureTextFn,
  mergeThemeConfig,
  type RaceLayout,
  type RaceMarkDef,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { raceA11y } from './a11y';
import { resolveRaceColors } from './colors';
import { truncateRaceLabel } from './layout-bar';
import { layoutForRaceMark } from './marks';
import { raceSpecWarning } from './prepare';
import type { RaceModel } from './types';

function raceLayoutBase(
  model: RaceModel,
  options: CompileOptions,
  measureText: MeasureTextFn,
): Omit<RaceLayout, 'mark' | 'static'> {
  const { width, height } = options;
  const { spec } = model;
  const watermark = model.specWatermark ?? options.watermark ?? true;
  const lightTheme = resolveTheme(mergeThemeConfig(spec.theme, options.theme));
  const theme = options.darkMode ? adaptTheme(lightTheme) : lightTheme;
  const chrome = computeChrome(
    spec.chrome,
    theme,
    width,
    options.measureText,
    'full',
    undefined,
    watermark,
  );
  const { padding } = theme.spacing;
  const area = {
    x: padding,
    y: padding + chrome.topHeight,
    width: Math.max(0, width - 2 * padding),
    height: Math.max(0, height - 2 * padding - chrome.topHeight - chrome.bottomHeight),
  };
  const { body } = theme.fonts.sizes;
  const { normal } = theme.fonts.weights;
  const labelBudget = area.width * 0.4;
  const measureWidth = (text: string, size: number, weight?: number) =>
    measureText(text, size, weight).width;
  const labels = model.matrix.labels.map((label) =>
    truncateRaceLabel(label, labelBudget, body, normal, measureWidth),
  );
  return {
    width,
    height,
    chrome,
    theme,
    a11y: raceA11y(model),
    watermark,
    periods: [...model.periodLabels],
    colors: resolveRaceColors(model.colorSlots, theme.colors.categorical),
    labels,
    measureText: options.measureText,
    playback: { ...model.playback },
    warnings: model.warnings.map(raceSpecWarning),
    area,
  };
}

/**
 * Resolve the race layout for the requested size and theme. An explicit mark overrides the spec's.
 * @throws {Error} The selected mark is unregistered.
 */
export function layoutRace(
  model: RaceModel,
  options: CompileOptions & { mark?: RaceMarkDef },
): RaceLayout {
  const measureText =
    options.measureText ??
    ((text: string, fontSize: number, fontWeight?: number) => ({
      width: estimateTextWidth(text, fontSize, fontWeight),
      height: fontSize,
    }));
  const base = raceLayoutBase(model, options, measureText);
  return layoutForRaceMark(model, base, options.mark ?? model.spec.mark, measureText);
}
