/**
 * Drawing one playback frame of a chart: run the registered renderer on the frame's rows
 * against the frozen scales, plot area and label plan. Name labels for `playback.labels`
 * are overlays (playback/overlays.ts), not part of the marks.
 */
import type { DataRow, Mark } from '@opendata-ai/openchart-core';
import type { FrozenChartFrame } from '../../playback/chart-types';
// Side-effect import: playback is an entry point of its own (the mounts call it without
// going through compileChart), so it registers the built-in renderers it draws with.
import '../builtin';
import { resolveRendererKey } from '../post-process';
import { type ChartRenderer, getChartRenderer } from '../registry';

/** Draws a frame's rows into marks keyed by `mark.key`. */
export type FrameDrawer = (rows: DataRow[]) => Map<string, Mark>;

/**
 * A drawer bound to the frozen frame. Marks without a key are left out, since frames are
 * matched to the DOM by key only.
 *
 * @throws {Error} When no renderer is registered for the frame's mark type.
 */
export function createFrameDrawer(frame: FrozenChartFrame, containerWidth: number): FrameDrawer {
  const { spec } = frame;
  const rendererKey = resolveRendererKey(spec.markType, spec.encoding, spec.markDef);
  const renderer: ChartRenderer | undefined = getChartRenderer(rendererKey);
  if (!renderer) {
    throw new Error(
      `No chart renderer is registered for '${rendererKey}', so playback can't draw frames.`,
    );
  }
  return (rows) => {
    const marks = renderer(
      { ...spec, data: rows },
      frame.scales,
      frame.chartArea,
      frame.strategy,
      frame.theme,
      containerWidth,
      frame.labelPlan,
    );
    const byKey = new Map<string, Mark>();
    for (const mark of marks) {
      const key = 'key' in mark ? mark.key : undefined;
      if (key === undefined) continue;
      byKey.set(key, mark);
    }
    return byKey;
  };
}
