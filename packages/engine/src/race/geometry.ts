import type {
  RaceFrame,
  RaceGeometry,
  RaceLayout,
  RaceMarkType,
} from '@opendata-ai/openchart-core';
import { buildRaceFrame } from './frame';
import { type RaceLayoutsByMark, raceMarkEntry } from './marks';
import type { RaceModel } from './types';

function frameAt(model: RaceModel, t: number, colors: string[], labels: string[]): RaceFrame {
  if (!Number.isFinite(t)) throw new RangeError('Race frame time must be finite.');
  const { matrix, timeline, spec, periodLabels, formatValue } = model;
  return buildRaceFrame(timeline.sample(t), {
    keys: matrix.keys,
    labels,
    colors,
    formatValue,
    periods: matrix.periods,
    periodLabels,
    summary: spec.race.summary === 'sum',
    top: timeline.top,
  });
}

/**
 * Return a standalone frame with the prepared spec-theme colors and full labels.
 * Finite times outside the race clamp to its endpoints.
 * @throws {RangeError} The frame time is not finite.
 */
export function raceFrameAt(model: RaceModel, t: number): RaceFrame {
  return frameAt(model, t, model.frameColors, model.matrix.labels);
}

function geometryForMark<TMark extends RaceMarkType>(
  model: RaceModel,
  layout: { mark: TMark } & RaceLayoutsByMark[TMark],
  frame: RaceFrame,
): RaceGeometry {
  return raceMarkEntry(layout.mark).geometry(model, layout, frame);
}

/**
 * Build on-screen geometry with `layout.colors` and fitted labels.
 * Finite times outside the race clamp to its endpoints.
 * @throws {RangeError} The frame time is not finite.
 * @throws {Error} The layout mark is unregistered.
 */
export function raceGeometryAt(model: RaceModel, layout: RaceLayout, t: number): RaceGeometry {
  return geometryForMark(model, layout, frameAt(model, t, layout.colors, layout.labels));
}
