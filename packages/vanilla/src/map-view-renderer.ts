import type {
  GeoLabelOverlay,
  GeoMapBorders,
  GeoMapFeatureMark,
  GeoMapLayout,
  GeoMapPointMark,
  GeoViewLayout,
} from '@opendata-ai/openchart-core';
import { applyMapCamera } from './map-camera';
import { mergeGeoLabelInventory } from './map-label-inventory';
import {
  describeGeoLabelInventory,
  renderGeoLabelNotes,
  renderGeoLabelOverlay,
  resolveMapLabelOverlay,
} from './map-labels';
import { cameraForGeoView } from './map-view-camera';
import { createRenderContext, type RenderContext } from './render-context';
import { resolvedSurface } from './theme-tokens';

const element = (
  tag: string,
  attrs: Record<string, string | number> = {},
  ctx: RenderContext = createRenderContext(),
) => {
  const el = ctx.factory.svg(tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
};
/** A complete renderer view of the shared map, with exactly one viewport offset. */
export function geoViewMapLayout(layout: GeoMapLayout, view: GeoViewLayout): GeoMapLayout {
  return {
    ...layout,
    views: undefined,
    area: {
      x: layout.area.x + view.viewport.x,
      y: layout.area.y + view.viewport.y,
      width: view.viewport.width,
      height: view.viewport.height,
    },
    mapSize: view.mapSize,
    features: view.features,
    borders: view.borders,
    pointMarks: view.pointMarks,
    labels: view.labels,
    focus: view.focus,
  };
}
interface ViewPainters {
  features(
    parent: SVGElement,
    features: GeoMapFeatureMark[],
    patternMap: Map<string, string>,
  ): void;
  borders(parent: SVGElement, borders: GeoMapBorders): void;
  points(parent: SVGElement, points: GeoMapPointMark[]): void;
}
export function renderGeoMapViews(
  svg: SVGSVGElement,
  layout: GeoMapLayout,
  patterns: Map<string, string>,
  paint: ViewPainters,
  ctx: RenderContext = createRenderContext(),
): void {
  const overlays = new Map<string, GeoLabelOverlay>();
  const inventory: NonNullable<GeoMapLayout['labels']>['initialOverlay']['inventory'] = [];
  for (const view of layout.views ?? []) {
    const frame = geoViewMapLayout(layout, view);
    const scene = element(
      'g',
      {
        class: 'oc-map-view',
        'data-geo-view-id': view.viewId,
        role: 'group',
        'aria-label': view.coverage ?? view.viewId,
      },
      ctx,
    );
    if (view.viewId !== 'root') {
      scene.appendChild(
        element(
          'rect',
          {
            x: layout.area.x + view.frame.x,
            y: layout.area.y + view.frame.y,
            width: view.frame.width,
            height: view.frame.height,
            fill: resolvedSurface(layout.theme),
            stroke: layout.theme.colors.text,
            'stroke-opacity': 0.35,
            'stroke-width': 1,
          },
          ctx,
        ),
      );
      if (view.label && view.labelBounds)
        for (const line of view.label.lines) {
          const label = element(
            'text',
            {
              x: layout.area.x + view.labelBounds.x + line.x,
              y: layout.area.y + view.labelBounds.y + line.y,
              fill: line.style.fill,
              'font-family': line.style.fontFamily,
              'font-size': line.style.fontSize,
              'font-weight': line.style.fontWeight,
            },
            ctx,
          );
          label.textContent = line.text;
          scene.appendChild(label);
        }
    }
    const mapGroup = element(
      'g',
      {
        class: 'oc-map-group',
        transform: `translate(${frame.area.x},${frame.area.y})`,
      },
      ctx,
    );
    const defs = element('defs', undefined, ctx),
      clip = element('clipPath', { id: ctx.ids.next('oc-map-view-clip') }, ctx);
    clip.appendChild(
      element('rect', { width: view.viewport.width, height: view.viewport.height }, ctx),
    );
    defs.appendChild(clip);
    scene.appendChild(defs);
    mapGroup.setAttribute('clip-path', `url(#${clip.id})`);
    mapGroup.setAttribute('data-geo-view-clip', `url(#${clip.id})`);
    const camera = element('g', { class: 'oc-map-camera', 'data-oc-map-camera': '' }, ctx);
    paint.features(camera, view.features, patterns);
    for (const layer of view.detailLayers) {
      const detail = element(
        'g',
        {
          'data-geo-layer-id': layer.id,
          'data-min-zoom': layer.minZoom,
          ...(layer.maxZoom !== undefined ? { 'data-max-zoom': layer.maxZoom } : {}),
          'pointer-events': 'none',
          'aria-hidden': 'true',
          fill: 'none',
          stroke: view.borders.interiorStroke,
          'stroke-width': view.borders.interiorWidth,
        },
        ctx,
      );
      for (const path of layer.paths)
        detail.appendChild(
          element('path', { d: path, 'vector-effect': 'non-scaling-stroke' }, ctx),
        );
      camera.appendChild(detail);
    }
    paint.borders(camera, view.borders);
    paint.points(camera, view.pointMarks);
    mapGroup.appendChild(camera);
    scene.appendChild(mapGroup);
    svg.appendChild(scene);
    const current = cameraForGeoView(view);
    applyMapCamera(scene, current, frame);
    applyGeoDetailVisibility(scene, current.k);
    const overlay = resolveMapLabelOverlay(frame, current);
    if (overlay) {
      renderGeoLabelOverlay(scene, frame, { ...overlay, notes: [] }, ctx);
      overlays.set(view.viewId, overlay);
      inventory.push(...overlay.inventory);
    }
  }
  renderGeoViewNotes(svg, layout, overlays, ctx);
  if (inventory.length)
    describeGeoLabelInventory(
      svg,
      {
        labels: [],
        leaders: [],
        markers: [],
        notes: [],
        inventory: mergeGeoLabelInventory(inventory),
      },
      ctx,
    );
}
/** Paint each global note slot once, even when its place has several views. */
export function renderGeoViewNotes(
  svg: SVGElement,
  layout: GeoMapLayout,
  overlays: ReadonlyMap<string, GeoLabelOverlay>,
  ctx: RenderContext = createRenderContext(),
): void {
  for (const node of svg.querySelectorAll('.oc-map-label-notes')) node.remove();
  const seen = new Set<string>();
  for (const view of layout.views ?? []) {
    const entries = (overlays.get(view.viewId)?.notes ?? []).filter((note) => {
      if (seen.has(note.id)) return false;
      seen.add(note.id);
      return true;
    });
    if (entries.length)
      renderGeoLabelNotes(svg, geoViewMapLayout(layout, view), entries, undefined, ctx);
  }
}
export function applyGeoDetailVisibility(scene: SVGElement, k: number): void {
  for (const layer of scene.querySelectorAll('[data-geo-layer-id]')) {
    const min = Number(layer.getAttribute('data-min-zoom') ?? 1),
      max = Number(layer.getAttribute('data-max-zoom') ?? Infinity);
    if (k >= min && k <= max) layer.removeAttribute('display');
    else layer.setAttribute('display', 'none');
  }
}
export function findGeoViewScene(svg: SVGElement, id: string): SVGElement | null {
  return (
    [...svg.querySelectorAll<SVGElement>('[data-geo-view-id]')].find(
      (scene) => scene.getAttribute('data-geo-view-id') === id,
    ) ?? null
  );
}
