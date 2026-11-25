/**
 * Validation of `encoding.time` on chart specs (RFC 2.7 errors). Warnings come from
 * `compileChartPlayback`, since validation has no warnings channel.
 */
import { jsonPointer } from '@opendata-ai/openchart-core';
import { barIdentityKey } from '../../charts/bar/identity-key';
import { firstDuplicateCell } from '../../playback/duplicate-cells';
import type { PlaybackTimeType } from '../../playback/periods';
import type { ValidationError } from '../types';
import { validatePlaybackBlock } from './playback';

/** Where the chart being validated sits. */
export interface TimeValidationContext {
  /** True for a leaf of a `LayerSpec`, where `time` is not supported. */
  inLayer?: boolean;
}

const SUPPORTED_MARKS = ['point', 'circle', 'bar'];
const KEYED_MARKS = ['point', 'circle'];
const TIME_PATH = '/encoding/time';

type Record_ = Record<string, unknown>;

function isRecord(value: unknown): value is Record_ {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldOf(channel: unknown): string | undefined {
  if (!isRecord(channel)) return undefined;
  return typeof channel.field === 'string' ? channel.field : undefined;
}

function markTypeOf(spec: Record_): string | undefined {
  if (typeof spec.mark === 'string') return spec.mark;
  return isRecord(spec.mark) && typeof spec.mark.type === 'string' ? spec.mark.type : undefined;
}

function mismatch(path: string, message: string, suggestion: string): ValidationError {
  return { code: 'ENCODING_MISMATCH', path, message: `Spec error: ${message}`, suggestion };
}

/** Errors for the mark, facet, layer, youDrawIt and trendline restrictions. */
function checkUnsupportedFeatures(
  spec: Record_,
  encoding: Record_,
  context: TimeValidationContext,
  errors: ValidationError[],
): void {
  const mark = markTypeOf(spec);
  if (mark && !SUPPORTED_MARKS.includes(mark)) {
    errors.push(
      mismatch(
        TIME_PATH,
        `encoding.time is not supported on ${mark} marks. It works on ${SUPPORTED_MARKS.join(', ')}`,
        `Change the mark to ${SUPPORTED_MARKS.join(', ')}, or remove encoding.time.`,
      ),
    );
  }
  if (encoding.facet !== undefined || spec.facet !== undefined) {
    errors.push(
      mismatch(
        TIME_PATH,
        'encoding.time cannot be combined with facet',
        'Remove the facet channel, or remove encoding.time.',
      ),
    );
  }
  for (const channel of ['row', 'column']) {
    if (encoding[channel] === undefined) continue;
    errors.push(
      mismatch(
        jsonPointer('encoding', channel),
        `encoding.time cannot be combined with encoding.${channel}, which facets the chart`,
        `Remove encoding.${channel}, or remove encoding.time.`,
      ),
    );
  }
  if (context.inLayer) {
    errors.push(
      mismatch(
        TIME_PATH,
        'encoding.time is not supported inside a layer',
        'Move the time chart out of the layer, or remove encoding.time.',
      ),
    );
  }
  if (spec.youDrawIt !== undefined) {
    errors.push(
      mismatch(
        '/youDrawIt',
        'encoding.time cannot be combined with youDrawIt',
        'Remove youDrawIt, or remove encoding.time.',
      ),
    );
  }
  if (isRecord(spec.mark) && spec.mark.trendline) {
    errors.push(
      mismatch(
        '/mark/trendline',
        'a trendline cannot be drawn on a chart with encoding.time',
        'Remove mark.trendline, or remove encoding.time.',
      ),
    );
  }
}

/** Errors for `playback.trails` and `playback.labels`, which only a point mark supports. */
function checkPointOnlyOptions(spec: Record_, errors: ValidationError[]): void {
  const mark = markTypeOf(spec);
  if (!mark || mark === 'point' || !isRecord(spec.playback)) return;
  for (const option of ['trails', 'labels']) {
    const value = spec.playback[option];
    if (value === undefined || value === false) continue;
    errors.push(
      mismatch(
        jsonPointer('playback', option),
        `playback.${option} is only supported on point marks, not ${mark}`,
        `Remove playback.${option}, or change the mark to point.`,
      ),
    );
  }
}

/**
 * Error for `playback.trails` on a point chart whose x or y is authored as a non-quantitative
 * type: a trail follows a key's x and y values, which only quantitative channels carry.
 */
function checkTrailAxes(spec: Record_, encoding: Record_, errors: ValidationError[]): void {
  if (markTypeOf(spec) !== 'point' || !isRecord(spec.playback)) return;
  const trails = spec.playback.trails;
  if (trails === undefined || trails === false) return;
  for (const channel of ['x', 'y']) {
    const authored = encoding[channel];
    const type = isRecord(authored) ? authored.type : undefined;
    if (type === undefined || type === 'quantitative') continue;
    errors.push(
      mismatch(
        jsonPointer('playback', 'trails'),
        `playback.trails needs quantitative x and y, but ${channel} is not quantitative (${JSON.stringify(type)})`,
        `Make encoding.${channel} quantitative, or remove playback.trails.`,
      ),
    );
    return;
  }
}

/** Errors for an aggregate transform whose groupby leaves out the time field. */
function checkAggregateKeepsTime(spec: Record_, timeField: string, errors: ValidationError[]) {
  if (!Array.isArray(spec.transform)) return;
  spec.transform.forEach((step, index) => {
    if (!(isRecord(step) && 'aggregate' in step)) return;
    const groupby = Array.isArray(step.groupby) ? step.groupby : [];
    if (groupby.includes(timeField)) return;
    errors.push(
      mismatch(
        jsonPointer('transform', index, 'groupby'),
        `this aggregate drops the time field '${timeField}', so there is nothing to play over`,
        `Add '${timeField}' to the aggregate's groupby.`,
      ),
    );
  });
}

/** How rows are identified: the key field for points, `color|category` for bars. */
interface Identity {
  label: string;
  of(row: Record_): string | undefined;
}

function barIdentity(encoding: Record_): Identity | null {
  const xQuantitative = isRecord(encoding.x) && encoding.x.type === 'quantitative';
  const categoryField = fieldOf(xQuantitative ? encoding.y : encoding.x);
  if (!categoryField) return null;
  const colorField = fieldOf(encoding.color);
  return {
    label: colorField ? `${colorField}|${categoryField}` : `|${categoryField}`,
    of: (row) => barIdentityKey(row, categoryField, colorField),
  };
}

function identityFor(spec: Record_, encoding: Record_, errors: ValidationError[]) {
  const mark = markTypeOf(spec);
  if (mark === 'bar') return barIdentity(encoding);
  if (!(mark && KEYED_MARKS.includes(mark))) return null;
  const keyField = fieldOf(encoding.key);
  if (!keyField) {
    errors.push({
      code: 'MISSING_FIELD',
      path: '/encoding/key',
      message: `Spec error: ${mark} charts with encoding.time need encoding.key`,
      suggestion:
        'Add encoding.key: { field: "<id field>" } so each mark can be followed over time.',
    });
    return null;
  }
  return {
    label: keyField,
    of: (row: Record_) => (row[keyField] == null ? undefined : String(row[keyField])),
  };
}

/**
 * How the time channel's periods read. Without an authored type, ordinal reads every string
 * and number as itself, so duplicates are still found by value.
 */
function timeTypeOf(time: unknown): PlaybackTimeType {
  const type = isRecord(time) ? time.type : undefined;
  return type === 'temporal' || type === 'quantitative' ? type : 'ordinal';
}

/** Error for the first identity and period pair that more than one row carries. */
function checkUniqueRows(
  spec: Record_,
  identity: Identity,
  time: { field: string; type: PlaybackTimeType },
  errors: ValidationError[],
): void {
  // A transform reshapes the rows, so the authored data says nothing about duplicates.
  if (!Array.isArray(spec.data) || spec.transform !== undefined) return;
  const collision = firstDuplicateCell(spec.data, identity.of, time);
  if (!collision) return;
  errors.push({
    code: 'INVALID_VALUE',
    path: '/data',
    message: `Spec error: ${collision.count} rows have ${identity.label} = '${collision.identity}' and ${time.field} = ${String(collision.period)}. Aggregate them first.`,
    suggestion: `Aggregate the data so each ${identity.label} has one row per ${time.field}.`,
  });
}

/**
 * Append errors for a chart spec that sets `encoding.time`: an unsupported mark (naming
 * point, circle and bar), missing `encoding.key` on point and circle, two rows with the same
 * identity and period (the derived `color|category` key for bars), `facet` or the `row` and
 * `column` facet channels, a layer leaf, `youDrawIt`, an authored `trendline`,
 * `playback.trails`/`labels` on a non-point mark, `playback.trails` with a non-quantitative
 * x or y, an `aggregate` whose groupby drops the time field, and problems in the `playback`
 * block.
 * Called only for specs with `encoding.time`.
 */
export function validateTimeEncoding(
  spec: Record<string, unknown>,
  errors: ValidationError[],
  context: TimeValidationContext = {},
): void {
  const encoding = isRecord(spec.encoding) ? spec.encoding : {};
  checkUnsupportedFeatures(spec, encoding, context, errors);
  checkPointOnlyOptions(spec, errors);
  checkTrailAxes(spec, encoding, errors);
  validatePlaybackBlock('playback', spec.playback, errors);

  const timeField = fieldOf(encoding.time);
  if (timeField) checkAggregateKeepsTime(spec, timeField, errors);
  const identity = identityFor(spec, encoding, errors);
  if (identity && timeField) {
    checkUniqueRows(spec, identity, { field: timeField, type: timeTypeOf(encoding.time) }, errors);
  }
}
