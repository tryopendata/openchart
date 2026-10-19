import type {
  GeoEntityRef,
  GeoMapSpec,
  GeoReaderSelection,
  ReaderChangeMeta,
  ReaderComparisonOperand,
} from '@opendata-ai/openchart-core';
import {
  buildGeoReaderIndex,
  compareReaderValues,
  type GeoReaderRecord,
} from '@opendata-ai/openchart-engine';
import { acquireReaderHost, readerEventExcluded } from './interactions/reader-arbitration';
import { createMapCompanion, type MapCompanionOptions } from './map-companion';
import { mapLabelAffine } from './map-labels';
import type { GeoMapInstance } from './map-mount';
import { renderMapReaderOverlay } from './map-reader-overlays';
import { geoViewMapLayout } from './map-view-renderer';
import type { ReaderPresentationOptions, ReaderSetOptions } from './reader-options';
import {
  createReaderPanel,
  type ReaderPanelRecord,
  type ReaderPanelViewModel,
} from './reader-panel';
export interface GeoReaderOptions extends Omit<ReaderPresentationOptions, 'mode'> {
  companion?: false | MapCompanionOptions;
}
export interface GeoReaderController {
  readonly selection: GeoReaderSelection;
  update(spec: GeoMapSpec, visibleKeys?: ReadonlySet<string>): void;
  setOptions(options: GeoReaderOptions): void;
  setSelection(next: GeoReaderSelection, options?: ReaderSetOptions): void;
  pin(ref: GeoEntityRef): void;
  preview(ref: GeoEntityRef | null): void;
  clear(): void;
  destroy(): void;
}
export function createGeoReader(
  container: HTMLElement,
  instance: GeoMapInstance,
  initial: GeoMapSpec,
  onChange: (selection: GeoReaderSelection, meta: ReaderChangeMeta) => void,
  initialOptions: GeoReaderOptions = {},
): GeoReaderController {
  let spec = initial;
  let options = initialOptions;
  let index = buildGeoReaderIndex(spec, instance.layout);
  let state: GeoReaderSelection = { preview: null, pinned: [], announcement: '' };
  let destroyed = false;
  let keyboardIndex = -1;
  let gesturing = false;
  let pointer: { x: number; y: number; id: number } | undefined;
  let rect: DOMRect | undefined;
  let visibility: ReadonlySet<string> | undefined;
  const activatedViews = new Map<string, string>();
  const lease = acquireReaderHost(instance, {});
  const inspectionTarget = document.createElement('button');
  inspectionTarget.type = 'button';
  inspectionTarget.className = 'oc-map-inspect-places';
  inspectionTarget.textContent = 'Inspect places';
  inspectionTarget.setAttribute(
    'aria-label',
    'Inspect places. Use arrow keys to move and Enter to pin.',
  );
  container.append(inspectionTarget);
  inspectionTarget.addEventListener('click', () => {
    if (!state.preview && index.records.length) preview(index.records[0].observation.entity);
  });
  let previewFrame: number | undefined;
  let pendingMove: PointerEvent | undefined;

  if (!lease) {
    inspectionTarget.disabled = true;
  }
  if (!lease)
    state.announcement = 'Map inspection is unavailable because another reader owns this map.';
  const refKey = (ref: GeoEntityRef) => `${ref.kind}:${ref.canonicalId}`;
  const byRef = (ref: GeoEntityRef) => index.byObservation.get(refKey(ref));
  const panelRecord = (record: GeoReaderRecord): ReaderPanelRecord => ({
    id: record.observation.observation,
    name: record.name,
    valueLabel: record.valueLabel,
    unit: record.valueStatus === 'value' ? record.unit : undefined,
    state: record.observation.state,
    fields: [
      ...record.fields,
      ...(record.identityStatus === 'ephemeral'
        ? [
            {
              label: 'Selection',
              value: 'Temporary selection; clears when the source data is replaced.',
            },
          ]
        : record.identityStatus === 'ambiguous'
          ? [{ label: 'Selection', value: 'Ambiguous identity; pinning is unavailable.' }]
          : []),
    ],
  });
  function comparison(): ReaderPanelViewModel['comparisons'] {
    if (state.pinned.length !== 2 || !options.comparison || options.comparison === 'values')
      return undefined;
    const [a, b] = state.pinned.map((pin) => index.byObservation.get(pin.observation)!);
    if (
      !a?.primary ||
      !b?.primary ||
      a.primary.value === undefined ||
      b.primary.value === undefined
    )
      return [
        {
          id: 'difference',
          label: 'B − A',
          explanation: 'A comparison needs two observed finite values.',
        },
      ];
    const operand = (record: GeoReaderRecord): ReaderComparisonOperand => ({
      value: record.primary!.value!,
      metadata: record.primary!.metadata,
      binding: {
        dataset: options.binding?.dataset ?? 'geo:source',
        transform: options.binding?.transform ?? 'identity',
        grouping: [],
        panelId: 'geo:root',
      },
    });
    const result = compareReaderValues(operand(a), operand(b), {
      allowNegativeRelative: options.allowNegativeRelative,
    });
    if (result.status === 'unavailable')
      return [{ id: 'difference', label: 'B − A', explanation: result.message }];
    return [
      {
        id: 'difference',
        label: 'B − A',
        absolute: result.absolute,
        unit: result.unit,
        ...(options.comparison === 'relative'
          ? result.relative === undefined
            ? {
                explanation:
                  result.relativeUnavailable === 'zero-baseline'
                    ? 'Relative change is unavailable from zero.'
                    : 'Relative change from a negative baseline requires explicit permission.',
              }
            : { relative: `${(result.relative * 100).toFixed(1)}%` }
          : {}),
      },
    ];
  }
  const panel = createReaderPanel(
    options.panel ? options.panel.container : undefined,
    {
      clear: () => clear(),
      unpin: (slot) => {
        state.pinned = state.pinned.filter((_, position) => position !== (slot === 'A' ? 0 : 1));
        state.announcement = `Removed ${slot}.`;
        paint();
        emit('user');
      },
      showOnMap: (id) => show(index.byObservation.get(id)),
      pinPreview: () => {
        if (state.preview) pin(state.preview.entity);
      },
    },
    container,
  );
  const companion = createMapCompanion({
    preview: (record) => preview(record?.observation.entity ?? null),
    pin: (record) => pin(record.observation.entity),
    show,
  });
  function show(record?: GeoReaderRecord, requestedView?: string) {
    if (destroyed || !record) return;
    record = index.byObservation.get(record.observation.observation);
    if (!record) return;
    if (record.viewIds?.length === 0) {
      state.announcement = `${record.name} is not visible in this projection. Choose a compatible projection or inset to show this place.`;
      paint();
      emit('user');
      return;
    }
    const views =
      instance.layout.views?.filter((view) =>
        record.observation.entity.kind === 'feature'
          ? view.features.some((mark) => String(mark.id) === String(record.observation.entity.id))
          : view.pointMarks.some((mark) => mark.data === record.observation.datum),
      ) ?? [];
    if (requestedView && !views.some((view) => view.viewId === requestedView))
      requestedView = undefined;
    const preferredView = activatedViews.get(record.observation.observation);
    const viewId =
      requestedView ??
      (views.some((view) => view.viewId === preferredView) ? preferredView : undefined) ??
      (views.length === 1 ? views[0].viewId : undefined);
    if (!viewId && views.length > 1) {
      chooser?.remove();
      chooser = document.createElement('div');
      chooser.className = 'oc-map-overlap-chooser';
      chooser.setAttribute('role', 'group');
      chooser.setAttribute('aria-label', `Choose a view for ${record.name}`);
      for (const view of views) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `Show in ${view.coverage ?? view.viewId}`;
        button.addEventListener('click', () => {
          show(index.byObservation.get(record!.observation.observation), view.viewId);
          chooser?.remove();
          chooser = undefined;
        });
        chooser.append(button);
      }
      container.append(chooser);
      chooser.querySelector('button')?.focus();
      return;
    }
    if (record.observation.entity.kind === 'feature')
      instance.zoomTo(record.observation.entity.id, { viewId });
    else {
      const point =
        views
          .find((view) => view.viewId === viewId)
          ?.pointMarks.find((mark) => mark.data === record.observation.datum) ?? record.point;
      if (point)
        instance.fitBounds(
          {
            x: point.cx - point.r,
            y: point.cy - point.r,
            width: point.r * 2,
            height: point.r * 2,
            padding: 24,
          },
          { viewId },
        );
    }
  }
  function paint() {
    if (destroyed) return;
    const pinned = state.pinned.flatMap((pin, position) => {
      const record = index.byObservation.get(pin.observation);
      return record
        ? [
            {
              slot: (position === 0 ? 'A' : 'B') as 'A' | 'B',
              record: panelRecord({ ...record, observation: pin }),
            },
          ]
        : [];
    });
    const previewRecord = state.preview
      ? index.byObservation.get(state.preview.observation)
      : undefined;
    panel.setTheme(instance.layout.theme);
    companion.setTheme(instance.layout.theme);
    panel.update({
      pinned,
      preview: previewRecord ? panelRecord(previewRecord) : undefined,
      comparisons: comparison(),
      announcement: state.announcement,
    });
    const svg = container.querySelector('svg');
    if (svg)
      renderMapReaderOverlay(svg, instance.layout, instance.getCamera(), index, state, (viewId) =>
        instance.getCamera(viewId),
      );
  }
  function emit(reason: ReaderChangeMeta['reason']) {
    if (destroyed) return;
    onChange({ ...state, pinned: [...state.pinned] }, { reason });
  }
  function preview(ref: GeoEntityRef | null) {
    if (destroyed || !lease?.active) return;
    const next = ref ? (byRef(ref)?.observation ?? null) : null;
    if (state.preview?.observation === next?.observation) return;
    state.preview = next;
    paint();
    emit('user');
  }
  function pin(ref: GeoEntityRef) {
    if (destroyed || !lease?.active) return;
    const record = byRef(ref);
    if (!record) return;
    if (record.identityStatus === 'ambiguous') {
      state.announcement = 'This identity is ambiguous; supply a unique key before pinning.';
      paint();
      emit('user');
      return;
    }
    const existing = state.pinned.findIndex(
      (pin) => pin.observation === record.observation.observation,
    );
    if (existing >= 0) state.pinned = state.pinned.filter((_, index) => index !== existing);
    else
      state.pinned =
        state.pinned.length < 2
          ? [...state.pinned, record.observation]
          : [state.pinned[0], record.observation];
    state.preview = record.observation;
    state.announcement = `${record.name} ${existing >= 0 ? 'removed' : 'pinned'}.`;
    paint();
    emit('user');
  }
  function clear() {
    if (destroyed) return;
    state = { preview: null, pinned: [], announcement: 'Selection dismissed.' };
    paint();
    emit('user');
  }
  function update(next: GeoMapSpec, visibleKeys?: ReadonlySet<string>) {
    if (destroyed) return;
    chooser?.remove();
    chooser = undefined;
    const filtered = visibility !== visibleKeys;
    const replaced =
      spec.data !== next.data ||
      spec.points?.data !== next.points?.data ||
      spec.encoding.key?.field !== next.encoding.key?.field ||
      spec.points?.key?.field !== next.points?.key?.field;
    spec = next;
    visibility = visibleKeys;
    const prior = state.pinned;
    const priorPreview = state.preview;
    index = buildGeoReaderIndex(spec, instance.layout);
    for (const [key, viewId] of activatedViews)
      if (!index.byObservation.get(key)?.viewIds?.includes(viewId)) activatedViews.delete(key);
    for (const diagnostic of index.diagnostics) options.onDiagnostic?.(diagnostic);
    for (const record of index.records)
      record.observation.state =
        visibility && !visibility.has(record.observation.observation) ? 'filtered' : 'visible';
    state.pinned = prior.flatMap((pin) => {
      const record = index.byObservation.get(pin.observation);
      if (!record || record.identityStatus === 'ambiguous' || (!pin.persistent && replaced))
        return [];
      return [
        {
          ...record.observation,
          ...(JSON.stringify(pin.datum) !== JSON.stringify(record.observation.datum)
            ? { previous: pin.datum }
            : {}),
        },
      ];
    });
    state.preview =
      !replaced && !filtered && priorPreview
        ? (index.byObservation.get(priorPreview.observation)?.observation ?? null)
        : null;
    state.announcement =
      state.pinned.length < prior.length
        ? 'Selection cleared: an observation was removed or its identity changed.'
        : '';
    rect = undefined;
    companion.update(index);
    paint();
    emit(filtered ? 'filter' : 'data');
  }
  const svgRect = () => (rect ??= container.querySelector('svg')?.getBoundingClientRect());
  function hits(event: PointerEvent | MouseEvent): GeoReaderRecord[] {
    const bounds = svgRect();
    if (!bounds || !bounds.width || !bounds.height) return [];
    const fullLayout = instance.layout;
    const targetView =
      event.target instanceof Element
        ? event.target.closest('[data-geo-view-id]')?.getAttribute('data-geo-view-id')
        : null;
    const view = fullLayout.views?.find((view) => view.viewId === targetView);
    const layout = view ? geoViewMapLayout(fullLayout, view) : fullLayout;
    const x = ((event.clientX - bounds.left) * layout.width) / bounds.width - layout.area.x;
    const y = ((event.clientY - bounds.top) * layout.height) / bounds.height - layout.area.y;
    const affine = mapLabelAffine(instance.getCamera(view?.viewId), layout);
    const points = index.records.filter((record) => {
      if (record.observation.entity.kind !== 'point') return false;
      const point = view
        ? view.pointMarks.find((mark) => mark.data === record.observation.datum)
        : record.point;
      if (!point) return false;
      return (
        Math.hypot(x - point.cx * affine.k - affine.tx, y - point.cy * affine.k - affine.ty) <=
        point.r
      );
    });
    if (view)
      for (const record of points) activatedViews.set(record.observation.observation, view.viewId);
    if (points.length) return points;
    const element =
      event.target instanceof Element ? event.target.closest('[data-feature-id]') : null;
    const id = element?.getAttribute('data-feature-id');
    const features =
      id === null || id === undefined
        ? []
        : index.records.filter(
            (record) =>
              record.observation.entity.kind === 'feature' &&
              String(record.observation.entity.id) === id,
          );
    if (view)
      for (const record of features)
        activatedViews.set(record.observation.observation, view.viewId);
    return features;
  }
  let chooser: HTMLElement | undefined;
  function choose(records: GeoReaderRecord[]) {
    chooser?.remove();
    if (records.length === 1) {
      pin(records[0].observation.entity);
      return;
    }
    if (!records.length) return;
    chooser = document.createElement('div');
    chooser.className = 'oc-map-overlap-chooser';
    chooser.setAttribute('role', 'group');
    chooser.setAttribute('aria-label', 'Overlapping places');
    for (const record of records) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${record.name}: ${record.valueLabel}`;
      button.addEventListener('click', () => {
        pin(record.observation.entity);
        chooser?.remove();
        chooser = undefined;
      });
      chooser.append(button);
    }
    chooser.addEventListener('keydown', (event) => {
      const buttons = [...chooser!.querySelectorAll('button')];
      const i = buttons.indexOf(event.target as HTMLButtonElement);
      if (event.key === 'Escape') {
        chooser?.remove();
        chooser = undefined;
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        buttons[
          (i + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
        ]?.focus();
        event.preventDefault();
      }
    });
    container.append(chooser);
  }
  const move = (event: PointerEvent) => {
    if (
      !lease?.active ||
      gesturing ||
      readerEventExcluded(event.target) ||
      event.pointerType === 'touch'
    )
      return;
    pendingMove = event;
    if (previewFrame !== undefined) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = undefined;
      const event = pendingMove;
      pendingMove = undefined;
      if (event && !gesturing && lease?.active) {
        const record = hits(event)[0];
        preview(record?.observation.entity ?? null);
      }
    });
  };
  const down = (event: PointerEvent) => {
    if (!lease?.active || readerEventExcluded(event.target)) return;
    pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const up = (event: PointerEvent) => {
    const start = pointer;
    pointer = undefined;
    if (
      !start ||
      !lease?.active ||
      gesturing ||
      start.id !== event.pointerId ||
      readerEventExcluded(event.target) ||
      Math.hypot(start.x - event.clientX, start.y - event.clientY) > 4
    )
      return;
    choose(hits(event));
  };
  const cancel = () => {
    pointer = undefined;
    rect = undefined;
    pendingMove = undefined;
    if (previewFrame !== undefined) {
      cancelAnimationFrame(previewFrame);
      previewFrame = undefined;
    }
  };
  const leave = () => {
    if (pointer) return;
    preview(null);
  };
  const key = (event: KeyboardEvent) => {
    if (!lease?.active || event.target !== inspectionTarget) return;
    const rows = index.records;
    if (event.key === 'Escape') {
      clear();
      event.preventDefault();
    } else if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp'
    ) {
      if (!rows.length) return;
      keyboardIndex =
        (keyboardIndex +
          (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) +
          rows.length) %
        rows.length;
      preview(rows[keyboardIndex].observation.entity);
      event.preventDefault();
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (state.preview) pin(state.preview.entity);
      else if (rows.length) preview(rows[0].observation.entity);
      event.preventDefault();
    }
  };
  container.addEventListener('pointermove', move);
  container.addEventListener('pointerdown', down);
  container.addEventListener('pointerup', up);
  container.addEventListener('pointercancel', cancel);
  container.addEventListener('pointerleave', leave);
  container.addEventListener('keydown', key);
  window.addEventListener('scroll', cancel, true);
  const unsubscribe = lease?.subscribe((event) => {
    if (event.kind === 'destroy') destroy();
    else if (event.kind === 'layout') {
      const latest = lease.getSpec();
      update(latest && 'type' in latest && latest.type === 'map' ? latest : spec, visibility);
    } else if (event.kind === 'camera') {
      const svg = container.querySelector('svg');
      if (svg)
        renderMapReaderOverlay(svg, instance.layout, instance.getCamera(), index, state, (viewId) =>
          instance.getCamera(viewId),
        );
    } else if (event.kind === 'gesture-start') {
      gesturing = true;
      cancel();
    } else if (event.kind === 'gesture-end') gesturing = false;
  });
  function setOptions(next: GeoReaderOptions) {
    if (destroyed) return;
    const revisionChanged = options.revision !== next.revision;
    const bindingChanged = JSON.stringify(options.binding) !== JSON.stringify(next.binding);
    options = next;
    if (revisionChanged || bindingChanged) {
      state.pinned = state.pinned.filter((pin) => !bindingChanged && pin.persistent);
      state.preview = null;
      state.announcement = 'Selection reconciled with the current data binding.';
    }

    panel.setContainer(options.panel ? options.panel.container : undefined);
    companion.setOptions(options.companion || undefined);
    companion.update(index);
    paint();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancel();
    inspectionTarget.remove();
    unsubscribe?.();
    lease?.release();
    panel.destroy();
    companion.destroy();
    chooser?.remove();
    container.querySelector('[data-oc-reader-overlay]')?.remove();
    container.removeEventListener('pointermove', move);
    container.removeEventListener('pointerdown', down);
    container.removeEventListener('pointerup', up);
    container.removeEventListener('pointercancel', cancel);
    container.removeEventListener('pointerleave', leave);
    container.removeEventListener('keydown', key);
    window.removeEventListener('scroll', cancel, true);
  }
  setOptions(options);
  for (const diagnostic of index.diagnostics) options.onDiagnostic?.(diagnostic);
  return {
    get selection() {
      return { ...state, pinned: [...state.pinned] };
    },
    update,
    setOptions,
    pin,
    preview,
    clear,
    destroy,
    setSelection(next, setOptions = {}) {
      if (destroyed) return;
      state = {
        ...next,
        pinned: next.pinned
          .flatMap((pin) => {
            const record = index.byObservation.get(pin.observation);
            return record && record.identityStatus !== 'ambiguous' ? [record.observation] : [];
          })
          .slice(0, 2),
        preview: next.preview
          ? (index.byObservation.get(next.preview.observation)?.observation ?? null)
          : null,
      };
      paint();
      if (setOptions.notify === true) emit('programmatic');
    },
  };
}
