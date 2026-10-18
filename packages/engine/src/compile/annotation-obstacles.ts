/**
 * Everything auto-placed annotations must avoid on a single chart: the legend,
 * the marks, visible data labels, the brand watermark, the endpoint column,
 * and the top chrome block.
 */

import type {
  EndpointLabelsLayout,
  LegendLayout,
  Mark,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { computeLabelBounds } from '@opendata-ai/openchart-core';
import type { PlacementObstacle } from '../annotations/placement';
import { computeMarkObstacles } from '../charts/post-process';
import type { AxesResult } from '../layout/axes';
import type { LayoutDimensions } from '../layout/dimensions';
import type { ResolvedScales } from '../layout/scales';
import { computeWatermarkObstacle } from './watermark-obstacle';

export function collectAnnotationObstacles(params: {
  legend: LegendLayout;
  marks: Mark[];
  scales: ResolvedScales;
  dims: LayoutDimensions;
  watermark: boolean;
  axes: AxesResult;
  theme: ResolvedTheme;
  endpointLabels: EndpointLabelsLayout;
}): PlacementObstacle[] {
  const { legend, marks, scales, dims, watermark, axes, theme, endpointLabels } = params;
  const obstacles: PlacementObstacle[] = [];
  if (legend.bounds.width > 0) {
    obstacles.push({ ...legend.bounds, kind: 'legend' });
  }
  obstacles.push(...computeMarkObstacles(marks, scales));

  // Add visible data label bounds as obstacles so annotations avoid overlapping them
  for (const mark of marks) {
    if ('label' in mark && mark.label?.visible) {
      obstacles.push({ ...computeLabelBounds(mark.label), kind: 'data-label' });
    }
  }

  // Add brand watermark as an obstacle so annotations avoid overlapping it.
  const watermarkRect = computeWatermarkObstacle(dims, watermark, axes, theme);
  if (watermarkRect) obstacles.push({ ...watermarkRect, kind: 'watermark' });

  // Add endpoint label bounds as obstacles
  if (endpointLabels.entries.length > 0 && endpointLabels.bounds.width > 0) {
    obstacles.push({ ...endpointLabels.bounds, kind: 'endpoint-label' });
  }

  // The top chrome block (eyebrow / title / subtitle) is painted text, not empty
  // space. Auto-placed annotations anchored near the plot's top edge would
  // otherwise happily land on top of the subtitle.
  if (dims.chrome.topHeight > 0) {
    obstacles.push({
      x: 0,
      y: 0,
      width: dims.total.width,
      height: chromeBottomY(dims),
      kind: 'chrome',
    });
  }
  return obstacles;
}

/** Bottom edge of the top chrome block (eyebrow / title / subtitle). */
export function chromeBottomY(dims: LayoutDimensions): number {
  return dims.topPad + dims.chrome.topHeight;
}
