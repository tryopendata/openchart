import type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  DataRow,
  Encoding,
  LayerSpec,
  Mark,
} from '@opendata-ai/openchart-core';
import {
  AXIS_TITLE_TRAILING_PAD,
  axisTitleOffset,
  BREAKPOINT_COMPACT_MAX,
  computeFieldFormatContext,
  defaultNumberFormatter,
  estimateTextWidth,
  resolveNumberFormatter,
  resolveTheme,
  TICK_LABEL_OFFSET,
} from '@opendata-ai/openchart-core';
import { scaleLinear } from 'd3-scale';
import { curveMonotoneX, area as d3area, line as d3line } from 'd3-shape';
import { flattenLayers } from '../compiler/index';
import type { MeasureFn } from '../layout/plan';
import { createMeasureFn } from '../layout/plan';

type ChartCompiler = (spec: unknown, options: CompileOptions) => ChartLayout;

/**
 * Compile a LayerSpec into a single ChartLayout.
 *
 * Flattens nested layers, merges inherited data/encoding/transforms,
 * compiles each leaf layer independently, unions scale domains (shared
 * by default), and concatenates marks in layer order.
 */
export function compileLayer(
  spec: LayerSpec,
  options: CompileOptions,
  compileChart: ChartCompiler,
): ChartLayout {
  const leaves = flattenLayers(spec);

  if (leaves.length === 0) {
    throw new Error('LayerSpec has no leaf chart specs after flattening');
  }

  if (leaves.length === 1) {
    const singleSpec = buildPrimarySpec(leaves, spec);
    return compileChart(singleSpec, options);
  }

  // Past this point every compile is one piece of a multi-leaf layer, not a
  // standalone chart. Flagged so per-chart resolutions that only make sense for
  // a whole figure (the canvas mark layer) opt out.
  const layerOptions: CompileOptions = { ...options, layered: true };

  if (spec.resolve?.scale?.y === 'independent') {
    return compileLayerIndependent(leaves, spec, layerOptions, compileChart);
  }

  const primarySpec = buildPrimarySpec(leaves, spec);
  const primaryLayout = compileChart(primarySpec, layerOptions);

  const allMarks: Mark[] = [];
  const seenLabels = new Set<string>();
  const pLegend = primaryLayout.legend;
  const mergedLegendEntries = 'entries' in pLegend ? [...pLegend.entries] : [];
  for (const entry of mergedLegendEntries) {
    seenLabels.add(entry.label);
  }

  const indexedLeaves = leaves.map((leaf, i) => ({
    leaf,
    zIndex: (leaf as ChartSpec).zIndex ?? i,
  }));
  indexedLeaves.sort((a, b) => a.zIndex - b.zIndex);

  // Leaf specs lack the layer-level chrome/legend, so left alone they compute
  // a different chart area than the primary and their marks drift off the
  // axes. Freeze the primary's area (and inherit its theme) for every leaf.
  const leafOptions: CompileOptions = { ...layerOptions, frozenChartArea: primaryLayout.area };

  // Shared scales means shared *domains*, not just a shared plot rect. Each leaf
  // otherwise re-fits its own domain from its own rows, so a layer holding fewer
  // or narrower rows than its siblings (a label layer naming only the notable
  // points, say) lands on a different scale and its marks slide off the ones
  // they annotate. Union the quantitative domains across every leaf and pin them.
  const sharedDomains = computeSharedDomains(leaves);

  for (const { leaf } of indexedLeaves) {
    const themedLeaf = {
      ...withSharedDomains(leaf as ChartSpec, sharedDomains),
      theme: (leaf as ChartSpec).theme ?? spec.theme,
      darkMode: (leaf as ChartSpec).darkMode ?? spec.darkMode,
    };
    const leafLayout = compileChart(themedLeaf as unknown, leafOptions);

    allMarks.push(...leafLayout.marks);

    const leafLeg = leafLayout.legend;
    if ('entries' in leafLeg) {
      for (const entry of leafLeg.entries) {
        if (!seenLabels.has(entry.label)) {
          seenLabels.add(entry.label);
          mergedLegendEntries.push(entry);
        }
      }
    }
  }

  const mergedLegend = {
    ...primaryLayout.legend,
    ...('entries' in pLegend ? { entries: mergedLegendEntries } : {}),
  } as typeof primaryLayout.legend;

  return {
    ...primaryLayout,
    marks: allMarks,
    legend: mergedLegend,
    // `legends` is what the renderer iterates, so the merged color legend has to
    // land in it too. Spreading `primaryLayout` alone would leave legends[0] as
    // the *pre-merge* legend and every leaf past the first would vanish from the
    // rendered key while `layout.legend` claimed otherwise.
    legends: [mergedLegend, ...primaryLayout.legends.slice(1)],
  };
}

