import type {
  GeoLabelAffine,
  GeoLabelOverlay,
  GeoMapLayout,
  GeoTextBlock,
  Point,
} from '@opendata-ai/openchart-core';
import { resolveGeoOverlay } from '@opendata-ai/openchart-engine';
import type { Camera } from './map-camera';
import { geographicInventoryText } from './map-label-inventory';
import { nextSvgId } from './svg-ids';

const NS = 'http://www.w3.org/2000/svg';
function element(tag: string, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}
export function mapLabelAffine(camera: Camera, layout: GeoMapLayout): GeoLabelAffine {
  return {
    k: camera.k,
    tx: layout.mapSize.width / 2 - camera.cx * camera.k,
    ty: layout.mapSize.height / 2 - camera.cy * camera.k,
  };
}
function textBlock(parent: Element, block: GeoTextBlock, x: number, y: number, halo: string) {
  for (const line of block.lines) {
    const text = element('text', {
      x: x + line.x,
      y: y + line.y,
      'font-family': line.style.fontFamily,
      'font-size': line.style.fontSize,
      'font-weight': line.style.fontWeight,
      fill: line.style.fill,
      'text-anchor': line.style.textAnchor ?? 'start',
      stroke: halo,
      'stroke-width': 2,
      'stroke-opacity': 0.85,
      'paint-order': 'stroke fill',
      'stroke-linejoin': 'round',
    });
    if (line.style.fontVariant) text.setAttribute('font-variant', line.style.fontVariant);
    text.textContent = line.text;
    parent.appendChild(text);
  }
}
/** Pure projection of the accepted identities during motion; placement runs only at settle. */
export function projectAcceptedGeoOverlay(
  accepted: GeoLabelOverlay,
  from: GeoLabelAffine,
  to: GeoLabelAffine,
  layout: GeoMapLayout,
): GeoLabelOverlay {
  const move = (p: Point): Point => ({
    x: ((p.x - from.tx) / from.k) * to.k + to.tx,
    y: ((p.y - from.ty) / from.k) * to.k + to.ty,
  });
  const viewport = layout.labels?.viewport ?? {
    x: 0,
    y: 0,
    width: layout.area.width,
    height: layout.area.height,
  };
  const visible = (p: Point) =>
    p.x >= viewport.x &&
    p.y >= viewport.y &&
    p.x <= viewport.x + viewport.width &&
    p.y <= viewport.y + viewport.height;
  const candidates = new Map(layout.labels?.candidates.map((c) => [c.id, c]));
  const zoomVisible = (id: string) => {
    const candidate = candidates.get(id);
    return (
      to.k >= (candidate?.minZoom ?? 1) &&
      (candidate?.maxZoom === undefined || to.k <= candidate.maxZoom)
    );
  };
  const labels = accepted.labels.flatMap((label) => {
    const anchor = move(label.anchor);
    const bounds = {
      ...label.bounds,
      x: label.bounds.x + anchor.x - label.anchor.x,
      y: label.bounds.y + anchor.y - label.anchor.y,
    };
    return visible(anchor) &&
      bounds.x >= viewport.x &&
      bounds.y >= viewport.y &&
      bounds.x + bounds.width <= viewport.x + viewport.width &&
      bounds.y + bounds.height <= viewport.y + viewport.height &&
      zoomVisible(label.id)
      ? [{ ...label, anchor, bounds }]
      : [];
  });
  const ids = new Set(labels.map((label) => label.id));
  const acceptedById = new Map(accepted.labels.map((label) => [label.id, label]));
  return {
    ...accepted,
    labels,
    leaders: accepted.leaders
      .filter((leader) => ids.has(leader.id))
      .map((leader) => {
        const label = acceptedById.get(leader.id)!;
        const anchor = move(label.anchor);
        return {
          ...leader,
          from: move(leader.from),
          to: {
            x: leader.to.x + anchor.x - label.anchor.x,
            y: leader.to.y + anchor.y - label.anchor.y,
          },
        };
      }),
    markers: accepted.markers
      .map((marker) => ({ ...marker, anchor: move(marker.anchor) }))
      .filter((marker) => visible(marker.anchor) && zoomVisible(marker.id)),
    inventory: accepted.inventory.map((entry) =>
      entry.presentation === 'label' && !ids.has(entry.id)
        ? {
            ...entry,
            visibility: zoomVisible(entry.id) ? 'offscreen' : 'zoom-range',
            presentation: 'none',
          }
        : entry,
    ),
  };
}
/** Renders measured map-local geometry without touching the camera or base map. */
export function renderGeoLabelOverlay(
  svg: SVGElement,
  layout: GeoMapLayout,
  overlay: GeoLabelOverlay,
): void {
  svg.querySelector('.oc-map-labels')?.remove();
  svg.querySelector('.oc-map-label-notes')?.remove();
  if (!layout.labels) return;
  const group = element('g', {
    class: 'oc-map-labels',
    'pointer-events': 'none',
    'aria-hidden': 'true',
    transform: `translate(${layout.area.x},${layout.area.y})`,
  });
  const clipId = nextSvgId('oc-map-label-clip');
  const defs = element('defs');
  const clip = element('clipPath', { id: clipId });
  clip.appendChild(element('rect', { ...layout.labels.viewport }));
  defs.appendChild(clip);
  group.appendChild(defs);
  const viewport = element('g', { 'clip-path': `url(#${clipId})` });
  group.appendChild(viewport);
  const halo =
    layout.theme.colors.background === 'transparent'
      ? 'var(--oc-bg, #fff)'
      : layout.theme.colors.background;
  for (const leader of overlay.leaders)
    viewport.appendChild(
      element('line', {
        x1: leader.from.x,
        y1: leader.from.y,
        x2: leader.to.x,
        y2: leader.to.y,
        stroke: layout.theme.colors.text,
        'stroke-opacity': 0.6,
        'stroke-width': 1,
      }),
    );
  for (const label of overlay.labels) {
    const item = element('g', { 'data-geo-label-id': label.id });
    textBlock(item, label.block, label.bounds.x, label.bounds.y, halo);
    viewport.appendChild(item);
  }
  const markerRadius = layout.labels.markerRadius ?? (7 * layout.theme.fonts.sizes.small) / 12;
  const markerScale = markerRadius / 7;
  for (const marker of overlay.markers) {
    const markerViewport = layout.labels.viewport;
    if (
      marker.anchor.x - markerRadius < markerViewport.x ||
      marker.anchor.y - markerRadius < markerViewport.y ||
      marker.anchor.x + markerRadius > markerViewport.x + markerViewport.width ||
      marker.anchor.y + markerRadius > markerViewport.y + markerViewport.height
    )
      continue;
    const item = element('g', { 'data-geo-note-id': marker.id });
    item.appendChild(
      element('circle', {
        cx: marker.anchor.x,
        cy: marker.anchor.y,
        r: markerRadius,
        fill: halo,
        stroke: layout.theme.colors.text,
      }),
    );
    const number = element('text', {
      x: marker.anchor.x,
      y: marker.anchor.y + 3 * markerScale,
      'font-size': 9 * markerScale,
      'font-family': layout.theme.fonts.family,
      'text-anchor': 'middle',
      fill: layout.theme.colors.text,
    });
    number.textContent = String(marker.number);
    item.appendChild(number);
    viewport.appendChild(item);
  }
  const mapGroup = svg.querySelector('.oc-map-group');
  mapGroup?.insertAdjacentElement('afterend', group);
  const notes = element('g', {
    class: 'oc-map-label-notes',
    'aria-hidden': 'true',
    transform: `translate(${layout.area.x},${layout.area.y})`,
  });
  for (const { id, slot } of overlay.notes) {
    const item = element('g', { 'data-geo-note-id': id });
    textBlock(item, slot.block, slot.bounds.x, slot.bounds.y, halo);
    notes.appendChild(item);
  }
  group.insertAdjacentElement('afterend', notes);
}
export function describeGeoLabelInventory(svg: SVGElement, overlay: GeoLabelOverlay): void {
  const previous = svg.querySelector('desc[data-geo-label-inventory]');
  if (previous) {
    const ids = (svg.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id && id !== previous.id);
    if (ids.length) svg.setAttribute('aria-describedby', ids.join(' '));
    else svg.removeAttribute('aria-describedby');
    previous.remove();
  }
  if (!overlay.inventory.length) return;
  const desc = element('desc', {
    'data-geo-label-inventory': '',
    id: nextSvgId('oc-map-label-description'),
  });
  desc.textContent = `Map places and notes. ${overlay.inventory.map(geographicInventoryText).join(' ')}`;
  svg.appendChild(desc);
  const ids = (svg.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  svg.setAttribute('aria-describedby', [...ids, desc.id].join(' '));
}
export function resolveMapLabelOverlay(
  layout: GeoMapLayout,
  camera: Camera,
): GeoLabelOverlay | undefined {
  return layout.labels
    ? resolveGeoOverlay(layout.labels, mapLabelAffine(camera, layout))
    : undefined;
}
