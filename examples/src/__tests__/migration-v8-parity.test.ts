/// <reference types="vite/client" />
/**
 * v8 -> v9 migration parity, measured against real v8.9.1 compile output.
 *
 * Fixtures come from `bun run test:parity:capture` (scripts/capture-v8-parity.mjs):
 * every authored v8.9.1 example spec compiled by v8.9.1 at 390px and 1280px.
 * Here each spec goes through `migrateSpecV8()` and the v9 engine at the same size,
 * and both layouts are reduced by the shared `parity-signature.ts` extractor.
 *
 * Gate (RFC section 7 acceptance: "migrated v8 specs keep v8 styling; layout is
 * not promised pixel-identical"):
 * - style equals v8 except the exact additive control metadata and B1 font fixes
 *   listed below (every other flattened field compares in both directions).
 * - geometry must be identical unless a D14 layout heuristic applies. Of the D14
 *   items, only placement order, connector-crossing scoring, source-order note
 *   numbering and wrapped rich-text notes can move geometry, and all four act on
 *   text annotations (the color and refline/range size items are style, which
 *   migration materializes; token stamping is renderer-only; inferFieldType moved
 *   nothing in this corpus; the gallery `labelPlacement` rewrites only touch v9
 *   examples). So a spec without text annotations must match v8 exactly. A spec
 *   with them may move only in the categories its GEOMETRY_ALLOWLIST entry names,
 *   and the entry cites the D14 item. Entries must have text annotations and must
 *   move in every listed category, so the list cannot go stale silently.
 *
 * R14 additionally permits exact x/cx changes for composedSpecForPanel only:
 * its primary axis already used [0.8, 4], while v8 marks incorrectly used
 * [0.8, 3.9]. The approval lists every before/final pair; the numerical test
 * below requires every point and label to agree with the displayed axis.
 *
 * PARITY_REPORT=1 prints a summary table; PARITY_DUMP=<file> also writes every
 * fixture's v8/v9 signatures and deltas as JSON for investigation.
 */
process.env.TZ = 'UTC';

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import usCountiesAlbers from 'us-atlas/counties-albers-10m.json';
import usStates from 'us-atlas/states-10m.json';
import usStatesAlbers from 'us-atlas/states-albers-10m.json';
import { describe, expect, it } from 'vitest';
import worldCountries from 'world-atlas/countries-110m.json';
import {
  compileBarList,
  compileChart,
  compileGeoMap,
  compileGraph,
  compileLayer,
  compileSankey,
  compileTable,
  compileTileMap,
} from '../../../packages/engine/src/compile';
import { migrateSpecV8 } from '../../../packages/engine/src/migration/v8';
import {
  APPROVED_AXIS_TITLE_LAYOUT,
  APPROVED_B3_MAP_LAYOUT,
  APPROVED_ENDPOINT_TOP_SWEEP,
  APPROVED_MAP_KEY_PLACEMENT,
  APPROVED_PRE_RFC_LAYOUT,
  APPROVED_R14_SHARED_AXIS,
  APPROVED_RFC_B1_LAYOUT,
} from './migration-v8-approved-changes';
import { APPROVED_C7_ATTRIBUTION } from './migration-v8-attribution-changes';
import {
  flatten,
  GEOMETRY_CATEGORIES,
  type Geometry,
  type Signature,
  signature,
} from './parity-signature';

interface Entry {
  name: string;
  width: number;
  spec: unknown;
  signature: Signature;
}
const capture = JSON.parse(
  gunzipSync(
    readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__/v8-parity.json.gz'),
    ),
  ).toString(),
) as { tag: string; commit: string; entries: Entry[]; skipped: unknown[] };

const topologies: Record<string, unknown> = {
  'us-atlas/counties-albers-10m.json': usCountiesAlbers,
  'us-atlas/states-10m.json': usStates,
  'us-atlas/states-albers-10m.json': usStatesAlbers,
  'world-atlas/countries-110m.json': worldCountries,
};
const hydrate = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value), (_key, child) =>
    child && typeof child === 'object' && typeof child.$topology === 'string'
      ? topologies[child.$topology]
      : child,
  );