// ---------------------------------------------------------------------------
// Independent y-scale compilation (dual-axis charts)
// ---------------------------------------------------------------------------

function estimateYAxisLabelWidth(
  data: DataRow[],
  encoding: Encoding | undefined,
  baseFontSize: number,
  measure?: MeasureFn,
): number {
  if (!encoding?.y) return 40;
  const yEnc = encoding.y;
  const yField = yEnc.field;
  if (!yField) return 40;

  const m = measure ?? estimateTextWidth;

  const yType = yEnc.type;
  if (yType === 'nominal' || yType === 'ordinal') {
    let maxWidth = 0;
    for (const row of data) {
      const label = String(row[yField] ?? '');
      const w = m(label, baseFontSize, 400);
      if (w > maxWidth) maxWidth = w;
    }
    return maxWidth > 0 ? maxWidth + 10 : 40;
  }

  const yAxisFormat = (encoding.y.axis as Record<string, unknown> | undefined)?.format as
    | string
    | undefined;
  let maxAbsVal = 0;
  for (const row of data) {
    const v = Number(row[yField]);
    if (Number.isFinite(v) && Math.abs(v) > maxAbsVal) maxAbsVal = Math.abs(v);
  }
  // Round to 2 significant figures to approximate d3 tick values, which land
  // at round numbers. Without this, a max of 80,505,294 formatted with "$~s"
  // produces "$80.5053M" while actual ticks show "$80M", over-reserving space.
  if (maxAbsVal > 0) {
    const mag = 10 ** (Math.floor(Math.log10(maxAbsVal)) - 1);
    maxAbsVal = Math.ceil(maxAbsVal / mag) * mag;
  }
  const ctx = computeFieldFormatContext(data.map((r) => r[yField]));
  let sampleLabel: string;
  if (yAxisFormat) {
    const fmt = resolveNumberFormatter(yAxisFormat, ctx);
    sampleLabel = fmt ? fmt(maxAbsVal) : String(maxAbsVal);
  } else {
    sampleLabel = defaultNumberFormatter({ ...ctx, extent: ctx.extent ?? [0, maxAbsVal] })(
      maxAbsVal,
    );
  }
  const hasNeg = data.some((r) => Number(r[yField]) < 0);
  const labelEst = (hasNeg ? '-' : '') + sampleLabel;
  return m(labelEst, baseFontSize, 400) + 10;
}

