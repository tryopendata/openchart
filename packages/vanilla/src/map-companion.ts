import type { ResolvedTheme } from '@opendata-ai/openchart-core';
import type { GeoReaderIndex, GeoReaderRecord } from '@opendata-ai/openchart-engine';
import { queryGeoReaderRecords } from '@opendata-ai/openchart-engine';
import { stampThemeProperties } from './theme-tokens';
export interface MapCompanionOptions {
  container: HTMLElement;
  search?: boolean;
  rank?: 'ascending' | 'descending';
  kind?: 'feature' | 'point';
  pageSize?: number;
}
export function createMapCompanion(actions: {
  preview(record: GeoReaderRecord | null): void;
  pin(record: GeoReaderRecord): void;
  show(record: GeoReaderRecord): void;
}) {
  let options: MapCompanionOptions | undefined;
  let index: GeoReaderIndex | undefined;
  let root: HTMLElement | undefined;
  let theme: ResolvedTheme | undefined;
  let query = '';
  let page = 0;
  let restoringFocus = false;
  function render() {
    const active =
      document.activeElement instanceof HTMLElement && root?.contains(document.activeElement)
        ? document.activeElement
        : undefined;
    const focused = active
      ? { action: active.dataset.companionAction, observation: active.dataset.companionObservation }
      : undefined;
    root?.remove();
    root = undefined;
    if (!options || !index) return;
    root = document.createElement('section');
    root.className = 'oc-root oc-map-companion';
    if (theme) stampThemeProperties(root, theme);
    root.setAttribute('aria-label', 'Find a place');
    if (options.search !== false) {
      const input = document.createElement('input');
      input.type = 'search';
      input.dataset.companionAction = 'search';
      input.setAttribute('aria-label', 'Find a place');
      input.value = query;
      input.addEventListener('input', () => {
        query = input.value;
        page = 0;
        render();
        const next = root?.querySelector('input');
        next?.focus();
        next?.setSelectionRange(query.length, query.length);
      });
      const label = document.createElement('label');
      label.textContent = 'Find a place';
      label.append(input);
      root.append(label);
    }
    const hint = document.createElement('p');
    hint.textContent = 'Choose a place to pin it for comparison. Hover or focus to preview.';
    root.append(hint);
    const rows = queryGeoReaderRecords(index, query, options.rank, options.kind);
    const size = Math.max(1, Math.floor(options.pageSize ?? 50));
    if (focused?.observation) {
      const position = rows.findIndex(
        (record) => record.observation.observation === focused.observation,
      );
      if (position >= 0) page = Math.floor(position / size);
    }
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / size) - 1));
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = rows.length
      ? `${rows.length} ${rows.length === 1 ? 'place' : 'places'}${query ? (rows.length === 1 ? ' matches your search' : ' match your search') : ' available'}.`
      : query
        ? 'No places match your search.'
        : 'No places available.';
    root.append(status);
    const list = document.createElement('ol');
    for (const record of rows.slice(page * size, (page + 1) * size)) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.companionAction = 'pin';
      button.dataset.companionObservation = record.observation.observation;
      const tied =
        record.rank !== undefined && rows.filter((row) => row.rank === record.rank).length > 1;
      button.textContent = `${record.rank !== undefined ? `${tied ? 'Tied ' : ''}${record.rank}. ` : ''}${record.name}: ${record.valueLabel}${record.valueStatus === 'value' && record.unit ? ` ${record.unit}` : ''}`;
      button.addEventListener('mouseenter', () => actions.preview(record));
      // Keep the last inspected place: clearing on leave can shrink a preceding panel,
      // move this row under the pointer again, and create a hover/layout feedback loop.
      button.addEventListener('focus', () => {
        if (!restoringFocus) actions.preview(record);
      });
      button.addEventListener('click', () => actions.pin(record));
      item.append(button);
      const show = document.createElement('button');
      show.type = 'button';
      show.dataset.companionAction = 'show';
      show.dataset.companionObservation = record.observation.observation;
      show.textContent = 'Show on map';
      show.setAttribute('aria-label', `Show ${record.name} on map`);
      show.addEventListener('click', () => actions.show(record));
      item.append(show);
      if (record.viewIds?.length === 0) {
        const unavailable = document.createElement('span');
        unavailable.textContent = 'Not visible in this projection.';
        item.append(unavailable);
      }
      list.append(item);
    }
    root.append(list);
    for (const [label, delta] of [
      ['Previous', -1],
      ['Next', 1],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.companionAction = label;
      button.disabled = delta < 0 ? page === 0 : (page + 1) * size >= rows.length;
      button.addEventListener('click', () => {
        page += delta;
        render();
      });
      root.append(button);
    }
    options.container.append(root);
    if (focused && document.activeElement === document.body) {
      const target = [...root.querySelectorAll<HTMLElement>('[data-companion-action]')].find(
        (element) =>
          element.dataset.companionAction === focused.action &&
          element.dataset.companionObservation === focused.observation,
      );
      restoringFocus = true;
      try {
        target?.focus();
      } finally {
        restoringFocus = false;
      }
    }
  }
  return {
    setTheme(next: ResolvedTheme) {
      theme = next;
      if (root) stampThemeProperties(root, next);
    },
    update(next: GeoReaderIndex) {
      if (index === next) return;
      index = next;
      render();
    },
    setOptions(next?: MapCompanionOptions) {
      if (!options && !next) return;
      const sameSemantics =
        options &&
        next &&
        (options.search !== false) === (next.search !== false) &&
        options.rank === next.rank &&
        options.kind === next.kind &&
        (options.pageSize ?? 50) === (next.pageSize ?? 50);
      if (sameSemantics && options!.container === next!.container) return;
      if (!sameSemantics) page = 0;
      options = next ? { ...next } : undefined;
      render();
    },
    destroy() {
      root?.remove();
      options = undefined;
      index = undefined;
    },
  };
}
