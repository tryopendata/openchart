/**
 * Table renderer: produces semantic HTML from a TableLayout.
 *
 * renderTable() creates the full DOM structure: chrome, search bar,
 * scrollable table with sticky column support, pagination, and footer.
 * The returned element replaces or appends to the given container.
 */

import type { ResolvedColumn, TableLayout, TableRow } from '@opendata-ai/openchart-core';
import { renderCell } from './renderers/table-cells';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRAND_URL = 'https://tryopendata.ai';
const BRAND_FONT_SIZE = 20;

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
    div.className = 'viz-chrome';

    if (chrome.title) {
      const h = document.createElement('div');
      h.className = 'viz-table-title';
      h.textContent = chrome.title.text;
      div.appendChild(h);
    }
    if (chrome.subtitle) {
      const sub = document.createElement('div');
      sub.className = 'viz-table-subtitle';
      sub.textContent = chrome.subtitle.text;
      div.appendChild(sub);
    }

    return div;
  }

  // Footer position
  if (!chrome.source && !chrome.footer) return null;

  const div = document.createElement('div');
  div.className = 'viz-chrome viz-chrome-footer';

  if (chrome.source) {
    const src = document.createElement('div');
    src.className = 'viz-table-source';
    src.textContent = chrome.source.text;
    div.appendChild(src);
  }
  if (chrome.footer) {
    const foot = document.createElement('div');
    foot.className = 'viz-table-footer-text';
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
      btn.className = 'viz-table-sort-btn';
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
  div.className = 'viz-table-search';

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
  div.className = 'viz-table-pagination';

  const info = document.createElement('span');
  info.className = 'viz-table-pagination-info';

  if (totalRows === 0) {
    info.textContent = 'No results';
  } else {
    const start = page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, totalRows);
    info.textContent = `Showing ${start}-${end} of ${totalRows}`;
  }

  div.appendChild(info);

  const btnGroup = document.createElement('span');
  btnGroup.className = 'viz-table-pagination-btns';

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
  div.className = 'viz-table-empty';
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
export function renderTable(layout: TableLayout, container: HTMLElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'viz-table-wrapper';

  // Apply theme colors as CSS custom properties so table CSS picks them up.
  // Without this, dark-background themes show invisible text since the
  // CSS defaults (--viz-text etc.) are light-mode values.
  const { theme, chrome } = layout;
  if (theme) {
    const s = wrapper.style;
    s.setProperty('--viz-bg', theme.colors.background);
    s.setProperty('--viz-text', theme.colors.text);
    s.setProperty('--viz-text-secondary', theme.colors.axis ?? theme.colors.text);
    s.setProperty('--viz-text-muted', theme.colors.axis ?? theme.colors.text);
    s.setProperty('--viz-gridline', theme.colors.gridline);
    s.setProperty('--viz-border', theme.colors.gridline);
    s.setProperty('--viz-font-family', theme.fonts.family);
    s.fontFamily = theme.fonts.family;
  }

  // Set computed chrome CSS custom properties so chrome elements pick up
  // theme-resolved values via CSS fallbacks (e.g. --viz-title-computed-size).
  {
    const s = wrapper.style;
    if (chrome.title) {
      s.setProperty('--viz-title-computed-size', `${chrome.title.style.fontSize}px`);
      s.setProperty('--viz-title-computed-weight', String(chrome.title.style.fontWeight));
      s.setProperty('--viz-title-computed-color', chrome.title.style.fill);
    }
    if (chrome.subtitle) {
      s.setProperty('--viz-subtitle-computed-size', `${chrome.subtitle.style.fontSize}px`);
      s.setProperty('--viz-subtitle-computed-weight', String(chrome.subtitle.style.fontWeight));
      s.setProperty('--viz-subtitle-computed-color', chrome.subtitle.style.fill);
    }
    if (chrome.source) {
      s.setProperty('--viz-source-computed-size', `${chrome.source.style.fontSize}px`);
      s.setProperty('--viz-source-computed-color', chrome.source.style.fill);
    }
    if (chrome.footer) {
      s.setProperty('--viz-footer-computed-size', `${chrome.footer.style.fontSize}px`);
      s.setProperty('--viz-footer-computed-color', chrome.footer.style.fill);
    }
  }

  // Apply class modifiers
  if (layout.compact) {
    wrapper.classList.add('viz-table--compact');
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
    scroll.className = 'viz-table-scroll';

    // Table
    const table = document.createElement('table');
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-label', layout.a11y.caption);

    if (layout.stickyFirstColumn) {
      table.classList.add('viz-table--sticky');
    }

    // Caption (screen reader only)
    const caption = document.createElement('caption');
    caption.className = 'viz-sr-only';
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

  // Footer chrome
  const footerChrome = renderChromeBlock(layout, 'footer');
  if (footerChrome) {
    wrapper.appendChild(footerChrome);
  }

  // Live region for screen reader announcements (sort changes, search results)
  const liveRegion = document.createElement('div');
  liveRegion.className = 'viz-table-live-region viz-sr-only';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.setAttribute('role', 'status');
  wrapper.appendChild(liveRegion);

  // Brand watermark
  const brandColor = theme ? theme.colors.axis : '#999999';
  const brand = document.createElement('div');
  brand.className = 'viz-table-ref';
  brand.style.cssText = 'text-align: right; padding: 4px 8px;';
  const brandLink = document.createElement('a');
  brandLink.href = BRAND_URL;
  brandLink.target = '_blank';
  brandLink.rel = 'noopener';
  brandLink.style.cssText = `font-size: ${BRAND_FONT_SIZE}px; font-weight: 600; color: ${brandColor}; opacity: 0.55; text-decoration: none; font-family: ${theme ? theme.fonts.family : 'sans-serif'};`;
  brandLink.textContent = 'OpenData';
  brand.appendChild(brandLink);
  wrapper.appendChild(brand);

  container.appendChild(wrapper);
  return wrapper;
}