function compileLayerIndependent(
  leaves: ChartSpec[],
  layerSpec: LayerSpec,
  options: CompileOptions,
  compileChart: ChartCompiler,
): ChartLayout {
  if (leaves.length > 2) {
    throw new Error(
      'Independent y-scales support at most 2 layers (left and right y-axis). ' +
        `Got ${leaves.length} layers.`,
    );
  }

  const leaf0 = leaves[0];
  const leaf1 = leaves[1];

  const xType0 = leaf0.encoding?.x?.type;
  const xType1 = leaf1.encoding?.x?.type;
  if (xType0 && xType1 && xType0 !== xType1) {
    throw new Error(
      `Dual-axis charts require matching x-field types across layers. ` +
        `Layer 0 has '${xType0}', layer 1 has '${xType1}'.`,
    );
  }

  const theme = resolveTheme(layerSpec.theme ?? leaf1.theme);
  const axisFontSize = theme.fonts?.sizes?.axisTick ?? 11;
  const measureFn = createMeasureFn(options.measureText);
  const rightAxisWidth = estimateYAxisLabelWidth(
    leaf1.data,
    leaf1.encoding,
    axisFontSize,
    measureFn,
  );
  const yAxisConfig = leaf1.encoding?.y?.axis || undefined;
  const hasRightAxisTitle = !!yAxisConfig?.title;
  const tickExtent = TICK_LABEL_OFFSET + rightAxisWidth;
  const bodyFontSize = theme.fonts?.sizes?.body ?? 13;
  const halfGlyph = Math.ceil(bodyFontSize / 2);
  // estimateYAxisLabelWidth adds +10px safety padding for tick rendering,
  // but axisTitleOffset already adds its own structural gaps, so subtract
  // the padding to avoid double-counting
  const rawTickWidth = Math.max(0, rightAxisWidth - 10);
  const titleCenterOffset = axisTitleOffset(rawTickWidth, bodyFontSize, options.width);
  const titleExtent = hasRightAxisTitle
    ? titleCenterOffset +
      halfGlyph +
      (options.width < BREAKPOINT_COMPACT_MAX ? 0 : AXIS_TITLE_TRAILING_PAD)
    : 0;
  const rightReserve = Math.max(tickExtent, titleExtent);

  const optionsWithReserve: CompileOptions = {
    ...options,
    rightAxisReserve: rightReserve,
  };

  const xField0 = leaf0.encoding?.x?.field;
  const xField1 = leaf1.encoding?.x?.field;

  const union = withUnionXDomain(leaf0, leaf1);
  let leaf0WithUnionX = union.leaf0;
  let leaf1WithUnionX = union.leaf1;

  const aligned = alignYDomains(leaf0WithUnionX, leaf1WithUnionX);
  if (aligned) {
    leaf0WithUnionX = withYDomain(leaf0WithUnionX, aligned.domain0);
    leaf1WithUnionX = withYDomain(leaf1WithUnionX, aligned.domain1);
  }

  const primary0 = buildPrimarySpec([leaf0WithUnionX], layerSpec);
  const layout0 = compileChart(primary0, optionsWithReserve);

  const primary1 = buildPrimarySpec([leaf1WithUnionX], layerSpec);
  primary1.annotations = [];
  const layout1 = compileChart(primary1, optionsWithReserve);

  const y2Axis = layout1.axes.y
    ? {
        ...layout1.axes.y,
        orient: 'right' as const,
        gridlines: [],
        start: {
          x: layout0.area.x + layout0.area.width,
          y: layout0.area.y,
        },
        end: {
          x: layout0.area.x + layout0.area.width,
          y: layout0.area.y + layout0.area.height,
        },
        ...(layout1.axes.y.label
          ? {
              titlePosition: {
                x:
                  layout0.area.x +
                  layout0.area.width +
                  axisTitleOffset(rawTickWidth, bodyFontSize, layout0.dimensions.width),
                y: layout0.area.y + layout0.area.height / 2,
                angle: 90,
              },
            }
          : {}),
      }
    : undefined;

  const layer0HasBars = layout0.marks.some((m) => m.type === 'rect');
  const layer1HasBars = layout1.marks.some((m) => m.type === 'rect');

  const bandCenterByCategory = new Map<string, number>();
  if (layer0HasBars && layout0.axes.x?.ticks) {
    for (const tick of layout0.axes.x.ticks) {
      bandCenterByCategory.set(String(tick.label), tick.position);
    }
  } else if (layer1HasBars && layout1.axes.x?.ticks) {
    for (const tick of layout1.axes.x.ticks) {
      bandCenterByCategory.set(String(tick.label), tick.position);
    }
  }

  const remapMarkX = (xField: string | undefined, mark: Mark): Mark => {
    if (!xField || bandCenterByCategory.size === 0) return mark;
    if (mark.type === 'line') {
      const newPoints = mark.points.map((p, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...p, x: bx } : p;
      });
      const newDataPoints = mark.dataPoints?.map((dp, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...dp, x: bx } : dp;
      });
      const newPath =
        d3line<{ x: number; y: number }>()
          .x((p) => p.x)
          .y((p) => p.y)
          .curve(curveMonotoneX)(newPoints) ?? undefined;
      return { ...mark, points: newPoints, dataPoints: newDataPoints, path: newPath };
    }
    if (mark.type === 'area') {
      const newTopPoints = mark.topPoints.map((p, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...p, x: bx } : p;
      });
      const newBottomPoints = mark.bottomPoints.map((p, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...p, x: bx } : p;
      });
      const newDataPoints = mark.dataPoints?.map((dp, i) => {
        const bx = bandCenterByCategory.get(String(mark.data[i]?.[xField] ?? ''));
        return bx !== undefined ? { ...dp, x: bx } : dp;
      });
      const areaGen = d3area<{ x: number; yTop: number; yBottom: number }>()
        .x((p) => p.x)
        .y0((p) => p.yBottom)
        .y1((p) => p.yTop)
        .curve(curveMonotoneX);
      const topLineGen = d3line<{ x: number; yTop: number }>()
        .x((p) => p.x)
        .y((p) => p.yTop)
        .curve(curveMonotoneX);
      const combined = newTopPoints.map((tp, i) => ({
        x: tp.x,
        yTop: tp.y,
        yBottom: newBottomPoints[i]?.y ?? tp.y,
      }));
      const newPath = areaGen(combined) ?? '';
      const newTopPath = topLineGen(combined) ?? '';
      return {
        ...mark,
        topPoints: newTopPoints,
        bottomPoints: newBottomPoints,
        dataPoints: newDataPoints,
        path: newPath,
        topPath: newTopPath,
      };
    }
    if (mark.type === 'point') {
      const bx = bandCenterByCategory.get(String(mark.data[xField] ?? ''));
      return bx !== undefined ? { ...mark, cx: bx } : mark;
    }
    return mark;
  };

  const adjustedMarks0 =
    bandCenterByCategory.size > 0 && !layer0HasBars
      ? layout0.marks.map((m) => remapMarkX(xField0, m))
      : layout0.marks;

  const taggedMarks1 = layout1.marks.map((mark) => {
    const tagged = { ...mark, yScale: 'y2' as const };
    if (bandCenterByCategory.size > 0 && !layer1HasBars) {
      return remapMarkX(xField1, tagged) as typeof tagged;
    }
    return tagged;
  });

  const seenLabels = new Set<string>();
  const l0Legend = layout0.legend;
  const l1Legend = layout1.legend;
  const mergedLegendEntries = 'entries' in l0Legend ? [...l0Legend.entries] : [];
  for (const entry of mergedLegendEntries) seenLabels.add(entry.label);
  const l1Entries = 'entries' in l1Legend ? l1Legend.entries : [];
  for (const entry of l1Entries) {
    if (!seenLabels.has(entry.label)) {
      seenLabels.add(entry.label);
      mergedLegendEntries.push(entry);
    }
  }

  const l0Count = layout0.marks.length;
  const mergedTooltips = new Map(layout0.tooltipDescriptors);
  for (const [key, value] of layout1.tooltipDescriptors) {
    const match = /^(rect|point|arc)-(\d+)$/.exec(key);
    if (match) {
      const offsetKey = `${match[1]}-${Number(match[2]) + l0Count}`;
      mergedTooltips.set(offsetKey, value);
    } else {
      mergedTooltips.set(key, value);
    }
  }

  const z0 = leaf0.zIndex ?? 0;
  const z1 = leaf1.zIndex ?? 1;
  const marks =
    z0 <= z1 ? [...adjustedMarks0, ...taggedMarks1] : [...taggedMarks1, ...adjustedMarks0];

  const mergedLegend = {
    ...layout0.legend,
    ...('entries' in l0Legend ? { entries: mergedLegendEntries } : {}),
  } as typeof layout0.legend;

  return {
    ...layout0,
    axes: {
      x: layout0.axes.x,
      y: layout0.axes.y,
      y2: y2Axis,
    },
    marks,
    legend: mergedLegend,
    // See the note in compileLayer: the renderer reads `legends`, so the merged
    // legend must replace the primary's entry there as well.
    legends: [mergedLegend, ...layout0.legends.slice(1)],
    tooltipDescriptors: mergedTooltips,
  };
}

