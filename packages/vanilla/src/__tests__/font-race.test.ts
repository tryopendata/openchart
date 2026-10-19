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

  it.each([
    false,
    true,
  ])('measures the effective root font through updates (nested=%s)', (nested) => {
    installFonts(makeFontFaceSet(true));
    const ctx = stubCanvasContext();
    // Without a layer theme the first leaf's theme owns the root.
    const spec = (family: string, parent?: string) => ({
      ...(parent ? { theme: { fonts: { family: parent } } } : {}),
      layer: nested
        ? [{ layer: [{ ...lineSpec, theme: { fonts: { family } } }] }]
        : [{ ...lineSpec, theme: { fonts: { family } } }],
    });
    for (const hostFamily of [undefined, 'HostFont']) {
      const chart = createChart(container, spec('LeafFont'), {
        theme: hostFamily ? { fonts: { family: hostFamily } } : undefined,
      });
      expect(chart.layout.theme.fonts.family).toBe(hostFamily ?? 'LeafFont');
      expect(ctx.font).toContain(hostFamily ?? 'LeafFont');
      chart.update(spec('NextLeafFont'));
      expect(chart.layout.theme.fonts.family).toBe(hostFamily ?? 'NextLeafFont');
      expect(ctx.font).toContain(hostFamily ?? 'NextLeafFont');
      // A layer theme owns the root whole, ahead of the leaf.
      chart.update(spec('NextLeafFont', 'ParentFont'));
      expect(chart.layout.theme.fonts.family).toBe(hostFamily ?? 'ParentFont');
      expect(ctx.font).toContain(hostFamily ?? 'ParentFont');
      chart.destroy();
    }
  });

  it.each([
    undefined,
    'HostFont',
  ])('restores host font measurement after removing a leaf theme (%s)', (hostFont) => {
    const fonts = makeFontFaceSet(false);
    const check = vi.fn(() => false);
    fonts.check = check;
    installFonts(fonts);
    const ctx = stubCanvasContext();
    const defaults = document.createElement('style');
    defaults.textContent = '.oc-root { --oc-font-family: Inter, sans-serif; }';
    document.body.appendChild(defaults);
    if (hostFont) container.style.setProperty('--oc-font-family', hostFont);
    const chart = createChart(container, {
      layer: [{ ...lineSpec, animation: false, theme: { fonts: { family: 'LeafFont' } } }],
    });
    chart.update({ layer: [{ ...lineSpec, animation: false }] });
    expect(ctx.font).toContain(hostFont ?? 'Inter');
    expect(ctx.font).not.toContain('LeafFont');
    expect(check).toHaveBeenLastCalledWith(`12px "${hostFont ?? 'Inter'}"`);
    expect(container.style.getPropertyValue('--oc-font-family')).toBe(hostFont ?? '');
    chart.destroy();
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

  it('watches the updated leaf font and ignores the superseded font reload', async () => {
    const fonts = makeFontFaceSet(false);
    const check = vi.fn(() => false);
    fonts.check = check;
    installFonts(fonts);
    stubCanvasContext();
    const spec = (family: string) => ({
      layer: [{ ...lineSpec, animation: false, theme: { fonts: { family } } }],
    });
    const chart = createChart(container, spec('FirstLeaf'));
    chart.update(spec('SecondLeaf'));
    expect(check).toHaveBeenLastCalledWith('12px "SecondLeaf"');
    const before = Number(container.dataset.ocRenderGen);
    fonts.resolveReady();
    await fonts.ready;
    await Promise.resolve();
    expect(container.dataset.ocFontsState).toBe('ready');
    expect(Number(container.dataset.ocRenderGen)).toBe(before + 1);
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

  it('defers ready until the post-animation recompile, not the deferred resize', async () => {
    // Entrance animation running -> resize() defers to pendingResize. The
    // fonts-ready flip must wait for the recompile that actually happens on the
    // pendingResize replay, so 'ready' never claims final-font layout early.
    vi.useFakeTimers();
    try {
      const fonts = makeFontFaceSet(false);
      installFonts(fonts);

      const animatedSpec = { ...lineSpec, animation: true as const };
      const chart = createChart(container, animatedSpec);
      expect(container.dataset.ocFontsState).toBe('pending');
      const genBefore = Number(container.dataset.ocRenderGen);

      fonts.resolveReady();
      await fonts.ready;
      await Promise.resolve();

      // resize() deferred (animation in flight): no recompile yet, still pending.
      expect(container.dataset.ocRenderGen).toBe(String(genBefore));
      expect(container.dataset.ocFontsState).toBe('pending');

      // Animation completes -> pendingResize replays -> recompile -> ready.
      vi.runAllTimers();
      expect(Number(container.dataset.ocRenderGen)).toBe(genBefore + 1);
      expect(container.dataset.ocFontsState).toBe('ready');

      chart.destroy();
    } finally {
      vi.useRealTimers();
    }
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
