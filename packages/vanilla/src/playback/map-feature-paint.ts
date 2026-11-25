/**
 * Painting one geo feature path for a playback frame: its class fill, class index and
 * no-data flag, and the RFC 3.5 crossfade to and from no data. While a feature fades, an
 * underlay path carrying the no-data fill sits directly behind it and the feature's class
 * fill shows over it at the fade's opacity, so the hatch shows through instead of snapping.
 * The underlay carries the feature's id and class index so every dim that reaches the
 * feature reaches it too.
 */
import type { MapFillFrame } from '@opendata-ai/openchart-engine';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Class on the no-data path drawn behind a fading feature. */
export const FEATURE_UNDERLAY_CLASS = 'oc-map-feature-underlay';

/** The underlay behind each fading feature path, by path. */
export type FeatureUnderlays = Map<Element, SVGElement>;

function setIfChanged(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function copyAttribute(from: Element, to: Element, name: string): void {
  const value = from.getAttribute(name);
  if (value === null) to.removeAttribute(name);
  else setIfChanged(to, name, value);
}

/**
 * The underlay directly behind `feature`, if it has one. Raising a feature on hover and
 * putting it back move the underlay with it, so it is always the previous sibling.
 */
function underlayOf(feature: Element): Element | null {
  const previous = feature.previousElementSibling;
  if (!previous?.classList.contains(FEATURE_UNDERLAY_CLASS)) return null;
  const id = feature.getAttribute('data-feature-id');
  return previous.getAttribute('data-feature-id') === id ? previous : null;
}

/** The elements that paint `feature`, back to front: its underlay, if any, then itself. */
export function featurePaintGroup(feature: Element): Element[] {
  const underlay = underlayOf(feature);
  return underlay ? [underlay, feature] : [feature];
}

/** Where to insert before so the result lands in front of `feature` and its underlay. */
export function featurePaintAnchor(feature: Element): Element {
  return underlayOf(feature) ?? feature;
}

/** A decorative copy of the feature's shape for the no-data fill. */
function createUnderlay(path: Element): SVGElement {
  const underlay = path.ownerDocument.createElementNS(SVG_NS, 'path');
  underlay.setAttribute('class', FEATURE_UNDERLAY_CLASS);
  underlay.setAttribute('d', path.getAttribute('d') ?? '');
  underlay.setAttribute('stroke', 'none');
  underlay.setAttribute('pointer-events', 'none');
  underlay.setAttribute('aria-hidden', 'true');
  return underlay;
}

/**
 * Show the no-data fill directly behind a fading path, creating the underlay on first use
 * and moving it back behind the path when a hover raised the path since.
 */
function showUnderlay(path: Element, fill: string, underlays: FeatureUnderlays): void {
  let underlay = underlays.get(path);
  if (!underlay?.parentNode) {
    underlay = createUnderlay(path);
    underlays.set(path, underlay);
  }
  if (underlay.nextSibling !== path) path.before(underlay);
  setIfChanged(underlay, 'fill', fill);
  copyAttribute(path, underlay, 'data-feature-id');
  copyAttribute(path, underlay, 'data-bin-index');
  // A focus dims with an inline opacity; following it each frame keeps the underlay in
  // step when the focus changes between frames.
  const opacity = (path as SVGElement).style.getPropertyValue('opacity');
  if (underlay.style.getPropertyValue('opacity') === opacity) return;
  if (opacity) underlay.style.setProperty('opacity', opacity);
  else underlay.style.removeProperty('opacity');
}

function removeUnderlay(path: Element, underlays: FeatureUnderlays): void {
  underlays.get(path)?.remove();
  underlays.delete(path);
}

/** The class index and no-data flag the legend hover and readers key on. */
function writeClassAttributes(path: Element, frame: MapFillFrame): void {
  if (frame.binIndex === undefined) path.removeAttribute('data-bin-index');
  else setIfChanged(path, 'data-bin-index', String(frame.binIndex));
  if (frame.noData) setIfChanged(path, 'data-nodata', 'true');
  else path.removeAttribute('data-nodata');
}

/**
 * Write a feature frame onto its path. `noDataFill` is the hatch's `url(#id)` the renderer
 * stamped, when the map defines one.
 */
export function writeFeature(
  path: Element,
  frame: MapFillFrame,
  noDataFill: string | null,
  underlays: FeatureUnderlays,
): void {
  writeClassAttributes(path, frame);
  if (frame.fade) {
    showUnderlay(path, noDataFill ?? frame.fade.noDataFill, underlays);
    setIfChanged(path, 'fill', frame.fill);
    setIfChanged(path, 'fill-opacity', String(frame.fade.opacity));
    return;
  }
  removeUnderlay(path, underlays);
  path.removeAttribute('fill-opacity');
  setIfChanged(path, 'fill', frame.noData ? (noDataFill ?? frame.fill) : frame.fill);
}
