/**
 * Design-refresh table DOM: density classes, responsive auto-condense and
 * cards mode, per-cell labels, delta chips and the totals footer.
 */

import type { TableSpec } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTable } from '../table-mount';

function makeSpec(overrides?: Partial<TableSpec>): TableSpec {
  return {
    type: 'table',
    data: [
      { name: 'Alice', revenue: 1200, change: 2.4 },
      { name: 'Bob', revenue: 800, change: -1.2 },
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'change', label: 'Change', delta: true, format: '.1f' },
    ],
    ...overrides,
  };
}

function mountAt(width: number): HTMLDivElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({
      width,
      height: 600,
      top: 0,
      left: 0,
      right: width,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  document.body.appendChild(container);
  return container;
}

describe('table density classes', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = mountAt(900);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('stamps the resolved density on the wrapper', () => {
    const t = createTable(container, makeSpec());
    expect(container.querySelector('.oc-table--regular')).not.toBeNull();
    t.destroy();
  });

  it('honors an explicit relaxed density at any width', () => {
    const t = createTable(container, makeSpec({ density: 'relaxed' }));
    const wrapper = container.querySelector('.oc-table-wrapper')!;
    expect(wrapper.classList.contains('oc-table--relaxed')).toBe(true);
    expect(wrapper.classList.contains('oc-table--condensed')).toBe(false);
    t.destroy();
  });

  it('keeps the deprecated compact alias class alongside condensed', () => {
    const t = createTable(container, makeSpec({ density: 'condensed' }));
    const wrapper = container.querySelector('.oc-table-wrapper')!;
    expect(wrapper.classList.contains('oc-table--condensed')).toBe(true);
    expect(wrapper.classList.contains('oc-table--compact')).toBe(true);
    t.destroy();
  });

  it('adds the striped class only when asked', () => {
    const plain = createTable(container, makeSpec());
    expect(container.querySelector('.oc-table--striped')).toBeNull();
    plain.destroy();

    const striped = createTable(container, makeSpec({ striped: true }));
    expect(container.querySelector('.oc-table--striped')).not.toBeNull();
    striped.destroy();
  });
});

describe('responsive density', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('leaves a roomy container at regular density', () => {
    const container = mountAt(900);
    const t = createTable(container, makeSpec());
    const wrapper = container.querySelector('.oc-table-wrapper')!;
    expect(wrapper.classList.contains('oc-table--condensed')).toBe(false);
    expect(wrapper.classList.contains('oc-table--cards')).toBe(false);
    t.destroy();
  });

  it('condenses under content pressure (more columns than 96px each)', () => {
    const container = mountAt(650);
    const spec = makeSpec({
      data: [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 }],
      columns: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((key) => ({ key })),
    });
    const t = createTable(container, spec);
    expect(container.querySelector('.oc-table-wrapper')!.classList).toContain(
      'oc-table--condensed',
    );
    t.destroy();
  });

  it('does not condense a 3-column table at 650px', () => {
    const container = mountAt(650);
    const t = createTable(container, makeSpec());
    expect(container.querySelector('.oc-table-wrapper')!.classList).not.toContain(
      'oc-table--condensed',
    );
    t.destroy();
  });

  it('switches to cards below 400px', () => {
    const container = mountAt(360);
    const t = createTable(container, makeSpec());
    expect(container.querySelector('.oc-table-wrapper')!.classList).toContain('oc-table--cards');
    t.destroy();
  });

  it('never overrides an explicit density with the auto-condense', () => {
    const container = mountAt(360);
    const t = createTable(container, makeSpec({ density: 'relaxed' }));
    const wrapper = container.querySelector('.oc-table-wrapper')!;
    expect(wrapper.classList.contains('oc-table--relaxed')).toBe(true);
    expect(wrapper.classList.contains('oc-table--condensed')).toBe(false);
    t.destroy();
  });
});

describe('cell labels and chips', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = mountAt(900);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('stamps data-label and data-priority on every body cell', () => {
    const t = createTable(container, makeSpec());
    const cells = [...container.querySelectorAll('tbody tr:first-child td')];
    expect(cells.map((td) => td.getAttribute('data-label'))).toEqual(['Name', 'Revenue', 'Change']);
    expect(cells.map((td) => td.getAttribute('data-priority'))).toEqual(['1', '2', '2']);
    t.destroy();
  });

  it('renders a toned delta chip with an arrow', () => {
    const t = createTable(container, makeSpec());
    const chips = [...container.querySelectorAll('.oc-table-delta')];
    expect(chips).toHaveLength(2);
    expect(chips[0].classList.contains('oc-table-delta--positive')).toBe(true);
    expect(chips[0].textContent).toBe('▲2.4');
    expect(chips[1].classList.contains('oc-table-delta--negative')).toBe(true);
    expect(chips[1].textContent).toBe('▼1.2');
    t.destroy();
  });

  it('renders the totals footer with rowgroup semantics', () => {
    const t = createTable(container, makeSpec({ totalRow: true }));
    const tfoot = container.querySelector('tfoot');
    expect(tfoot).not.toBeNull();
    expect(tfoot!.getAttribute('role')).toBe('rowgroup');
    expect(tfoot!.classList.contains('oc-table-total')).toBe(true);
    const cells = [...tfoot!.querySelectorAll('td')];
    expect(cells[0].textContent).toBe('Total');
    expect(cells[1].textContent).toBe('2,000');
    t.destroy();
  });

  it('omits the footer when totalRow is off', () => {
    const t = createTable(container, makeSpec());
    expect(container.querySelector('tfoot')).toBeNull();
    t.destroy();
  });

  it('marks thead and tbody as rowgroups so cards mode keeps table semantics', () => {
    const t = createTable(container, makeSpec());
    expect(container.querySelector('thead')!.getAttribute('role')).toBe('rowgroup');
    expect(container.querySelector('tbody')!.getAttribute('role')).toBe('rowgroup');
    t.destroy();
  });
});
