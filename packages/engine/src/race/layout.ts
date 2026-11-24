import {
  adaptTheme,
  type CompileOptions,
  computeChrome,
  estimateTextWidth,
  mergeThemeConfig,
  type RaceLayout,
  type RaceMarkDef,
  resolveTheme,
  truncateToWidth,
} from '@opendata-ai/openchart-core';
import { raceA11y } from './a11y';
import { resolveRaceColors } from './colors';
import { layoutForRaceMark } from './marks';
import { raceSpecWarning } from './prepare';
import type { RaceModel } from './types';

/** The optional mark overrides the model spec's mark for runtime swaps. */
export function layoutRace(
  model: RaceModel,
  options: CompileOptions & { mark?: RaceMarkDef },
): RaceLayout {
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
  const measureText =
    options.measureText ??
    ((text: string, fontSize: number, fontWeight?: number) => ({
      width: estimateTextWidth(text, fontSize, fontWeight),
      height: fontSize,
    }));
  const { body } = theme.fonts.sizes;
  const { normal } = theme.fonts.weights;
  const labelBudget = area.width * 0.4;
  const measureWidth = (text: string, size: number, weight?: number) =>
    measureText(text, size, weight).width;
  const labels = model.matrix.labels.map((label) => {
    const truncated = truncateToWidth(label, labelBudget, body, normal, measureWidth);
    const complete = truncated === label ? label : truncated.replace(/\s*[\uD800-\uDBFF]…$/u, '…');
    // The shared truncator returns an ellipsis even when the budget is narrower.
    return complete === '…' && measureWidth(complete, body, normal) > labelBudget ? '' : complete;
  });
  const base = {
    width,
    height,
    chrome,
    theme,
    a11y: raceA11y(spec.chrome.title?.text),
    watermark,
    periods: [...model.periodLabels],
    colors: resolveRaceColors(model.colorSlots, theme.colors.categorical),
    labels,
    measureText: options.measureText,
    playback: { ...model.playback },
    warnings: model.warnings.map(raceSpecWarning),
    area,
  };

  return layoutForRaceMark(model, base, options.mark ?? spec.mark, measureText);
}
