import type {
  MeasureTextFn,
  RaceFrame,
  RaceGeometry,
  RaceLayout,
  RaceMarkDef,
  RaceMarkType,
} from '@opendata-ai/openchart-core';
import { barGeometry, computeBarStatic } from './layout-bar';
import { computeLineStatic, lineGeometry } from './layout-line';
import { computeTableStatic, tableGeometry } from './layout-table';
import type { RaceModel } from './types';

/** Index the layout variants by mark so each registry entry receives its own static type. */
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

/** Static measurement and frame geometry by supported race mark. */
export const RACE_MARKS: { [TMark in RaceMarkType]?: RaceMarkEntry<TMark> } = {
  bar: {
    computeStatic(model, layout, mark, measureText) {
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
          measureWidth(model.formatValue(min / 2 + max / 2)),
        ),
        cornerRadius: mark.cornerRadius ?? 0,
        fontSize: { name: body, value: body, tick: axisTick },
        showPeriod: model.spec.race.period !== false,
        measurePeriodWidth(fontSize) {
          // The SVG uses tabular numerals. Measure a representative digit once per pattern.
          const labels = new Set(model.periodLabels.map((label) => label.replace(/\d/g, '0')));
          let width = 0;
          for (const label of labels)
            width = Math.max(width, measureText(label, fontSize, 600).width);
          return width;
        },
        showSummary: model.spec.race.summary === 'sum',
        hasNegatives: min < 0,
      });
    },
    geometry(model, layout, frame) {
      const { measureText, theme } = layout;
      return barGeometry(layout.static, frame, model.formatValue, {
        fontSize: theme.fonts.sizes.body,
        fontWeight: theme.fonts.weights.normal,
        measureWidth:
          measureText && ((text, size, weight) => measureText(text, size, weight).width),
      });
    },
  },
  line: { computeStatic: computeLineStatic, geometry: lineGeometry },
  table: { computeStatic: computeTableStatic, geometry: tableGeometry },
};

/**
 * Get the entry for a race mark.
 * @throws {Error} The mark is unregistered.
 */
export function raceMarkEntry<TMark extends RaceMarkType>(mark: TMark): RaceMarkEntry<TMark> {
  const entry = RACE_MARKS[mark];
  if (!Object.hasOwn(RACE_MARKS, mark) || !entry) {
    throw new Error(
      `Race mark "${mark}" is not registered. Registered: ${Object.keys(RACE_MARKS).join(', ')}`,
    );
  }
  return entry;
}

/**
 * Attach the selected mark's static geometry to the shared layout.
 * @throws {Error} The mark is unregistered.
 */
export function layoutForRaceMark<TMark extends RaceMarkType>(
  model: RaceModel,
  base: RaceLayoutBase,
  mark: { type: TMark } & RaceMarkDefsByType[TMark],
  measureText: MeasureTextFn,
): RaceLayout;
export function layoutForRaceMark<TMark extends RaceMarkType>(
  model: RaceModel,
  base: RaceLayoutBase,
  mark: { type: TMark } & RaceMarkDefsByType[TMark],
  measureText: MeasureTextFn,
) {
  const entry = raceMarkEntry(mark.type);
  return { ...base, mark: mark.type, static: entry.computeStatic(model, base, mark, measureText) };
}
