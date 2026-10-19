import type { GeoMapLayout, GeoReaderSelection } from '@opendata-ai/openchart-core';
import type { GeoReaderIndex } from '@opendata-ai/openchart-engine';
import type { Camera } from './map-camera';
import { renderActiveGeoColorKeys } from './map-color-key';
import { mapLabelAffine } from './map-labels';
import { geoViewMapLayout } from './map-view-renderer';
import { nextSvgId } from './svg-ids';

const NS = 'http://www.w3.org/2000/svg';
export function renderMapReaderOverlay(
  svg: SVGSVGElement,
  layout: GeoMapLayout,
  camera: Camera,
  index: GeoReaderIndex,
  selection: GeoReaderSelection,
  getCamera?: (viewId: string) => Camera,
) {
  svg.querySelector('[data-oc-reader-overlay]')?.remove();
  const group = document.createElementNS(NS, 'g');
  group.setAttribute('data-oc-reader-overlay', '');
  group.setAttribute('pointer-events', 'none');
  group.setAttribute('aria-hidden', 'true');
  for (const view of layout.views ?? [undefined]) {
    const frame = view ? geoViewMapLayout(layout, view) : layout;
    const clipId = nextSvgId('oc-reader-clip');
    const clip = document.createElementNS(NS, 'clipPath');
    clip.id = clipId;
    const rect = document.createElementNS(NS, 'rect');
    for (const [key, value] of Object.entries(frame.area)) rect.setAttribute(key, String(value));
    clip.append(rect);
    group.append(clip);
    const outlines = document.createElementNS(NS, 'g');
    outlines.setAttribute('clip-path', `url(#${clipId})`);
    group.append(outlines);
    const affine = mapLabelAffine(view && getCamera ? getCamera(view.viewId) : camera, frame);
    const records = [
      ...selection.pinned,
      ...(selection.preview &&
      !selection.pinned.some((pin) => pin.observation === selection.preview!.observation)
        ? [selection.preview]
        : []),
    ];
    for (const [position, observation] of records.entries()) {
      const record = index.byObservation.get(observation.observation);
      if (!record || observation.state === 'filtered') continue;
      let element: SVGElement;
      if (observation.entity.kind === 'feature') {
        const matches = frame.features.filter(
          (feature) => String(feature.id) === String(observation.entity.id),
        );
        if (matches.length !== 1) continue;
        element = document.createElementNS(NS, 'path');
        element.setAttribute('d', matches[0].path);
        element.setAttribute(
          'transform',
          `translate(${frame.area.x + affine.tx},${frame.area.y + affine.ty}) scale(${affine.k})`,
        );
        element.setAttribute('vector-effect', 'non-scaling-stroke');
      } else {
        const point = view
          ? view.pointMarks.find(
              (mark) =>
                mark.data === observation.datum ||
                String(mark.key) === String(observation.entity.id),
            )
          : record.point;
        if (!point) continue;
        element = document.createElementNS(NS, 'circle');
        element.setAttribute('cx', String(frame.area.x + point.cx * affine.k + affine.tx));
        element.setAttribute('cy', String(frame.area.y + point.cy * affine.k + affine.ty));
        element.setAttribute('r', String(point.r + 3));
      }
      element.setAttribute('fill', 'none');
      element.setAttribute(
        'stroke',
        position === 0 ? layout.theme.colors.text : layout.theme.colors.annotationLeader,
      );
      element.setAttribute('stroke-width', position < selection.pinned.length ? '2.5' : '1.5');
      if (position === 1) element.setAttribute('stroke-dasharray', '5 3');
      outlines.append(element);
    }
  }
  renderActiveGeoColorKeys(group, layout, index, selection);
  svg.append(group);
}
