import {
  type RaceFrame,
  type RaceGeometry,
  type RaceLayout,
  type RaceMarkType,
  resolveTheme,
} from '@opendata-ai/openchart-core';
import { resolveRaceColors } from './colors';
import { buildRaceFrame } from './frame';
import { type RaceLayoutsByMark, raceMarkEntry } from './marks';
import type { RaceModel } from './types';

function frameAt(model: RaceModel, t: number, colors: string[], labels: string[]): RaceFrame {
  if (Number.isNaN(t)) throw new RangeError('Race frame time cannot be NaN.');
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

export function raceFrameAt(model: RaceModel, t: number): RaceFrame {
  const { colors } = resolveTheme(model.spec.theme);
  return frameAt(
    model,
    t,
    resolveRaceColors(model.colorSlots, colors.categorical),
    model.matrix.labels,
  );
}

function geometryForMark<TMark extends RaceMarkType>(
  model: RaceModel,
  layout: { mark: TMark } & RaceLayoutsByMark[TMark],
  frame: RaceFrame,
): RaceGeometry {
  return raceMarkEntry(layout.mark).geometry(model, layout, frame);
}

export function raceGeometryAt(model: RaceModel, layout: RaceLayout, t: number): RaceGeometry {
  return geometryForMark(model, layout, frameAt(model, t, layout.colors, layout.labels));
}
