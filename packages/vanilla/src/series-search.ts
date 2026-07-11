/**
 * Series search combobox: the DOM overlay for the `seriesSearch` spec option.
 *
 * Renders an ARIA 1.2 editable combobox (input + popup listbox) with
 * multi-select chips, absolutely positioned inside `.oc-root` over the band
 * the chrome layout reserves (`layout.seriesSearch`). Because the overlay is
 * position: absolute, mounting or updating it never changes the observed
 * container's size, so it cannot re-trigger the container ResizeObserver.
 *
 * Matching is a diacritic-insensitive normalized prefix/substring match
 * (prefix matches rank first). No fuzzy-ranking dependency.
 */

import type { ResolvedSeriesSearch } from '@opendata-ai/openchart-core';

export interface SeriesSearchOptions {
  /** The chart container (`.oc-root`). Must be position: relative. */
  container: HTMLElement;
  /** Fired with the full selection (insertion order) after every add/remove. */
  onChange: (selected: string[]) => void;
}

export interface SeriesSearchController {
  /** Reposition and refresh the control against a freshly rendered layout. */
  update(band: ResolvedSeriesSearch, svg: SVGElement): void;
  /** Hide the control (layout stripped the band but the spec still wants it). */
  hide(): void;
  /** Currently selected values, in insertion order. */
  getSelected(): string[];
  /** Replace the selection without firing onChange (e.g. reset on spec update). */
  setSelected(values: string[]): void;
  /** Remove the control from the DOM. */
  destroy(): void;
}

let seriesSearchIdCounter = 0;

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Fold a string for matching: lowercase with combining diacritical marks
 * stripped. `map[i]` is the index in the original string that produced
 * folded character `i`, so match ranges can be mapped back for emphasis.
 */
function foldWithMap(s: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const f = s[i]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    for (const ch of f) {
      folded += ch;
      map.push(i);
    }
  }
  return { folded, map };
}

function fold(s: string): string {
  return foldWithMap(s).folded;
}

/** Small stroke icon (magnifier or cross) built from SVG path data. */
function createIcon(size: number, paths: string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);
  }
  return svg;
}

/**
 * Create the series search control. Mounted once per chart instance and kept
 * across re-renders (so typing focus and chips survive highlight re-renders);
 * `update()` re-syncs position, values, and placeholder after each render.
 */
