/**
 * SVG pattern utilities: creates <pattern> elements from ResolvedFillPattern
 * specs (engine output for `mark.fillPattern: 'auto'`) and resolves mark
 * fills to url(#id) refs. Mirrors the gradient defs lifecycle in
 * gradient-utils.ts, including nextSvgId-based deterministic IDs.
 */

import type { ResolvedFillPattern } from '@opendata-ai/openchart-core';
import { nextSvgId } from './svg-ids';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Pattern tile size in px (userSpaceOnUse, so zoom-stable within the SVG). */
const TILE = 6;

/**
 * Opacity of the pattern geometry over the series base color. Full-contrast
 * lines read as stripes and fight the data; a settled overlay keeps the
 * series color dominant while the texture stays clearly legible.
 */
const LINE_OPACITY = 0.55;

/** Stable dedup key: one SVG element per unique (type, base, line) combo. */
function patternKey(p: ResolvedFillPattern): string {
  return `${p.type}|${p.base}|${p.line}`;
}

/** Create one <pattern> tile: base-color rect + line-colored geometry. */
function createPatternElement(p: ResolvedFillPattern, id: string): SVGElement {
  const el = document.createElementNS(SVG_NS, 'pattern');
  el.setAttribute('id', id);
  el.setAttribute('patternUnits', 'userSpaceOnUse');
  el.setAttribute('width', String(TILE));
  el.setAttribute('height', String(TILE));

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', String(TILE));
  bg.setAttribute('height', String(TILE));
  bg.setAttribute('fill', p.base);
  el.appendChild(bg);

  if (p.type === 'dot') {
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(TILE / 2));
    dot.setAttribute('cy', String(TILE / 2));
    dot.setAttribute('r', '1.2');
    dot.setAttribute('fill', p.line);
    dot.setAttribute('fill-opacity', String(LINE_OPACITY));
    el.appendChild(dot);
    return el;
  }

  // Stroked shapes. Diagonal paths include half-tile companions so the
  // hatch stays continuous across tile seams.
  const d =
    p.type === 'diagonal'
      ? `M0,${TILE} l${TILE},-${TILE} M-1.5,1.5 l3,-3 M${TILE - 1.5},${TILE + 1.5} l3,-3`
      : p.type === 'crosshatch'
        ? `M0,0 l${TILE},${TILE} M${TILE},0 l-${TILE},${TILE}`
        : `M${TILE / 2},0 V${TILE}`;

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('stroke', p.line);
  path.setAttribute('stroke-width', '1');
  path.setAttribute('stroke-opacity', String(LINE_OPACITY));
  el.appendChild(path);
  return el;
}

/**
 * Scan marks for resolved fill patterns, create <pattern> elements in the
 * provided <defs> node, and return a map from pattern key to element ID.
 *
 * Identical patterns share one SVG element within a chart. IDs come from
 * `nextSvgId` (shared counter with gradients and clip-paths) so they are
 * deterministic at generation time and globally unique across charts.
 */
export function buildPatternDefs(
  marks: Array<{ pattern?: ResolvedFillPattern }>,
  defs: SVGElement,
): Map<string, string> {
  const map = new Map<string, string>();

  for (const mark of marks) {
    const pattern = mark.pattern;
    if (!pattern) continue;
    const key = patternKey(pattern);
    if (!map.has(key)) {
      const id = nextSvgId('oc-pattern');
      defs.appendChild(createPatternElement(pattern, id));
      map.set(key, id);
    }
  }

  return map;
}

/**
 * Resolve a mark's pattern to an SVG fill string ("url(#id)"), falling back
 * to the pattern's base color if the def is missing (defensive; buildPatternDefs
 * runs over the same mark list first).
 */
export function resolvePatternFill(
  pattern: ResolvedFillPattern,
  patternMap: Map<string, string>,
): string {
  const id = patternMap.get(patternKey(pattern));
  return id ? `url(#${id})` : pattern.base;
}
