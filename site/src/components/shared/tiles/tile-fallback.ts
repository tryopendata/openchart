/**
 * What a tile shows for a chart the library draws only in the browser: a small
 * HTML table, set in the shared tile table style (tiles.css). A table tile
 * shows its first rows; a sankey tile its largest flows. It is what a reader
 * without JavaScript sees, and what any reader sees until the live chart mounts.
 */
import {
  buildD3Formatter,
  isSankeySpec,
  isTableSpec,
  type VizSpec,
} from "@opendata-ai/openchart-core";
import { escapeHtml } from "../../../lib/demo/escape-html";

/** How many flows a sankey tile lists. */
export const SANKEY_FLOWS = 8;

type TableColumn = { key: string; label?: string; format?: string; align?: string };
type Cell = { text: string; number: boolean };

function cellText(value: unknown, format: string | undefined): string {
  if (typeof value === "number") return (buildD3Formatter(format) ?? String)(value);
  if (value === null || value === undefined) return "";
  return String(value);
}

/** A small table with numbers right-aligned in tabular figures. */
function tableHtml(head: Cell[], rows: Cell[][]): string {
  const cls = (cell: Cell) => (cell.number ? ' class="tile-table-number"' : "");
  const th = head.map((cell) => `<th${cls(cell)}>${escapeHtml(cell.text)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td${cls(cell)}>${escapeHtml(cell.text)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table class="tile-table"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * A table tile spec's rows as a plain HTML table, in the columns the tile
 * spec kept. Columns that hold series (sparklines) are left out.
 */
export function tableFallbackHtml(spec: VizSpec): string {
  if (!isTableSpec(spec)) return "";
  const rows = spec.data as Record<string, unknown>[];
  const columns = (spec.columns as TableColumn[]).filter((column) =>
    rows.every((row) => !Array.isArray(row[column.key])),
  );
  const isNumber = (column: TableColumn) => column.align === "right";
  return tableHtml(
    columns.map((column) => ({ text: column.label ?? column.key, number: isNumber(column) })),
    rows.map((row) =>
      columns.map((column) => ({
        text: cellText(row[column.key], column.format),
        number: isNumber(column),
      })),
    ),
  );
}

type Channel = { field?: string; format?: string };

/** A sankey's largest flows, largest first, as From, To and the value in the spec's format. */
export function sankeyFallbackHtml(spec: VizSpec): string {
  if (!isSankeySpec(spec)) return "";
  const encoding = spec.encoding as unknown as Record<"source" | "target" | "value", Channel>;
  const field = (channel: Channel, fallback: string) => channel.field ?? fallback;
  const rows = (spec.data as Record<string, unknown>[])
    .map((row) => ({
      from: String(row[field(encoding.source, "source")]),
      to: String(row[field(encoding.target, "target")]),
      value: Number(row[field(encoding.value, "value")]),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, SANKEY_FLOWS);
  return tableHtml(
    [
      { text: "From", number: false },
      { text: "To", number: false },
      { text: "Flow", number: true },
    ],
    rows.map((row) => [
      { text: row.from, number: false },
      { text: row.to, number: false },
      { text: cellText(row.value, encoding.value.format), number: true },
    ]),
  );
}
