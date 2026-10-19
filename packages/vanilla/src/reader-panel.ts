import type { ResolvedTheme } from '@opendata-ai/openchart-core';
import { applySrOnlyStyles } from './dom-helpers';
import { stampThemeProperties } from './theme-tokens';
/** Shared host-owned reader UI. Adapters supply all labels and comparisons. */
export interface ReaderPanelRecord {
  id: string;
  name: string;
  domainLabel?: string;
  valueLabel: string;
  unit?: string;
  state: 'visible' | 'filtered';
  fields: Array<{ label: string; value: string; status?: 'value' | 'missing' | 'ambiguous' }>;
}
export interface ReaderPanelViewModel {
  preview?: ReaderPanelRecord;
  pinned: Array<{ slot: 'A' | 'B'; record: ReaderPanelRecord }>;
  comparisons?: Array<{
    id: string;
    label: string;
    absolute?: string | number;
    relative?: string | number;
    unit?: string;
    explanation?: string;
  }>;
  announcement: string;
}
export interface ReaderPanelActions {
  clear(): void;
  unpin(slot: 'A' | 'B'): void;
  showOnMap?(id: string): void;
  pinPreview?(): void;
}
export function createReaderPanel(
  initial: HTMLElement | undefined,
  actions: ReaderPanelActions,
  announcementHost?: HTMLElement,
) {
  let container = initial;
  let theme: ResolvedTheme | undefined;
  let root: HTMLElement | undefined;
  let last: ReaderPanelViewModel = { pinned: [], announcement: '' };
  let lastAnnouncement = '';
  let live: HTMLElement | undefined;
  const text = (tag: string, value: string) => {
    const el = document.createElement(tag);
    el.textContent = value;
    return el;
  };
  const button = (label: string, action: () => void) => {
    const el = text('button', label) as HTMLButtonElement;
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  };
  function render() {
    if (!live) {
      live = text('p', '');
      live.className = 'oc-sr-only';
      applySrOnlyStyles(live);
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
    }
    if (!container) {
      root?.remove();
      if (last.announcement !== lastAnnouncement) live.textContent = last.announcement;
      lastAnnouncement = last.announcement;
      announcementHost?.append(live);
      return;
    }
    const focused = root?.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).textContent
      : null;
    if (!root) {
      root = document.createElement('section');
      root.className = 'oc-root oc-reader-panel';
      root.setAttribute('aria-label', 'Chart inspection');
    }
    if (theme) stampThemeProperties(root, theme);
    for (const child of [...root.children]) if (child !== live) child.remove();
    const records = [
      ...last.pinned.map((pin) => ({ label: pin.slot, record: pin.record, slot: pin.slot })),
      ...(last.preview && !last.pinned.some((pin) => pin.record.id === last.preview!.id)
        ? [{ label: 'Preview', record: last.preview, slot: undefined }]
        : []),
    ];
    if (!records.length) {
      const empty = text('p', 'Inspect a value, then pin two selections to compare.');
      empty.className = 'oc-reader-empty';
      root.append(empty);
    }
    for (const item of records) {
      const article = document.createElement('article');
      if (item.slot) article.dataset.readerSlot = item.slot;
      article.append(text('h3', `${item.label}: ${item.record.name}`));
      if (item.record.domainLabel) article.append(text('p', item.record.domainLabel));
      article.append(
        text(
          'p',
          `${item.record.valueLabel}${item.record.unit ? ` ${item.record.unit}` : ''}${item.record.state === 'filtered' ? ' (not currently shown)' : ''}`,
        ),
      );
      const list = document.createElement('dl');
      for (const field of item.record.fields) {
        list.append(text('dt', field.label), text('dd', field.value));
      }
      article.append(list);
      if (item.slot) article.append(button(`Remove ${item.slot}`, () => actions.unpin(item.slot!)));
      else if (actions.pinPreview) article.append(button('Pin preview', actions.pinPreview));
      if (actions.showOnMap)
        article.append(
          button(`Show ${item.record.name} on map`, () => actions.showOnMap!(item.record.id)),
        );
      root.append(article);
    }
    for (const comparison of last.comparisons ?? []) {
      const section = document.createElement('p');
      section.className = 'oc-reader-comparison';
      section.append(text('strong', comparison.label));
      if (comparison.absolute !== undefined)
        section.append(
          document.createTextNode(
            ` ${comparison.absolute}${comparison.unit ? ` ${comparison.unit}` : ''}`,
          ),
        );
      if (comparison.relative !== undefined)
        section.append(document.createTextNode(` (${comparison.relative})`));
      if (comparison.explanation)
        section.append(document.createTextNode(` ${comparison.explanation}`));
      root.append(section);
    }
    if (last.pinned.length) root.append(button('Clear selection', actions.clear));
    if (live && last.announcement !== lastAnnouncement) live.textContent = last.announcement;
    lastAnnouncement = last.announcement;
    if (live) root.append(live);
    container.append(root);
    if (focused)
      [...root.querySelectorAll('button')]
        .find((button) => button.textContent === focused)
        ?.focus();
  }
  return {
    setTheme(next: ResolvedTheme) {
      theme = next;
      if (root) stampThemeProperties(root, next);
    },
    update(model: ReaderPanelViewModel) {
      last = model;
      render();
    },
    setContainer(next?: HTMLElement) {
      if (next !== container) {
        container = next;
        render();
      }
    },
    destroy() {
      root?.remove();
      live?.remove();
      root = undefined;
      container = undefined;
    },
  };
}