/** Merge an x-scale `domain` onto a leaf's x-encoding, preserving other scale config. */
function withXDomain(leaf: ChartSpec, domain: number[] | string[]): ChartSpec {
  if (!leaf.encoding?.x) return leaf;
  return {
    ...leaf,
    encoding: {
      ...leaf.encoding,
      x: {
        ...leaf.encoding.x,
        scale: {
          ...leaf.encoding.x.scale,
          domain,
        },
      },
    },
  } as ChartSpec;
}

/**
 * Make both dual-axis layers render against ONE shared x-scale by pinning an
 * explicit union x-domain on each, rather than injecting placeholder data rows.
 *
 * Injecting rows (the old approach) put x-only rows with no y-field into each
 * leaf's data. In line/area compute those become null-y points, which are
 * treated as line breaks -- so two series with interleaved x-values drew as
 * disconnected segments. Pinning the domain achieves the shared axis without
 * ever touching the mark data.
 *
 * Kept separate from computeSharedDomains, which only unions *quantitative*
 * channels and folds zero in (correct for a magnitude y-axis, wrong for an x
 * position axis that must also cover temporal/ordinal and must not fold zero).
 *
 * An author-pinned `scale.domain` on a leaf's x wins for that leaf; the union
 * is still applied to the other leaf. Note that pinning a domain suppresses
 * d3's `.nice()`, so x-axis endpoints become the exact union min/max -- the
 * same behaviour the shared-scale path already has.
 */
