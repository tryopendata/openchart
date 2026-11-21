/**
 * The build-time HTML inside a wall tile's stage. Charts with a static renderer
 * get the demo system's light and dark SVGs, laid out at the tile size and slimmed:
 * whole-pixel geometry, and none of the data attributes and ids that only a live
 * chart reads, since the tile sits behind `aria-hidden`. Tables get a small HTML
 * table of their first rows; sankeys and networks get the demo system's placeholder
 * line naming the chart, until their live chart mounts.
 */
import { buildD3Formatter, isTableSpec, type VizSpec } from "@opendata-ai/openchart-core";
import { demoDomId } from "../../../lib/demo/dom-id";
import { escapeHtml } from "../../../lib/demo/escape-html";
import { stageContentHtml } from "../../../lib/demo/figure";
import { TILE_SVG_SIZE, TILE_TABLE } from "./tile-spec";

/** CSS reads `data-theme` on each static SVG to pick the one for the page's theme. */
const KEPT_DATA_ATTRIBUTE = "data-theme";

/**
 * The SVG without `data-*` attributes (except `data-theme`) and without ids
 * nothing in it references. Ids that a `url(#…)`, `href="#…"` or an ARIA
 * reference points at, such as clip paths, gradients and titles, stay.
 */
export function slimSvg(svg: string): string {
  const referenced = new Set([
    ...[...svg.matchAll(/(?:url\(#|href="#)([^)"]+)/g)].map(([, id]) => id ?? ""),
    ...[...svg.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)].flatMap(([, ids]) =>
      (ids ?? "").split(/\s+/),
    ),
  ]);
  return svg
    .replace(/\s(data-[\w-]+)="[^"]*"/g, (attribute, name: string) =>
      name === KEPT_DATA_ATTRIBUTE ? attribute : "",
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
 * A table spec's first rows as a plain HTML table: what a reader without
 * JavaScript sees on a table tile. Columns that hold series (sparklines) are left out.
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

/** The stage content for one tile: slimmed static SVGs, a table fallback, or the placeholder line. */
export function tileStageHtml(tile: { demo: string; title: string; spec: VizSpec }): string {
  if (isTableSpec(tile.spec)) return tableFallbackHtml(tile.spec);
  const content = stageContentHtml({
    spec: tile.spec,
    title: tile.title,
    domId: `w-${demoDomId(tile.demo)}`,
    ...TILE_SVG_SIZE,
    static: true,
    precision: 0,
  });
  return slimSvg(content);
}
