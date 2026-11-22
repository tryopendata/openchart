/**
 * Sankey data updates tween through the shared element tween (Seam B): nodes
 * move and resize, link ribbons morph with their gradient endpoints, labels
 * slide; new nodes and links fade in; removed ones leave fading ghosts whose
 * gradients are re-homed into the new SVG.
 */

import type { AnimationSpec, SankeySpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { type FrameClock, installFrameClock } from '../__test-fixtures__/graph-frame-clock';
import { createSankey, type SankeyInstance } from '../sankey-mount';

const MOTION: AnimationSpec = { enter: false, update: { duration: 400 } };

type Flow = { from: string; to: string; amount: number };
const spec = (rows: Flow[], animation: AnimationSpec = MOTION): SankeySpec => ({
  type: 'sankey',
  animation,
  data: rows,
  encoding: {
    source: { field: 'from', type: 'nominal' },
    target: { field: 'to', type: 'nominal' },
    value: { field: 'amount', type: 'quantitative' },
  },
});

const BEFORE: Flow[] = [
  { from: 'A', to: 'X', amount: 10 },
  { from: 'B', to: 'X', amount: 20 },
  { from: 'C', to: 'Y', amount: 15 },
];
// A grows, C (and C->Y, Y) leave, D->X arrives.
const AFTER: Flow[] = [
  { from: 'A', to: 'X', amount: 30 },
  { from: 'B', to: 'X', amount: 20 },
  { from: 'D', to: 'X', amount: 5 },
];

let clock: FrameClock;
const instances: SankeyInstance[] = [];

function mount(s: SankeySpec): { container: HTMLElement; chart: SankeyInstance } {
  const container = createContainer();
  const chart = createSankey(container, s, { autoResize: false });
  instances.push(chart);
  return { container, chart };
}

const nodeRect = (c: HTMLElement, id: string) =>
  c.querySelector(`.oc-sankey-node[data-node-id="${id}"] rect`)!;
const link = (c: HTMLElement, source: string, target: string) =>
  c.querySelector(`.oc-sankey-link[data-source="${source}"][data-target="${target}"]`)!;
const label = (c: HTMLElement, id: string) =>
  c.querySelector(`.oc-sankey-label[data-node-id="${id}"]`)!;
const ghosts = (c: HTMLElement) => c.querySelectorAll('.oc-ghost');
const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

/** Gradient ids differ between renders; normalize them for comparison. */
const markup = (c: HTMLElement) =>
  c.querySelector('svg')!.outerHTML.replace(/oc-sg-[\w-]+?-\d+/g, 'ID');

function stubReducedMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  clock = installFrameClock();
});

afterEach(() => {
  for (const chart of instances.splice(0)) chart.destroy();
  clock.restore();
  document.body.innerHTML = '';
});

