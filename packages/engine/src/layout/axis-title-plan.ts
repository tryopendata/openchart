import type { EncodingChannel, MeasureTextFn, ResolvedTheme } from '@opendata-ai/openchart-core';
import { estimateTextWidth, wrapText } from '@opendata-ai/openchart-core';

export interface AxisTitleHeader {
  lines: string[];
  height: number;
  padding: number;
  fontSize: number;
  lineHeight: number;
}

/** OpenChart resolves an unrotated y-title at the end of its axis as a header. */
export function isYAxisHeader(channel: EncodingChannel | undefined): boolean {
  const axis = channel?.axis;
  return !!axis && axis.titleAngle === 0 && axis.titleAnchor === 'end' && !!axis.title;
}

export function measureYAxisHeader(
  channel: EncodingChannel | undefined,
  theme: ResolvedTheme,
  availableWidth: number,
  measureText?: MeasureTextFn,
): AxisTitleHeader | undefined {
  if (!isYAxisHeader(channel)) return undefined;
  const axis = channel!.axis;
  if (!axis) return undefined;
  const fontSize = theme.fonts.sizes.body;
  const lineHeight = fontSize * 1.3;
  const padding = axis.titlePadding ?? 8;
  const lines = wrapText(
    axis.title!,
    fontSize,
    theme.fonts.weights.medium,
    Math.max(1, availableWidth),
    measureText,
  );
  return {
    lines,
    fontSize,
    lineHeight,
    padding,
    height: lines.length * lineHeight + padding + theme.fonts.sizes.axisTick,
  };
}

/** Rotated title footprint for authored angles; omitted angles keep legacy geometry. */
export function authoredTitleFootprint(
  channel: EncodingChannel | undefined,
  theme: ResolvedTheme,
  measureText?: MeasureTextFn,
): { width: number; height: number } | undefined {
  const axis = channel?.axis;
  if (!axis || !axis.title || axis.titleAngle === undefined || isYAxisHeader(channel))
    return undefined;
  const size = theme.fonts.sizes.body;
  const width =
    measureText?.(axis.title, size, theme.fonts.weights.medium).width ??
    estimateTextWidth(axis.title, size, theme.fonts.weights.medium);
  const angle = (axis.titleAngle * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * size,
    height: Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * size,
  };
}
