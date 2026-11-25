/**
 * Writes a map playback's frames onto the SVG built from its base layout: feature fills by
 * `data-key`, tile paint by `data-state`, point radius, fill and fade by `data-point-key`,
 * each element's accessible label, and the period label's text. Reads only attributes the
 * renderer stamped, never measured geometry.
 */
import type { MapFillFrame, MapPlayback, MapPointFrame } from '@opendata-ai/openchart-engine';
import { type FeatureUnderlays, writeFeature } from './map-feature-paint';

/** Draws frames onto one rendered map SVG. */
export interface MapFrameWriter {
  /** Write `fillsAt(t)`, `pointsAt(t)` and `overlaysAt(t)` onto the base elements. */
  draw(t: number): void;
  /** Drop element references. Leaves the SVG as last drawn. */
  destroy(): void;
}

/** The renderer stamps the no-data hatch's `url(#id)` here when the map defines one. */
export const NO_DATA_FILL_ATTRIBUTE = 'data-oc-nodata-fill';

function setIfChanged(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function setStyleFill(element: Element | undefined, fill: string): void {
  if (!element) return;
  const style = (element as SVGElement & ElementCSSInlineStyle).style;
  if (style.getPropertyValue('fill') !== fill) style.setProperty('fill', fill);
}

/** A tile group: the tile's paint, and its code and value labels' ink and text. */
function writeTile(group: Element, frame: MapFillFrame): void {
  const rect = group.querySelector('rect');
  if (rect) {
    setIfChanged(rect, 'fill', frame.fill);
    setIfChanged(rect, 'fill-opacity', String(frame.fillOpacity ?? 1));
    if (frame.stroke !== undefined) setIfChanged(rect, 'stroke', frame.stroke);
  }
  if (!frame.labels) return;
  const [code, value] = group.querySelectorAll('text');
  setStyleFill(code, frame.labels.codeFill);
  if (!value) return;
  setStyleFill(value, frame.labels.valueFill);
  if (value.textContent !== frame.labels.valueText) value.textContent = frame.labels.valueText;
}

/**
 * A point's radius at the camera's current zoom: the renderer stamps the unzoomed radius in
 * `data-base-r` and divides `r` by the zoom, so the ratio of the two recovers it.
 */
function writePoint(circle: Element, frame: MapPointFrame): void {
  const baseR = Number(circle.getAttribute('data-base-r'));
  const shownR = Number(circle.getAttribute('r'));
  const zoom = baseR > 0 && shownR > 0 ? baseR / shownR : 1;
  setIfChanged(circle, 'data-base-r', String(frame.r));
  setIfChanged(circle, 'r', String(frame.r / zoom));
  setIfChanged(circle, 'fill', frame.fill);
  if (frame.presence >= 1) circle.removeAttribute('opacity');
  else setIfChanged(circle, 'opacity', String(frame.presence));
  // A faded-out point is gone from the frame, so it mustn't catch the pointer either.
  if (frame.presence > 0) circle.removeAttribute('pointer-events');
  else setIfChanged(circle, 'pointer-events', 'none');
}

function indexBy(svg: SVGElement, attribute: string): Map<string, Element[]> {
  const index = new Map<string, Element[]>();
  for (const element of svg.querySelectorAll(`[${attribute}]`)) {
    const key = element.getAttribute(attribute) as string;
    const elements = index.get(key);
    if (elements) elements.push(element);
    else index.set(key, [element]);
  }
  return index;
}

/**
 * Bind to the keyed elements of a rendered map SVG and write each frame by key. Insets can
 * draw a feature more than once, so every element with the key is written. Keys without an
 * element are ignored and unkeyed elements are never touched. Accessible labels follow the
 * nearest period, so they're written only when it changes.
 */
export function createMapFrameWriter(
  svg: SVGElement,
  playback: MapPlayback<unknown>,
): MapFrameWriter {
  // Tiles carry their key as data-state: stamping data-key too would change every static
  // tile map's output, which the static parity goldens pin.
  let byKey: Map<string, Element[]> | null = indexBy(svg, 'data-key');
  for (const [key, tiles] of indexBy(svg, 'data-state')) byKey.set(key, tiles);
  let byPointKey: Map<string, Element[]> | null = indexBy(svg, 'data-point-key');
  const noDataFill = svg.getAttribute(NO_DATA_FILL_ATTRIBUTE);
  const underlays: FeatureUnderlays = new Map();
  let labelledPeriod: number | undefined;

  return {
    draw(t) {
      if (!byKey || !byPointKey) return;
      const period = Math.round(t);
      const relabel = period !== labelledPeriod;
      labelledPeriod = period;
      for (const frame of playback.fillsAt(t)) {
        for (const element of byKey.get(frame.key) ?? []) {
          if (element.tagName.toLowerCase() === 'g') writeTile(element, frame);
          else writeFeature(element, frame, noDataFill, underlays);
          if (relabel) setIfChanged(element, 'aria-label', frame.ariaLabel);
        }
      }
      for (const frame of playback.pointsAt(t)) {
        for (const element of byPointKey.get(frame.key) ?? []) {
          writePoint(element, frame);
          if (relabel) setIfChanged(element, 'aria-label', frame.ariaLabel);
        }
      }
      for (const overlay of playback.overlaysAt(t)) {
        for (const element of byKey.get(overlay.key ?? '') ?? []) {
          if (element.textContent !== overlay.text) element.textContent = overlay.text;
        }
      }
    },
    destroy() {
      byKey = null;
      byPointKey = null;
      underlays.clear();
    },
  };
}
