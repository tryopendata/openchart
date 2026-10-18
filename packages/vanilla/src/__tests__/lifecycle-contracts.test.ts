import type {
  BarListSpec,
  ChartSpec,
  GeoMapSpec,
  SankeySpec,
  TableSpec,
  TileMapSpec,
} from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBarList } from '../barlist-mount';
import { createGeoMap } from '../map-mount';
import { createChart } from '../mount';
import { createSankey } from '../sankey-mount';
import { createTable } from '../table-mount';
import { createTileMap } from '../tilemap-mount';

const rows = [
  { name: 'Alpha', value: 10 },
  { name: 'Beta', value: 20 },
];
const chart: ChartSpec = {
  mark: 'bar',
  data: rows,
  encoding: { x: { field: 'value', type: 'quantitative' }, y: { field: 'name', type: 'nominal' } },
};
const barlist: BarListSpec = {
  type: 'barlist',
  data: rows,
  encoding: {
    label: { field: 'name', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
};
const map: GeoMapSpec = {
  type: 'map',
  geo: {
    projection: 'mercator',
    features: {
      type: 'Topology',
      objects: {
        regions: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Polygon', id: 'Alpha', properties: { name: 'Alpha' }, arcs: [[0]] },
            { type: 'Polygon', id: 'Beta', properties: { name: 'Beta' }, arcs: [[1]] },
          ],
        },
      },
      arcs: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
        [
          [2, 0],
          [2, 1],
          [3, 1],
          [3, 0],
          [2, 0],
        ],
      ],
    },
  },
  data: rows,
  encoding: {
    key: { field: 'name', type: 'nominal' },
    color: { field: 'value', type: 'quantitative' },
  },
};
const tilemap: TileMapSpec = {
  type: 'tilemap',
  data: [
    { state: 'CA', value: 10 },
    { state: 'TX', value: 20 },
  ],
  encoding: {
    state: { field: 'state', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
};
const sankey: SankeySpec = {
  type: 'sankey',
  data: [
    { from: 'Alpha', to: 'Beta', value: 10 },
    { from: 'Beta', to: 'Gamma', value: 10 },
  ],
  encoding: {
    source: { field: 'from', type: 'nominal' },
    target: { field: 'to', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
};
const table: TableSpec = {
  type: 'table',
  data: rows,
  rowKey: 'name',
  columns: [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'value', label: 'Value' },
  ],
  search: true,
};

type Spec = ChartSpec | BarListSpec | GeoMapSpec | TileMapSpec | SankeySpec;
function fixture<S extends Spec>(
  name: string,
  create: (
    element: HTMLElement,
    spec: S,
    options: { autoResize: false },
  ) => { update(spec: S): void; resize(): void; export(format: 'svg'): unknown; destroy(): void },
  spec: S,
  selector: string,
) {
  return {
    name,
    selector,
    mount: (element: HTMLElement, animation: boolean) => {
      const instance = create(element, { ...spec, animation }, { autoResize: false });
      return {
        ...instance,
        invalid: () => instance.update({ ...spec, data: null } as unknown as S),
        update: () =>
          instance.update({ ...spec, animation, chrome: { title: 'Updated evidence' } }),
        svg: () => instance.export('svg') as string,
      };
    },
  };
}
const fixtures = [
  fixture('bar', createChart, chart, '.oc-mark-rect'),
  fixture('bar list', createBarList, barlist, '.oc-barlist-row'),
  fixture('map', createGeoMap, map, '.oc-map-feature'),
  fixture('tile map', createTileMap, tilemap, '.oc-tilemap-tile'),
  fixture('Sankey', createSankey, sankey, '.oc-sankey-node'),
];

function container() {
  let width = 600;
  const element = document.createElement('div');
  element.getBoundingClientRect = () => ({
    width,
    height: 400,
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: 400,
    toJSON: () => ({}),
  });
  document.body.append(element);
  return {
    element,
    width: (value: number) => {
      width = value;
    },
  };
}
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe.each(fixtures)('$name lifecycle contract', ({ mount, selector, name }) => {
  it('keeps the last valid view and export usable after a rejected update', () => {
    const host = container();
    const instance = mount(host.element, false);
    const svg = host.element.querySelector('svg');
    const evidence = host.element.querySelectorAll(selector).length;
    expect(() => instance.invalid()).toThrow();
    expect(host.element.querySelector('svg')).toBe(svg);
    expect(instance.svg()).toContain('<svg');
    host.width(390);
    instance.resize();
    expect(host.element.querySelectorAll(selector)).toHaveLength(evidence);
    expect(host.element.querySelector('svg')?.getAttribute('viewBox')?.split(' ')[2]).toBe('390');
    instance.update();
    expect(host.element.textContent).toContain('Updated evidence');
    instance.destroy();
  });

  it('handles both a deferred resize and another resize after entrance settlement', () => {
    vi.useFakeTimers();
    const host = container();
    const instance = mount(host.element, true);
    host.width(390);
    instance.resize();
    vi.advanceTimersByTime(5000);
    expect(host.element.querySelector('svg')?.getAttribute('viewBox')?.split(' ')[2]).toBe('390');
    host.width(768);
    instance.resize();
    expect(host.element.querySelector('svg')?.getAttribute('viewBox')?.split(' ')[2]).toBe('768');
    instance.update();
    expect(host.element.querySelector('svg')?.classList.contains('oc-animate')).toBe(false);
    instance.destroy();
  });

  if (name !== 'bar') {
    it('supports inspection, activation and native Tab exit, preserving focus on resize', () => {
      const host = container();
      const instance = mount(host.element, false);
      const first = host.element.querySelector<SVGElement>(selector)!;
      first.focus();
      first.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
      const selectedKey = document.activeElement?.getAttribute('data-navigation-key');
      expect(selectedKey).toBeTruthy();
      expect(document.activeElement).not.toBe(first);
      const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.activeElement?.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(false);
      host.width(390);
      instance.resize();
      expect(document.activeElement?.getAttribute('data-navigation-key')).toBe(selectedKey);
      expect(host.element.querySelectorAll('[tabindex="0"][data-navigation-key]')).toHaveLength(1);
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      expect(host.element.querySelector<HTMLElement>('.oc-tooltip')?.style.display).toBe('none');
      instance.destroy();
    });
  }
});

it('Sankey callbacks work without tooltips and teardown clears active evidence', () => {
  const host = container();
  const clicks: unknown[] = [];
  const hovers: unknown[] = [];
  const instance = createSankey(host.element, sankey, {
    autoResize: false,
    tooltip: false,
    onNodeClick: (node) => clicks.push(node),
    onNodeHover: (node) => hovers.push(node),
  });
  const node = host.element.querySelector<SVGElement>('.oc-sankey-node')!;
  node.focus();
  node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(clicks).toHaveLength(1);
  expect(hovers.at(-1)).toEqual(clicks[0]);
  instance.destroy();
  expect(hovers.at(-1)).toBeNull();
});

it('exports a settled Sankey without transient hover dimming or changing the live view', () => {
  const host = container();
  const instance = createSankey(
    host.element,
    { ...sankey, animation: true },
    { autoResize: false },
  );
  const node = host.element.querySelector('.oc-sankey-node')!;
  node.dispatchEvent(new MouseEvent('mouseenter'));
  const before = host.element.querySelector('svg')!.outerHTML;
  const exported = instance.export('svg') as string;
  const parsed = new DOMParser().parseFromString(exported, 'image/svg+xml');
  expect(parsed.querySelector('.oc-animate')).toBeNull();
  const fills = [...parsed.querySelectorAll('.oc-sankey-link path')].map((el) =>
    Number(el.getAttribute('fill-opacity')),
  );
  expect(fills).toEqual(instance.layout.links.map((link) => link.fillOpacity));
  expect(host.element.querySelector('svg')!.outerHTML).toBe(before);
  instance.destroy();
});

it('table Escape cancels queued typing and focuses the current body', () => {
  vi.useFakeTimers();
  const host = container();
  const instance = createTable(host.element, table, { autoResize: false });
  const input = host.element.querySelector<HTMLInputElement>('input')!;
  input.focus();
  input.value = 'Alpha';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  vi.advanceTimersByTime(500);
  expect(instance.getState().search).toBe('');
  expect(host.element.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(document.activeElement).toBe(host.element.querySelector('tbody'));
  instance.destroy();
});

it('table preserves the logical cell after reordering and rejects invalid updates atomically', () => {
  const host = container();
  const instance = createTable(host.element, table, { autoResize: false });
  host.element.querySelector<HTMLElement>('tbody')!.focus();
  instance.update({ ...table, data: [...rows].reverse() });
  expect(host.element.querySelector('.oc-table-cell-focus')?.textContent).toBe('Alpha');
  const view = host.element.querySelector('table');
  expect(() => instance.update({ ...table, data: null } as unknown as TableSpec)).toThrow();
  expect(host.element.querySelector('table')).toBe(view);
  instance.resize();
  expect(host.element.querySelector('.oc-table-cell-focus')?.textContent).toBe('Alpha');
  instance.destroy();
});

it('table animation does not permanently block responsive layout', () => {
  vi.useFakeTimers();
  const host = container();
  const instance = createTable(host.element, { ...table, animation: true }, { autoResize: false });
  host.width(390);
  instance.resize();
  vi.advanceTimersByTime(5000);
  expect(host.element.querySelector('.oc-table--cards')).not.toBeNull();
  host.width(768);
  instance.resize();
  expect(host.element.querySelector('.oc-table--cards')).toBeNull();
  instance.destroy();
});

it('table callbacks distinguish typed, duplicate and missing keys after sorting', () => {
  const host = container();
  const data = [
    { id: 1, name: 'Numeric' },
    { id: '1', name: 'String' },
    { id: 'same', name: 'First duplicate' },
    { id: 'same', name: 'Second duplicate' },
    { name: 'Missing' },
  ];
  const selected: unknown[] = [];
  const instance = createTable(
    host.element,
    { ...table, rowKey: 'id', data, columns: [{ key: 'name', label: 'Name', sortable: true }] },
    { autoResize: false, onRowClick: (row) => selected.push(row) },
  );
  instance.setState({ sort: { column: 'name', direction: 'asc' } });
  const renderedRows = [...host.element.querySelectorAll('tbody tr')];
  expect(new Set(renderedRows.map((row) => row.getAttribute('data-row-id'))).size).toBe(
    data.length,
  );
  for (const row of renderedRows) row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(selected).toEqual([...data].sort((a, b) => a.name.localeCompare(b.name)));
  instance.destroy();
});

it('table CSV includes every filtered row even when the displayed table is paginated', () => {
  const host = container();
  const instance = createTable(
    host.element,
    { ...table, pagination: { pageSize: 1 } },
    { autoResize: false },
  );
  expect(host.element.querySelectorAll('tbody tr')).toHaveLength(1);
  instance.setState({ page: 1, sort: { column: 'name', direction: 'desc' } });
  expect(instance.export('csv').split('\n')).toEqual(['Name,Value', 'Beta,20', 'Alpha,10']);
  instance.destroy();
});

it.each([
  'line',
  'area',
] as const)('%s gaps survive intermediate motion, interruption and terminal export', (mark) => {
  const host = container();
  const spec: ChartSpec = {
    mark,
    animation: { preset: 'fluid', enter: false },
    data: [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: null },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ],
    encoding: { x: { field: 'x', type: 'ordinal' }, y: { field: 'y', type: 'quantitative' } },
  };
  const instance = createChart(host.element, spec, { autoResize: false });
  const next = {
    ...spec,
    data: spec.data.map((row) => ({ ...row, y: typeof row.y === 'number' ? row.y * 2 : row.y })),
  };
  const motion = instance.beginManualUpdate(next)!;
  expect(motion).not.toBeNull();
  motion.step(motion.totalMs / 2);
  const selector = `.oc-mark-${mark}:not(.oc-ghost) path`;
  const expected = instance.layout.marks.find((item) => item.type === mark);
  if (!expected || (expected.type !== 'line' && expected.type !== 'area'))
    throw new Error('Missing path mark');
  expect(expected.path.match(/M/g)).toHaveLength(2);
  expect(host.element.querySelector(selector)?.getAttribute('d')).toBe(expected.path);
  const interrupted = instance.beginManualUpdate(spec)!;
  interrupted.step(interrupted.totalMs / 2);
  const target = instance.layout.marks.find((item) => item.type === mark);
  if (!target || (target.type !== 'line' && target.type !== 'area'))
    throw new Error('Missing target');
  expect(host.element.querySelector(selector)?.getAttribute('d')).toBe(target.path);
  interrupted.step(interrupted.totalMs);
  expect(host.element.querySelector(selector)?.getAttribute('d')).toBe(target.path);
  const exported = new DOMParser().parseFromString(instance.export('svg'), 'image/svg+xml');
  expect(exported.querySelector(selector)?.getAttribute('d')).toBe(target.path);
  instance.destroy();
});
