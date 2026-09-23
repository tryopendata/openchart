/**
 * "You draw it" (`youDrawIt`) interaction tests.
 *
 * Mounts real charts via createChart into a happy-dom container and drives the
 * drawing overlay with real pointer events, asserting on visible behavior:
 * the reader's guess path, the reveal clip animation, onReveal payload in data
 * coordinates, the keyboard-reachable skip and clear buttons, and
 * reduced-motion.
 *
 * happy-dom has no layout engine, so the SVG's getBoundingClientRect is the
 * zero rect and viewBox.baseVal is empty. Our pointer math then falls back to
 * scale 1 with a (0,0) origin, so clientX maps directly to SVG user units.
 */

import type { ChartSpec, ResolvedYouDrawIt } from '@opendata-ai/openchart-core';
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

const POINTER_ID = 1;

function pointer(type: string, clientX = 0, clientY = 0): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: POINTER_ID,
    clientX,
    clientY,
  });
}

/** Press on the overlay and start a stroke. */
function drawAt(target: EventTarget, clientX: number, clientY: number): void {
  target.dispatchEvent(pointer('pointerdown', clientX, clientY));
}

/** Continue the stroke. Pointer capture routes moves to the overlay. */
function dragTo(target: EventTarget, clientX: number, clientY: number): void {
  target.dispatchEvent(pointer('pointermove', clientX, clientY));
}

function release(target: EventTarget): void {
  target.dispatchEvent(pointer('pointerup'));
}

/** Parse "M x,y L x,y ..." into points. */
function pathPoints(d: string): Array<{ x: number; y: number }> {
  return Array.from(d.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)).map((m) => ({
    x: Number.parseFloat(m[1]),
    y: Number.parseFloat(m[2]),
  }));
}

/** Pixel y → data value through the resolved linear anchors. */
function pixelToData(ydi: ResolvedYouDrawIt, py: number): number {
  const inv = ydi.yInvert!;
  const t = (py - inv.topPixel) / (inv.bottomPixel - inv.topPixel);
  return inv.topData + t * (inv.bottomData - inv.topData);
}

function resetButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('.oc-ydi-reset-button') as HTMLButtonElement;
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

  it('fills every sample from a single fast sweep, interpolating along the stroke', () => {
    const onReveal = vi.fn();
    chart = createChart(container, makeSpec(), { onReveal });
    const ydi = chart.layout.youDrawIt!;
    expect(ydi.samples.map((s) => s.xValue)).toEqual(['2015', '2020']);
    const rect = overlay(container)!;

    // One move event from `from` straight to the last sample, skipping 2015.
    const endX = ydi.samples[1].px;
    drawAt(rect, ydi.fromX, 100);
    dragTo(rect, endX, 200);
    release(rect);
    chart.revealDrawing();

    const guess = onReveal.mock.calls[0][0] as Array<{ x: string | number; y: number }>;
    expect(guess.map((g) => g.x)).toEqual(['2015', '2020']);
    const t = (ydi.samples[0].px - ydi.fromX) / (endX - ydi.fromX);
    expect(guess[0].y).toBeCloseTo(pixelToData(ydi, 100 + t * 100), 1);
    expect(guess[1].y).toBeCloseTo(pixelToData(ydi, 200), 1);
  });

  it('draws the stroke at pixel resolution rather than snapping to samples', () => {
    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;
    drawAt(rect, ydi.fromX, 150);
    dragTo(rect, ydi.samples[1].px, 150);
    release(rect);

    const points = pathPoints(guessPath(container)!.getAttribute('d') ?? '');
    // Far more vertices than the two samples: the path follows the pointer.
    expect(points.length).toBeGreaterThan(50);
    // Monotonic in x: still one y per x.
    for (let i = 1; i < points.length; i++) {
      expect(points[i].x).toBeGreaterThanOrEqual(points[i - 1].x);
    }
  });

  it('a backward sweep overwrites the stretch it crosses', () => {
    const onReveal = vi.fn();
    chart = createChart(container, makeSpec(), { onReveal });
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;
    const endX = ydi.samples[1].px;

    drawAt(rect, ydi.fromX, 120);
    dragTo(rect, endX, 120);
    dragTo(rect, ydi.fromX, 220);
    release(rect);
    chart.revealDrawing();

    const guess = onReveal.mock.calls[0][0] as Array<{ x: string | number; y: number }>;
    // 2020 sits at the turnaround (y 120); 2015 was overwritten by the return pass.
    const t = (endX - ydi.samples[0].px) / (endX - ydi.fromX);
    expect(guess[0].y).toBeCloseTo(pixelToData(ydi, 120 + t * 100), 1);
    expect(guess[1].y).toBeCloseTo(pixelToData(ydi, 120), 1);
  });

  it('starts the guess at the visible line end when the first press is near `from`', () => {
    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    expect(ydi.anchor).toBeDefined();
    const rect = overlay(container)!;

    drawAt(rect, ydi.fromX + 10, 250);
    release(rect);

    const points = pathPoints(guessPath(container)!.getAttribute('d') ?? '');
    expect(points[0].x).toBeCloseTo(ydi.fromX, 1);
    expect(points[0].y).toBeCloseTo(ydi.anchor!.y, 1);
  });

  it('a press left of `from` starts the stroke at the boundary', () => {
    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;
    // The overlay reaches a little left of `from` so near-misses still land.
    expect(Number.parseFloat(rect.getAttribute('x') ?? '0')).toBeLessThan(ydi.fromX);

    drawAt(rect, ydi.fromX - 8, 250);
    release(rect);

    const points = pathPoints(guessPath(container)!.getAttribute('d') ?? '');
    expect(points.length).toBeGreaterThan(0);
    expect(Math.min(...points.map((p) => p.x))).toBeGreaterThanOrEqual(ydi.fromX - 0.01);
  });

  it('does not invent a ramp from the line end when the first press is far right', () => {
    const onReveal = vi.fn();
    chart = createChart(container, makeSpec(), { onReveal });
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;

    drawAt(rect, ydi.samples[1].px, 200);
    release(rect);

    const points = pathPoints(guessPath(container)!.getAttribute('d') ?? '');
    expect(points[0].x).toBeGreaterThan(ydi.fromX + 40);

    chart.revealDrawing();
    const guess = onReveal.mock.calls[0][0] as Array<{ x: string | number }>;
    // 2015 was never drawn over, so it isn't reported.
    expect(guess.map((g) => g.x)).toEqual(['2020']);
  });

  it('clamps a guess drawn out of bounds to the plot area', () => {
    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;

    // Press far below the bottom of the area, away from the anchor.
    drawAt(rect, ydi.samples[1].px, ydi.area.y + ydi.area.height + 500);
    release(rect);

    const points = pathPoints(guessPath(container)!.getAttribute('d') ?? '');
    expect(points.length).toBeGreaterThan(0);
    // Clamped to the area's bottom edge, not the 500px overdraw.
    expect(points[0].y).toBeLessThanOrEqual(ydi.area.y + ydi.area.height + 0.01);
    expect(points[0].y).toBeGreaterThanOrEqual(ydi.area.y);
  });

  it('keeps the drawing in data space across a resize', () => {
    let width = 600;
    const resizable = document.createElement('div');
    Object.defineProperty(resizable, 'getBoundingClientRect', {
      value: () => ({
        width,
        height: 400,
        top: 0,
        left: 0,
        right: width,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(resizable);

    const onReveal = vi.fn();
    chart = createChart(resizable, makeSpec(), { onReveal });
    const before = chart.layout.youDrawIt!;
    const rect = overlay(resizable)!;
    drawAt(rect, before.fromX, 150);
    dragTo(rect, before.samples[1].px, 150);
    release(rect);
    const drawnValue = pixelToData(before, 150);

    width = 1200;
    chart.resize();
    const after = chart.layout.youDrawIt!;
    expect(after.fromX).not.toBeCloseTo(before.fromX, 0);

    // The path re-lays out against the new geometry.
    const points = pathPoints(guessPath(resizable)!.getAttribute('d') ?? '');
    expect(points[0].x).toBeCloseTo(after.fromX, 0);
    expect(points[points.length - 1].x).toBeCloseTo(after.samples[1].px, 0);

    chart.revealDrawing();
    const guess = onReveal.mock.calls[0][0] as Array<{ x: string | number; y: number }>;
    // Still reported in data coordinates, not stale pixels.
    expect(guess.map((g) => g.x)).toEqual(['2015', '2020']);
    for (const g of guess) expect(g.y).toBeCloseTo(drawnValue, 1);
  });

  it('shows a clear button once the reader has drawn, and clearing starts over', () => {
    chart = createChart(container, makeSpec({ youDrawIt: { from: '2010', resetLabel: 'Erase' } }));
    const ydi = chart.layout.youDrawIt!;
    const button = resetButton(container);
    expect(button.hidden).toBe(true);
    expect(button.textContent).toBe('Erase');
    expect(button.getAttribute('aria-label')).toBe('Erase your drawing');

    const rect = overlay(container)!;
    drawAt(rect, ydi.fromX, 150);
    dragTo(rect, ydi.samples[1].px, 180);
    release(rect);
    expect(button.hidden).toBe(false);

    button.click();

    expect(guessPath(container)!.getAttribute('d')).toBe('');
    expect(button.hidden).toBe(true);
    const reveal = container.querySelector('.oc-ydi-reveal-button') as HTMLButtonElement;
    expect(reveal.disabled).toBe(false);
    expect(document.activeElement).toBe(reveal);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Drawing cleared');

    // Drawing works again after clearing.
    drawAt(overlay(container)!, ydi.fromX, 150);
    release(overlay(container)!);
    expect(guessPath(container)!.getAttribute('d')).not.toBe('');
  });

  it('hides the clear button after reveal', () => {
    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;
    drawAt(rect, ydi.fromX, 150);
    release(rect);
    expect(resetButton(container).hidden).toBe(false);

    chart.revealDrawing();
    expect(resetButton(container).hidden).toBe(true);
  });

  it('reveals via the button and reports the guess to onReveal in data coordinates', () => {
    const onReveal = vi.fn();
    chart = createChart(container, makeSpec(), { onReveal });
    const samples = chart.layout.youDrawIt!.samples;
    const inv = chart.layout.youDrawIt!.yInvert!;
    const rect = overlay(container)!;

    // Tap at the top pixel of the area at the first sample.
    drawAt(rect, samples[0].px, inv.topPixel);
    release(rect);

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
    release(rect);

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
    release(overlay(container)!);
    chart.revealDrawing();
    expect(overlay(container)).toBeNull();

    chart.resetDrawing();

    // Guess cleared, overlay + prompt back, button re-enabled.
    expect(guessPath(container)!.getAttribute('d')).toBe('');
    expect(overlay(container)).not.toBeNull();
    const button = container.querySelector('.oc-ydi-reveal-button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('supports touch drawing through pointer events', () => {
    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;

    const touch = (type: string, x: number, y: number) =>
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
      });
    const down = touch('pointerdown', ydi.fromX, 120);
    rect.dispatchEvent(down);
    // Default prevented so the browser doesn't scroll or select mid-stroke.
    expect(down.defaultPrevented).toBe(true);
    rect.dispatchEvent(touch('pointermove', ydi.samples[1].px, 150));
    rect.dispatchEvent(touch('pointerup', ydi.samples[1].px, 150));

    const points = pathPoints(guessPath(container)!.getAttribute('d') ?? '');
    expect(points.length).toBeGreaterThan(2);
  });

  it('keeps an in-progress stroke going across a re-render', () => {
    const onReveal = vi.fn();
    chart = createChart(container, makeSpec(), { onReveal });
    const ydi = chart.layout.youDrawIt!;
    drawAt(overlay(container)!, ydi.fromX, 150);
    dragTo(overlay(container)!, ydi.samples[0].px, 150);

    // A re-render mid-drag (e.g. a theme flip) replaces the overlay.
    const before = overlay(container);
    chart.update(makeSpec());
    expect(overlay(container)).not.toBe(before);

    dragTo(overlay(container)!, ydi.samples[1].px, 150);
    release(overlay(container)!);
    chart.revealDrawing();

    const guess = onReveal.mock.calls[0][0] as Array<{ x: string | number }>;
    expect(guess.map((g) => g.x)).toEqual(['2015', '2020']);
  });

  it('ignores moves after the pointer is released', () => {
    chart = createChart(container, makeSpec());
    const ydi = chart.layout.youDrawIt!;
    const rect = overlay(container)!;
    drawAt(rect, ydi.fromX, 150);
    release(rect);
    const d = guessPath(container)!.getAttribute('d');

    dragTo(rect, ydi.samples[1].px, 250);
    expect(guessPath(container)!.getAttribute('d')).toBe(d);
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
