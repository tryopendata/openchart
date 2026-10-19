import type {
  ChartLayout,
  ChartSpec,
  DataRow,
  LayerSpec,
  ReaderChangeMeta,
  ReaderObservation,
  ReaderSelection,
} from '@opendata-ai/openchart-core';
import {
  observationKey,
  reconcileReaderSelection,
  resolveObservationIdentities,
} from '@opendata-ai/openchart-engine';
import { acquireReaderHost, readerEventExcluded } from './interactions/reader-arbitration';
import type { ChartInstance } from './mount';
import type { ReaderPresentationOptions, ReaderSetOptions } from './reader-options';
import { createReaderPanel } from './reader-panel';
import { observationPanelModel } from './reader-view-model';

export interface ReaderController {
  readonly selection: ReaderSelection;
  /** Call after chart.update(). Without an override, visibility follows compiled marks. */
  update(spec: ChartSpec | LayerSpec, visibleKeys?: ReadonlySet<string>): void;
  pin(datum: DataRow): void;
  clear(): void;
  setSelection(next: ReaderSelection, options?: ReaderSetOptions): void;
  setOptions(options: ReaderPresentationOptions): void;
  destroy(): void;
}

const LAYER_UNSUPPORTED =
  'Reader inspection is unavailable for layered charts: observations cannot be bound to a single dataset.';
const seriesField = (spec: ChartSpec) =>
  spec.encoding.color && 'field' in spec.encoding.color ? spec.encoding.color.field : undefined;

/**
 * Persistent reader interaction, separate from editor ElementRef selection.
 * Layered specs clear/disable inspection and announce the unsupported binding;
 * updating back to a single chart resumes inspection without choosing a leaf.
 */
