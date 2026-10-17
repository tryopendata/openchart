import type { ChartSpec } from '@opendata-ai/openchart-core';
import { expandSpecSugar } from '../compile/spec-sugar';
import { normalizeSpec } from '../compiler/normalize';
import type { NormalizedChartSpec } from '../compiler/types';
import { countColorSeries, resolveSuppression } from '../legend/suppression';

/** A documented authored-spec change made by migrateSpecV8. */
export interface SpecRepair {
  path: string;
  from: unknown;
  to: unknown;
  reason: string;
}
type Node = Record<string, unknown>;
const node = (value: unknown): Node | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Node)
    : undefined;
const escapePointer = (value: string) => value.replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * Rewrite v8 aliases without mutating the input. Safe to run repeatedly.
 * Legacy end-of-line labels become endpoint labels; their manual offsets are
 * reported as lost repairs because the two placement models are different.
 */
export function migrateSpecV8<T>(input: T): { spec: T; repairs: SpecRepair[] } {
  const repairs: SpecRepair[] = [];
  const clone = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(clone)
      : node(value) &&
          (Object.getPrototypeOf(value) === Object.prototype ||
            Object.getPrototypeOf(value) === null)
        ? Object.fromEntries(
            Object.entries(value as Node).map(([key, child]) => [key, clone(child)]),
          )
        : value;
  const spec = clone(input) as T;
  function visit(current: Node, path: string, inherited: Node = {}) {
    function replace(owner: Node, key: string, value: unknown, at: string, reason: string) {
      repairs.push({
        path: `${at}/${escapePointer(key)}`,
        from: clone(owner[key]),
        to: clone(value),
        reason,
      });
      if (value === undefined) delete owner[key];
      else owner[key] = value;
    }
    const rewrite = (key: string, value: unknown, reason: string) =>
      replace(current, key, value, path, reason);
    if ('darkMode' in current)
      rewrite('darkMode', undefined, 'Spec darkMode has no effect; use the mount option.');
    if (current.type === 'table' && 'compact' in current) {
      if (current.density === undefined)
        rewrite('density', current.compact ? 'condensed' : 'regular', 'Use table density.');
      rewrite('compact', undefined, 'Replaced by density.');
    }
    const theme = node(current.theme);
    const chrome = node(theme?.chrome);
    if (chrome)
      for (const [key, value] of Object.entries(chrome)) {
        if (typeof value === 'string')
          replace(
            chrome,
            key,
            { color: value },
            `${path}/theme/chrome`,
            'Use a chrome color object.',
          );
      }
    if (current.animation === 'legacy')
      rewrite('animation', true, 'Omitting the preset retains v8 animation.');
    const animation = node(current.animation);
    if (animation?.preset === 'legacy')
      replace(animation, 'preset', undefined, `${path}/animation`, 'Omit the legacy preset.');
    const mark = node(current.mark);
    if (mark && 'render' in mark)
      replace(mark, 'render', undefined, `${path}/mark`, 'Use the renderer mount option.');
    const markType = typeof current.mark === 'string' ? current.mark : mark?.type;
    const encoding = node(current.encoding);
    if (encoding) {
      for (const key of ['radius', 'shape', 'href', 'order']) {
        if (key in encoding)
          replace(
            encoding,
            key,
            undefined,
            `${path}/encoding`,
            'This channel has no rendering effect.',
          );
      }
      if (['arc', 'waffle', 'parliament'].includes(String(markType)) && 'y' in encoding) {
        if (encoding.theta === undefined)
          replace(
            encoding,
            'theta',
            encoding.y,
            `${path}/encoding`,
            'Use theta for angular values.',
          );
        replace(encoding, 'y', undefined, `${path}/encoding`, 'Replaced by theta.');
      }
    }
    if (
      ['sankey', 'map', 'barlist'].includes(String(current.type)) &&
      typeof current.valueFormat === 'string'
    ) {
      const key = current.type === 'map' ? 'color' : 'value';
      const enc = node(current.encoding) ?? {};
      const channel = node(enc[key]);
      if (channel) {
        if (channel.format === undefined)
          replace(
            channel,
            'format',
            current.valueFormat,
            `${path}/encoding/${key}`,
            'Use channel format.',
          );
        rewrite('valueFormat', undefined, 'Replaced by channel format.');
      }
    }
    if (Array.isArray(current.annotations))
      for (const [index, value] of current.annotations.entries()) {
        const annotation = node(value);
        if (annotation?.type === 'rule')
          replace(annotation, 'type', 'refline', `${path}/annotations/${index}`, 'Use refline.');
      }
    const data = current.data ?? inherited.data;
    const effectiveEncoding = { ...node(inherited.encoding), ...encoding };
    const labels = node(current.labels);
    const endpoint = current.endpointLabels ?? inherited.endpointLabels;
    let legacyLabels = false;
    if (['line', 'area'].includes(String(markType))) {
      // Reuse the compiler's truth table, including the series-count cutoff,
      // angular/color inference and stacked-area behavior. Migration has no
      // viewport; width-only responsive demotion stays a rendering decision.
      const normalized = normalizeSpec(
        expandSpecSugar({
          ...inherited,
          ...current,
          data: data ?? [],
          encoding: effectiveEncoding,
        }) as unknown as ChartSpec,
      ) as NormalizedChartSpec;
      legacyLabels = resolveSuppression(normalized, {
        seriesCount: countColorSeries(normalized),
        labelsHiddenByStrategy: false,
        labelsDensityNone: normalized.labels.density === 'none',
      }).showEndOfLineLabels;
    }
    if (legacyLabels)
      rewrite(
        'endpointLabels',
        { content: 'label', showMarker: false },
        'Replace legacy end-of-line labels with the endpoint column; label positions may change.',
      );
    const offsets = node(labels?.offsets);
    if (labels && offsets) {
      for (const key of Object.keys(offsets))
        replace(
          offsets,
          key,
          undefined,
          `${path}/labels/offsets`,
          'Manual legacy-label offset cannot be represented by endpoint labels.',
        );
      delete labels.offsets;
    }
    if (Array.isArray(current.layer))
      current.layer.forEach((child, index) => {
        const childNode = node(child);
        if (childNode)
          visit(childNode, `${path}/layer/${index}`, {
            data,
            encoding: effectiveEncoding,
            endpointLabels: endpoint,
            legend: current.legend ?? inherited.legend,
            labels: current.labels ?? inherited.labels,
          });
      });
  }
  const root = node(spec);
  if (root) visit(root, '');
  return { spec, repairs };
}
