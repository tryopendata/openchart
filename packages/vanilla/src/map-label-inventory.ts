import type { GeoLabelInventoryEntry, ResolvedTheme } from '@opendata-ai/openchart-core';
import { applySrOnlyStyles } from './dom-helpers';
import { nextSvgId } from './svg-ids';

export type LabelInventoryOptions = false | { container: HTMLElement };
const explanations = {
  visible: 'Visible on map',
  collision: 'Omitted to avoid overlapping labels',
  'zoom-range': 'Visible at another zoom level',
  offscreen: 'Outside the current map view',
  unresolved: 'Anchor could not be resolved',
  'geometry-budget': 'Limited geographic label geometry',
};
const limitations = {
  'candidate-limit': 'Visual label candidate limit reached',
  'vertex-limit': 'Canonical anchor used because the projected geometry budget was reached',
  'search-limit': 'Interior anchor search limit reached',
};
export function geographicInventoryText(entry: GeoLabelInventoryEntry): string {
  const anchor =
    entry.anchor.kind === 'coordinate'
      ? `${entry.anchor.space} coordinate ${entry.anchor.x}, ${entry.anchor.y}`
      : `${entry.anchor.kind} ${entry.anchor.id}`;
  return `${entry.id}: ${entry.text}${entry.subtitle ? `. ${entry.subtitle}` : ''}. ${anchor}. ${explanations[entry.visibility]}${entry.presentation === 'note' ? '; available in map notes' : ''}${entry.limitation ? `. ${limitations[entry.limitation]}` : ''}.`;
}
/** One authored place/note stays one inventory entry across duplicated views. */
export function mergeGeoLabelInventory(
  entries: GeoLabelInventoryEntry[],
): GeoLabelInventoryEntry[] {
  const merged = new Map<string, GeoLabelInventoryEntry>();
  for (const entry of entries) {
    const prior = merged.get(entry.id);
    if (!prior || (entry.visibility === 'visible' && prior.visibility !== 'visible'))
      merged.set(entry.id, entry);
  }
  return [...merged.values()];
}
/** Owns only its two list trees; host contents and map dimensions are untouched. */
export function createMapLabelInventory(container: HTMLElement, initial?: LabelInventoryOptions) {
  let id: string | undefined;
  let hidden: HTMLDivElement | null = null;
  let disclosure: HTMLDetailsElement | null = null;
  let options = initial;
  let entries: GeoLabelInventoryEntry[] = [];
  let svg: SVGElement | null = null;
  let theme: ResolvedTheme | undefined;
  const fill = (target: HTMLElement) => {
    const list = document.createElement('ul');
    for (const entry of entries) {
      const item = document.createElement('li');
      item.textContent = geographicInventoryText(entry);
      list.appendChild(item);
    }
    target.appendChild(list);
  };
  const detachAssociation = () => {
    if (!svg) return;
    const ids = (svg.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((value) => value && value !== id);
    if (ids.length) svg.setAttribute('aria-describedby', ids.join(' '));
    else svg.removeAttribute('aria-describedby');
  };
  const refresh = () => {
    detachAssociation();
    if (!entries.length) {
      hidden?.remove();
      hidden = null;
      disclosure?.remove();
      disclosure = null;
      return;
    }
    if (!hidden) {
      id ??= nextSvgId('oc-map-label-inventory');
      hidden = document.createElement('div');
      hidden.id = id;
      hidden.className = 'oc-map-label-inventory oc-sr-only';
      applySrOnlyStyles(hidden);
      container.appendChild(hidden);
    }
    hidden.replaceChildren();
    fill(hidden);
    if (svg)
      svg.setAttribute(
        'aria-describedby',
        [svg.getAttribute('aria-describedby'), id].filter(Boolean).join(' '),
      );
    if (options) {
      if (!disclosure) {
        disclosure = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Map places and notes';
        disclosure.appendChild(summary);
      }
      if (theme) {
        Object.assign(disclosure.style, {
          fontFamily: theme.fonts.family,
          fontSize: `${theme.fonts.sizes.body}px`,
          lineHeight: '1.5',
          color: theme.colors.text,
          padding: '12px 0',
        });
        Object.assign((disclosure.firstElementChild as HTMLElement).style, {
          cursor: 'pointer',
          fontWeight: '600',
          padding: '4px 0',
        });
      }
      const open = disclosure.open;
      while (disclosure.children.length > 1) disclosure.lastElementChild?.remove();
      fill(disclosure);
      disclosure.open = open;
      options.container.appendChild(disclosure);
    } else {
      disclosure?.remove();
      disclosure = null;
    }
  };
  return {
    update(nextSvg: SVGElement, next: GeoLabelInventoryEntry[], nextTheme?: ResolvedTheme) {
      theme = nextTheme;
      detachAssociation();
      svg = nextSvg;
      entries = next;
      refresh();
    },
    setOptions(next?: LabelInventoryOptions) {
      options = next;
      refresh();
    },
    destroy() {
      detachAssociation();
      hidden?.remove();
      disclosure?.remove();
      hidden = null;
      disclosure = null;
      svg = null;
      entries = [];
    },
  };
}
