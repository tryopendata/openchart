/**
 * Font-race regression tests.
 *
 * On real devices the primary webfont (Inter via display=swap) swaps in after
 * first paint, changing text metrics. These tests cover the two halves of the
 * fix: the measurer honors the provided font family, and the mount recompiles
 * exactly once when a late FontFaceSet resolves.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { lineSpec } from '../__test-fixtures__/specs';
import { createMeasureText } from '../measure-text';
import { createChart } from '../mount';

// ---------------------------------------------------------------------------
// Canvas ctx stub: happy-dom's getContext returns null, so stub it to capture
// the font string createMeasureText writes.
// ---------------------------------------------------------------------------

interface FakeCtx {
  font: string;
  measureText(text: string): { width: number };
}

function stubCanvasContext(): FakeCtx {
  const ctx: FakeCtx = {
    font: '',
    measureText: (text: string) => ({ width: text.length * 7 }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  return ctx;
}

// ---------------------------------------------------------------------------
// Controllable FontFaceSet stub. check() reports the font missing; ready is a
// promise we resolve on demand to simulate a late font swap.
// ---------------------------------------------------------------------------

interface FakeFontFaceSet {
  check: () => boolean;
  ready: Promise<unknown>;
  resolveReady: () => void;
}

function makeFontFaceSet(loaded: boolean): FakeFontFaceSet {
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  return {
    check: () => loaded,
    ready,
    resolveReady,
  };
}

function installFonts(set: FakeFontFaceSet | undefined): void {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: set,
  });
}

describe('createMeasureText font family', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the provided font family in ctx.font', () => {
    const ctx = stubCanvasContext();
    const measure = createMeasureText('"My Font", Georgia, serif');

    measure('hello', 14, 600);

    expect(ctx.font).toBe('600 14px "My Font", Georgia, serif');
  });

  it('defaults to the Inter fallback stack when no family is given', () => {
    const ctx = stubCanvasContext();
    const measure = createMeasureText();

    measure('hi', 12);

    expect(ctx.font).toBe('400 12px Inter, sans-serif');
  });
});

describe('createChart font-load recompile', () => {
  let container: HTMLDivElement;
  const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFonts) {
      Object.defineProperty(document, 'fonts', originalFonts);
    } else {
      // happy-dom has no document.fonts by default; remove our stub.
      Object.defineProperty(document, 'fonts', { configurable: true, value: undefined });
    }
    document.body.innerHTML = '';
  });

  it('marks pending then ready and re-renders once when fonts resolve late', async () => {
    const fonts = makeFontFaceSet(false);
    installFonts(fonts);

    const chart = createChart(container, lineSpec);

    expect(container.dataset.ocFontsState).toBe('pending');
    const genBefore = Number(container.dataset.ocRenderGen);
    expect(genBefore).toBeGreaterThanOrEqual(1);

    fonts.resolveReady();
    await fonts.ready;
    // Let the .then() microtask flush.
    await Promise.resolve();

    expect(container.dataset.ocFontsState).toBe('ready');
    const genAfter = Number(container.dataset.ocRenderGen);
    expect(genAfter).toBe(genBefore + 1);

    chart.destroy();
  });

  it('marks ready immediately and does not re-render when fonts already loaded', async () => {
    const fonts = makeFontFaceSet(true);
    installFonts(fonts);

    const chart = createChart(container, lineSpec);

    expect(container.dataset.ocFontsState).toBe('ready');
    const genBefore = Number(container.dataset.ocRenderGen);

    fonts.resolveReady();
    await Promise.resolve();

    expect(Number(container.dataset.ocRenderGen)).toBe(genBefore);

    chart.destroy();
  });

  it('does not re-render after the chart is destroyed', async () => {
    const fonts = makeFontFaceSet(false);
    installFonts(fonts);

    const chart = createChart(container, lineSpec);
    expect(container.dataset.ocFontsState).toBe('pending');
    const genBefore = Number(container.dataset.ocRenderGen);

    chart.destroy();

    fonts.resolveReady();
    await fonts.ready;
    await Promise.resolve();

    // Destroyed chart must not bump the render generation.
    expect(Number(container.dataset.ocRenderGen)).toBe(genBefore);
  });
});
