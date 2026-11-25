/**
 * Painting one geo feature path for a playback frame: its class fill, class index and
 * no-data flag, and the RFC 3.5 crossfade to and from no data. While a feature fades, an
 * underlay path carrying the no-data fill sits directly behind it and the feature's class
 * fill shows over it at the fade's opacity, so the hatch shows through instead of snapping.
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

/** A decorative copy of the feature's shape, inserted just behind it. */
function createUnderlay(path: Element): SVGElement {
  const underlay = path.ownerDocument.createElementNS(SVG_NS, 'path');
  underlay.setAttribute('class', FEATURE_UNDERLAY_CLASS);
  underlay.setAttribute('d', path.getAttribute('d') ?? '');
  underlay.setAttribute('stroke', 'none');
  underlay.setAttribute('pointer-events', 'none');
  underlay.setAttribute('aria-hidden', 'true');
  // A focus dims features outside it with an inline opacity; the underlay matches.
  const opacity = (path as SVGElement).style?.getPropertyValue('opacity');
  if (opacity) underlay.style.setProperty('opacity', opacity);
  path.before(underlay);
  return underlay;
}

/** Show the no-data fill behind a fading path, creating the underlay on first use. */
function showUnderlay(path: Element, fill: string, underlays: FeatureUnderlays): void {
  let underlay = underlays.get(path);
  if (!underlay?.isConnected) {
    underlay = createUnderlay(path);
    underlays.set(path, underlay);
  }
  setIfChanged(underlay, 'fill', fill);
}

function removeUnderlay(path: Element, underlays: FeatureUnderlays): void {
  underlays.get(path)?.remove();
  underlays.delete(path);
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
  if (frame.fade) {
    showUnderlay(path, noDataFill ?? frame.fade.noDataFill, underlays);
    setIfChanged(path, 'fill', frame.fill);
    setIfChanged(path, 'fill-opacity', String(frame.fade.opacity));
  } else {
    removeUnderlay(path, underlays);
    path.removeAttribute('fill-opacity');
    setIfChanged(path, 'fill', frame.noData ? (noDataFill ?? frame.fill) : frame.fill);
  }
  if (frame.binIndex === undefined) path.removeAttribute('data-bin-index');
  else setIfChanged(path, 'data-bin-index', String(frame.binIndex));
  if (frame.noData) setIfChanged(path, 'data-nodata', 'true');
  else path.removeAttribute('data-nodata');
}
