import type {
  ChartSpec,
  ReaderSelection,
  ReaderSlice,
  ReaderSliceSelection,
} from '@opendata-ai/openchart-core';
import { buildD3Formatter, formatNumber } from '@opendata-ai/openchart-core';
import { compareReaderValues, normalizeSpec } from '@opendata-ai/openchart-engine';
import type { ReaderPresentationOptions } from './reader-options';
import type { ReaderPanelRecord, ReaderPanelViewModel } from './reader-panel';

const number = (value: unknown) =>
  typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : NaN;
const string = (value: unknown) =>
  value === null || value === undefined ? 'No observation' : String(value);
const semanticEncodings = new WeakMap<
  ChartSpec,
  { data: ChartSpec['data']; encoding: ChartSpec['encoding']; normalized: ChartSpec['encoding'] }
>();
function observationEncoding(spec: ChartSpec | null) {
  if (!spec) return undefined;
  let cached = semanticEncodings.get(spec);
  if (!cached || cached.data !== spec.data || cached.encoding !== spec.encoding) {
    cached = {
      data: spec.data,
      encoding: spec.encoding,
      normalized: (normalizeSpec(spec) as { encoding: ChartSpec['encoding'] }).encoding,
    };
    semanticEncodings.set(spec, cached);
  }
  return cached.normalized;
}
export function observationPanelModel(
  state: ReaderSelection,
  spec: ChartSpec | null,
  options: ReaderPresentationOptions,
): ReaderPanelViewModel {
  const encoding = observationEncoding(spec);
  const horizontal = encoding?.x?.type === 'quantitative' && encoding?.y?.type !== 'quantitative';
  const category = horizontal ? encoding?.y : encoding?.x;
  const valueChannel = encoding?.y?.type === 'quantitative' ? encoding.y : encoding?.x;
  const record = (observation: ReaderSelection['pinned'][number]): ReaderPanelRecord => {
    const data = observation.datum;
    const value = valueChannel;
    return {
      id: observation.observation,
      name:
        category && 'field' in category ? string(data[category.field]) : observation.observation,
      valueLabel:
        value && 'field' in value
          ? (() => {
              const raw = data[value.field],
                numeric = number(raw);
              const explicit =
                value.format ||
                (typeof value.axis === 'object' && value.axis !== null
                  ? value.axis.format
                  : undefined);
              const formatter = buildD3Formatter(explicit) || formatNumber;
              return Number.isFinite(numeric) ? formatter(numeric) : string(raw);
            })()
          : '',
      unit: value && 'field' in value ? spec?.fields?.[value.field]?.unit : undefined,
      state: observation.state,
      fields: Object.entries(data).map(([label, value]) => ({ label, value: string(value) })),
    };
  };
  const comparisons: NonNullable<ReaderPanelViewModel['comparisons']> = [];
  const pair =
    state.pinned.length === 2
      ? state.pinned
      : state.pinned.length === 1 &&
          state.preview &&
          state.preview.observation !== state.pinned[0].observation
        ? [state.pinned[0], state.preview]
        : [];
  if (
    pair.length === 2 &&
    options.comparison &&
    options.comparison !== 'values' &&
    valueChannel &&
    'field' in valueChannel
  ) {
    const field = valueChannel.field,
      metadata = spec?.fields?.[field];
    const operand = (item: (typeof pair)[number]) => ({
      value: number(item.datum[field]),
      metadata,
      binding: {
        dataset: options.binding?.dataset ?? 'chart',
        transform: JSON.stringify(spec?.transform ?? []),
        grouping: [item.series ?? ''],
        panelId:
          spec?.encoding.facet && 'field' in spec.encoding.facet
            ? JSON.stringify(item.datum[spec.encoding.facet.field])
            : 'root',
      },
    });
    const result = compareReaderValues(operand(pair[0]), operand(pair[1]), {
      allowNegativeRelative: options.allowNegativeRelative,
    });
    if (result.status === 'unavailable')
      comparisons.push({ id: field, label: 'B minus A', explanation: result.message });
    else
      comparisons.push({
        id: field,
        label: 'B minus A',
        absolute: result.absolute,
        unit: result.unit,
        ...(options.comparison === 'relative'
          ? {
              relative:
                result.relative === undefined
                  ? undefined
                  : `${(result.relative * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`,
              explanation: result.relativeUnavailable
                ? `Relative change unavailable: ${result.relativeUnavailable.replaceAll('-', ' ')}.`
                : undefined,
            }
          : {}),
      });
  }
  return {
    preview: state.preview ? record(state.preview) : undefined,
    pinned: state.pinned.map((item, index) => ({
      slot: index === 0 ? 'A' : 'B',
      record: record(item),
    })),
    comparisons,
    announcement: state.announcement,
  };
}
function sliceRecord(slice: ReaderSlice): ReaderPanelRecord {
  const panel = slice.panel.facet
    ? slice.panel.facet.values.map((value) => string(value.value)).join(', ')
    : '';
  return {
    id: slice.key,
    name: slice.xLabel,
    domainLabel: panel ? `Panel: ${panel}` : undefined,
    valueLabel: `${slice.members.length} series`,
    state: slice.state,
    fields: slice.members.map((member) => ({
      label: member.series.metadata?.unit
        ? `${member.series.label} (${member.series.metadata.unit})`
        : member.series.label,
      value:
        member.status === 'no-observation'
          ? 'No observation'
          : member.status === 'ambiguous'
            ? 'Ambiguous observations'
            : (member.formattedValue ?? string(member.value)),
      status:
        member.status === 'no-observation'
          ? 'missing'
          : member.status === 'ambiguous'
            ? 'ambiguous'
            : 'value',
    })),
  };
}
export function slicePanelModel(
  state: ReaderSliceSelection,
  options: ReaderPresentationOptions,
): ReaderPanelViewModel {
  const pair =
    state.pinned.length === 2
      ? state.pinned
      : state.pinned.length === 1 && state.preview && state.preview.key !== state.pinned[0].key
        ? [state.pinned[0], state.preview]
        : [];
  const comparisons: NonNullable<ReaderPanelViewModel['comparisons']> = [];
  if (pair.length === 2 && options.comparison && options.comparison !== 'values') {
    const [a, b] = pair;
    for (const member of a.members) {
      const after = b.members.find((item) => item.series.key === member.series.key);
      if (!after) continue;
      if (
        member.status !== 'observed' ||
        after.status !== 'observed' ||
        member.valueStatus !== 'finite' ||
        after.valueStatus !== 'finite'
      ) {
        comparisons.push({
          id: member.series.key,
          label: member.series.label,
          explanation: 'Change unavailable: no unique finite observation at both dates.',
        });
        continue;
      }
      const operand = (
        slice: ReaderSlice,
        value: number,
        metadata: typeof member.series.metadata,
      ) => ({
        value,
        metadata,
        binding: {
          dataset: slice.binding.dataset,
          transform: slice.binding.transform,
          grouping: slice.binding.grouping,
          panelId: slice.panel.id,
        },
      });
      const result = compareReaderValues(
        operand(a, member.value!, member.series.metadata),
        operand(b, after.value!, after.series.metadata),
        { allowNegativeRelative: options.allowNegativeRelative },
      );
      if (result.status === 'unavailable')
        comparisons.push({
          id: member.series.key,
          label: member.series.label,
          explanation: result.message,
        });
      else
        comparisons.push({
          id: member.series.key,
          label: `${member.series.label}: B minus A`,
          absolute: result.absolute,
          unit: result.unit,
          ...(options.comparison === 'relative'
            ? {
                relative:
                  result.relative === undefined
                    ? undefined
                    : `${(result.relative * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`,
                explanation: result.relativeUnavailable
                  ? `Relative change unavailable: ${result.relativeUnavailable.replaceAll('-', ' ')}.`
                  : undefined,
              }
            : {}),
        });
    }
  }
  return {
    preview: state.preview ? sliceRecord(state.preview) : undefined,
    pinned: state.pinned.map((slice, index) => ({
      slot: index === 0 ? 'A' : 'B',
      record: sliceRecord(slice),
    })),
    comparisons,
    announcement: state.announcement,
  };
}
