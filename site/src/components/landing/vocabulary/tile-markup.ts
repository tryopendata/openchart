/**
 * The build-time HTML of a wall tile's chart: a bare demo stage and the embedded
 * spec, in the demo markup contract, so the page's demo script (scripts/demos.ts)
 * mounts each tile and plays its entrance the first time it is seen, like any
 * demo. Charts with a static renderer get the demo system's light and dark SVGs,
 * laid out at the tile size and slimmed: whole-pixel geometry, and none of the
 * data attributes and ids only a live chart reads, since the stage sits behind
 * `aria-hidden`. Tables get a small HTML table of their first rows; sankeys and
 * networks get the demo system's placeholder line naming the chart.
 */
import { buildD3Formatter, isTableSpec, type VizSpec } from "@opendata-ai/openchart-core";
import { getDemo } from "../../../demos/registry";
import type { VocabularyTile } from "../../../landing/vocabulary";
import { demoDomId } from "../../../lib/demo/dom-id";
import { escapeHtml } from "../../../lib/demo/escape-html";
import { bareStageHtml, embeddedSpecHtml, stageContentHtml } from "../../../lib/demo/figure";
import { DEMO_ATTR } from "../../../lib/demo/markup";
import { validateDemo } from "../../../lib/demo/validate";
import { TILE_SVG_SIZE, TILE_TABLE, tileSpec } from "./tile-spec";

/** Data attributes the slimmed SVGs keep: CSS picks a theme by one, demos.ts removes the placeholder by the other. */
const KEPT_DATA_ATTRIBUTES = new Set(["data-theme", DEMO_ATTR.placeholder]);

/** The class on a tile's stage, which landing-wall.css sizes. */
export const TILE_STAGE_CLASS = "wall-stage";

/**
 * The markup without `data-*` attributes (except those in KEPT_DATA_ATTRIBUTES)
 * and without ids nothing in it references. Ids that a `url(#…)`, `href="#…"`
 * or an ARIA reference points at, such as clip paths, gradients and titles, stay.
 */
export function slimSvg(svg: string): string {
  const referenced = new Set([
    ...[...svg.matchAll(/(?:url\(#|href="#)([^)"]+)/g)].map(([, id]) => id ?? ""),
    ...[...svg.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)].flatMap(([, ids]) =>
      (ids ?? "").split(/\s+/),
    ),
  ]);
  return svg
    .replace(/\s(data-[\w-]+)(?:="[^"]*")?(?=[\s>/])/g, (attribute, name: string) =>
      KEPT_DATA_ATTRIBUTES.has(name) ? attribute : "",
    )
    .replace(/\sid="([^"]*)"/g, (attribute, id: string) => (referenced.has(id) ? attribute : ""));
}

type TableColumn = { key: string; label?: string; format?: string; align?: string };

function cellText(value: unknown, format: string | undefined): string {
  if (typeof value === "number") return (buildD3Formatter(format) ?? String)(value);
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * A table spec's first rows as a plain HTML table: what a table tile shows until
 * its live table mounts, and all a reader without JavaScript sees. Columns that
 * hold series (sparklines) are left out.
 */
export function tableFallbackHtml(spec: VizSpec): string {
  if (!isTableSpec(spec)) return "";
  const rows = (spec.data as Record<string, unknown>[]).slice(0, TILE_TABLE.rows);
  const columns = (spec.columns as TableColumn[])
    .filter((column) => rows.every((row) => !Array.isArray(row[column.key])))
    .slice(0, TILE_TABLE.columns);
  const align = (column: TableColumn) =>
    column.align === "right" ? ' class="wall-table-number"' : "";
  const head = columns
    .map((column) => `<th${align(column)}>${escapeHtml(column.label ?? column.key)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map(
            (column) =>
              `<td${align(column)}>${escapeHtml(cellText(row[column.key], column.format))}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table class="wall-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * The stage's content for one tile spec: slimmed static SVGs, or the demo
 * system's placeholder line naming the chart, which a table tile sets as a
 * caption under its first rows.
 */
function tileStageContent(demo: string, title: string, spec: VizSpec): string {
  const content = stageContentHtml({
    spec,
    title,
    domId: `w-${demoDomId(demo)}`,
    ...TILE_SVG_SIZE,
    static: true,
    precision: 0,
  });
  const slim = slimSvg(content);
  return isTableSpec(spec) ? tableFallbackHtml(spec) + slim : slim;
}

/**
 * One tile's stage and embedded spec. `pageShared` is the page's record of
 * shared values already written (`pageSharedHashes(Astro.locals)`), so a value
 * such as a US atlas goes into the page once.
 *
 * @throws {Error} Naming the tile when its demo is unknown or its spec fails validation.
 */
export function tileChartHtml(tile: VocabularyTile, pageShared: Set<string>): string {
  let title: string;
  let spec: VizSpec;
  try {
    const demo = getDemo(tile.demo);
    validateDemo(tile.demo, demo.spec);
    title = demo.title;
    spec = tileSpec(demo.spec);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`src/landing/vocabulary.ts tile "${tile.demo}": ${reason}`, { cause: error });
  }
  const stage = bareStageHtml(tileStageContent(tile.demo, title, spec), TILE_STAGE_CLASS);
  return stage + embeddedSpecHtml(spec, pageShared);
}
