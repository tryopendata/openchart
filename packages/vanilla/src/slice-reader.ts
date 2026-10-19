import type {
  ChartSpec,
  LayerSpec,
  ReaderChangeMeta,
  ReaderSlice,
  ReaderSliceSelection,
} from '@opendata-ai/openchart-core';
import {
  buildReaderSliceIndex,
  nearestReaderSlice,
  readerSliceByKey,
  reconcileReaderSlices,
} from '@opendata-ai/openchart-engine';
import { acquireReaderHost, readerEventExcluded } from './interactions/reader-arbitration';
import type { ChartInstance } from './mount';
import type { ReaderPresentationOptions, ReaderSetOptions } from './reader-options';
import { createReaderPanel } from './reader-panel';
import { slicePanelModel } from './reader-view-model';
export interface SliceReaderController {
  readonly selection: ReaderSliceSelection;
  update(spec: ChartSpec | LayerSpec, visibleObservationKeys?: ReadonlySet<string>): void;
  pin(slice: ReaderSlice): void;
  clear(): void;
  setSelection(next: ReaderSliceSelection, options?: ReaderSetOptions): void;
  setOptions(options: ReaderPresentationOptions): void;
  destroy(): void;
}
const NS = 'http://www.w3.org/2000/svg';
export function createSliceReader(
  container: HTMLElement,
  instance: ChartInstance,
  initial: ChartSpec | LayerSpec,
  onChange: (selection: ReaderSliceSelection, meta: ReaderChangeMeta) => void,
  initialOptions: ReaderPresentationOptions,
): SliceReaderController {
  let options = initialOptions,
    spec = initial,
    revision = 0,
    destroyed = false;
  let index = buildReaderSliceIndex(spec, instance.layout, {
    revision: options.revision ?? String(revision),
    binding: options.binding,
  });
  let state: ReaderSliceSelection = {
    kind: 'slices',
    preview: null,
    pinned: [],
    announcement: index.supported ? '' : index.diagnostics.map((d) => d.message).join(' '),
  };
  let lease: ReturnType<typeof acquireReaderHost> = null;
  const owner = {};
  let unsubscribe: (() => void) | undefined;
  let guide: SVGGElement | null = null;
  let pointerFrame: number | null = null;
  let pendingPointer: { x: number; y: number } | null = null;
  let lastEmitted = '';
  let cancelledTap = false;
  let press: { x: number; y: number; id: number; touch: boolean } | null = null;
  let bounds =
    container.querySelector('svg')?.getBoundingClientRect() ?? container.getBoundingClientRect();
  const refreshBounds = () => {
    const svg = container.querySelector('svg');
    const candidate = svg?.getBoundingClientRect();
    bounds = candidate?.width && candidate.height ? candidate : container.getBoundingClientRect();
  };
  refreshBounds();
  const active = () =>
    !destroyed && index.supported && !instance.layout.a11y.hidden && !!lease?.active;
  const sourceSpec = () => {
    const current = lease?.getSpec();
    return current && !('type' in current) ? current : spec;
  };
  const cancel = () => {
    press = null;
    cancelledTap = true;
    pendingPointer = null;
    if (pointerFrame !== null) cancelAnimationFrame(pointerFrame);
    pointerFrame = null;
  };
  const candidates = () => index.panels.flatMap((panel) => panel.slices);
  function guides() {
    guide?.remove();
    guide = null;
    const svg = container.querySelector('svg');
    if (!svg || !index.supported) return;
    guide = document.createElementNS(NS, 'g');
    guide.setAttribute('class', 'oc-reader-guides');
    guide.setAttribute('pointer-events', 'none');
    guide.setAttribute('aria-hidden', 'true');
    const slices = [
      ...state.pinned,
      ...(state.preview && !state.pinned.some((pin) => pin.key === state.preview!.key)
        ? [state.preview]
        : []),
    ];
    for (const slice of slices) {
      const panel = index.panels.find((panel) => panel.scope.id === slice.panel.id);
      const position = panel?.slices.findIndex((item) => item.key === slice.key) ?? -1;
      if (!panel || position < 0 || slice.state === 'filtered') continue;
      const x = panel.positions[position];
      const line = document.createElementNS(NS, 'line');
      for (const [key, value] of Object.entries({
        x1: x,
        x2: x,
        y1: panel.area.y,
        y2: panel.area.y + panel.area.height,
        stroke: instance.layout.theme.colors.text,
        'stroke-opacity': state.pinned.some((pin) => pin.key === slice.key) ? 0.55 : 0.25,
        'stroke-width': 1,
      }))
        line.setAttribute(key, String(value));
      line.setAttribute('data-reader-slice', slice.key);
      guide.appendChild(line);
      const pinIndex = state.pinned.findIndex((pin) => pin.key === slice.key);
      if (pinIndex >= 0) {
        const label = document.createElementNS(NS, 'text');
        label.textContent = pinIndex === 0 ? 'A' : 'B';
        for (const [key, value] of Object.entries({
          x: x > panel.area.x + panel.area.width - 20 ? x - 4 : x + 4,
          'text-anchor': x > panel.area.x + panel.area.width - 20 ? 'end' : 'start',
          y: panel.area.y + instance.layout.theme.fonts.sizes.small,
          'font-family': instance.layout.theme.fonts.family,
          'font-size': instance.layout.theme.fonts.sizes.small,
          'font-weight': 600,
          fill: instance.layout.theme.colors.text,
        }))
          label.setAttribute(key, String(value));
        guide.appendChild(label);
      }
    }
    svg.appendChild(guide);
  }
  const panel = createReaderPanel(
    options.panel ? options.panel.container : undefined,
    {
      clear: () => clear(),
      unpin(slot) {
        const i = slot === 'A' ? 0 : 1;
        state = {
          ...state,
          pinned: state.pinned.filter((_, index) => index !== i),
          announcement: 'Date unpinned.',
        };
        emit('user');
      },
      pinPreview() {
        if (state.preview) pin(state.preview);
      },
    },
    container,
  );
  const paint = () => {
    panel.setTheme(instance.layout.theme);
    panel.update(slicePanelModel(state, options));
    guides();
  };
  const emit = (reason: ReaderChangeMeta['reason']) => {
    if (destroyed) return;
    paint();
    const next = JSON.stringify(state);
    if (next === lastEmitted) return;
    lastEmitted = next;
    onChange({ ...state, pinned: [...state.pinned] }, { reason });
  };
  function pin(slice: ReaderSlice) {
    if (destroyed) return;
    const current = readerSliceByKey(index, slice.key);
    if (!current) return;
    const existing = state.pinned.findIndex((pin) => pin.key === current.key);
    const pinned =
      existing >= 0
        ? state.pinned.filter((pin) => pin.key !== current.key)
        : state.pinned.length < 2
          ? [...state.pinned, current]
          : [state.pinned[0], current];
    state = {
      ...state,
      preview: current,
      pinned,
      announcement:
        existing >= 0
          ? `${current.xLabel} unpinned.`
          : `${current.xLabel} pinned as ${pinned.length === 1 ? 'A' : 'B'}.`,
    };
    emit('user');
  }
  function clear() {
    if (destroyed) return;
    cancel();
    state = { kind: 'slices', preview: null, pinned: [], announcement: 'Selection dismissed.' };
    emit('user');
  }
  function hit(clientX: number, clientY: number) {
    if (!bounds.width || !bounds.height) return null;
    const x = ((clientX - bounds.left) * instance.layout.dimensions.width) / bounds.width,
      y = ((clientY - bounds.top) * instance.layout.dimensions.height) / bounds.height;
    const panel = index.panels.find(
      (panel) =>
        x >= panel.area.x &&
        x <= panel.area.x + panel.area.width &&
        y >= panel.area.y &&
        y <= panel.area.y + panel.area.height,
    );
    return panel ? nearestReaderSlice(index, x, panel.scope.id) : null;
  }
  const preview = (event: PointerEvent) => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5)
      cancelledTap = true;
    if (
      !active() ||
      readerEventExcluded(event.target) ||
      event.pointerType === 'touch' ||
      event.buttons
    )
      return;
    pendingPointer = { x: event.clientX, y: event.clientY };
    if (pointerFrame !== null) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = null;
      if (!active() || !pendingPointer) return;
      const value = pendingPointer;
      pendingPointer = null;
      state = { ...state, preview: hit(value.x, value.y) };
      emit('user');
    });
  };
  const leave = () => {
    if (!active() || press?.touch) return;
    cancel();
    state = { ...state, preview: null };
    emit('user');
  };
  const down = (event: PointerEvent) => {
    cancelledTap = false;
    if (!active() || readerEventExcluded(event.target) || (press && press.id !== event.pointerId)) {
      cancel();
      return;
    }
    press = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      touch: event.pointerType === 'touch',
    };
  };
  const up = (event: PointerEvent) => {
    if (!press) return;
    if (press.touch && !cancelledTap && active() && !readerEventExcluded(event.target)) {
      const slice = hit(event.clientX, event.clientY);
      if (slice) pin(slice);
      cancelledTap = true;
    }
    press = null;
  };
  const click = (event: MouseEvent) => {
    if (!active() || cancelledTap || readerEventExcluded(event.target)) return;
    const slice = hit(event.clientX, event.clientY);
    if (slice) pin(slice);
  };
  const key = (event: KeyboardEvent) => {
    if (!active() || readerEventExcluded(event.target)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      clear();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (state.preview) pin(state.preview);
      else {
        const first = candidates()[0];
        if (first) {
          state = { ...state, preview: first };
          pin(first);
        }
      }
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const rows = candidates();
    if (!rows.length) return;
    event.preventDefault();
    const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const current = rows.findIndex((row) => row.key === state.preview?.key);
    const next =
      current < 0
        ? backwards
          ? rows.length - 1
          : 0
        : (current + (backwards ? -1 : 1) + rows.length) % rows.length;
    state = { ...state, preview: rows[next] };
    emit('user');
  };
  const blur = (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
    leave();
  };
  const scroll = () => {
    refreshBounds();
    cancel();
  };
  for (const [name, listener] of [
    ['pointermove', preview],
    ['pointerdown', down],
    ['pointerup', up],
    ['pointercancel', cancel],
    ['pointerleave', leave],
    ['click', click],
    ['keydown', key],
    ['focusout', blur],
  ] as const)
    container.addEventListener(name, listener as EventListener);
  window.addEventListener('scroll', scroll, true);
  window.addEventListener('resize', refreshBounds);
  const originalTabindex = container.getAttribute('tabindex');
  const originalLabel = container.getAttribute('aria-label');
  const originalRole = container.getAttribute('aria-roledescription');
  function acquire() {
    if (!index.supported) {
      lease?.release();
      return;
    }
    if (!lease?.active) {
      lease?.release();
      lease = acquireReaderHost(instance, owner);
    }
    if (!instance.layout.a11y.hidden && lease?.active) {
      container.setAttribute('tabindex', '0');
      container.setAttribute('aria-label', instance.layout.a11y.altText);
      container.setAttribute('aria-roledescription', 'chart');
    }
  }
  function diagnostics() {
    for (const diagnostic of index.diagnostics) options.onDiagnostic?.(diagnostic);
  }
  const controller: SliceReaderController = {
    get selection() {
      return state;
    },
    pin,
    clear,
    update(next, visibleKeys) {
      if (destroyed) return;
      const previousState = state;
      const dataReplaced = 'layer' in spec || 'layer' in next || next.data !== spec.data;
      spec = next;
      if (dataReplaced) revision++;
      const nextIndex = buildReaderSliceIndex(spec, instance.layout, {
        revision: options.revision ?? String(revision),
        binding: options.binding,
      });
      state = reconcileReaderSlices(state, nextIndex, {
        dataReplaced,
        visibleObservationKeys: visibleKeys,
      });
      if (!dataReplaced && !state.announcement) {
        const preview = previousState.preview
          ? readerSliceByKey(nextIndex, previousState.preview.key)
          : null;
        state = {
          ...state,
          announcement: previousState.announcement,
          preview: preview?.state === 'visible' ? preview : null,
        };
      }
      index = nextIndex;
      refreshBounds();
      acquire();
      diagnostics();
      const visibilityChanged = previousState.pinned.some(
        (before) => state.pinned.find((after) => after.key === before.key)?.state !== before.state,
      );
      emit(visibleKeys || (!dataReplaced && visibilityChanged) ? 'filter' : 'data');
    },
    setSelection(next, settings) {
      if (destroyed || JSON.stringify(state) === JSON.stringify(next)) return;
      state = { ...next, kind: 'slices', pinned: next.pinned.slice(0, 2) };
      if (settings?.notify) emit('programmatic');
      else {
        lastEmitted = JSON.stringify(state);
        paint();
      }
    },
    setOptions(next) {
      if (destroyed) return;
      const revisionChanged = next.revision !== options.revision;
      const bindingChanged = JSON.stringify(next.binding) !== JSON.stringify(options.binding);
      const rebuild = revisionChanged || bindingChanged;
      if (rebuild)
        state = {
          ...state,
          preview: null,
          pinned: state.pinned.filter((pin) => !bindingChanged && pin.persistent),
          announcement: 'Selection reconciled with the current data binding.',
        };
      options = next;
      panel.setContainer(options.panel ? options.panel.container : undefined);
      if (rebuild) controller.update(spec);
      else paint();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancel();
      unsubscribe?.();
      if (originalLabel === null) container.removeAttribute('aria-label');
      else container.setAttribute('aria-label', originalLabel);
      if (originalRole === null) container.removeAttribute('aria-roledescription');
      else container.setAttribute('aria-roledescription', originalRole);
      lease?.release();
      panel.destroy();
      guide?.remove();
      for (const [name, listener] of [
        ['pointermove', preview],
        ['pointerdown', down],
        ['pointerup', up],
        ['pointercancel', cancel],
        ['pointerleave', leave],
        ['click', click],
        ['keydown', key],
        ['focusout', blur],
      ] as const)
        container.removeEventListener(name, listener as EventListener);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', refreshBounds);
      if (originalTabindex === null) container.removeAttribute('tabindex');
      else container.setAttribute('tabindex', originalTabindex);
    },
  };
  acquire();
  // Subscribe even when initially unsupported so a later valid spec resumes.
  const subscriptionLease = lease ?? acquireReaderHost(instance, owner);
  if (!index.supported) subscriptionLease?.release();
  unsubscribe = subscriptionLease?.subscribe((event) => {
    if (event.kind === 'destroy') controller.destroy();
    else if (event.kind === 'gesture-start' || event.kind === 'editing') cancel();
    else if (event.kind === 'layout') controller.update(sourceSpec());
  });
  diagnostics();
  paint();
  if (!index.supported) emit('data');
  return controller;
}
