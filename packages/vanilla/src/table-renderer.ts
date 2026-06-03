/**
 * Table renderer: produces semantic HTML from a TableLayout.
 *
 * renderTable() creates the full DOM structure: chrome, search bar,
 * scrollable table with sticky column support, pagination, and footer.
 * The returned element replaces or appends to the given container.
 */

import type { ResolvedColumn, TableLayout, TableRow } from '@opendata-ai/openchart-core';
import { BRAND_FONT_SIZE } from '@opendata-ai/openchart-core';
import { clampStaggerDelay } from '@opendata-ai/openchart-engine';
import { renderCell } from './renderers/table-cells';

/** Options for renderTable(). */
export interface TableRenderOptions {
  /** Whether to apply entrance animation on this render. */
  animate?: boolean;
}

/** CSS easing preset map for animation custom properties. */
const EASE_VAR_MAP: Record<string, string> = {
  smooth: 'var(--oc-ease-smooth)',
  snappy: 'var(--oc-ease-snappy)',
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRAND_URL = 'https://tryopendata.ai';

// ---------------------------------------------------------------------------
// Chrome rendering
// ---------------------------------------------------------------------------

/** Create chrome (title/subtitle or source/footer) block. */
function renderChromeBlock(
  layout: TableLayout,
  position: 'header' | 'footer',
): HTMLDivElement | null {
  const chrome = layout.chrome;

  if (position === 'header') {
    if (!chrome.title && !chrome.subtitle) return null;

    const div = document.createElement('div');
    div.className = 'oc-chrome';

    if (chrome.title) {
      const h = document.createElement('div');
      h.className = 'oc-table-title';
      h.textContent = chrome.title.text;
      div.appendChild(h);
    }
    if (chrome.subtitle) {
      const sub = document.createElement('div');
      sub.className = 'oc-table-subtitle';
      sub.textContent = chrome.subtitle.text;
      div.appendChild(sub);
    }

    return div;
  }

  // Footer position
  if (!chrome.source && !chrome.footer) return null;

  const div = document.createElement('div');
  div.className = 'oc-chrome oc-chrome-footer';

  if (chrome.source) {
    const src = document.createElement('div');
    src.className = 'oc-table-source';
    src.textContent = chrome.source.text;
    div.appendChild(src);
  }
  if (chrome.footer) {
    const foot = document.createElement('div');
    foot.className = 'oc-table-footer-text';
    foot.textContent = chrome.footer.text;
    div.appendChild(foot);
  }

  return div;
}

// ---------------------------------------------------------------------------
// Table head
// ---------------------------------------------------------------------------

function renderThead(
  columns: ResolvedColumn[],
  sort: TableLayout['sort'],
): HTMLTableSectionElement {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  tr.setAttribute('role', 'row');

  for (const col of columns) {
    const th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.setAttribute('role', 'columnheader');
    th.style.textAlign = col.align;
    th.style.width = `${col.width}px`;

    // Sort state: use 'ascending'/'descending' per WAI-ARIA spec
    let ariaSortValue: string = 'none';
    if (sort && sort.column === col.key) {
      ariaSortValue = sort.direction === 'asc' ? 'ascending' : 'descending';
    }
    th.setAttribute('aria-sort', ariaSortValue);
    th.setAttribute('data-column', col.key);

    // Label
    const labelSpan = document.createTextNode(col.label);
    th.appendChild(labelSpan);

    // Sort button
    if (col.sortable) {
      const btn = document.createElement('button');
      btn.className = 'oc-table-sort-btn';
      btn.setAttribute('aria-label', `Sort by ${col.label}`);
      btn.setAttribute('data-sort-column', col.key);
      btn.type = 'button';
      th.appendChild(btn);
    }

    tr.appendChild(th);
  }

  thead.appendChild(tr);
  return thead;
}

// ---------------------------------------------------------------------------
// Table body
// ---------------------------------------------------------------------------

function renderTbody(rows: TableRow[], columns: ResolvedColumn[]): HTMLTableSectionElement {
  const tbody = document.createElement('tbody');

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');
    tr.setAttribute('data-row-id', row.id);
    tr.style.setProperty('--oc-row-index', String(r));

    for (let c = 0; c < columns.length; c++) {
      const cell = row.cells[c];
      if (!cell) continue;

      const td = renderCell(cell);
      td.setAttribute('role', 'gridcell');
      td.style.textAlign = columns[c].align;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  return tbody;
}

// ---------------------------------------------------------------------------
// Search bar
// ---------------------------------------------------------------------------

function renderSearchBar(layout: TableLayout): HTMLDivElement | null {
  if (!layout.search.enabled) return null;

  const div = document.createElement('div');
  div.className = 'oc-table-search';

  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = layout.search.placeholder;
  input.setAttribute('aria-label', 'Search table');
  input.value = layout.search.query;

  div.appendChild(input);
  return div;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function renderPagination(layout: TableLayout): HTMLDivElement | null {
  if (!layout.pagination) return null;

  const { page, pageSize, totalRows, totalPages } = layout.pagination;

  const div = document.createElement('div');
  div.className = 'oc-table-pagination';

  const info = document.createElement('span');
  info.className = 'oc-table-pagination-info';

  if (totalRows === 0) {
    info.textContent = 'No results';
  } else {
    const start = page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, totalRows);
    info.textContent = `Showing ${start}-${end} of ${totalRows}`;
  }

  div.appendChild(info);

  const btnGroup = document.createElement('span');
  btnGroup.className = 'oc-table-pagination-btns';

  const prevBtn = document.createElement('button');
  prevBtn.setAttribute('aria-label', 'Previous page');
  prevBtn.setAttribute('data-page-action', 'prev');
  prevBtn.textContent = 'Prev';
  prevBtn.disabled = page <= 0;
  btnGroup.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.setAttribute('aria-label', 'Next page');
  nextBtn.setAttribute('data-page-action', 'next');
  nextBtn.textContent = 'Next';
  nextBtn.disabled = page >= totalPages - 1;
  btnGroup.appendChild(nextBtn);

  div.appendChild(btnGroup);
  return div;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function renderEmptyState(message: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'oc-table-empty';
  div.setAttribute('aria-live', 'polite');
  div.textContent = message;
  return div;
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

/**
 * Render a TableLayout into a full DOM structure.
 *
 * @param layout - The compiled table layout.
 * @param container - The container element to render into.
 * @returns The wrapper element that was created.
 */
export function renderTable(
  layout: TableLayout,
  container: HTMLElement,
  opts?: TableRenderOptions,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'oc-table-wrapper';

  // Apply theme colors as CSS custom properties so table CSS picks them up.
  // Without this, dark-background themes show invisible text since the
  // CSS defaults (--oc-text etc.) are light-mode values.
  const { theme, chrome } = layout;
  if (theme) {
    const s = wrapper.style;
    s.setProperty('--oc-bg', theme.colors.background);
    s.setProperty('--oc-text', theme.colors.text);
    s.setProperty('--oc-text-secondary', theme.colors.axis ?? theme.colors.text);
    s.setProperty('--oc-text-muted', theme.colors.axis ?? theme.colors.text);
    s.setProperty('--oc-gridline', theme.colors.gridline);
    s.setProperty('--oc-border', theme.colors.gridline);
    s.setProperty('--oc-font-family', theme.fonts.family);
    s.fontFamily = theme.fonts.family;
  }

  // Set computed chrome CSS custom properties so chrome elements pick up
  // theme-resolved values via CSS fallbacks (e.g. --oc-title-computed-size).
  {
    const s = wrapper.style;
    if (chrome.title) {
      s.setProperty('--oc-title-computed-size', `${chrome.title.style.fontSize}px`);
      s.setProperty('--oc-title-computed-weight', String(chrome.title.style.fontWeight));
      s.setProperty('--oc-title-computed-color', chrome.title.style.fill);
    }
    if (chrome.subtitle) {
      s.setProperty('--oc-subtitle-computed-size', `${chrome.subtitle.style.fontSize}px`);
      s.setProperty('--oc-subtitle-computed-weight', String(chrome.subtitle.style.fontWeight));
      s.setProperty('--oc-subtitle-computed-color', chrome.subtitle.style.fill);
    }
    if (chrome.source) {
      s.setProperty('--oc-source-computed-size', `${chrome.source.style.fontSize}px`);
      s.setProperty('--oc-source-computed-color', chrome.source.style.fill);
    }
    if (chrome.footer) {
      s.setProperty('--oc-footer-computed-size', `${chrome.footer.style.fontSize}px`);
      s.setProperty('--oc-footer-computed-color', chrome.footer.style.fill);
    }
  }

  // Apply class modifiers
  if (layout.compact) {
    wrapper.classList.add('oc-table--compact');
  }

  // Header chrome
  const headerChrome = renderChromeBlock(layout, 'header');
  if (headerChrome) {
    wrapper.appendChild(headerChrome);
  }

  // Search bar
  const searchBar = renderSearchBar(layout);
  if (searchBar) {
    wrapper.appendChild(searchBar);
  }

  // Handle empty data
  if (layout.rows.length === 0) {
    const message = layout.search.query ? 'No results found' : 'No data';
    wrapper.appendChild(renderEmptyState(message));
  } else {
    // Scroll container
    const scroll = document.createElement('div');
    scroll.className = 'oc-table-scroll';

    // Table
    const table = document.createElement('table');
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-label', layout.a11y.caption);

    if (layout.stickyFirstColumn) {
      table.classList.add('oc-table--sticky');
    }

    // Caption (screen reader only – inline styles ensure hiding even without
    // the external stylesheet, e.g. CDN / esm.sh usage)
    const caption = document.createElement('caption');
    caption.className = 'oc-sr-only';
    caption.style.position = 'absolute';
    caption.style.width = '1px';
    caption.style.height = '1px';
    caption.style.padding = '0';
    caption.style.margin = '-1px';
    caption.style.overflow = 'hidden';
    caption.style.clipPath = 'inset(50%)';
    caption.style.whiteSpace = 'nowrap';
    caption.style.borderWidth = '0';
    caption.textContent = layout.a11y.summary;
    table.appendChild(caption);

    // Thead
    table.appendChild(renderThead(layout.columns, layout.sort));

    // Tbody
    table.appendChild(renderTbody(layout.rows, layout.columns));

    scroll.appendChild(table);
    wrapper.appendChild(scroll);
  }

  // Pagination
  const pagination = renderPagination(layout);
  if (pagination) {
    wrapper.appendChild(pagination);
  }

  // Footer row: source/footer chrome on the left, brand watermark on the
  // right, laid out on a single line via flex. Built up here and appended
  // after the live region so source text and watermark share a baseline.
  const footerRow = document.createElement('div');
  footerRow.className = 'oc-table-footer-row';

  const footerChrome = renderChromeBlock(layout, 'footer');
  if (footerChrome) {
    footerRow.appendChild(footerChrome);
  }

  // Live region for screen reader announcements (sort changes, search results)
  const liveRegion = document.createElement('div');
  liveRegion.className = 'oc-table-live-region oc-sr-only';
  liveRegion.style.position = 'absolute';
  liveRegion.style.width = '1px';
  liveRegion.style.height = '1px';
  liveRegion.style.padding = '0';
  liveRegion.style.margin = '-1px';
  liveRegion.style.overflow = 'hidden';
  liveRegion.style.clipPath = 'inset(50%)';
  liveRegion.style.whiteSpace = 'nowrap';
  liveRegion.style.borderWidth = '0';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.setAttribute('role', 'status');
  wrapper.appendChild(liveRegion);

  // Brand watermark — joins the footer row, pushed to the right by the
  // flex container so it sits on the same line as the source text.
  if (layout.watermark) {
    const brandColor = theme ? theme.colors.axis : '#999999';
    const brand = document.createElement('div');
    brand.className = 'oc-table-ref';
    const brandLink = document.createElement('a');
    brandLink.href = BRAND_URL;
    brandLink.target = '_blank';
    brandLink.rel = 'noopener';
    brandLink.style.cssText = `font-size: ${BRAND_FONT_SIZE}px; font-weight: 600; color: ${brandColor}; opacity: 0.55; text-decoration: none; font-family: ${theme ? theme.fonts.family : 'sans-serif'};`;
    brandLink.textContent = 'tryOpenData.ai';
    brand.appendChild(brandLink);
    footerRow.appendChild(brand);
  }

  // Append the footer row only when it has content (source/footer/watermark).
  if (footerRow.childElementCount > 0) {
    wrapper.appendChild(footerRow);
  }

  // Animation: stamp CSS custom properties and add oc-animate class BEFORE
  // DOM insertion to avoid a flash of final state.
  if (opts?.animate && layout.animation?.enabled) {
    const anim = layout.animation;
    const rowCount = layout.rows.length;
    const stagger = clampStaggerDelay(anim.staggerDelay, rowCount);
    const s = wrapper.style;
    s.setProperty('--oc-animation-duration', `${anim.duration}ms`);
    s.setProperty('--oc-animation-stagger', `${stagger}ms`);
    s.setProperty('--oc-animation-ease', EASE_VAR_MAP[anim.ease] || EASE_VAR_MAP.smooth);
    wrapper.classList.add('oc-animate');
  }

  container.appendChild(wrapper);
  return wrapper;
}