describe('sankey update tween', () => {
  it('writes the from-state synchronously, before the first frame', () => {
    const { container, chart } = mount(spec(BEFORE));
    const fromHeight = num(nodeRect(container, 'A'), 'height');
    const fromD = link(container, 'A', 'X').querySelector('path')!.getAttribute('d');

    chart.update(spec(AFTER));

    expect(num(nodeRect(container, 'A'), 'height')).toBeCloseTo(fromHeight, 6);
    const d = link(container, 'A', 'X').querySelector('path')!.getAttribute('d')!;
    const numbers = (s: string) => (s.match(/-?[\d.]+/g) ?? []).map(Number);
    numbers(d).forEach((n, i) => {
      expect(n).toBeCloseTo(numbers(fromD!)[i], 4);
    });
    // D and D->X are new and start invisible.
    expect(nodeRect(container, 'D').getAttribute('opacity')).toBe('0');
    expect(link(container, 'D', 'X').getAttribute('opacity')).toBe('0');
    // C, its label, C->Y and Y leave as ghosts that match no live selector.
    expect(ghosts(container).length).toBeGreaterThanOrEqual(3);
    for (const ghost of ghosts(container)) {
      expect(ghost.matches('.oc-sankey-node, .oc-sankey-link, .oc-sankey-label')).toBe(false);
    }
  });

  it('re-homes a removed link gradient into the new SVG under a fresh id', () => {
    const { container, chart } = mount(spec(BEFORE));
    const oldFill = link(container, 'C', 'Y').querySelector('path')!.getAttribute('fill');
    chart.update(spec(AFTER));

    const svg = container.querySelector('svg')!;
    const ghostPaths = [...svg.querySelectorAll('.oc-ghost path')];
    const urls = ghostPaths
      .map((p) => /url\(#([^)]+)\)/.exec(p.getAttribute('fill') ?? '')?.[1])
      .filter(Boolean) as string[];
    expect(oldFill).toMatch(/^url\(/);
    expect(urls.length).toBeGreaterThan(0);
    for (const id of urls) {
      expect(id).toContain('-ghost-');
      expect(svg.querySelectorAll(`linearGradient[id="${id}"]`)).toHaveLength(1);
    }
    // The re-homed defs leave with their ghosts.
    clock.pump(0);
    clock.pump(5000);
    expect(svg.querySelectorAll('linearGradient[id*="-ghost-"]')).toHaveLength(0);
  });

  it('tweens link gradient endpoints as the nodes move', () => {
    const { container, chart } = mount(spec(BEFORE));
    chart.update(spec(AFTER));
    const fresh = mount(spec(AFTER)).container;
    const gradientOf = (c: HTMLElement) => {
      const id = /url\(#([^)]+)\)/.exec(
        link(c, 'A', 'X').querySelector('path')!.getAttribute('fill') ?? '',
      )?.[1];
      return id ? c.querySelector(`linearGradient[id="${id}"]`) : null;
    };
    const live = gradientOf(container)!;
    const final = gradientOf(fresh)!;
    expect(live).not.toBeNull();
    expect(final).not.toBeNull();
    clock.pump(0);
    clock.pump(5000);
    expect(live.getAttribute('x1')).toBe(final.getAttribute('x1'));
    expect(live.getAttribute('x2')).toBe(final.getAttribute('x2'));
  });

  it('moves through intermediate values and ends equal to a fresh render', () => {
    const { container, chart } = mount(spec(BEFORE));
    const fromHeight = num(nodeRect(container, 'A'), 'height');
    const fromLabelY = num(label(container, 'A'), 'y');
    chart.update(spec(AFTER));
    const fresh = mount(spec(AFTER)).container;
    const toHeight = num(nodeRect(fresh, 'A'), 'height');

    clock.pump(0);
    clock.pump(300);
    const mid = num(nodeRect(container, 'A'), 'height');
    expect(mid).toBeGreaterThan(Math.min(fromHeight, toHeight));
    expect(mid).toBeLessThan(Math.max(fromHeight, toHeight));
    expect(fromLabelY).not.toBe(num(label(fresh, 'A'), 'y'));
    expect(label(container, 'A').getAttribute('transform')).toMatch(/^translate\(/);

    clock.pump(5000);
    expect(ghosts(container)).toHaveLength(0);
    expect(markup(container)).toBe(markup(fresh));
  });

  it('crossfades a label that changes side instead of sliding it across its node', () => {
    const { container, chart } = mount(spec(BEFORE));
    // First-column labels sit left of their node; 'right' moves them right.
    expect(label(container, 'A').getAttribute('text-anchor')).toBe('end');
    chart.update({ ...spec(BEFORE), nodeLabelAlign: 'right' });
    const fresh = mount({ ...spec(BEFORE), nodeLabelAlign: 'right' }).container;

    const moved = label(container, 'A');
    expect(moved.getAttribute('text-anchor')).toBe('start');
    expect(moved.hasAttribute('transform')).toBe(false);
    expect(moved.getAttribute('opacity')).toBe('0');
    const ghost = container.querySelector('.oc-sankey-labels .oc-ghost[data-node-id="A"]');
    expect(ghost?.getAttribute('text-anchor')).toBe('end');
    // Interior labels keep their side, so they slide as before.
    expect(container.querySelector('.oc-sankey-labels .oc-ghost[data-node-id="X"]')).toBeNull();

    clock.pump(0);
    clock.pump(5000);
    expect(ghosts(container)).toHaveLength(0);
    expect(markup(container)).toBe(markup(fresh));
  });

  it('crossfades labels that move onto the flow when an update narrows the room', () => {
    const container = createContainer(360, 400);
    const chart = createSankey(container, spec(BEFORE), { autoResize: false });
    instances.push(chart);
    expect(label(container, 'A').hasAttribute('paint-order')).toBe(false);

    // Long first- and last-column names need gutters that would squeeze the flow.
    chart.update(
      spec([
        ...BEFORE,
        { from: 'Imported fuels and feedstocks', to: 'Residential and commercial', amount: 5 },
      ]),
    );

    const moved = label(container, 'A');
    expect(moved.hasAttribute('paint-order')).toBe(true);
    expect(moved.getAttribute('opacity')).toBe('0');
    expect(container.querySelector('.oc-ghost[data-node-id="A"]')).not.toBeNull();
  });

  it('snaps when update motion is off', () => {
    const off: AnimationSpec = { enter: false, update: false };
    const { container, chart } = mount(spec(BEFORE, off));
    chart.update(spec(AFTER, off));
    expect(ghosts(container)).toHaveLength(0);
    expect(markup(container)).toBe(markup(mount(spec(AFTER, off)).container));
  });

  it('snaps an update that lands while the entrance plays', () => {
    const animated: AnimationSpec = { update: { duration: 400 } };
    const { container, chart } = mount(spec(BEFORE, animated));
    expect(container.querySelector('svg.oc-animate')).not.toBeNull();
    chart.update(spec(AFTER, animated));
    expect(ghosts(container)).toHaveLength(0);
    expect(nodeRect(container, 'D').hasAttribute('opacity')).toBe(false);
  });

  it('snaps under reduced motion', () => {
    stubReducedMotion();
    const { container, chart } = mount(spec(BEFORE));
    chart.update(spec(AFTER));
    expect(ghosts(container)).toHaveLength(0);
    expect(markup(container)).toBe(markup(mount(spec(AFTER)).container));
  });

  it('snaps and drops ghosts when a resize or destroy interrupts it', () => {
    const { container, chart } = mount(spec(BEFORE));
    chart.update(spec(AFTER));
    clock.pump(0);
    clock.pump(100);
    chart.resize();
    expect(ghosts(container)).toHaveLength(0);

    chart.update(spec(BEFORE));
    expect(ghosts(container).length).toBeGreaterThan(0);
    chart.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });
});