export function createSeriesSearch(options: SeriesSearchOptions): SeriesSearchController {
  const { container, onChange } = options;

  const id = `oc-series-search-${++seriesSearchIdCounter}`;
  const listboxId = `${id}-listbox`;

  let values: string[] = [];
  let selected: string[] = [];
  let matches: string[] = [];
  let activeIndex = -1;
  let open = false;
  let destroyed = false;

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  const root = document.createElement('div');
  root.className = 'oc-series-search';
  root.style.display = 'none';

  const chips = document.createElement('div');
  chips.className = 'oc-series-search-chips';

  const box = document.createElement('div');
  box.className = 'oc-series-search-box';

  const icon = createIcon(14, [
    'M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z',
    'M10.5 10.5 13.5 13.5',
  ]);
  icon.classList.add('oc-series-search-icon');

  const input = document.createElement('input');
  input.className = 'oc-series-search-input';
  input.type = 'text';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listboxId);
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-haspopup', 'listbox');
  input.autocomplete = 'off';
  input.spellcheck = false;

  const listbox = document.createElement('ul');
  listbox.className = 'oc-series-search-listbox';
  listbox.id = listboxId;
  listbox.setAttribute('role', 'listbox');
  listbox.hidden = true;

  box.append(icon, input, listbox);
  root.append(chips, box);
  // Ensure absolute children position against the chart container, matching
  // the tooltip manager's approach.
  container.style.position = container.style.position || 'relative';
  // First child so the tab order matches the visual order (search above chart);
  // render() re-appends the SVG after this node on every re-render.
  container.insertBefore(root, container.firstChild);

  // ---------------------------------------------------------------------------
  // Matching
  // ---------------------------------------------------------------------------

  function computeMatches(): string[] {
    const q = fold(input.value.trim());
    const available = values.filter((v) => !selected.includes(v));
    if (!q) return available;
    const prefix: string[] = [];
    const substring: string[] = [];
    for (const v of available) {
      const idx = fold(v).indexOf(q);
      if (idx === 0) prefix.push(v);
      else if (idx > 0) substring.push(v);
    }
    return [...prefix, ...substring];
  }

  /** Append the option label with the matched substring emphasized. */
  function appendOptionText(li: HTMLLIElement, value: string): void {
    const q = fold(input.value.trim());
    if (!q) {
      li.textContent = value;
      return;
    }
    const { folded, map } = foldWithMap(value);
    const idx = folded.indexOf(q);
    if (idx < 0) {
      li.textContent = value;
      return;
    }
    const start = map[idx];
    const end = idx + q.length < folded.length ? map[idx + q.length] : value.length;
    li.append(document.createTextNode(value.slice(0, start)));
    const match = document.createElement('span');
    match.className = 'oc-series-search-match';
    match.textContent = value.slice(start, end);
    li.append(match, document.createTextNode(value.slice(end)));
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function renderChips(): void {
    chips.textContent = '';
    for (const value of selected) {
      const chip = document.createElement('span');
      chip.className = 'oc-series-search-chip';
      chip.append(document.createTextNode(value));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'oc-series-search-chip-remove';
      remove.setAttribute('aria-label', `Remove ${value}`);
      remove.appendChild(createIcon(8, ['M3 3 13 13', 'M13 3 3 13']));
      remove.addEventListener('click', () => {
        removeValue(value);
        input.focus();
      });

      chip.appendChild(remove);
      chips.appendChild(chip);
    }
  }

  function renderList(): void {
    matches = computeMatches();
    if (activeIndex >= matches.length) activeIndex = matches.length - 1;
    listbox.textContent = '';

    if (matches.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'oc-series-search-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = 'No matches';
      listbox.appendChild(empty);
      input.removeAttribute('aria-activedescendant');
      return;
    }

    matches.forEach((value, i) => {
      const li = document.createElement('li');
      li.className = 'oc-series-search-option';
      li.id = `${id}-opt-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === activeIndex));
      appendOptionText(li, value);
      li.addEventListener('click', () => selectValue(value));
      listbox.appendChild(li);
    });

    if (activeIndex >= 0) {
      input.setAttribute('aria-activedescendant', `${id}-opt-${activeIndex}`);
      const activeEl = listbox.children[activeIndex] as HTMLElement | undefined;
      activeEl?.scrollIntoView?.({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function openList(): void {
    if (open) return;
    open = true;
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function closeList(): void {
    if (!open) return;
    open = false;
    activeIndex = -1;
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  function selectValue(value: string): void {
    if (!selected.includes(value)) selected.push(value);
    input.value = '';
    closeList();
    renderChips();
    onChange([...selected]);
  }

  function removeValue(value: string): void {
    const idx = selected.indexOf(value);
    if (idx < 0) return;
    selected.splice(idx, 1);
    renderChips();
    onChange([...selected]);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  input.addEventListener('input', () => {
    openList();
    activeIndex = computeMatches().length > 0 ? 0 : -1;
    renderList();
  });

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const wasOpen = open;
        openList();
        if (!wasOpen) {
          matches = computeMatches();
          activeIndex = matches.length > 0 ? 0 : -1;
        } else if (matches.length > 0) {
          const delta = e.key === 'ArrowDown' ? 1 : -1;
          activeIndex = (activeIndex + delta + matches.length) % matches.length;
        }
        renderList();
        break;
      }
      case 'Enter': {
        if (open && activeIndex >= 0 && activeIndex < matches.length) {
          e.preventDefault();
          selectValue(matches[activeIndex]);
        }
        break;
      }
      case 'Escape': {
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          closeList();
        }
        break;
      }
      case 'Backspace': {
        if (input.value === '' && selected.length > 0) {
          removeValue(selected[selected.length - 1]);
        }
        break;
      }
      case 'Tab': {
        closeList();
        break;
      }
    }
  });

  // Keep focus in the input while clicking options/chips inside the popup.
  listbox.addEventListener('mousedown', (e) => e.preventDefault());

  // Close when focus leaves the whole control.
  root.addEventListener('focusout', (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (!next || !root.contains(next)) closeList();
  });

  // ---------------------------------------------------------------------------
  // Controller
  // ---------------------------------------------------------------------------

  return {
    update(band: ResolvedSeriesSearch, svg: SVGElement): void {
      if (destroyed) return;
      values = band.values;
      input.placeholder = band.placeholder;
      input.setAttribute('aria-label', band.placeholder);

      // Layout coords -> pixel coords relative to the container, same
      // viewBox-scale approach as the text edit overlay.
      const viewBox = (svg as SVGSVGElement).viewBox?.baseVal;
      const svgRect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scaleX = viewBox?.width && svgRect.width ? svgRect.width / viewBox.width : 1;
      const scaleY = viewBox?.height && svgRect.height ? svgRect.height / viewBox.height : 1;
      root.style.left = `${band.x * scaleX + (svgRect.left - containerRect.left)}px`;
      root.style.top = `${band.y * scaleY + (svgRect.top - containerRect.top)}px`;
      root.style.width = `${band.width * scaleX}px`;
      root.style.height = `${band.height * scaleY}px`;
      root.style.display = 'flex';

      if (open) renderList();
    },
    hide(): void {
      root.style.display = 'none';
      closeList();
    },
    getSelected(): string[] {
      return [...selected];
    },
    setSelected(next: string[]): void {
      selected = [...next];
      renderChips();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.remove();
    },
  };
}
