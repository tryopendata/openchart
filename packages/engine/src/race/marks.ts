import type {
  MeasureTextFn,
  RaceFrame,
  RaceGeometry,
  RaceLayout,
  RaceMarkDef,
  RaceMarkType,
} from '@opendata-ai/openchart-core';
import { barGeometry, computeBarStatic } from './layout-bar';
import type { RaceModel } from './types';

export type RaceLayoutsByMark = {
  [TMark in RaceMarkType]: Extract<RaceLayout, { mark: TMark }>;
};
type RaceMarkDefsByType = {
  [TMark in RaceMarkType]: Extract<RaceMarkDef, { type: TMark }>;
};
type RaceLayoutBase = Omit<RaceLayout, 'mark' | 'static'>;

export interface RaceMarkEntry<TMark extends RaceMarkType> {
  /** Measure the text this mark needs. The bar name gutter uses `layout.labels`. */
  computeStatic(
    model: RaceModel,
    layout: RaceLayoutBase,
    mark: RaceMarkDefsByType[TMark],
    measureText: MeasureTextFn,
  ): RaceLayoutsByMark[TMark]['static'];
  geometry(
    model: RaceModel,
    layout: RaceLayoutsByMark[TMark],
    frame: RaceFrame,
  ): Extract<RaceGeometry, { mark: TMark }>;
}

interface RegisteredRaceMark<TMark extends RaceMarkType> extends RaceMarkEntry<TMark> {
  createLayout(
    model: RaceModel,
    base: RaceLayoutBase,
    mark: RaceMarkDefsByType[TMark],
    measureText: MeasureTextFn,
  ): RaceLayoutsByMark[TMark];
}

// Each entry pairs its tag with its own static layout type.
const registeredMarks: { [TMark in RaceMarkType]?: RegisteredRaceMark<TMark> } = {
  bar: {
    createLayout(model, base, mark, measureText) {
      return {
        ...base,
        mark: mark.type,
        static: this.computeStatic(model, base, mark, measureText),
      };
    },
    computeStatic(model, layout, _mark, measureText) {
      const { area, labels, theme } = layout;
      const { body, axisTick } = theme.fonts.sizes;
      const { normal } = theme.fonts.weights;
      const measureWidth = (text: string) => measureText(text, body, normal).width;
      let maxLabelWidth = 0;
      for (const label of labels) {
        maxLabelWidth = Math.max(maxLabelWidth, measureWidth(label));
      }

      let min = Infinity;
      let max = -Infinity;
      for (const series of model.matrix.values) {
        for (const value of series) {
          if (!Number.isFinite(value)) continue;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }

      return computeBarStatic({
        area,
        top: model.timeline.top,
        maxLabelWidth,
        maxValueLabelWidth: Math.max(
          measureWidth(model.formatValue(min)),
          measureWidth(model.formatValue(max)),
        ),
        fontSize: { name: body, value: body, tick: axisTick },
        showPeriod: model.spec.race.period !== false,
        showSummary: model.spec.race.summary === 'sum',
        hasNegatives: min < 0,
      });
    },
    geometry(model, layout, frame) {
      return barGeometry(layout.static, frame, model.formatValue);
    },
  },
};

export const RACE_MARKS: { [TMark in RaceMarkType]?: RaceMarkEntry<TMark> } = registeredMarks;

function requireRaceMark<T>(mark: RaceMarkType, entry: T | undefined): T {
  if (!Object.hasOwn(RACE_MARKS, mark) || !entry) {
    throw new Error(`Race mark "${mark}" is not registered. Use a registered mark.`);
  }
  return entry;
}

export function raceMarkEntry<TMark extends RaceMarkType>(mark: TMark): RaceMarkEntry<TMark> {
  return requireRaceMark<RaceMarkEntry<TMark>>(mark, RACE_MARKS[mark]);
}

export function layoutForRaceMark<TMark extends RaceMarkType>(
  model: RaceModel,
  base: RaceLayoutBase,
  mark: { type: TMark } & RaceMarkDefsByType[TMark],
  measureText: MeasureTextFn,
): RaceLayout {
  const entry = requireRaceMark<RegisteredRaceMark<TMark>>(mark.type, registeredMarks[mark.type]);
  return entry.createLayout(model, base, mark, measureText);
}
