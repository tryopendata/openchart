/**
 * SVG gradient utilities: creates <linearGradient> and <radialGradient>
 * elements from GradientDef specs and resolves mark fills to url(#id) refs.
 */

import type { GradientDef, LinearGradient, RadialGradient } from '@opendata-ai/openchart-core';
import { isGradientDef } from '@opendata-ai/openchart-core';
import { nextSvgId } from './svg-ids';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Produce a stable, deterministic key for a GradientDef.
 * Used for deduplication so identical gradients share one SVG element.
 * Recursively sorts object keys for stability across property order variations.
 */
function gradientKey(def: GradientDef): string {
  return sortedStringify(def);
}

function sortedStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return `[${value.map(sortedStringify).join(',')}]`;
  if (typeof value === 'object') {
    const sorted = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${sortedStringify((value as Record<string, unknown>)[k])}`);
    return `{${sorted.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Create a single SVG gradient element (<linearGradient> or <radialGradient>).
 * Uses gradientUnits="objectBoundingBox" so coordinates are in [0,1] space.
 */
function createGradientElement(def: GradientDef, id: string): SVGElement {
  if (def.gradient === 'linear') {
    return createLinearGradient(def, id);
  }
  return createRadialGradient(def, id);
}

function createLinearGradient(def: LinearGradient, id: string): SVGElement {
  const el = document.createElementNS(SVG_NS, 'linearGradient');
  el.setAttribute('id', id);
  el.setAttribute('gradientUnits', 'objectBoundingBox');
  el.setAttribute('x1', String(def.x1 ?? 0));
  el.setAttribute('y1', String(def.y1 ?? 0));
  el.setAttribute('x2', String(def.x2 ?? 0));
  el.setAttribute('y2', String(def.y2 ?? 1));

  for (const stop of def.stops) {
    appendStop(el, stop);
  }

  return el;
}

function createRadialGradient(def: RadialGradient, id: string): SVGElement {
  const el = document.createElementNS(SVG_NS, 'radialGradient');
  el.setAttribute('id', id);
  el.setAttribute('gradientUnits', 'objectBoundingBox');
  // SVG radialGradient: cx/cy/r = outer circle, fx/fy/fr = focal (inner) circle
  // Spec: x2/y2/r2 = outer, x1/y1/r1 = inner (focal)
  el.setAttribute('cx', String(def.x2 ?? 0.5));
  el.setAttribute('cy', String(def.y2 ?? 0.5));
  el.setAttribute('r', String(def.r2 ?? 0.5));
  el.setAttribute('fx', String(def.x1 ?? 0.5));
  el.setAttribute('fy', String(def.y1 ?? 0.5));
  el.setAttribute('fr', String(def.r1 ?? 0));

  for (const stop of def.stops) {
    appendStop(el, stop);
  }

  return el;
}

function appendStop(
  parent: SVGElement,
  stop: { offset: number; color: string; opacity?: number },
): void {
  const stopEl = document.createElementNS(SVG_NS, 'stop');
  stopEl.setAttribute('offset', String(stop.offset));
  stopEl.setAttribute('stop-color', stop.color);
  if (stop.opacity !== undefined) {
    stopEl.setAttribute('stop-opacity', String(stop.opacity));
  }
  parent.appendChild(stopEl);
}

/**
 * Scan all marks for GradientDef fill values, create SVG gradient elements
 * in the provided <defs> node, and return a map from gradient key to element ID.
 *
 * Identical gradients (by key) share a single SVG element within one chart.
 * IDs come from `nextSvgId` so they're globally unique across charts and
 * share the counter with clip-path IDs (see svg-ids.ts). Gradient ID numbers
 * may skip values when clip-paths consume counter slots - still monotonic,
 * still unique.
 */
export function buildGradientDefs(
  marks: Array<{ fill?: unknown }>,
  defs: SVGElement,
): Map<string, string> {
  const map = new Map<string, string>();

  for (const mark of marks) {
    const fill = mark.fill;
    if (fill && isGradientDef(fill)) {
      const key = gradientKey(fill);
      if (!map.has(key)) {
        const id = nextSvgId('oc-grad');
        const el = createGradientElement(fill, id);
        defs.appendChild(el);
        map.set(key, id);
      }
    }
  }

  return map;
}

/**
 * Resolve a mark's fill value to a CSS/SVG fill string.
 * Returns the color string directly for plain fills,
 * or "url(#gradientId)" for gradient fills.
 */
export function resolveMarkFill(
  fill: string | GradientDef,
  gradientMap: Map<string, string>,
): string {
  if (typeof fill === 'string') return fill;
  const key = gradientKey(fill);
  const id = gradientMap.get(key);
  return id ? `url(#${id})` : '#000000';
}
