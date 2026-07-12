/**
 * "You draw it" (`youDrawIt`) interaction tests.
 *
 * Mounts real charts via createChart into a happy-dom container and drives the
 * drawing overlay with real mouse/touch events, asserting on visible behavior:
 * the reader's guess path, the reveal clip animation, onReveal payload in data
 * coordinates, the keyboard-reachable skip button, and reduced-motion.
 *
 * happy-dom has no layout engine, so the SVG's getBoundingClientRect is the
 * zero rect and viewBox.baseVal is empty. Our pointer math then falls back to
 * scale 1 with a (0,0) origin, so clientX maps directly to SVG user units:
 * dispatching at clientX === sample.px snaps the guess to that sample.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { type ChartInstance, createChart } from '../mount';

function lineData() {
  return [2000, 2005, 2010, 2015, 2020].map((year, i) => ({
    year: `${year}`,
    value: 100 + i * 10,
  }));
}

function makeSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    mark: 'line',
    data: lineData(),
    encoding: {
      x: { field: 'year', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    youDrawIt: { from: '2010' },
    animation: false,
    ...overrides,
  } as ChartSpec;
}

function overlay(container: HTMLElement): SVGRectElement | null {
  return container.querySelector('[data-ydi-overlay]');
}

function guessPath(container: HTMLElement): SVGPathElement | null {
  return container.querySelector('[data-ydi-guess-path]');
}

function clipRect(container: HTMLElement): SVGRectElement | null {
  return container.querySelector('[data-ydi-clip-rect]');
}

function drawAt(target: EventTarget, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX, clientY }));
}

function dragTo(clientX: number, clientY: number): void {
  document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY }));
}

function releaseMouse(): void {
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

describe('you draw it', () => {
  let container: HTMLDivElement;
  let chart: ChartInstance | null = null;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    chart?.destroy();
    chart = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders the hatched drawing region, prompt, and a keyboard-reachable reveal button', () => {
    chart = createChart(container, makeSpec({ youDrawIt: { from: '2010', prompt: 'Guess it' } }));

    expect(container.querySelector('[data-ydi-region]')).not.toBeNull();
    expect(overlay(container)).not.toBeNull();

    const promptEl = container.querySelector('.oc-ydi-prompt');
    expect(promptEl?.textContent).toBe('Guess it');

    const button = container.querySelector('.oc-ydi-reveal-button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    // Native button is focusable (keyboard reachable) without a manual tabindex.
    expect(button.tagName).toBe('BUTTON');
    expect(button.disabled).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('draws a guess snapped to x-samples as the reader drags', () => {
    chart = createChart(container, makeSpec());
    const samples = chart.layout.youDrawIt!.samples;
    expect(samples.length).toBe(3); // 2010, 2015, 2020

    const rect = overlay(container)!;
    // Drag across all three samples at distinct y heights.
    drawAt(rect, samples[0].px, 120);
    dragTo(samples[1].px, 160);
    dragTo(samples[2].px, 200);
    releaseMouse();

    const d = guessPath(container)!.getAttribute('d') ?? '';
    // One M + two L commands = three snapped points.
    const commands = d.match(/[ML]/g) ?? [];
    expect(commands.length).toBe(3);
    // Points sit exactly on the sample x positions.
    for (const s of samples) {
      expect(d).toContain(`${s.px},`);
    }
  });

  it('clamps a guess drawn out of bounds to the plot area', () => {
    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;

    // Drag far below the bottom of the area.
    drawAt(rect, ydi.samples[0].px, ydi.area.y + ydi.area.height + 500);
    releaseMouse();

    const d = guessPath(container)!.getAttribute('d') ?? '';
    const match = d.match(/M[\d.]+,([\d.]+)/);
    expect(match).not.toBeNull();
    const y = Number.parseFloat(match![1]);
    // Clamped to the area's bottom edge, not the 500px overdraw.
    expect(y).toBeLessThanOrEqual(ydi.area.y + ydi.area.height + 0.01);
    expect(y).toBeGreaterThanOrEqual(ydi.area.y);
  });

  it('reveals via the button and reports the guess to onReveal in data coordinates', () => {
    const onReveal = vi.fn();
    chart = createChart(container, makeSpec(), { onReveal });
    const samples = chart.layout.youDrawIt!.samples;
    const inv = chart.layout.youDrawIt!.yInvert!;
    const rect = overlay(container)!;

    // Draw at the top pixel of the area at the first sample.
    drawAt(rect, samples[0].px, inv.topPixel);
    releaseMouse();

    const button = container.querySelector('.oc-ydi-reveal-button') as HTMLButtonElement;
    button.click();

    expect(onReveal).toHaveBeenCalledTimes(1);
    const guess = onReveal.mock.calls[0][0] as Array<{ x: string | number; y: number }>;
    expect(guess.length).toBe(1);
    expect(guess[0].x).toBe(samples[0].xValue);
    // y maps back to the data value at the top pixel.
    expect(guess[0].y).toBeCloseTo(inv.topData, 5);
  });

  it('reveal keeps the guess visible and expands the clip to the full area', () => {
    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;
    drawAt(rect, ydi.samples[0].px, 130);
    releaseMouse();

    const before = clipRect(container)!;
    // Pre-reveal: clip only covers up to `from`.
    expect(Number.parseFloat(before.getAttribute('width') ?? '0')).toBeCloseTo(
      Math.max(0, ydi.fromX - ydi.area.x),
      1,
    );

    chart.revealDrawing();

    // The clip now spans the whole area (real line fully revealed).
    expect(Number.parseFloat(clipRect(container)!.getAttribute('width') ?? '0')).toBeCloseTo(
      ydi.area.width,
      1,
    );
    // The reader's guess path is still present for comparison.
    const d = guessPath(container)!.getAttribute('d') ?? '';
    expect(d.length).toBeGreaterThan(0);
    // Drawing overlay is torn down after reveal.
    expect(overlay(container)).toBeNull();
  });

  it('skip-to-reveal works before any drawing (empty guess payload)', () => {
    const onReveal = vi.fn();
    chart = createChart(container, makeSpec(), { onReveal });
    const button = container.querySelector('.oc-ydi-reveal-button') as HTMLButtonElement;
    button.click();
    expect(onReveal).toHaveBeenCalledWith([]);
  });

  it('resetDrawing clears the guess and restores the drawing state', () => {
    chart = createChart(container, makeSpec());
    const samples = chart.layout.youDrawIt!.samples;
    drawAt(overlay(container)!, samples[0].px, 140);
    releaseMouse();
    chart.revealDrawing();
    expect(overlay(container)).toBeNull();

    chart.resetDrawing();

    // Guess cleared, overlay + prompt back, button re-enabled.
    expect(guessPath(container)!.getAttribute('d')).toBe('');
    expect(overlay(container)).not.toBeNull();
    const button = container.querySelector('.oc-ydi-reveal-button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('supports touch drawing (touchstart/touchmove)', () => {
    chart = createChart(container, makeSpec());
    const samples = chart.layout.youDrawIt!.samples;
    const rect = overlay(container)!;

    const touch = (x: number, y: number) => ({ clientX: x, clientY: y }) as Touch;
    rect.dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [touch(samples[0].px, 120)],
      }),
    );
    rect.dispatchEvent(
      new TouchEvent('touchmove', {
        bubbles: true,
        cancelable: true,
        touches: [touch(samples[1].px, 150)],
      }),
    );
    rect.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));

    const commands = (guessPath(container)!.getAttribute('d') ?? '').match(/[ML]/g) ?? [];
    expect(commands.length).toBe(2);
  });

  it('reveals instantly under prefers-reduced-motion (no transition class)', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          onchange: null,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );

    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    chart.revealDrawing();

    const clip = clipRect(container)!;
    // No animation class; width snaps straight to full.
    expect(clip.classList.contains('oc-ydi-clip-animate')).toBe(false);
    expect(Number.parseFloat(clip.getAttribute('width') ?? '0')).toBeCloseTo(ydi.area.width, 1);
  });

  it('disables youDrawIt when edit callbacks are provided (mutually exclusive)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    chart = createChart(container, makeSpec(), { onEdit: () => {} });

    // No drawing overlay: edit mode wins, youDrawIt is suppressed.
    expect(overlay(container)).toBeNull();
    expect(container.querySelector('.oc-ydi-region')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('mutually exclusive'));
  });
});
