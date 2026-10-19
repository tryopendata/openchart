import type { GeoLabelInventoryEntry } from '@opendata-ai/openchart-core';
import { afterEach, expect, it } from 'vitest';
import { createMapLabelInventory } from '../map-label-inventory';

const entries: GeoLabelInventoryEntry[] = [
  {
    id: 'custom',
    kind: 'callout',
    anchor: { kind: 'coordinate', space: 'geographic', x: 12, y: 34 },
    text: 'Exact custom text',
    subtitle: 'The complete subtitle',
    visibility: 'zoom-range',
    presentation: 'none',
  },
];
afterEach(() => {
  document.body.innerHTML = '';
});
it('keeps hidden complete inventory associated across SVG replacement and cleans owned DOM only', () => {
  const root = document.createElement('div');
  root.style.height = '200px';
  document.body.append(root);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  root.append(svg);
  const host = document.createElement('div');
  host.innerHTML = '<p>Keep me</p>';
  document.body.append(host);
  const inventory = createMapLabelInventory(root, { container: host });
  inventory.update(svg, entries);
  const id = svg.getAttribute('aria-describedby')!;
  expect(root.querySelector(`#${id}`)?.textContent).toContain(
    'Exact custom text. The complete subtitle',
  );
  expect(host.querySelector('summary')?.textContent).toBe('Map places and notes');
  expect(host.textContent).toContain('Visible at another zoom level');
  expect(root.style.height).toBe('200px');
  const next = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  inventory.update(next, entries);
  expect(next.getAttribute('aria-describedby')).toBe(id);
  expect(svg.hasAttribute('aria-describedby')).toBe(false);
  const replacement = document.createElement('aside');
  inventory.setOptions({ container: replacement });
  expect(host.querySelector('details')).toBeNull();
  expect(replacement.querySelectorAll('details')).toHaveLength(1);
  inventory.destroy();
  expect(root.querySelector('.oc-map-label-inventory')).toBeNull();
  expect(replacement.querySelector('details')).toBeNull();
  expect(host.textContent).toBe('Keep me');
});
it('gives separate maps distinct IDs and adds no visible disclosure when omitted', () => {
  const a = document.createElement('div'),
    b = document.createElement('div');
  const sa = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    sb = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const first = createMapLabelInventory(a),
    second = createMapLabelInventory(b);
  first.update(sa, entries);
  second.update(sb, entries);
  expect(sa.getAttribute('aria-describedby')).not.toBe(sb.getAttribute('aria-describedby'));
  expect(a.querySelector('details')).toBeNull();
  first.destroy();
  second.destroy();
});
it('explains visible fallback limitations while retaining exact authored text', () => {
  const root = document.createElement('div');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const controller = createMapLabelInventory(root);
  controller.update(svg, [
    { ...entries[0], visibility: 'visible', presentation: 'label', limitation: 'vertex-limit' },
  ]);
  expect(root.textContent).toContain('Exact custom text');
  expect(root.textContent).toContain(
    'Canonical anchor used because the projected geometry budget was reached',
  );
  controller.destroy();
});
