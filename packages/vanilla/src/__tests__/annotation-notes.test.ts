import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec } from '../__test-fixtures__/specs';
import { exportSVG, exportSVGWithFonts } from '../export';
import { createChart } from '../mount';

const spec: ChartSpec = {
  ...barSpec,
  animation: false,
  responsive: { compactAnnotationLimit: 0 },
  annotations: [
    {
      type: 'text',
      id: 'first',
      x: 10,
      y: 'A',
      text: 'A **finding**',
      subtitle: 'Supporting **context**',
    },
    {
      type: 'text',
      id: 'second',
      x: 20,
      y: 'B',
      text: 'Another finding',
      subtitle: 'Complete detail',
    },
  ],
};
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
});
function mount(nextSpec = spec) {
  const container = createContainer(390, 400);
  const onEdit = vi.fn();
  const chart = createChart(container, nextSpec, { autoResize: false, onEdit });
  cleanups.push(() => chart.destroy());
  const svg = container.querySelector('svg')!;
  const note = (index: number) =>
    svg.querySelector<SVGElement>(`[data-note-spec-index="${index}"]`)!;
  const markers = (index: number) => [
    ...svg.querySelectorAll<SVGElement>(`[data-note-marker-index="${index}"]`),
  ];
  return { container, chart, svg, onEdit, note, markers };
}
const press = (element: Element, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('source-linked annotation notes', () => {
  it.each([
    false,
    true,
  ])('keeps hidden notes out of keyboard navigation across compatible updates (initially hidden=%s)', (hidden) => {
    const m = mount({ ...spec, a11y: { hidden } });
    for (const nextHidden of [hidden, !hidden, hidden]) {
      m.chart.update({ ...spec, a11y: { hidden: nextHidden } });
      const svg = m.container.querySelector('svg')!;
      const note = svg.querySelector<SVGElement>('[data-note-spec-index]')!;
      const marker = svg.querySelector<SVGElement>('[data-note-marker-index]')!;
      expect(note.getAttribute('tabindex')).toBe(nextHidden ? null : '0');
      expect(marker.getAttribute('tabindex')).toBe(nextHidden ? null : '0');
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      note.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(!nextHidden);
    }
  });
  it('renders source-ordered, accessible complete notes with rich text', () => {
    const m = mount();
    expect(
      m.svg.querySelector('[role="list"][aria-label="Annotation notes, in source order"]'),
    ).not.toBeNull();
    expect(
      [...m.svg.querySelectorAll('[data-note-spec-index]')].map((el) =>
        el.getAttribute('data-note-spec-index'),
      ),
    ).toEqual(['0', '1']);
    expect(m.svg.getAttribute('role')).toBe('group');
    expect(m.svg.getAttribute('aria-label')).toBe(
      'Bar chart showing Updated Chart (3 data points)',
    );
    expect(m.note(0).getAttribute('role')).toBe('listitem');
    expect(m.note(0).getAttribute('tabindex')).toBe('0');
    expect(m.note(0).getAttribute('aria-label')).toBe('1. A finding. Supporting context');
    expect(m.note(0).textContent).not.toContain('**');
    expect(
      [...m.note(0).querySelectorAll('[font-weight="700"]')].map((el) => el.textContent).join(' '),
    ).toContain('finding');
    expect(m.markers(0)).toHaveLength(1);
    expect(m.markers(0)[0].getAttribute('role')).toBe('button');
    expect(m.markers(0)[0].getAttribute('tabindex')).toBe('0');
    const number = m.markers(0)[0].querySelector('.oc-annotation-footnote-number')!;
    expect(number.getAttribute('text-anchor')).toBe('middle');
    expect(number.getAttribute('dominant-baseline')).toBe('central');
  });

  it('focus and click emphasize only the source-linked note and marker; blur and Escape clear them', () => {
    const m = mount();
    m.note(0).focus();
    expect([...m.svg.querySelectorAll('.oc-note-active')]).toEqual(
      expect.arrayContaining([m.note(0), m.markers(0)[0]]),
    );
    expect(m.note(1).classList.contains('oc-note-active')).toBe(false);
    m.note(0).blur();
    expect(m.svg.querySelector('.oc-note-active')).toBeNull();
    m.note(1).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(m.note(1).classList.contains('oc-note-active')).toBe(true);
    expect(m.markers(1)[0].classList.contains('oc-note-active')).toBe(true);
    press(m.note(1), 'Escape');
    expect(m.svg.querySelector('.oc-note-active')).toBeNull();
    expect(m.onEdit).not.toHaveBeenCalled();
  });

  it.each(['Enter', ' '])('%s moves focus between a marker and its note without editing', (key) => {
    const m = mount();
    const marker = m.markers(0)[0];
    marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    marker.focus();
    press(marker, key);
    expect(document.activeElement).toBe(m.note(0));
    expect(m.container.querySelector('textarea, input, [contenteditable]')).toBeNull();
    press(m.note(0), key);
    expect(document.activeElement).toBe(marker);
    expect(m.onEdit).not.toHaveBeenCalled();
  });

  it('resolves current note peers after a compatible resize reconciles SVG nodes', () => {
    let width = 1280;
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.getBoundingClientRect = () => ({ width, height: 400 }) as DOMRect;
    const chart = createChart(container, spec, { autoResize: false });
    cleanups.push(() => chart.destroy());
    const originalSVG = container.querySelector('svg');
    expect(container.querySelector('[data-note-spec-index]')).toBeNull();
    width = 390;
    chart.resize();
    expect(container.querySelector('svg')).toBe(originalSVG);
    const note = container.querySelector<SVGElement>('[data-note-spec-index="0"]')!;
    const marker = container.querySelector<SVGElement>('[data-note-marker-index="0"]')!;
    note.focus();
    expect(marker.classList.contains('oc-note-active')).toBe(true);
    press(note, 'Enter');
    expect(document.activeElement).toBe(marker);
    press(marker, ' ');
    expect(document.activeElement).toBe(note);
    for (let i = 0; i < 3; i++) chart.update(spec);
    const latestNote = container.querySelector<SVGElement>('[data-note-spec-index="0"]')!;
    const latestMarker = container.querySelector<SVGElement>('[data-note-marker-index="0"]')!;
    const focus = vi.spyOn(latestMarker, 'focus');
    press(latestNote, 'Enter');
    expect(focus).toHaveBeenCalledTimes(1);
    chart.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('emphasizes every facet marker for one source and returns to the first instance', () => {
    const faceted: ChartSpec = {
      ...spec,
      data: spec.data.flatMap((row) => [
        { ...row, panel: 'one' },
        { ...row, panel: 'two' },
      ]),
      encoding: { ...spec.encoding, facet: { field: 'panel', type: 'nominal' } },
    };
    const m = mount(faceted);
    expect(m.markers(0)).toHaveLength(2);
    m.note(0).focus();
    expect(m.markers(0).every((marker) => marker.classList.contains('oc-note-active'))).toBe(true);
    press(m.note(0), 'Enter');
    expect(document.activeElement).toBe(m.markers(0)[0]);
    expect(m.onEdit).not.toHaveBeenCalled();
  });

  it.each([
    'svg',
    'embedded-svg',
  ] as const)('excludes transient emphasis and editor controls from %s without clearing the live view', async (format) => {
    const m = mount();
    m.note(0).focus();
    expect(m.svg.querySelector('.oc-note-active')).not.toBeNull();
    const source =
      format === 'svg' ? exportSVG(m.svg) : await exportSVGWithFonts(m.svg, { embedFonts: false });
    const exported = new DOMParser().parseFromString(source, 'image/svg+xml');
    expect(
      exported.querySelector(
        '.oc-note-active, .oc-selection-overlay, .oc-anchor-handle, .oc-connector-handle',
      ),
    ).toBeNull();
    expect(exported.querySelectorAll('[data-note-spec-index]')).toHaveLength(2);
    expect(exported.querySelector('[data-note-spec-index="0"]')?.getAttribute('aria-label')).toBe(
      '1. A finding. Supporting context',
    );
    expect(m.svg.querySelector('.oc-note-active')).not.toBeNull();
    expect(m.onEdit).not.toHaveBeenCalled();
  });
});
