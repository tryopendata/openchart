/** The attribution obstacle uses the same resolved text box and anchor as paint. */
import type { MeasureTextFn, Rect, ResolvedTheme } from '@opendata-ai/openchart-core';
import { wrapText } from '@opendata-ai/openchart-core';
import type { AxesResult } from '../layout/axes';
import type { LayoutDimensions } from '../layout/dimensions';

export function computeWatermarkObstacle(
  dims: LayoutDimensions,
  _watermark: boolean,
  _axes: AxesResult,
  _theme: ResolvedTheme,
  measureText?: MeasureTextFn,
): Rect | null {
  const mark = dims.chrome.brand ?? dims.chrome.watermark;
  if (!mark) return null;
  const lines = wrapText(
    mark.text,
    mark.style.fontSize,
    mark.style.fontWeight,
    mark.maxWidth,
    measureText,
  );
  const count = Math.min(lines.length, mark.maxLines ?? Infinity);
  const anchor = dims.chrome.bottomAnchorY ?? dims.chartArea.y + dims.chartArea.height;
  const band = dims.chrome.noteBandHeight ?? dims.noteBand ?? 0;
  const align = mark.style.textAnchor ?? 'start';
  return {
    x: mark.x - (align === 'end' ? mark.maxWidth : align === 'middle' ? mark.maxWidth / 2 : 0),
    y: anchor + band + mark.y,
    width: mark.maxWidth,
    height: count * mark.style.fontSize * (mark.style.lineHeight ?? 1.3),
  };
}
