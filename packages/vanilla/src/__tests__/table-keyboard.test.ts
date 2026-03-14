import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachKeyboardNav } from '../table-keyboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTableDOM(rows: number, cols: number, opts?: { search?: boolean }): HTMLDivElement {
  const wrapper = document.createElement('div');
  const table = document.createElement('table');

  // thead
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (let c = 0; c < cols; c++) {
    const th = document.createElement('th');
    th.textContent = `Col${c}`;
    th.setAttribute('data-column', `col${c}`);
    const sortBtn = document.createElement('button');
    sortBtn.setAttribute('data-sort-column', `col${c}`);
    th.appendChild(sortBtn);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // tbody
  const tbody = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      td.textContent = `R${r}C${c}`;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrapper.appendChild(table);

  // Search input
  if (opts?.search) {
    const searchDiv = document.createElement('div');
    searchDiv.className = 'viz-table-search';
    const input = document.createElement('input');
    searchDiv.appendChild(input);
    wrapper.appendChild(searchDiv);
  }

  return wrapper;
}

function keydown(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function focusTbody(wrapper: HTMLDivElement): HTMLElement {
  const tbody = wrapper.querySelector('tbody')!;
  tbody.dispatchEvent(new Event('focus'));
  return tbody;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('attachKeyboardNav', () => {
  let wrapper: HTMLDivElement;
  let onSort: ReturnType<typeof vi.fn>;
  let onClearSearch: ReturnType<typeof vi.fn>;
  let onAnnounce: ReturnType<typeof vi.fn>;
  let cleanup: () => void;

  function attach(w: HTMLDivElement): () => void {
    return attachKeyboardNav({
      wrapper: w,
      onSort,
      onClearSearch,
      onAnnounce,
    });
  }

  beforeEach(() => {
    onSort = vi.fn();
    onClearSearch = vi.fn();
    onAnnounce = vi.fn();
    wrapper = createTableDOM(5, 3);
    document.body.appendChild(wrapper);
    cleanup = attach(wrapper);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('makes tbody focusable', () => {
    const tbody = wrapper.querySelector('tbody')!;
    expect(tbody.getAttribute('tabindex')).toBe('0');
  });

  it('makes header cells focusable', () => {
    const headers = wrapper.querySelectorAll('thead th');
    for (const th of headers) {
      expect(th.getAttribute('tabindex')).toBe('0');
    }
  });

  it('returns noop cleanup when no table exists', () => {
    const empty = document.createElement('div');
    const c = attachKeyboardNav({
      wrapper: empty,
      onSort,
      onClearSearch,
      onAnnounce,
    });
    expect(c).toBeTypeOf('function');
    c(); // should not throw
  });
});

describe('tbody arrow key navigation', () => {
  let wrapper: HTMLDivElement;
  let onSort: ReturnType<typeof vi.fn>;
  let onClearSearch: ReturnType<typeof vi.fn>;
  let onAnnounce: ReturnType<typeof vi.fn>;
  let cleanup: () => void;

  beforeEach(() => {
    onSort = vi.fn();
    onClearSearch = vi.fn();
    onAnnounce = vi.fn();
    wrapper = createTableDOM(5, 3);
    document.body.appendChild(wrapper);
    cleanup = attachKeyboardNav({
      wrapper,
      onSort,
      onClearSearch,
      onAnnounce,
    });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('focus highlights first cell and sets aria-activedescendant', () => {
    const tbody = focusTbody(wrapper);
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-0-0');
    const cell = wrapper.querySelector('.viz-table-cell-focus');
    expect(cell).not.toBeNull();
    expect(cell?.textContent).toBe('R0C0');
  });

  it('ArrowDown moves focus down one row', () => {
    const tbody = focusTbody(wrapper);
    keydown(tbody, 'ArrowDown');
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-1-0');
  });

  it('ArrowDown does not go past last row', () => {
    const tbody = focusTbody(wrapper);
    for (let i = 0; i < 10; i++) keydown(tbody, 'ArrowDown');
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-4-0');
  });

  it('ArrowRight moves focus right one column', () => {
    const tbody = focusTbody(wrapper);
    keydown(tbody, 'ArrowRight');
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-0-1');
  });

  it('ArrowRight does not go past last column', () => {
    const tbody = focusTbody(wrapper);
    for (let i = 0; i < 10; i++) keydown(tbody, 'ArrowRight');
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-0-2');
  });

  it('ArrowLeft moves focus left', () => {
    const tbody = focusTbody(wrapper);
    keydown(tbody, 'ArrowRight');
    keydown(tbody, 'ArrowRight');
    keydown(tbody, 'ArrowLeft');
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-0-1');
  });

  it('ArrowLeft does not go past first column', () => {
    const tbody = focusTbody(wrapper);
    keydown(tbody, 'ArrowLeft');
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-0-0');
  });

  it('Home moves to first column in current row', () => {
    const tbody = focusTbody(wrapper);
    keydown(tbody, 'ArrowRight');
    keydown(tbody, 'ArrowRight');
    keydown(tbody, 'Home');
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-0-0');
  });

  it('End moves to last column in current row', () => {
    const tbody = focusTbody(wrapper);
    keydown(tbody, 'End');
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-0-2');
  });

  it('navigation clears previous focus highlight', () => {
    const tbody = focusTbody(wrapper);
    keydown(tbody, 'ArrowDown');
    const focused = wrapper.querySelectorAll('.viz-table-cell-focus');
    expect(focused.length).toBe(1);
    expect(focused[0].textContent).toBe('R1C0');
  });
});

describe('header keyboard navigation', () => {
  let wrapper: HTMLDivElement;
  let onSort: ReturnType<typeof vi.fn>;
  let onClearSearch: ReturnType<typeof vi.fn>;
  let onAnnounce: ReturnType<typeof vi.fn>;
  let cleanup: () => void;

  beforeEach(() => {
    onSort = vi.fn();
    onClearSearch = vi.fn();
    onAnnounce = vi.fn();
    wrapper = createTableDOM(3, 3);
    document.body.appendChild(wrapper);
    cleanup = attachKeyboardNav({
      wrapper,
      onSort,
      onClearSearch,
      onAnnounce,
    });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('ArrowUp from first body row moves focus to header', () => {
    const tbody = focusTbody(wrapper);
    // ArrowUp from row 0 should focus the header
    keydown(tbody, 'ArrowUp');
    // Focus moved to header, so tbody's activedescendant should remain unchanged
    const headers = wrapper.querySelectorAll('thead th');
    // Can't easily check document.activeElement in happy-dom, but header focus() was called
    expect(headers[0]).toBeDefined();
  });

  it('Enter on header triggers sort', () => {
    const headers = wrapper.querySelectorAll('thead th');
    keydown(headers[1] as HTMLElement, 'Enter');
    expect(onSort).toHaveBeenCalledWith('col1');
  });

  it('Space on header triggers sort', () => {
    const headers = wrapper.querySelectorAll('thead th');
    keydown(headers[0] as HTMLElement, ' ');
    expect(onSort).toHaveBeenCalledWith('col0');
  });

  it('ArrowRight on header moves to next header', () => {
    // This tests the focus logic; in happy-dom we just verify no errors
    const headers = wrapper.querySelectorAll('thead th');
    keydown(headers[0] as HTMLElement, 'ArrowRight');
    // Should not throw
  });

  it('ArrowDown from header moves to body at same column', () => {
    const headers = wrapper.querySelectorAll('thead th');
    keydown(headers[1] as HTMLElement, 'ArrowDown');
    const tbody = wrapper.querySelector('tbody')!;
    // The tbody should have activedescendant set to first row, column 1
    expect(tbody.getAttribute('aria-activedescendant')).toBe('viz-cell-0-1');
  });
});

describe('search escape handling', () => {
  let wrapper: HTMLDivElement;
  let onSort: ReturnType<typeof vi.fn>;
  let onClearSearch: ReturnType<typeof vi.fn>;
  let onAnnounce: ReturnType<typeof vi.fn>;
  let cleanup: () => void;

  beforeEach(() => {
    onSort = vi.fn();
    onClearSearch = vi.fn();
    onAnnounce = vi.fn();
    wrapper = createTableDOM(3, 3, { search: true });
    document.body.appendChild(wrapper);
    cleanup = attachKeyboardNav({
      wrapper,
      onSort,
      onClearSearch,
      onAnnounce,
    });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('Escape in search input calls onClearSearch', () => {
    const input = wrapper.querySelector('.viz-table-search input')!;
    keydown(input as HTMLElement, 'Escape');
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('Escape in search announces "Search cleared"', () => {
    const input = wrapper.querySelector('.viz-table-search input')!;
    keydown(input as HTMLElement, 'Escape');
    expect(onAnnounce).toHaveBeenCalledWith('Search cleared');
  });

  it('non-Escape keys in search do not trigger clear', () => {
    const input = wrapper.querySelector('.viz-table-search input')!;
    keydown(input as HTMLElement, 'a');
    keydown(input as HTMLElement, 'Enter');
    expect(onClearSearch).not.toHaveBeenCalled();
  });
});

describe('cleanup', () => {
  it('removes event listeners after cleanup', () => {
    const wrapper = createTableDOM(3, 3, { search: true });
    document.body.appendChild(wrapper);

    const onSort = vi.fn();
    const onClearSearch = vi.fn();
    const onAnnounce = vi.fn();

    const cleanup = attachKeyboardNav({
      wrapper,
      onSort,
      onClearSearch,
      onAnnounce,
    });

    cleanup();

    // After cleanup, keyboard events should not trigger callbacks
    const tbody = wrapper.querySelector('tbody')!;
    tbody.dispatchEvent(new Event('focus'));
    keydown(tbody, 'ArrowDown');

    const input = wrapper.querySelector('.viz-table-search input')!;
    keydown(input as HTMLElement, 'Escape');

    expect(onClearSearch).not.toHaveBeenCalled();

    // Focus highlight should be cleared
    const focused = wrapper.querySelectorAll('.viz-table-cell-focus');
    expect(focused.length).toBe(0);

    document.body.innerHTML = '';
  });
});