// biome-ignore lint/suspicious/noExplicitAny: fixtures are untyped v8 JSON.
function compile(spec: any, width: number) {
  const options = { width, height: 400, onWarn: () => {} };
  if ('layer' in spec) return compileLayer(spec, options);
  if ('mark' in spec) return compileChart(spec, options);
  switch (spec.type) {
    case 'table':
      return compileTable(spec, options);
    case 'graph':
      return compileGraph(spec, options);
    case 'sankey':
      return compileSankey(spec, options);
    case 'map':
      return compileGeoMap(spec, options);
    case 'barlist':
      return compileBarList(spec, options);
    case 'tilemap':
      return compileTileMap(spec, options);
  }
  throw new Error(`Unknown spec kind for ${JSON.stringify(Object.keys(spec))}`);
}

interface StyleDiff {
  path: string;
  v8: unknown;
  v9: unknown;
}
function styleDiff(v8: Signature['style'], v9: Signature['style']): StyleDiff[] {
  const before = flatten(v8);
  const after = flatten(v9);
  const diffs: StyleDiff[] = [];
  for (const [path, value] of Object.entries(before))
    if (!(path in after) || after[path] !== value) diffs.push({ path, v8: value, v9: after[path] });
  for (const [path, value] of Object.entries(after))
    if (!(path in before)) diffs.push({ path, v8: undefined, v9: value });
  return diffs;
}

interface CategoryDelta {
  /** Largest absolute px difference over numeric values present on both sides. */
  maxAbs: number;
  /** Values added, removed, or changed in kind or text (tick labels, note text). */
  structural: number;
}
function geometryDelta(v8: Geometry, v9: Geometry) {
  const out: Record<string, CategoryDelta> = {};
  for (const category of GEOMETRY_CATEGORIES) {
    const before = v8[category] ?? {};
    const after = v9[category] ?? {};
    const delta = { maxAbs: 0, structural: 0 };
    for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const a = before[path];
      const b = after[path];
      if (typeof a === 'number' && typeof b === 'number')
        delta.maxAbs = Math.max(delta.maxAbs, Math.round(Math.abs(a - b) * 100) / 100);
      else if (a !== b) delta.structural++;
    }
    out[category] = delta;
  }
  return out;
}

type Category = (typeof GEOMETRY_CATEGORIES)[number];
/** Plot shrink from a taller reserved note band moves everything below the chrome. */
const NOTE_BAND: Category[] = ['area', 'chrome', 'axes', 'marks', 'annotations', 'notes'];
const NUMBERING = 'D14 source-order note numbering (RFC section 4 "Numbering (v9, D14)")';
const WRAPPED =
  'D14 wrapped rich-text notes: the subtitle gets its own note line, and the reserved ' +
  'note band (8.11 stabilization) grows, shrinking the plot (RFC section 4 "Note content")';
const PLAN_HEIGHT =
  'v9 layout plan sizes y ticks against the final plot height (v8 left the subtract-mode ' +
  'note band out and picked ticks for a taller plot: 8 ticks 16px apart at 130px) ' +
  '(RFC section 7: layout is not promised pixel-identical)';
const CURVE_TAIL =
  'curve connectors are shaped to the data point and shortened along their end tangent, ' +
  'so the tail aims at the marker (v8 shortened along the chord)';
const PLACEMENT =
  'D14 placement order and connector-crossing scoring (RFC section 4 "Placement order ' +
  'and scoring (v9, D14)")';

/**
 * Specs whose geometry moves under v9 because of a D14 heuristic (RFC section 2
 * D14; section 9 phase 5 "D14 retunes"), with the categories allowed to move.
 * Keyed by fixture name; applies to both widths.
 */
