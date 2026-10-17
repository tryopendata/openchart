import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { legacyEditorial } from '@opendata-ai/openchart-core';
import { buildPrimarySpec } from '../compile/layer';
import { expandSpecSugar } from '../compile/spec-sugar';
import { flattenLayers, normalizeSpec } from '../compiler/normalize';
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
    // Materialize only omitted v8 defaults. An authored null/false remains an opt-out.
    if (Array.isArray(current.annotations))
      for (const [index, value] of current.annotations.entries()) {
        const annotation = node(value);
        if (!annotation) continue;
        const at = `${path}/annotations/${index}`;
        const setDefault = (key: string, value: unknown) => {
          if (annotation[key] === undefined)
            replace(annotation, key, value, at, 'Preserve the v8 annotation default.');
        };
        if (annotation.type === 'text') {
          setDefault('maxWidth', null);
          if (annotation.subtitle) {
            setDefault('fontWeight', 700);
            setDefault(
              'subtitleFontSize',
              Math.round(
                (typeof annotation.fontSize === 'number' ? annotation.fontSize : 13) * 0.85,
              ),
            );
          }
          if (annotation.connector === 'curve')
            replace(
              annotation,
              'connector',
              { type: 'curve', arrow: true },
              at,
              'Preserve the v8 curve arrow.',
            );
          const connector = node(annotation.connector);
          if (connector?.type === 'curve' && connector.arrow === undefined)
            replace(connector, 'arrow', true, `${at}/connector`, 'Preserve the v8 curve arrow.');
        }
        if (
          annotation.type === 'refline' &&
          annotation.label &&
          annotation.labelAnchor === undefined &&
          annotation.labelPlacement === undefined
        ) {
          setDefault('labelAnchor', annotation.y !== undefined ? 'top' : 'left');
        }
      }
    const isChart = current.mark !== undefined || Array.isArray(current.layer);
    const isLayer = Array.isArray(current.layer);
    if (isChart && !isLayer && current.chromeLayout === undefined)
      rewrite('chromeLayout', 'subtract', 'Preserve the v8 fixed figure budget.');
    if (
      isChart &&
      (!isLayer ||
        current.responsive !== undefined ||
        (typeof current.width === 'number' && typeof current.height === 'number'))
    ) {
      const responsive = current.responsive;
      if (responsive !== false) {
        if (
          responsive === undefined &&
          typeof current.width === 'number' &&
          typeof current.height === 'number'
        )
          rewrite('responsive', false, 'Preserve the fixed-size responsive opt-out.');
        else if (node(responsive)?.compactAnnotationLimit === undefined)
          rewrite(
            'responsive',
            { ...node(responsive), compactAnnotationLimit: null },
            'Preserve unlimited v8 compact annotations.',
          );
      }
    }
    // A theme-less layer inherits its parent. Adding a partial leaf theme would
    // change the v8 shallow merge, so only materialize at an actual theme owner.
    if (
      (!isLayer && (isChart || current.type !== undefined) && inherited.theme === undefined) ||
      current.theme !== undefined
    ) {
      const oldTheme = { ...node(current.theme) };
      const fonts = node(oldTheme.fonts) ?? {};
      const sizes = node(fonts.sizes) ?? {};
      const chromeDefaults = node(oldTheme.chrome) ?? {};
      const newSizes = { ...sizes };
      for (const [key, value] of Object.entries(legacyEditorial.fonts!.sizes!)) {
        const matching = key === 'small' ? ['source', 'byline', 'footer'] : [key];
        if (
          newSizes[key] === undefined &&
          !matching.some((name) => node(chromeDefaults[name])?.fontSize !== undefined)
        )
          newSizes[key] = value;
      }
      const newChrome = { ...chromeDefaults };
      for (const key of ['byline', 'source', 'footer']) {
        const entry = node(newChrome[key]) ?? {};
        if (entry.fontSize === undefined)
          newChrome[key] = { ...entry, fontSize: sizes.small ?? 11 };
      }
      const materialized = { ...oldTheme, fonts: { ...fonts, sizes: newSizes }, chrome: newChrome };
      if (JSON.stringify(materialized) !== JSON.stringify(current.theme))
        rewrite(
          'theme',
          materialized,
          'Preserve v8 typography without overriding authored chrome sizes.',
        );
    }
    const data = current.data ?? inherited.data;
    const effectiveEncoding = { ...node(inherited.encoding), ...encoding };
    const labels = node(current.labels);
    const endpoint = current.endpointLabels ?? inherited.endpointLabels;
    let legacyLabels = false;
    const effective: Node = {
      ...inherited,
      ...current,
      data: data ?? [],
      encoding: effectiveEncoding,
    };
    const layerSpec = effective as unknown as LayerSpec;
    const leaves = Array.isArray(current.layer) ? flattenLayers(layerSpec) : [];
    // Independent axes compile each leaf as a primary chart. Shared scales
    // use the first mark as the primary, with all leaf data, just as compileLayer.
    const migrationSources = leaves.length
      ? layerSpec.resolve?.scale?.y === 'independent'
        ? leaves.map((leaf) => buildPrimarySpec([leaf], layerSpec))
        : [buildPrimarySpec(leaves, layerSpec)]
      : [effective];
    legacyLabels = migrationSources.some((migrationSource) => {
      const sourceMark =
        typeof migrationSource.mark === 'string'
          ? migrationSource.mark
          : node(migrationSource.mark)?.type;
      if (!['line', 'area'].includes(String(sourceMark))) return false;
      const normalized = normalizeSpec(
        expandSpecSugar(migrationSource as unknown as Node) as unknown as ChartSpec,
      ) as NormalizedChartSpec;
      return resolveSuppression(normalized, {
        seriesCount: countColorSeries(normalized),
        labelsHiddenByStrategy: false,
        labelsDensityNone: normalized.labels.density === 'none',
      }).showEndOfLineLabels;
    });
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
            theme: current.theme ?? inherited.theme,
            responsive: current.responsive ?? inherited.responsive,
            chromeLayout: current.chromeLayout ?? inherited.chromeLayout,
            encoding: effectiveEncoding,
            endpointLabels: current.endpointLabels ?? endpoint,
            legend: current.legend ?? inherited.legend,
            labels: current.labels ?? inherited.labels,
          });
      });
  }
  const root = node(spec);
  if (root) visit(root, '');
  return { spec, repairs };
}
