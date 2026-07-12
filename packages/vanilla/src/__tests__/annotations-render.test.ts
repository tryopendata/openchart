/**
 * Annotation connector + marker rendering.
 *
 * Covers the Phase 2 redesign contract: one quadratic curve, an open-V stroked
 * arrowhead (not a filled triangle), exactly one endpoint marker per annotated
 * point, and the two connector voices (ink for arrowed emphasis, gray hairline
 * for quiet leaders).
 */

import type { Annotation, ChartSpec, CompileOptions } from '@opendata-ai/openchart-engine';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { renderChartSVG } from '../svg-renderer';

const COMPILE_OPTS: CompileOptions = { width: 600, height: 400 };

function renderAnnotated(annotations: Annotation[]) {
  const spec: ChartSpec = {
    mark: 'line',
    data: [
      { date: '2020-01-01', value: 10 },
      { date: '2020-02-01', value: 30 },
      { date: '2020-03-01', value: 20 },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    annotations,
  };
  const container = createContainer(COMPILE_OPTS.width, COMPILE_OPTS.height);
  const layout = compileChart(spec, COMPILE_OPTS);
  renderChartSVG(layout, container);
  return { container, layout };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('annotation connectors', () => {
  it('renders the curve as a single quadratic path', () => {
    const { container } = renderAnnotated([
      {
        type: 'text',
        x: '2020-02-01',
        y: 30,
        text: 'Peak',
        connector: 'curve',
        offset: { dx: 60, dy: -50 },
      },
    ]);

    const path = container.querySelector('path.oc-annotation-connector');
    expect(path).not.toBeNull();
    const d = path!.getAttribute('d') ?? '';
    expect(d).toMatch(/^M [\d.-]+ [\d.-]+ Q /);
    expect(d).not.toContain('C ');
  });

  it('renders the arrowhead as a stroked open-V polyline, not a filled polygon', () => {
    const { container } = renderAnnotated([
      {
        type: 'text',
        x: '2020-02-01',
        y: 30,
        text: 'Peak',
        connector: 'curve',
        offset: { dx: 60, dy: -50 },
      },
    ]);

    expect(container.querySelector('polygon.oc-annotation-connector')).toBeNull();

    const arrow = container.querySelector('polyline.oc-annotation-connector');
    expect(arrow).not.toBeNull();
    expect(arrow!.getAttribute('fill')).toBe('none');
    expect(arrow!.getAttribute('stroke-linecap')).toBe('round');
    // "baseLeft tip baseRight" — three points, so the V opens away from the tip.
    expect((arrow!.getAttribute('points') ?? '').split(' ')).toHaveLength(3);
  });

  it('draws exactly one endpoint marker (the old bullseye pair is gone)', () => {
    const { container } = renderAnnotated([
      {
        type: 'text',
        x: '2020-02-01',
        y: 30,
        text: 'Peak',
        dot: true,
        offset: { dx: 60, dy: -50 },
      },
    ]);

    expect(container.querySelectorAll('.oc-annotation-dot')).toHaveLength(1);
    expect(container.querySelector('.oc-annotation-endpoint-ring')).toBeNull();
    expect(container.querySelector('.oc-annotation-endpoint-dot')).toBeNull();
  });

  it('gives the arrowed curve the label ink and the plain leader a gray hairline', () => {
    const { layout: arrowed } = renderAnnotated([
      {
        type: 'text',
        x: '2020-02-01',
        y: 30,
        text: 'Peak',
        connector: 'curve',
        offset: { dx: 60, dy: -50 },
      },
    ]);
    const { layout: quiet } = renderAnnotated([
      {
        type: 'text',
        x: '2020-02-01',
        y: 30,
        text: 'Peak',
        connector: 'straight',
        offset: { dx: 60, dy: -50 },
      },
    ]);

    const arrowConnector = arrowed.annotations[0].label?.connector;
    const quietConnector = quiet.annotations[0].label?.connector;
    expect(arrowConnector?.stroke).toBe(arrowed.annotations[0].label?.style.fill);
    expect(quietConnector?.stroke).not.toBe(quiet.annotations[0].label?.style.fill);
    // The quiet leader and its marker read as one system.
    expect(quietConnector?.stroke).toBe(quiet.annotations[0].dot?.stroke);
  });
});

describe('annotation rich text', () => {
  it('emits one tspan per span and bolds only the marked run', () => {
    const { container } = renderAnnotated([
      { type: 'text', x: '2020-02-01', y: 30, text: 'Inflation peaked at **8.5%**' },
    ]);

    const spans = [...container.querySelectorAll('text.oc-annotation-label tspan')];
    expect(spans.map((s) => s.textContent)).toEqual(['Inflation peaked at ', '8.5%']);
    expect(spans[0].getAttribute('font-weight')).toBeNull();
    expect(spans[1].getAttribute('font-weight')).toBe('700');
    // The delimiters are syntax, never glyphs.
    expect(container.querySelector('text.oc-annotation-label')!.textContent).not.toContain('**');
  });

  it('composes multi-line with bold spans, resetting x on each new line', () => {
    const { container } = renderAnnotated([
      { type: 'text', x: '2020-02-01', y: 30, text: 'Line **one**\n**Line** two' },
    ]);

    const spans = [...container.querySelectorAll('text.oc-annotation-label tspan')];
    expect(spans.map((s) => s.textContent)).toEqual(['Line ', 'one', 'Line', ' two']);
    // First span of each line carries the x reset; continuation spans must not.
    expect(spans[0].getAttribute('x')).not.toBeNull();
    expect(spans[1].getAttribute('x')).toBeNull();
    expect(spans[2].getAttribute('x')).not.toBeNull();
    expect(spans[3].getAttribute('x')).toBeNull();
    // Only the second line advances.
    expect(spans[0].getAttribute('dy')).toBe('0');
    expect(Number(spans[2].getAttribute('dy'))).toBeGreaterThan(0);
  });

  it('parses bold spans in the subtitle too', () => {
    const { container } = renderAnnotated([
      {
        type: 'text',
        x: '2020-02-01',
        y: 30,
        text: 'Peak',
        subtitle: 'Revised **upward** in March',
      },
    ]);

    const spans = [...container.querySelectorAll('text.oc-annotation-subtitle tspan')];
    expect(spans.map((s) => s.textContent)).toEqual(['Revised ', 'upward', ' in March']);
    expect(spans[1].getAttribute('font-weight')).toBe('700');
  });

  it('renders an unmatched delimiter literally', () => {
    const { container } = renderAnnotated([
      { type: 'text', x: '2020-02-01', y: 30, text: 'Up **50% YoY' },
    ]);

    const label = container.querySelector('text.oc-annotation-label')!;
    expect(label.textContent).toBe('Up **50% YoY');
    expect(label.querySelector('tspan[font-weight]')).toBeNull();
  });
});