const GEOMETRY_ALLOWLIST: Record<string, { d14: string; categories: Category[] }> = {
  '../gallery/charts-scatter-distribution.stories.tsx.bubbleSpec': {
    d14: NUMBERING,
    categories: ['notes'],
  },
  '../gallery/charts-scatter-distribution.stories.tsx.colorScatterSpec': {
    d14: NUMBERING,
    categories: ['notes'],
  },
  // v9 also emits display lines for one-line notes (wrapped notes).
  '../gallery/charts-scatter-distribution.stories.tsx.trendScatterSpec': {
    d14: `${NUMBERING}; ${WRAPPED}`,
    categories: ['notes'],
  },
  '../gallery/features-annotations.stories.tsx.textAnnotationSpec': {
    d14: WRAPPED,
    categories: NOTE_BAND,
  },
  '../gallery/features-annotations.stories.tsx.ledeSpec': { d14: WRAPPED, categories: NOTE_BAND },
  // At 1280 the new candidate scoring also demotes "Straight, no arrow" to a note.
  '../gallery/features-annotations.stories.tsx.connectorsSpec': {
    d14: `${WRAPPED}; ${PLACEMENT}`,
    categories: NOTE_BAND,
  },
  '../gallery/features-annotations.stories.tsx.thinningSpec': {
    d14: `${NUMBERING}; ${PLACEMENT}`,
    categories: ['annotations', 'notes'],
  },
  '../gallery/features-annotations.stories.tsx.richTextSpec': {
    d14: CURVE_TAIL,
    categories: ['annotations'],
  },
  '../gallery/showcase.stories.tsx.scatterSpec': {
    d14: CURVE_TAIL,
    categories: ['annotations'],
  },
  '../testing/fixtures-lines.stories.tsx.lineSpec': {
    d14: PLAN_HEIGHT,
    categories: ['axes'],
  },
  '../testing/fixtures-bars.stories.tsx.tempSpec': {
    d14: PLACEMENT,
    categories: ['annotations'],
  },
};

const RETIRED_LABELS =
  'RFC 8.1 "End-of-line labels": v9 retires per-mark line-end labels and migration ' +
  'rewrites them to a label-only endpoint column, which has no per-label font settings ' +
  'and reserves its own column beside the plot';

/**
 * Specs whose STYLE differs from v8 because a documented migration rewrite has
 * no style-preserving v9 equivalent. Keyed by fixture name; applies to both
 * widths. `style` lists flattened style path prefixes that may differ (exact
 * path or a `prefix.` descendant); `geometry` lists categories that may move.
 * Every listed prefix and category must differ at some width.
 */
const STYLE_ALLOWLIST: Record<string, { reason: string; style: string[]; geometry: Category[] }> = {
  '../gallery/features-data-encoding.stories.tsx.dashEncodingSpec': {
    reason: RETIRED_LABELS,
    style: ['endpointLabels', 'marks.0.label', 'marks.1.label', 'marks.2.label'],
    geometry: ['area', 'axes', 'marks', 'labels', 'endpointLabels'],
  },
};
/**
 * Style paths allowed to differ in every fixture, each with its reason. Endpoint
 * markers are centered on the line's last point (where hover dots, the
 * crosshair and annotation anchors sit) instead of offset by their radius, so
 * their fill must be opaque to cover the line end.
 */
const CORPUS_STYLE_CHANGES: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /^endpointLabels\.(entries|leading)\.\d+\.marker\.fill$/,
    reason: 'endpoint markers center on the data point with an opaque knockout fill',
  },
];
// These are additive resolved metadata, not a license to change existing style.
const ENDPOINT_CONTROL_METADATA: Record<string, number> = {
  'theme.fonts.sizes.endpointLabel': 13,
  'theme.fonts.sizes.endpointValue': 12,
  'theme.spacing.endpointEntryGap': 6,
  'theme.spacing.endpointValueGap': 4,
  'theme.spacing.endpointColumnGap': 18,
};
const VALUE_FONT_PATH = /^marks(?:\.facet\[[^\]]+\])?\.\d+\.label\.style\.fontFamily$/;
const VALUE_FONT_REASON =
  'B1: bar/column, dot and range value labels follow the resolved theme font instead of hardcoded system-ui; pie already did so.';
function sanctionedValueFontChange(diff: StyleDiff, next: Signature | undefined): boolean {
  if (
    !next ||
    !VALUE_FONT_PATH.test(diff.path) ||
    diff.v8 !== 'system-ui, -apple-system, sans-serif'
  )
    return false;
  const fields = flatten(next.style);
  const mark = diff.path.slice(0, -'.label.style.fontFamily'.length);
  return (
    ['rect', 'point'].includes(String(fields[`${mark}.type`])) &&
    diff.v9 === fields['theme.fonts.family']
  );
}
const sanctionedEndpointPrecisionChange = (diff: StyleDiff) => {
  if (
    !/^endpointLabels\.(entries|leading)\.\d+\.value$/.test(diff.path) ||
    typeof diff.v8 !== 'string' ||
    typeof diff.v9 !== 'string'
  )
    return false;
  if (!/^[+−-]?\d+(?:\.\d+)?$/.test(diff.v8) || !/^[+−-]?\d+(?:\.\d+)?$/.test(diff.v9))
    return false;
  const trimPrecision = (value: string) =>
    value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
  return trimPrecision(diff.v8) === trimPrecision(diff.v9);
};
const additiveEndpointMetadata = (diff: StyleDiff) =>
  diff.v8 === undefined &&
  Object.hasOwn(ENDPOINT_CONTROL_METADATA, diff.path) &&
  diff.v9 === ENDPOINT_CONTROL_METADATA[diff.path];