export function createObservationReader(
  container: HTMLElement,
  instance: ChartInstance,
  initial: ChartSpec | LayerSpec,
  onChange: (selection: ReaderSelection, meta: ReaderChangeMeta) => void,
  initialOptions: ReaderPresentationOptions = {},
): ReaderController {
  let spec = 'layer' in initial ? null : initial;
  let options = initialOptions;
  let destroyed = false;
  const originalTabindex = container.getAttribute('tabindex');
  const originalLabel = container.getAttribute('aria-label');
  const originalRole = container.getAttribute('aria-roledescription');
  const owner = {};
  let lease = acquireReaderHost(instance, owner);
  if ('layer' in initial) lease?.release();
  else if (!instance.layout.a11y.hidden && lease?.active) {
    container.setAttribute('tabindex', '0');
    container.setAttribute('aria-label', instance.layout.a11y.altText);
    container.setAttribute('aria-roledescription', 'chart');
  }
  const active = () => !destroyed && !!lease?.active;
  let bounds =
    container.querySelector('svg')?.getBoundingClientRect() ?? container.getBoundingClientRect();
  const refreshBounds = () => {
    const svgBounds = container.querySelector('svg')?.getBoundingClientRect();
    bounds = svgBounds?.width && svgBounds.height ? svgBounds : container.getBoundingClientRect();
  };
  refreshBounds();
  const usableBounds = () => bounds;
  let state: ReaderSelection = {
    preview: null,
    pinned: [],
    announcement: spec
      ? lease
        ? ''
        : 'Inspection is unavailable because another reader owns this chart.'
      : LAYER_UNSUPPORTED,
  };
  let keyboardIndex = -1;
  let settleFrame: number | null = null;
  let pointerFrame: number | null = null;
  let pointerEvent: PointerEvent | null = null;
  let visibilityOverride: ReadonlySet<string> | undefined;
  let identities = spec
    ? resolveObservationIdentities(spec.data, spec.encoding.key?.field, seriesField(spec))
    : [];
  let panel: ReturnType<typeof createReaderPanel> | undefined;
  let emitted = '';
  const paint = () => {
    panel?.setTheme(instance.layout.theme);
    panel?.update(observationPanelModel(state, spec, options));
  };
  const emit = (reason: ReaderChangeMeta['reason'] = 'user') => {
    if (destroyed) return;
    paint();
    const signature = JSON.stringify(state);
    if (signature === emitted) return;
    emitted = signature;
    onChange({ ...state, pinned: [...state.pinned] }, { reason });
  };
  const visibleData = (
    layout: ChartLayout = instance.sampleLayout(),
  ): Array<{ datum: DataRow; key?: string }> => {
    const rows = (
      layout.facet ? layout.facet.panels.flatMap((panel) => panel.marks) : layout.marks
    ).flatMap((mark) => {
      if ('opacity' in mark && mark.opacity === 0) return [];
      if (mark.type === 'line' || mark.type === 'area')
        return (mark.dataPoints ?? []).map((point, index) => ({
          datum: point.datum,
          key: mark.pointKeys?.[index],
        }));
      if ('data' in mark) return [{ datum: mark.data as DataRow, key: mark.key }];
      return [];
    });
    // A line and its point overlay share rows. Distinct duplicate rows must not
    // collapse merely because their serialized values happen to be identical.
    return [...new Map(rows.map((row) => [row.datum, row])).values()];
  };
  const compiledVisibleKeys = (observations: ReaderObservation[]): ReadonlySet<string> => {
    const keys = new Set<string>();
    if (!spec || !observations.length) return keys;
    // Use the destination layout, not interpolated geometry or exit ghosts.
    // Zero-length marks still count; absence retains the pin as filtered.
    const rows = visibleData(instance.layout);
    const references = new Set(rows.map(({ datum }) => datum));
    const signatures = new Set(rows.map(({ datum }) => JSON.stringify(datum)));
    const keyField = spec.encoding.key?.field;
    const visibleSourceKeys = new Set(
      keyField ? rows.map(({ datum }) => observationKey(datum[keyField])) : [],
    );
    for (const observation of observations) {
      if (observation.kind === 'aggregate') {
        if (signatures.has(JSON.stringify(observation.datum))) keys.add(observation.observation);
        continue;
      }
      const index = identities.findIndex((id) => id.observation === observation.observation);
      if (index < 0) continue;
      const row = spec.data[index];
      const signature = JSON.stringify(row);
      const visible = observation.persistent
        ? visibleSourceKeys.has(observation.observation)
        : references.has(row) ||
          (signatures.has(signature) &&
            spec.data.filter((source) => JSON.stringify(source) === signature).length === 1);
      if (visible) keys.add(observation.observation);
    }
    return keys;
  };
  const resolve = (datum: DataRow): ReaderObservation | null => {
    if (!spec) return null;
    const keyField = spec.encoding.key?.field;
    let index = spec.data.indexOf(datum);
    if (index >= 0 && spec.data.lastIndexOf(datum) !== index) return null;
    if (index < 0 && keyField)
      index = spec.data.findIndex(
        (_row, i) =>
          identities[i].persistent && identities[i].observation === observationKey(datum[keyField]),
      );
    // Compilers may normalize a row. Within one revision, a unique exact row
    // match is safe; an ambiguous match must never pick the first observation.
    if (index < 0) {
      const matches = spec.data.flatMap((row, i) =>
        JSON.stringify(row) === JSON.stringify(datum) ? [i] : [],
      );
      if (matches.length > 1) return null;
      if (matches.length === 1) index = matches[0];
    }
    if (index >= 0) {
      const source = spec.data[index];
      const candidates = visibleData(instance.layout).filter((row) =>
        keyField
          ? observationKey(row.datum[keyField]) === identities[index].observation
          : Object.keys(source).every((field) => row.datum[field] === source[field]),
      );
      const destination = candidates.length === 1 ? candidates[0].datum : datum;
      return { ...identities[index], datum: destination, state: 'visible' };
    }
    // Aggregated/bin observations describe visible groups, not a raw source row.
    // Their identity includes the transformation and grouping mark; replacement
    // clears them until an explicit host mapping supplies revision persistence.
    const group = visibleData(instance.layout).find(
      (row) => row.datum === datum || JSON.stringify(row.datum) === JSON.stringify(datum),
    );
    return group
      ? {
          observation: `aggregate:${JSON.stringify([spec.mark, spec.encoding, spec.transform])}:${group.key ?? JSON.stringify(datum)}`,
          persistent: false,
          datum: group.datum,
          kind: 'aggregate',
          state: 'visible',
        }
      : null;
  };
  const pin = (datum: DataRow) => {
    const observation = resolve(datum);
    if (!observation) return;
    observation.state = (visibilityOverride ?? compiledVisibleKeys([observation])).has(
      observation.observation,
    )
      ? 'visible'
      : 'filtered';
    state = {
      ...state,
      preview: observation,
      announcement: 'Observation pinned.',
      pinned: [
        ...state.pinned.filter((item) => item.observation !== observation.observation),
        observation,
      ].slice(-2),
    };
    emit();
  };
  const clear = () => {
    cancel();
    state = {
      preview: null,
      pinned: [],
      announcement: spec ? 'Selection dismissed.' : LAYER_UNSUPPORTED,
    };
    emit();
  };
  function hit(event: MouseEvent | PointerEvent): DataRow | null {
    if (!spec) return null;
    const svg = container.querySelector('svg');
    if (!svg) return null;
    const bounds = usableBounds();
    if (!bounds.width || !bounds.height) return null;
    const layout = instance.sampleLayout();
    const x = ((event.clientX - bounds.left) * layout.dimensions.width) / bounds.width;
    const y = ((event.clientY - bounds.top) * layout.dimensions.height) / bounds.height;
    if (
      x < layout.area.x ||
      x > layout.area.x + layout.area.width ||
      y < layout.area.y ||
      y > layout.area.y + layout.area.height
    )
      return null;
    let nearest: DataRow | null = null;
    let distance = 32;
    const consider = (datum: DataRow, dx: number, dy: number) => {
      const d = Math.hypot(dx, dy);
      if (d <= distance) {
        distance = d;
        nearest = datum;
      }
    };
    for (const mark of layout.facet
      ? layout.facet.panels.flatMap((panel) => panel.marks)
      : layout.marks) {
      if ('opacity' in mark && mark.opacity === 0) continue;
      if (mark.type === 'point') consider(mark.data, x - mark.cx, y - mark.cy);
      else if (mark.type === 'rect')
        consider(
          mark.data,
          Math.max(mark.x - x, 0, x - mark.x - mark.width),
          Math.max(mark.y - y, 0, y - mark.y - mark.height),
        );
      else if (mark.type === 'arc') {
        const dx = x - mark.center.x;
        const dy = y - mark.center.y;
        const radius = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        const start = (mark.startAngle + Math.PI * 2) % (Math.PI * 2);
        const sweep = mark.endAngle - mark.startAngle;
        if (
          radius >= mark.innerRadius &&
          radius <= mark.outerRadius &&
          (angle - start + Math.PI * 2) % (Math.PI * 2) <= sweep
        )
          consider(mark.data, 0, 0);
      } else if (mark.type === 'line' || mark.type === 'area') {
        for (const point of mark.dataPoints ?? []) consider(point.datum, x - point.x, y - point.y);
      }
    }
    return nearest;
  }
  const preview = (event: PointerEvent) => {
    if (!active() || readerEventExcluded(event.target) || event.pointerType === 'touch') return;
    const datum = hit(event);
    state = { ...state, preview: datum ? resolve(datum) : null };
    emit();
  };
  const click = (event: MouseEvent) => {
    if (!active() || readerEventExcluded(event.target) || cancelledTap) return;
    const datum = hit(event);
    if (datum) pin(datum);
  };
  const leave = () => {
    cancel();
    state = { ...state, preview: null };
    emit();
  };
  const keydown = (event: KeyboardEvent) => {
    if (!spec || !active() || readerEventExcluded(event.target)) return;
    if (
      (event.target as HTMLElement).closest(
        'input, textarea, select, button, [contenteditable=true]',
      )
    )
      return;
    if (event.key === 'Escape') {
      event.preventDefault();
      clear();
      return;
    }
    if (event.key === 'Enter' && state.preview) {
      event.preventDefault();
      pin(state.preview.datum);
      return;
    }
    const rows = visibleData();
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || !rows.length)
      return;
    event.preventDefault();
    event.stopPropagation();
    const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    keyboardIndex =
      keyboardIndex < 0
        ? backwards
          ? rows.length - 1
          : 0
        : (keyboardIndex + (backwards ? -1 : 1) + rows.length) % rows.length;
    state = { ...state, preview: resolve(rows[keyboardIndex].datum) };
    emit();
  };
  let press: { x: number; y: number; id: number } | null = null;
  let cancelledTap = false;
  const down = (event: PointerEvent) => {
    cancelledTap = false;
    if (
      !active() ||
      readerEventExcluded(event.target) ||
      (!event.isPrimary && event.pointerType === 'touch')
    ) {
      press = null;
      cancelledTap = true;
      return;
    }
    press = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const move = (event: PointerEvent) => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5)
      cancelledTap = true;
    pointerEvent = event;
    if (pointerFrame === null)
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = null;
        if (pointerEvent && !destroyed) preview(pointerEvent);
        pointerEvent = null;
      });
  };
  const cancel = () => {
    press = null;
    cancelledTap = true;
    if (pointerFrame !== null) cancelAnimationFrame(pointerFrame);
    pointerFrame = null;
    pointerEvent = null;
  };
  const scroll = () => {
    refreshBounds();
    cancel();
  };
  container.addEventListener('pointerdown', down);
  container.addEventListener('pointercancel', cancel);
  window.addEventListener('scroll', scroll, true);
  window.addEventListener('resize', refreshBounds);
  container.addEventListener('pointermove', move);
  container.addEventListener('pointerleave', leave);
  container.addEventListener('click', click);
  container.addEventListener('keydown', keydown);
  panel = createReaderPanel(
    options.panel ? options.panel.container : undefined,
    {
      clear,
      unpin(slot) {
        const index = slot === 'A' ? 0 : 1;
        state = {
          ...state,
          pinned: state.pinned.filter((_, i) => i !== index),
          announcement: 'Observation unpinned.',
        };
        emit();
      },
      pinPreview() {
        if (state.preview) pin(state.preview.datum);
      },
    },
    container,
  );
  paint();
  if (!spec) emit();
  let unsubscribe: (() => void) | undefined;
  const controller: ReaderController = {
    get selection() {
      return state;
    },
    pin,
    clear,
    update(next, visibleKeys) {
      if (destroyed) return;
      refreshBounds();
      if (lease?.active && !instance.layout.a11y.hidden) {
        container.setAttribute('aria-label', instance.layout.a11y.altText);
        container.setAttribute('aria-roledescription', 'chart');
        container.setAttribute('tabindex', '0');
      }
      if (settleFrame !== null) {
        cancelAnimationFrame(settleFrame);
        settleFrame = null;
      }
      visibilityOverride = visibleKeys;
      if ('layer' in next) {
        lease?.release();
        spec = null;
        identities = [];
        keyboardIndex = -1;
        state = { preview: null, pinned: [], announcement: LAYER_UNSUPPORTED };
        emit(visibilityOverride ? 'filter' : 'data');
        return;
      }
      const meaningChanged =
        !spec ||
        JSON.stringify([next.mark, next.encoding, next.transform]) !==
          JSON.stringify([spec.mark, spec.encoding, spec.transform]);
      if (
        meaningChanged &&
        (state.pinned.some((item) => item.kind === 'aggregate') ||
          state.preview?.kind === 'aggregate')
      ) {
        state = {
          ...state,
          preview: null,
          pinned: state.pinned.filter((item) => item.kind !== 'aggregate'),
          announcement:
            'Aggregate selection cleared because its grouping or transformation changed.',
        };
      }
      const replaced =
        !spec || next.data !== spec.data || next.encoding.key?.field !== spec.encoding.key?.field;
      const resuming = !spec || !lease;
      if (resuming) {
        lease = acquireReaderHost(instance, owner);
        subscribeLease();
        if (lease?.active && !instance.layout.a11y.hidden) {
          container.setAttribute('tabindex', '0');
          container.setAttribute('aria-label', instance.layout.a11y.altText);
          container.setAttribute('aria-roledescription', 'chart');
        }
      }
      spec = next;
      identities = resolveObservationIdentities(
        spec.data,
        spec.encoding.key?.field,
        seriesField(spec),
      );
      const effectiveVisibility = visibleKeys ?? compiledVisibleKeys(state.pinned);
      if (replaced)
        state = reconcileReaderSelection(
          state,
          spec.data,
          spec.encoding.key?.field,
          seriesField(spec),
          effectiveVisibility,
        );
      else
        state = {
          ...state,
          preview: null,
          pinned: state.pinned.map((item) => ({
            ...item,
            ...(item.kind !== 'aggregate'
              ? identities.find((id) => id.observation === item.observation)
              : {}),
            state: effectiveVisibility.has(item.observation) ? 'visible' : 'filtered',
          })),
        };
      state.pinned = state.pinned.map((item) =>
        item.state === 'visible' && item.kind !== 'aggregate'
          ? { ...item, datum: resolve(item.datum)?.datum ?? item.datum }
          : item,
      );
      if (resuming)
        state = {
          ...state,
          announcement: lease?.active
            ? ''
            : 'Inspection is unavailable because another reader owns this chart.',
        };
      if (replaced || meaningChanged) keyboardIndex = -1;
      emit(visibilityOverride ? 'filter' : 'data');
      const settle = () => {
        settleFrame = null;
        if (!state.pinned.some((item) => item.previous)) return;
        if (instance.sampleLayout() !== instance.layout) {
          settleFrame = requestAnimationFrame(settle);
          return;
        }
        state = { ...state, pinned: state.pinned.map(({ previous: _previous, ...item }) => item) };
        emit(visibilityOverride ? 'filter' : 'data');
      };
      settleFrame = requestAnimationFrame(settle);
    },
    setSelection(next, settings) {
      if (destroyed || JSON.stringify(next) === JSON.stringify(state)) return;
      state = { ...next, pinned: [...next.pinned].slice(-2) };
      if (settings?.notify) emit('programmatic');
      else {
        emitted = JSON.stringify(state);
        paint();
      }
    },
    setOptions(next) {
      if (destroyed) return;
      const revisionChanged = options.revision !== next.revision;
      const bindingChanged = JSON.stringify(options.binding) !== JSON.stringify(next.binding);
      if (revisionChanged || bindingChanged)
        state = {
          ...state,
          preview: null,
          pinned: state.pinned.filter((pin) => !bindingChanged && pin.persistent),
          announcement: 'Selection reconciled with the current data binding.',
        };
      options = next;
      panel?.setContainer(options.panel ? options.panel.container : undefined);
      paint();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancel();
      unsubscribe?.();
      if (originalTabindex === null) container.removeAttribute('tabindex');
      else container.setAttribute('tabindex', originalTabindex);
      if (originalLabel === null) container.removeAttribute('aria-label');
      else container.setAttribute('aria-label', originalLabel);
      if (originalRole === null) container.removeAttribute('aria-roledescription');
      else container.setAttribute('aria-roledescription', originalRole);
      lease?.release();
      panel?.destroy();
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', refreshBounds);
      container.removeEventListener('pointerdown', down);
      container.removeEventListener('pointercancel', cancel);
      if (settleFrame !== null) cancelAnimationFrame(settleFrame);
      container.removeEventListener('pointermove', move);
      container.removeEventListener('pointerleave', leave);
      container.removeEventListener('click', click);
      container.removeEventListener('keydown', keydown);
    },
  };
  function subscribeLease() {
    unsubscribe?.();
    unsubscribe = lease?.subscribe((event) => {
      if (event.kind === 'destroy') {
        controller.destroy();
        return;
      }
      if (event.kind === 'gesture-start' || event.kind === 'editing') {
        cancel();
        return;
      }
      if (event.kind === 'layout') {
        const next = lease?.getSpec();
        controller.update(next && !('type' in next) ? next : (spec ?? initial));
      }
    });
  }
  subscribeLease();
  return controller;
}