function withUnionXDomain(
  leaf0: ChartSpec,
  leaf1: ChartSpec,
): { leaf0: ChartSpec; leaf1: ChartSpec } {
  const xEnc0 = leaf0.encoding?.x;
  const xEnc1 = leaf1.encoding?.x;
  const xField0 = xEnc0?.field;
  const xField1 = xEnc1?.field;
  if (!xField0 || !xField1) return { leaf0, leaf1 };

  // The x-type guard upstream already ensures both encodings agree; take either.
  const xType = xEnc0?.type ?? xEnc1?.type;

  const pinned0 = xEnc0?.scale?.domain !== undefined;
  const pinned1 = xEnc1?.scale?.domain !== undefined;
  if (pinned0 && pinned1) return { leaf0, leaf1 };

  const values0 = leaf0.data.map((row) => row[xField0]);
  const values1 = leaf1.data.map((row) => row[xField1]);
  const allValues = [...values0, ...values1].filter((v) => v != null);
  if (allValues.length === 0) return { leaf0, leaf1 };

  let domain: number[] | string[] | undefined;

  if (xType === 'temporal') {
    let minMs = Number.POSITIVE_INFINITY;
    let maxMs = Number.NEGATIVE_INFINITY;
    for (const v of allValues) {
      const ms = (v instanceof Date ? v : new Date(String(v))).getTime();
      if (Number.isNaN(ms)) continue;
      if (ms < minMs) minMs = ms;
      if (ms > maxMs) maxMs = ms;
    }
    if (minMs <= maxMs) {
      domain = [new Date(minMs).toISOString(), new Date(maxMs).toISOString()];
    }
  } else if (xType === 'quantitative') {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const v of allValues) {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) continue;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    if (min <= max) domain = [min, max];
  } else {
    // Discrete x (nominal/ordinal): ordered union of category labels. leaf0's
    // categories in data order, then leaf1's not-yet-seen values appended. Pinned
    // to BOTH leaves so each band/point scale enumerates the full set -- the bar
    // remap in the caller reads band centres for every category from the axis ticks.
    const seen = new Set<string>();
    const categories: string[] = [];
    for (const v of allValues) {
      const s = String(v);
      if (!seen.has(s)) {
        seen.add(s);
        categories.push(s);
      }
    }
    if (categories.length > 0) domain = categories;
  }

  if (domain === undefined) return { leaf0, leaf1 };

  return {
    leaf0: pinned0 ? leaf0 : withXDomain(leaf0, domain),
    leaf1: pinned1 ? leaf1 : withXDomain(leaf1, domain),
  };
}

