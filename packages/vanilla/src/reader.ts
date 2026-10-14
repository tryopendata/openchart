import type {
  ChartLayout,
  ChartSpec,
  DataRow,
  LayerSpec,
  ReaderObservation,
  ReaderSelection,
} from '@opendata-ai/openchart-core';
import {
  observationKey,
  reconcileReaderSelection,
  resolveObservationIdentities,
} from '@opendata-ai/openchart-engine';
import type { ChartInstance } from './mount';

export interface ReaderController {
  readonly selection: ReaderSelection;
  /** Call after chart.update(). Without an override, visibility follows compiled marks. */
  update(spec: ChartSpec | LayerSpec, visibleKeys?: ReadonlySet<string>): void;
  pin(datum: DataRow): void;
  clear(): void;
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
export function createReader(
  container: HTMLElement,
  instance: ChartInstance,
  initial: ChartSpec | LayerSpec,
  onChange: (selection: ReaderSelection) => void,
): ReaderController {
  let spec = 'layer' in initial ? null : initial;
  let state: ReaderSelection = {
    preview: null,
    pinned: [],
    announcement: spec ? '' : LAYER_UNSUPPORTED,
  };
  let keyboardIndex = -1;
  let settleFrame: number | null = null;
  let visibilityOverride: ReadonlySet<string> | undefined;
  let identities = spec
    ? resolveObservationIdentities(spec.data, spec.encoding.key?.field, seriesField(spec))
    : [];
  const emit = () => onChange({ ...state, pinned: [...state.pinned] });
  const visibleData = (
    layout: ChartLayout = instance.sampleLayout(),
  ): Array<{ datum: DataRow; key?: string }> => {
    const rows = layout.marks.flatMap((mark) => {
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
    if (index >= 0) return { ...identities[index], datum: spec.data[index], state: 'visible' };
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
    const bounds = svg.getBoundingClientRect();
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
    for (const mark of layout.marks) {
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
    if (event.pointerType === 'touch') return;
    const datum = hit(event);
    state = { ...state, preview: datum ? resolve(datum) : null };
    emit();
  };
  const click = (event: MouseEvent) => {
    const datum = hit(event);
    if (datum) pin(datum);
  };
  const leave = () => {
    state = { ...state, preview: null };
    emit();
  };
  const keydown = (event: KeyboardEvent) => {
    if (!spec) return;
    if (
      (event.target as HTMLElement).closest(
        'input, textarea, select, button, [contenteditable=true]',
      )
    )
      return;
    if (event.key === 'Escape') {
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
  container.addEventListener('pointermove', preview);
  container.addEventListener('pointerleave', leave);
  container.addEventListener('click', click);
  container.addEventListener('keydown', keydown, true);
  if (!spec) emit();
  return {
    get selection() {
      return state;
    },
    pin,
    clear,
    update(next, visibleKeys) {
      if (settleFrame !== null) {
        cancelAnimationFrame(settleFrame);
        settleFrame = null;
      }
      visibilityOverride = visibleKeys;
      if ('layer' in next) {
        spec = null;
        identities = [];
        keyboardIndex = -1;
        state = { preview: null, pinned: [], announcement: LAYER_UNSUPPORTED };
        emit();
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
      const resuming = !spec;
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
      if (resuming) state = { ...state, announcement: '' };
      if (replaced || meaningChanged) keyboardIndex = -1;
      emit();
      const settle = () => {
        settleFrame = null;
        if (!state.pinned.some((item) => item.previous)) return;
        if (instance.sampleLayout() !== instance.layout) {
          settleFrame = requestAnimationFrame(settle);
          return;
        }
        state = { ...state, pinned: state.pinned.map(({ previous: _previous, ...item }) => item) };
        emit();
      };
      settleFrame = requestAnimationFrame(settle);
    },
    destroy() {
      if (settleFrame !== null) cancelAnimationFrame(settleFrame);
      container.removeEventListener('pointermove', preview);
      container.removeEventListener('pointerleave', leave);
      container.removeEventListener('click', click);
      container.removeEventListener('keydown', keydown, true);
    },
  };
}
