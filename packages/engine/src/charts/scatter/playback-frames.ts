/**
 * Drawing one playback frame of a chart: build each key's interpolated row at the playhead
 * and run the registered renderer on them against the frozen scales, plot area and label
 * plan. Name labels for `playback.labels`
 * are overlays (playback/overlays.ts), not part of the marks.
 */
import type { DataRow, Mark, MeasureTextFn } from '@opendata-ai/openchart-core';
import type { FrameMark, FrozenChartFrame } from '../../playback/chart-types';
import type { FrameSampler } from '../../playback/frame-sampler';
import { resolveRendererKey } from '../post-process';
import { type ChartRenderer, getChartRenderer } from '../registry';

/** Draws a frame's rows into marks keyed by `mark.key`. */
export type FrameDrawer = (rows: DataRow[]) => Map<string, Mark>;

/**
 * A drawer bound to the frozen frame. Marks without a key are left out, since frames are
 * matched to the DOM by key only. `measureText` is the compile's own, so text-sized layout
 * (a pyramid's gutter) matches the frozen axes, which were placed with it.
 *
 * @throws {Error} When no renderer is registered for the frame's mark type.
 */
export function createFrameDrawer(
  frame: FrozenChartFrame,
  containerWidth: number,
  measureText?: MeasureTextFn,
): FrameDrawer {
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
      measureText,
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

/** Where a frame's interpolated values go in the rows the renderer reads. */
export interface FrameRowFields {
  /** Field the key is written to. */
  identity: string;
  /** Field per sampler channel, in channel order. */
  channelFields: string[];
}

/** A playback's marks at a playhead, drawn from the sampler through the frame drawer. */
export interface FrameMarks {
  /** Every base key's mark at `t`, in base order. Repeated calls at one `t` draw once. */
  marksAt(t: number): FrameMark[];
  /**
   * The keyed marks the renderer draws beside the data marks (a pyramid's gutter category
   * labels and half labels) at `t`. They depend only on the frozen frame and the category
   * set, so they hold still for the whole run.
   */
  fixedMarksAt(t: number): FrameMark[];
}

/**
 * Remembers the last frame drawn. The frame writer asks for the marks and the overlays at
 * the same `t`, and the overlays are built from the marks, so each frame draws once.
 */
function lastFrameCache(drawAt: (t: number) => FrameMark[]): (t: number) => FrameMark[] {
  let lastT = Number.NaN;
  let lastFrame: FrameMark[] = [];
  return (t) => {
    if (t !== lastT) {
      lastFrame = drawAt(t);
      lastT = t;
    }
    return lastFrame;
  };
}

/**
 * Bind `draw` to the sampler: rows for the keys at `order` (matrix key indexes, base order)
 * written through `fields`, drawn per playhead.
 */
export function createFrameMarks(
  draw: FrameDrawer,
  sampler: FrameSampler,
  order: number[],
  fields: FrameRowFields,
): FrameMarks {
  const { matrix } = sampler;
  const dataKeys = new Set(matrix.keys);

  const drawRows = (t: number) => {
    const states = order.map((keyIndex) => sampler.stateAt(keyIndex, t));
    const rows: DataRow[] = order.map((keyIndex, position) => {
      const row: DataRow = {
        ...matrix.statics[keyIndex],
        [fields.identity]: matrix.keys[keyIndex],
      };
      for (const [channel, value] of states[position].values.entries()) {
        if (Number.isFinite(value)) row[fields.channelFields[channel]] = value;
      }
      return row;
    });
    return { drawn: draw(rows), presences: states.map(({ presence }) => presence) };
  };

  const marksAt = lastFrameCache((t) => {
    const { drawn, presences } = drawRows(t);
    const frameMarks: FrameMark[] = [];
    order.forEach((keyIndex, position) => {
      const key = matrix.keys[keyIndex];
      const mark = drawn.get(key);
      // Statics are constant per key and held values stay finite, so a key the renderer
      // draws once it draws at every t; this only skips keys it can never draw.
      if (mark) frameMarks.push({ key, mark, presence: presences[position] });
    });
    return frameMarks;
  });

  const fixedMarksAt = (t: number): FrameMark[] =>
    [...drawRows(t).drawn]
      .filter(([key]) => !dataKeys.has(key))
      .map(([key, mark]) => ({ key, mark, presence: 1 }));

  return { marksAt, fixedMarksAt };
}