function alignYDomains(
  leaf0: ChartSpec,
  leaf1: ChartSpec,
): { domain0: [number, number]; domain1: [number, number] } | undefined {
  const yEnc0 = leaf0.encoding?.y;
  const yEnc1 = leaf1.encoding?.y;
  if (!yEnc0 || !yEnc1) return undefined;
  if (yEnc0.type !== 'quantitative' || yEnc1.type !== 'quantitative') return undefined;

  if (yEnc0.scale?.domain || yEnc1.scale?.domain) return undefined;

  const includeZero0 = yEnc0.scale?.zero !== false;
  const includeZero1 = yEnc1.scale?.zero !== false;

  const vals0 = leaf0.data.map((r) => Number(r[yEnc0.field])).filter(Number.isFinite);
  const vals1 = leaf1.data.map((r) => Number(r[yEnc1.field])).filter(Number.isFinite);
  if (vals0.length === 0 || vals1.length === 0) return undefined;

  const niced = (vals: number[], includeZero: boolean): [number, number] => {
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (includeZero) {
      lo = Math.min(0, lo);
      hi = Math.max(0, hi);
    }
    const s = scaleLinear().domain([lo, hi]);
    s.nice();
    const [dLo, dHi] = s.domain();
    return [dLo, dHi];
  };

  const [min0, max0] = niced(vals0, includeZero0);
  const [min1, max1] = niced(vals1, includeZero1);

  const span0 = max0 - min0;
  const span1 = max1 - min1;
  if (span0 === 0 || span1 === 0) return undefined;

  const zf0 = (0 - min0) / span0;
  const zf1 = (0 - min1) / span1;

  const zeroInDomain0 = zf0 >= -0.001 && zf0 <= 1.001;
  const zeroInDomain1 = zf1 >= -0.001 && zf1 <= 1.001;
  if (!zeroInDomain0 || !zeroInDomain1) return undefined;

  if (Math.abs(zf0 - zf1) < 0.001) {
    return { domain0: [min0, max0], domain1: [min1, max1] };
  }

  const targetZf = Math.max(zf0, zf1);

  const align = (dMin: number, dMax: number, currentZf: number): [number, number] => {
    if (Math.abs(currentZf - targetZf) < 0.001) return [dMin, dMax];

    if (targetZf > currentZf) {
      const newMin = -(targetZf / (1 - targetZf)) * dMax;
      return [newMin, dMax];
    }
    const newMax = (-dMin * (1 - targetZf)) / targetZf;
    return [dMin, newMax];
  };

  const domain0 = align(min0, max0, zf0);
  const domain1 = align(min1, max1, zf1);

  return { domain0, domain1 };
}

function withYDomain(leaf: ChartSpec, domain: [number, number]): ChartSpec {
  if (!leaf.encoding?.y) return leaf;
  return {
    ...leaf,
    encoding: {
      ...leaf.encoding,
      y: {
        ...leaf.encoding.y,
        scale: {
          ...leaf.encoding.y.scale,
          domain,
        },
      },
    },
  } as ChartSpec;
}

type SharedDomains = { x?: [number, number]; y?: [number, number] };

/**
 * Union the quantitative x/y extents across every leaf.
 *
 * Only channels that every leaf encodes *quantitatively* are unioned — a leaf
 * mixing a nominal x with a quantitative one has no common numeric domain, and
 * an author-pinned `scale.domain` on any leaf is left to win on its own.
 */