const additiveV8ScaffoldingMetadata = (
  diff: StyleDiff,
  next: Signature | undefined,
  isMap: boolean,
) => {
  if (diff.v8 !== undefined || !next) return false;
  const fields = flatten(next.style);
  if (diff.path === 'theme.colors.gridlineZero') return diff.v9 === fields['theme.colors.gridline'];
  return (
    (diff.path === 'theme.colors.mapInteriorBorder' &&
      diff.v9 === (isMap ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.14)')) ||
    (diff.path === 'theme.colors.mapOutlineBorder' &&
      diff.v9 === (isMap ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.40)'))
  );
};

const underPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}.`);

/** Whether any spec level (root, layer, override) authors a text annotation. */
function hasTextAnnotation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (
    Array.isArray(record.annotations) &&
    record.annotations.some((annotation) => (annotation as { type?: string })?.type === 'text')
  )
    return true;
  return Object.values(record).some(hasTextAnnotation);
}

const results = capture.entries.map((entry) => {
  const { spec: migrated } = migrateSpecV8(hydrate(entry.spec));
  let v9: Signature | undefined;
  let error: string | undefined;
  try {
    v9 = signature(compile(migrated, entry.width));
  } catch (caught) {
    error = (caught as Error).message;
  }
  return {
    ...entry,
    v9,
    error,
    style: v9 ? styleDiff(entry.signature.style, v9.style) : [],
    geometry: v9 ? geometryDelta(entry.signature.geometry, v9.geometry) : undefined,
  };
});
const moved = (result: (typeof results)[number]) =>
  Object.values(result.geometry ?? {}).some((delta) => delta.maxAbs > 0 || delta.structural > 0);

if (process.env.PARITY_REPORT) {
  const rows = GEOMETRY_CATEGORIES.map((category) => {
    const deltas = results.map((result) => result.geometry?.[category]);
    return {
      category,
      fixturesMoved: deltas.filter((delta) => delta && (delta.maxAbs > 0 || delta.structural > 0))
        .length,
      maxAbsPx: Math.max(0, ...deltas.map((delta) => delta?.maxAbs ?? 0)),
      structural: deltas.reduce((sum, delta) => sum + (delta?.structural ?? 0), 0),
    };
  });
  console.log(
    `v8 parity vs ${capture.tag} (${capture.commit.slice(0, 8)}): ${results.length} fixtures, ` +
      `${results.filter((result) => result.error).length} v9 compile errors, ` +
      `${results.filter((result) => result.style.length).length} with style mismatches, ` +
      `${results.filter(moved).length} with geometry diffs, ${capture.skipped.length} skipped at capture`,
  );
  console.table(rows);
  if (process.env.PARITY_DUMP)
    writeFileSync(process.env.PARITY_DUMP, JSON.stringify(results, null, 1));
}

describe(`v8 migration parity against ${capture.tag}`, () => {
  it('has a v8 corpus', () => {
    expect(new Date(0).getTimezoneOffset()).toBe(0);
    expect(new Set(capture.entries.map((entry) => entry.name)).size).toBeGreaterThan(200);
  });

  it('adds only released endpoint control values and narrowly scoped B1 value fonts', () => {
    expect(VALUE_FONT_REASON).toContain('B1');
    for (const result of results) {
      if (!result.v9) continue;
      const fields = flatten(result.v9.style);
      for (const [path, value] of Object.entries(ENDPOINT_CONTROL_METADATA))
        expect(fields[path]).toBe(value);
    }
    expect(
      results.some((result) =>
        result.style.some((diff) => sanctionedValueFontChange(diff, result.v9)),
      ),
    ).toBe(true);
  });

  it('allowlist only names text-annotated fixtures that move in every listed category', () => {
    const stale = Object.entries(GEOMETRY_ALLOWLIST).flatMap(([name, { categories }]) => {
      const mine = results.filter((result) => result.name === name);
      if (!mine.length) return [`${name}: no such fixture`];
      if (!hasTextAnnotation(mine[0].spec))
        return [`${name}: no text annotations, D14 cannot apply`];
      return categories
        .filter((category) =>
          mine.every(({ geometry }) => {
            const delta = geometry?.[category];
            return !delta || (delta.maxAbs === 0 && delta.structural === 0);
          }),
        )
        .map((category) => `${name}: ${category} never moves`);
    });
    expect(stale).toEqual([]);
  });

  it('R14 composed GDP points and labels agree with their displayed quantitative axis', () => {
    for (const width of [390, 1280]) {
      const entry = capture.entries.find(
        (entry) =>
          entry.name === '../gallery/charts-building-blocks.stories.tsx.composedSpecForPanel' &&
          entry.width === width,
      )!;
      const migrated = migrateSpecV8(entry.spec).spec;
      const layout = compileLayer(migrated as Parameters<typeof compileLayer>[0], {
        width,
        height: 400,
        onWarn: () => {},
      });
      const ticks = layout.axes.x!.ticks;
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      const first = ticks[0],
        last = ticks[ticks.length - 1];
      const position = (value: number) =>
        first.position +
        ((value - Number(first.value)) / (Number(last.value) - Number(first.value))) *
          (last.position - first.position);
      expect(layout.xInvert?.bottomData).toBe(4);
      const dataMarks = layout.marks.filter(
        (mark) => mark.type === 'point' || mark.type === 'textMark',
      );
      expect(dataMarks).toHaveLength(20);
      for (const mark of dataMarks) {
        const actual = mark.type === 'point' ? mark.cx : mark.x;
        expect(actual, `${width}: GDP ${mark.data.gdp}`).toBeCloseTo(
          position(Number(mark.data.gdp)),
          8,
        );
      }
    }
  });

  it('approved geometry exceptions match every exact before/final path value', () => {
    for (const [key, approval] of [
      ...Object.entries(APPROVED_C7_ATTRIBUTION),
      ...Object.entries(APPROVED_B3_MAP_LAYOUT),
      ...Object.entries(APPROVED_PRE_RFC_LAYOUT),
      ...Object.entries(APPROVED_R14_SHARED_AXIS),
      ...Object.entries(APPROVED_RFC_B1_LAYOUT),
      ...Object.entries(APPROVED_MAP_KEY_PLACEMENT),
      ...Object.entries(APPROVED_AXIS_TITLE_LAYOUT),
      ...Object.entries(APPROVED_ENDPOINT_TOP_SWEEP),
    ]) {
      const result = results.find((result) => `${result.name} @${result.width}` === key)!;
      expect(result, key).toBeDefined();
      expect(approval.reason.length).toBeGreaterThan(20);
      for (const [category, paths] of Object.entries(approval.changes)) {
        for (const [path, [before, after]] of Object.entries(paths)) {
          expect(
            result.signature.geometry[category][path],
            `${key} before ${category}.${path}`,
          ).toBe(before);
          // Later B3 and C7 reservations can move a previously corrected path.
          // The new approval still guards the original v8 value and final v9 value.
          const latestPair =
            APPROVED_C7_ATTRIBUTION[key]?.changes[category]?.[path] ??
            APPROVED_B3_MAP_LAYOUT[key]?.changes[category]?.[path];
          const finalAfter = latestPair ? latestPair[1] : after;
          expect(result.v9!.geometry[category][path], `${key} after ${category}.${path}`).toBe(
            finalAfter,
          );
          expect(before).not.toBe(after);
        }
      }
    }
  });

  it('map key corrections match exact before/after style values', () => {
    for (const [key, approval] of [
      ...Object.entries(APPROVED_MAP_KEY_PLACEMENT),
      ...Object.entries(APPROVED_C7_ATTRIBUTION),
      ...Object.entries(APPROVED_B3_MAP_LAYOUT),
    ]) {
      const result = results.find((result) => `${result.name} @${result.width}` === key)!;
      const before = flatten(result.signature.style);
      const after = flatten(result.v9!.style);
      for (const [path, pair] of Object.entries(approval.style)) {
        expect(before[path]).toBe(pair[0]);
        expect(after[path]).toBe(pair[1]);
        expect(pair[0]).not.toBe(pair[1]);
      }
    }
  });

  it('style allowlist only names prefixes and categories that actually differ', () => {
    const stale = Object.entries(STYLE_ALLOWLIST).flatMap(([name, entry]) => {
      const mine = results.filter((result) => result.name === name);
      if (!mine.length) return [`${name}: no such fixture`];
      return [
        ...entry.style
          .filter((prefix) =>
            mine.every(({ style }) => !style.some((diff) => underPrefix(diff.path, prefix))),
          )
          .map((prefix) => `${name}: style ${prefix} never differs`),
        ...entry.geometry
          .filter((category) =>
            mine.every(({ geometry }) => {
              const delta = geometry?.[category];
              return !delta || (delta.maxAbs === 0 && delta.structural === 0);
            }),
          )
          .map((category) => `${name}: ${category} never moves`),
      ];
    });
    expect(stale).toEqual([]);
  });

  for (const result of results) {
    describe(`${result.name} @${result.width}`, () => {
      it('compiles after migration', () => {
        expect(result.error).toBeUndefined();
      });
      it('keeps v8 styling', () => {
        const allowed = STYLE_ALLOWLIST[result.name]?.style ?? [];
        expect(
          result.style.filter(
            (diff) =>
              !allowed.some((prefix) => underPrefix(diff.path, prefix)) &&
              !CORPUS_STYLE_CHANGES.some(({ pattern }) => pattern.test(diff.path)) &&
              !additiveEndpointMetadata(diff) &&
              !additiveV8ScaffoldingMetadata(
                diff,
                result.v9,
                (result.spec as { type?: string }).type === 'map',
              ) &&
              !sanctionedValueFontChange(diff, result.v9) &&
              !sanctionedEndpointPrecisionChange(diff) &&
              !Object.entries({
                ...APPROVED_MAP_KEY_PLACEMENT[`${result.name} @${result.width}`]?.style,
                ...APPROVED_B3_MAP_LAYOUT[`${result.name} @${result.width}`]?.style,
                ...APPROVED_C7_ATTRIBUTION[`${result.name} @${result.width}`]?.style,
              }).some(
                ([path, pair]) => path === diff.path && pair[0] === diff.v8 && pair[1] === diff.v9,
              ),
          ),
        ).toEqual([]);
      });
      it('keeps v8 geometry outside D14-allowlisted categories', () => {
        const allowed = new Set([
          ...(GEOMETRY_ALLOWLIST[result.name]?.categories ?? []),
          ...(STYLE_ALLOWLIST[result.name]?.geometry ?? []),
        ]);
        const approved = [
          APPROVED_C7_ATTRIBUTION[`${result.name} @${result.width}`],
          APPROVED_B3_MAP_LAYOUT[`${result.name} @${result.width}`],
          APPROVED_PRE_RFC_LAYOUT[`${result.name} @${result.width}`],
          APPROVED_R14_SHARED_AXIS[`${result.name} @${result.width}`],
          APPROVED_RFC_B1_LAYOUT[`${result.name} @${result.width}`],
          APPROVED_MAP_KEY_PLACEMENT[`${result.name} @${result.width}`],
          APPROVED_AXIS_TITLE_LAYOUT[`${result.name} @${result.width}`],
          APPROVED_ENDPOINT_TOP_SWEEP[`${result.name} @${result.width}`],
        ];
        const unexpected: Record<string, unknown> = {};
        for (const [category, delta] of Object.entries(result.geometry ?? {})) {
          if (allowed.has(category as Category) || (!delta.maxAbs && !delta.structural)) continue;
          const before = result.signature.geometry[category];
          const after = result.v9!.geometry[category];
          for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (before[path] === after[path]) continue;
            const matches = approved.some((approval) => {
              const pair = approval?.changes[category]?.[path];
              return pair && pair[0] === before[path] && pair[1] === after[path];
            });
            if (!matches) {
              unexpected[`${category}.${path}`] = { before: before[path], after: after[path] };
            }
          }
        }
        expect(unexpected).toEqual({});
      });
    });
  }
});
