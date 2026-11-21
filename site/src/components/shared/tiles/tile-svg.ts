/**
 * Slims a static tile SVG: whole-pixel geometry is the renderer's job; this
 * drops the data attributes and ids only a live chart reads, since a tile's
 * chart is a picture behind `aria-hidden`.
 */
import { DEMO_ATTR } from "../../../lib/demo/markup";

/** Data attributes the slimmed SVGs keep: CSS picks a theme by one, demos.ts removes the placeholder by the other. */
const KEPT_DATA_ATTRIBUTES = new Set(["data-theme", DEMO_ATTR.placeholder]);

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

const GEOMETRY = new Set(["x", "y", "width", "height", "rx", "ry"]);
const RECT = /<rect\b([^>]*?)\/>/y;
const ATTRIBUTE = /([\w:-]+)="([^"]*)"/g;

/** A rect's outline as path data, with its corners rounded by `r`. */
function rectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${x} ${y}h${w}v${h}h${-w}z`;
  const s = Math.min(r, w / 2, h / 2);
  return (
    `M${x + s} ${y}h${w - 2 * s}a${s} ${s} 0 0 1 ${s} ${s}v${h - 2 * s}` +
    `a${s} ${s} 0 0 1 ${-s} ${s}h${-(w - 2 * s)}a${s} ${s} 0 0 1 ${-s} ${-s}` +
    `v${-(h - 2 * s)}a${s} ${s} 0 0 1 ${s} ${-s}z`
  );
}

type ParsedRect = { paint: string; d: string };

function parseRect(attributes: string): ParsedRect {
  const geometry: Record<string, number> = {};
  const paint: string[] = [];
  for (const [, name = "", value = ""] of attributes.matchAll(ATTRIBUTE)) {
    if (GEOMETRY.has(name)) geometry[name] = Number(value);
    else paint.push(`${name}="${value}"`);
  }
  const { x = 0, y = 0, width = 0, height = 0, rx = 0 } = geometry;
  return { paint: paint.join(" "), d: rectPath(x, y, width, height, rx) };
}

/** Group attributes that change how a group's content paints; a group with any of them stays. */
const PAINTING_GROUP = /\s(?:transform|clip-path|mask|filter|opacity|fill|stroke|style)=/;

/**
 * Lifts a rect out of a group that holds only it and changes nothing about how
 * it paints, as the renderer wraps each mark for a live chart's hit testing and
 * labels. In an image those wrappers do nothing, and they keep rects apart.
 */
function unwrapLoneRects(svg: string): string {
  return svg.replace(
    /<g\b([^>]*)>(<rect\b[^>]*\/>)<\/g>/g,
    (group, attributes: string, rect: string) => (PAINTING_GROUP.test(attributes) ? group : rect),
  );
}

/**
 * Draws each run of adjacent rects that share every attribute but their
 * geometry as one path, as a waffle's cells or a heatmap's rows of one color,
 * after lifting each out of a wrapper group that only marks it. Adjacent only,
 * so paint order never changes.
 */
export function mergeRects(svg: string): string {
  return mergeAdjacentRects(unwrapLoneRects(svg));
}

function mergeAdjacentRects(svg: string): string {
  let out = "";
  let index = 0;
  while (index < svg.length) {
    const start = svg.indexOf("<rect", index);
    if (start === -1) break;
    out += svg.slice(index, start);
    const run: ParsedRect[] = [];
    let cursor = start;
    for (;;) {
      RECT.lastIndex = cursor;
      const match = RECT.exec(svg);
      if (!match) break;
      const rect = parseRect(match[1] ?? "");
      if (run.length > 0 && rect.paint !== run[0]?.paint) break;
      run.push(rect);
      cursor = RECT.lastIndex;
    }
    if (run.length < 2) {
      // Not a run (or not a self-closing rect): copy one tag through as it is.
      const end = svg.indexOf(">", start) + 1;
      out += svg.slice(start, end);
      index = end;
      continue;
    }
    const paint = run[0]?.paint ? ` ${run[0].paint}` : "";
    out += `<path d="${run.map((rect) => rect.d).join("")}"${paint}/>`;
    index = cursor;
  }
  return out + svg.slice(index);
}