function computeSharedDomains(leaves: ChartSpec[]): SharedDomains {
  const shared: SharedDomains = {};

  for (const channel of ['x', 'y'] as const) {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    let sawAny = false;
    let usable = true;

    for (const leaf of leaves) {
      const enc = (leaf.encoding as Encoding | undefined)?.[channel];
      // Skip *this channel* if any leaf can't take part: no encoding, a
      // non-quantitative type, or a domain the author already pinned. Bailing
      // out of the whole function here would abandon the other channel too --
      // a nominal x would silently strand a quantitative y, which is the most
      // common layered shape there is (bars plus their value labels).
      if (!enc || !('field' in enc) || enc.type !== 'quantitative' || enc.scale?.domain) {
        usable = false;
        break;
      }

      for (const row of leaf.data ?? []) {
        const v = Number((row as DataRow)[enc.field]);
        if (!Number.isFinite(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        sawAny = true;
      }
    }

    if (!usable || !sawAny || lo > hi) continue;

    // Pin the union through zero the way an unpinned scale would.
    //
    // `withSharedDomains` writes this extent onto each leaf as `scale.domain`,
    // and `resolveQuantitativeScale` takes an explicit domain *verbatim* --
    // skipping the `zero !== false` baselining it would otherwise apply. So a
    // raw [50, 100] union lands as a literal domain and the 50-bar collapses
    // to a sliver against its own baseline. Fold zero in here, honouring an
    // explicit `zero: false` on any leaf (a sparkline opting out of it).
    const wantsZero = leaves.every((leaf) => {
      const enc = (leaf.encoding as Encoding | undefined)?.[channel];
      return enc && 'scale' in enc ? enc.scale?.zero !== false : true;
    });
    shared[channel] = wantsZero ? [Math.min(0, lo), Math.max(0, hi)] : [lo, hi];
  }

  return shared;
}

/** Pin the shared domains onto a leaf's quantitative x/y channels. */
function withSharedDomains(leaf: ChartSpec, shared: SharedDomains): ChartSpec {
  if (!shared.x && !shared.y) return leaf;

  const encoding = { ...(leaf.encoding as Record<string, unknown>) };

  for (const channel of ['x', 'y'] as const) {
    const domain = shared[channel];
    const ch = encoding[channel] as Record<string, unknown> | undefined;
    if (!domain || !ch) continue;
    encoding[channel] = {
      ...ch,
      scale: { ...((ch.scale as object) ?? {}), domain },
    };
  }

  // ChartSpec is a union discriminated on `mark`, and spreading widens the
  // encoding past whichever member `leaf` is, so re-assert the original type.
  return { ...leaf, encoding } as unknown as ChartSpec;
}

function buildPrimarySpec(leaves: ChartSpec[], layerSpec: LayerSpec): ChartSpec {
  const allData = leaves.flatMap((leaf) => leaf.data);

  const primary = {
    ...leaves[0],
    data: allData,
    chrome: layerSpec.chrome ?? leaves[0].chrome,
    // Annotations come from the parent LayerSpec when present, otherwise
    // the first flattened leaf's. Later leaves' annotations are silently
    // dropped. The dual-axis path (compileLayerIndependent) explicitly
    // clears the secondary axis spec's annotations.
    annotations: layerSpec.annotations ?? leaves[0].annotations,
    labels: layerSpec.labels ?? leaves[0].labels,
    legend: layerSpec.legend ?? leaves[0].legend,
    responsive: layerSpec.responsive ?? leaves[0].responsive,
    theme: layerSpec.theme ?? leaves[0].theme,
    darkMode: layerSpec.darkMode ?? leaves[0].darkMode,
    watermark: layerSpec.watermark ?? leaves[0].watermark,
    hiddenSeries: layerSpec.hiddenSeries ?? leaves[0].hiddenSeries,
    endpointLabels: layerSpec.endpointLabels ?? leaves[0].endpointLabels,
  };

  return primary;
}
