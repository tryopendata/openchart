import {
  type Chrome,
  inferFieldType,
  type RaceMarkDef,
  type RaceSpec,
} from '@opendata-ai/openchart-core';
import type { NormalizedChrome } from '../compiler/types';
import type { NormalizedRaceSpec } from './types';

const CHROME_FIELDS: (keyof Chrome)[] = [
  'eyebrow',
  'title',
  'subtitle',
  'source',
  'byline',
  'footer',
  'brand',
];

function normalizeChrome(chrome: Chrome | undefined): NormalizedChrome {
  const result: NormalizedChrome = {};
  for (const field of CHROME_FIELDS) {
    const value = chrome?.[field];
    if (value !== undefined) result[field] = typeof value === 'string' ? { text: value } : value;
  }
  return result;
}

export function normalizeRaceSpec(spec: RaceSpec, warnings: string[]): NormalizedRaceSpec {
  const { encoding, race } = spec;
  const mark: RaceMarkDef = typeof spec.mark === 'string' ? { type: spec.mark } : spec.mark;
  const timeType = encoding.time.type ?? inferFieldType(spec.data, encoding.time.field);
  const autoplay = spec.animation === false ? false : (race?.autoplay ?? 'visible');
  const controls = race?.controls ?? true;
  const period = race?.period;
  const periodFormat = (period === false ? undefined : period?.format) ?? encoding.time.format;

  if (!controls && autoplay !== false) {
    warnings.push(
      'Race autoplay is enabled with controls disabled. Set race.controls to true or race.autoplay to false so viewers can pause motion (WCAG 2.2.2).',
    );
  }

  return {
    ...spec,
    mark:
      mark.type === 'line'
        ? { ...mark, window: mark.window ?? 'reveal' }
        : mark.type === 'bar'
          ? { ...mark, cornerRadius: mark.cornerRadius ?? 0 }
          : {
              ...mark,
              columns: mark.columns ?? ['rank', 'change', 'name', 'bar', 'value', 'share'],
            },
    encoding: {
      ...encoding,
      time: { ...encoding.time, type: timeType === 'nominal' ? 'ordinal' : timeType },
      key: { ...encoding.key, type: encoding.key.type ?? 'nominal' },
      value: { ...encoding.value, type: 'quantitative' },
    },
    race: {
      top: race?.top ?? 10,
      duration: race?.duration,
      step: race?.step,
      swap: race?.swap ?? 400,
      rescale: race?.rescale ?? 'frame',
      gaps: race?.gaps ?? 'interpolate',
      holdEnd: race?.holdEnd ?? 1500,
      loop: race?.loop ?? false,
      autoplay,
      controls,
      period: period === false ? false : periodFormat === undefined ? {} : { format: periodFormat },
      summary: race?.summary ?? false,
    },
    chrome: normalizeChrome(spec.chrome),
    theme: spec.theme ?? {},
    watermark: spec.watermark ?? true,
  };
}
