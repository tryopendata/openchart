import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { createBarList } from '../barlist-mount';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

// animation: false because barlist normalization defaults animation on, and
// an entrance animation defers resize() until its cleanup timer fires.
const basicSpec = {
  type: 'barlist' as const,
  animation: false as const,
  data: [
    { name: 'Alpha', value: 40, region: 'West' },
    { name: 'Beta', value: 100, region: 'East' },
    { name: 'Gamma', value: 70, region: 'West' },
  ],
  encoding: {
    label: { field: 'name', type: 'nominal' as const },
    value: { field: 'value', type: 'quantitative' as const },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createBarList', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts an SVG with barlist classes into the container', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('oc-barlist')).toBe(true);
    expect(container.classList.contains('oc-barlist-root')).toBe(true);

    instance.destroy();
  });

  it('renders a row with label, value, track, and bar for each data row', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });

    const rows = container.querySelectorAll('.oc-barlist-row');
    expect(rows).toHaveLength(3);

    const first = rows[0];
    expect(first.querySelectorAll('.oc-barlist-track')).toHaveLength(1);
    expect(first.querySelectorAll('.oc-barlist-bar')).toHaveLength(1);

    const text = container.textContent ?? '';
    expect(text).toContain('Alpha');
    expect(text).toContain('Beta');
    expect(text).toContain('Gamma');

    instance.destroy();
  });

  it('sorts rows descending by value', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });

    const labels = instance.layout.rows.map((r) => r.label.text);
    expect(labels).toEqual(['Beta', 'Gamma', 'Alpha']);

    instance.destroy();
  });

  it('maxItems caps the number of rendered rows', () => {
    const instance = createBarList(container, { ...basicSpec, maxItems: 2 }, { responsive: false });

    expect(container.querySelectorAll('.oc-barlist-row')).toHaveLength(2);
    expect(instance.layout.rows).toHaveLength(2);

    instance.destroy();
  });

  it('valueFormat formats value labels', () => {
    const instance = createBarList(
      container,
      { ...basicSpec, valueFormat: '$,.0f' },
      { responsive: false },
    );

    const values = instance.layout.rows.map((r) => r.valueLabel.text);
    expect(values).toContain('$100');
    expect(container.textContent).toContain('$100');

    instance.destroy();
  });

  it('renders chrome title text', () => {
    const instance = createBarList(
      container,
      { ...basicSpec, chrome: { title: 'Top Things' } },
      { responsive: false },
    );

    const title = container.querySelector('.oc-title');
    expect(title?.textContent).toBe('Top Things');

    instance.destroy();
  });

  it('renders the watermark link when enabled', () => {
    const instance = createBarList(container, basicSpec, {
      responsive: false,
      watermark: true,
    });

    expect(container.querySelector('.oc-chrome-ref')).not.toBeNull();

    instance.destroy();
  });

  it('auto-sizes height down to content for few rows', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });

    // Container is 600x400; three rows should not need the full height.
    expect(instance.layout.height).toBeLessThan(400);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(Number.parseFloat(svg.style.height)).toBeCloseTo(instance.layout.height, 1);

    instance.destroy();
  });

  it('renders an empty list without throwing when no row has a numeric value', () => {
    const instance = createBarList(
      container,
      { ...basicSpec, data: [{ name: 'X', value: null }] },
      { responsive: false },
    );

    expect(container.querySelector('svg')).not.toBeNull();
    expect(instance.layout.rows).toHaveLength(0);
    expect(container.querySelectorAll('.oc-barlist-row')).toHaveLength(0);

    instance.destroy();
  });

  it('update() re-renders with new data', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });
    expect(container.dataset.ocRenderGen).toBe('1');

    instance.update({
      ...basicSpec,
      data: [
        { name: 'Delta', value: 5 },
        { name: 'Epsilon', value: 9 },
      ],
    });

    expect(container.dataset.ocRenderGen).toBe('2');
    expect(container.querySelectorAll('.oc-barlist-row')).toHaveLength(2);
    expect(container.textContent).toContain('Delta');
    expect(container.textContent).not.toContain('Alpha');
    // Only one SVG mounted at a time
    expect(container.querySelectorAll('svg')).toHaveLength(1);

    instance.destroy();
  });

  it('update() with a new theme font rebuilds the measurer and still renders', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });

    instance.update({
      ...basicSpec,
      theme: { fonts: { family: 'Georgia, serif' } },
    });

    expect(container.querySelectorAll('.oc-barlist-row')).toHaveLength(3);
    expect(instance.layout.theme.fonts.family).toContain('Georgia');

    instance.destroy();
  });

  it('options.theme font wins over spec theme font', () => {
    const instance = createBarList(
      container,
      { ...basicSpec, theme: { fonts: { family: 'Georgia, serif' } } },
      { responsive: false, theme: { fonts: { family: 'Courier, monospace' } } },
    );

    expect(instance.layout.theme.fonts.family).toContain('Courier');

    instance.destroy();
  });

  it('resize() recompiles and re-renders', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });
    expect(container.dataset.ocRenderGen).toBe('1');

    instance.resize();

    expect(container.dataset.ocRenderGen).toBe('2');
    expect(container.querySelectorAll('svg')).toHaveLength(1);

    instance.destroy();
  });

  it('destroy() removes the SVG and container classes', () => {
    const instance = createBarList(container, basicSpec, {
      responsive: false,
      darkMode: 'force',
    });

    expect(container.querySelector('svg')).not.toBeNull();

    instance.destroy();

    expect(container.querySelector('svg')).toBeNull();
    expect(container.classList.contains('oc-barlist-root')).toBe(false);
    expect(container.classList.contains('oc-dark')).toBe(false);

    // Double destroy and post-destroy resize are safe no-ops
    instance.destroy();
    instance.resize();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('darkMode "force" adds the oc-dark class, default does not', () => {
    const dark = createBarList(container, basicSpec, { responsive: false, darkMode: 'force' });
    expect(container.classList.contains('oc-dark')).toBe(true);
    dark.destroy();

    const light = createBarList(container, basicSpec, { responsive: false });
    expect(container.classList.contains('oc-dark')).toBe(false);
    light.destroy();
  });

  it('marks fonts state ready when no webfont reload is pending', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });

    expect(container.dataset.ocFontsState).toBe('ready');

    instance.destroy();
  });

  it('default responsive mode installs a resize observer without errors', () => {
    const instance = createBarList(container, basicSpec);

    expect(container.querySelector('svg')).not.toBeNull();

    instance.destroy();
  });

  it('export("svg") returns serialized SVG; unknown format and post-destroy return ""', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });

    const svgString = instance.export('svg') as string;
    expect(typeof svgString).toBe('string');
    expect(svgString).toContain('<svg');
    expect(svgString).toContain('oc-barlist');

    expect(instance.export('bogus' as 'svg')).toBe('');

    instance.destroy();
    expect(instance.export('svg')).toBe('');
  });

  it('export("png") and export("jpg") return promises', () => {
    const instance = createBarList(container, basicSpec, { responsive: false });

    const png = instance.export('png');
    const jpg = instance.export('jpg', { quality: 0.8 });
    const withFonts = instance.export('svg-with-fonts');
    expect(png).toBeInstanceOf(Promise);
    expect(jpg).toBeInstanceOf(Promise);
    expect(withFonts).toBeInstanceOf(Promise);
    // happy-dom has no real canvas/Image/font pipeline; swallow rejections
    (png as Promise<Blob>).catch(() => {});
    (jpg as Promise<Blob>).catch(() => {});
    (withFonts as Promise<string>).catch(() => {});

    instance.destroy();
  });

  it('recompiles once webfonts finish loading', async () => {
    const fontsStub = {
      check: () => false,
      ready: Promise.resolve(),
    };
    const originalFonts = Object.getOwnPropertyDescriptor(Document.prototype, 'fonts');
    Object.defineProperty(document, 'fonts', { value: fontsStub, configurable: true });

    try {
      const instance = createBarList(
        container,
        { ...basicSpec, theme: { fonts: { family: 'Inter, sans-serif' } } },
        { responsive: false },
      );

      expect(container.dataset.ocFontsState).toBe('pending');
      expect(container.dataset.ocRenderGen).toBe('1');

      // Let fonts.ready resolve: the owed recompile renders and flips the flag
      await fontsStub.ready;
      await Promise.resolve();

      expect(container.dataset.ocFontsState).toBe('ready');
      expect(container.dataset.ocRenderGen).toBe('2');

      instance.destroy();
    } finally {
      Reflect.deleteProperty(document, 'fonts');
      if (originalFonts) {
        Object.defineProperty(Document.prototype, 'fonts', originalFonts);
      }
    }
  });

  describe('tooltip and interaction', () => {
    it('shows the tooltip on mouseenter/mousemove and hides on mouseleave', () => {
      const instance = createBarList(container, basicSpec, { responsive: false });

      const row = container.querySelector('.oc-barlist-row') as SVGGElement;
      row.dispatchEvent(createMouseEvent('mouseenter', 150, 60));

      const tooltip = container.querySelector('.oc-tooltip') as HTMLDivElement;
      expect(tooltip).not.toBeNull();
      expect(tooltip.style.display).toBe('block');

      row.dispatchEvent(createMouseEvent('mousemove', 160, 65));
      expect(tooltip.style.display).toBe('block');

      row.dispatchEvent(createMouseEvent('mouseleave'));
      expect(tooltip.style.display).not.toBe('block');

      instance.destroy();
    });

    it('tooltip: false skips tooltip creation entirely', () => {
      const instance = createBarList(container, basicSpec, {
        responsive: false,
        tooltip: false,
      });

      const row = container.querySelector('.oc-barlist-row') as SVGGElement;
      row.dispatchEvent(createMouseEvent('mouseenter', 150, 60));

      expect(container.querySelector('.oc-tooltip')).toBeNull();

      instance.destroy();
    });

    it('onRowClick fires with label, value, and source data', () => {
      const onRowClick = vi.fn();
      const instance = createBarList(container, basicSpec, {
        responsive: false,
        onRowClick,
      });

      // First rendered row is the highest value (Beta)
      const row = container.querySelector('.oc-barlist-row') as SVGGElement;
      row.dispatchEvent(createMouseEvent('click'));

      expect(onRowClick).toHaveBeenCalledTimes(1);
      expect(onRowClick).toHaveBeenCalledWith({
        label: 'Beta',
        value: 100,
        data: { name: 'Beta', value: 100, region: 'East' },
      });

      instance.destroy();
    });

    it('onRowHover fires with the row on enter and null on leave', () => {
      const onRowHover = vi.fn();
      const instance = createBarList(container, basicSpec, {
        responsive: false,
        onRowHover,
      });

      const row = container.querySelector('.oc-barlist-row') as SVGGElement;
      row.dispatchEvent(createMouseEvent('mouseenter', 150, 60));
      expect(onRowHover).toHaveBeenLastCalledWith(
        expect.objectContaining({ label: 'Beta', value: 100 }),
      );

      row.dispatchEvent(createMouseEvent('mouseleave'));
      expect(onRowHover).toHaveBeenLastCalledWith(null);

      instance.destroy();
    });

    it('interaction listeners are removed on destroy', () => {
      const onRowClick = vi.fn();
      const instance = createBarList(container, basicSpec, {
        responsive: false,
        onRowClick,
      });

      const row = container.querySelector('.oc-barlist-row') as SVGGElement;
      instance.destroy();
      row.dispatchEvent(createMouseEvent('click'));

      expect(onRowClick).not.toHaveBeenCalled();
    });
  });

  describe('animation lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('animated mount adds oc-animate, defers resize, and removes oc-animate on completion', () => {
      const instance = createBarList(
        container,
        { ...basicSpec, animation: true },
        { responsive: false },
      );

      const svg = container.querySelector('svg') as SVGSVGElement;
      expect(svg.classList.contains('oc-animate')).toBe(true);
      expect(container.dataset.ocRenderGen).toBe('1');

      // Resize during the entrance animation is deferred
      instance.resize();
      expect(container.dataset.ocRenderGen).toBe('1');

      // Let the cleanup timer fire: oc-animate is removed, SVG stays mounted,
      // and the deferred resize replays (onComplete nulls animationCleanup
      // BEFORE calling resize(), so the replay clears the in-flight gate).
      vi.advanceTimersByTime(10_000);
      const svgAfter = container.querySelector('svg') as SVGSVGElement;
      expect(svgAfter).not.toBeNull();
      expect(svgAfter.classList.contains('oc-animate')).toBe(false);
      expect(container.dataset.ocRenderGen).toBe('2');

      instance.destroy();
    });

    it('update() during the entrance animation cancels it and re-renders without oc-animate', () => {
      const instance = createBarList(
        container,
        { ...basicSpec, animation: true },
        { responsive: false },
      );

      instance.update({ ...basicSpec, animation: true, data: [{ name: 'Solo', value: 1 }] });

      const svg = container.querySelector('svg') as SVGSVGElement;
      expect(svg.classList.contains('oc-animate')).toBe(false);
      expect(container.textContent).toContain('Solo');

      instance.destroy();
    });

    it('destroy() during the entrance animation cancels cleanly', () => {
      const instance = createBarList(
        container,
        { ...basicSpec, animation: true },
        { responsive: false },
      );

      instance.destroy();
      expect(container.querySelector('svg')).toBeNull();

      // Timer was cleared; advancing must not throw or resurrect anything
      vi.advanceTimersByTime(10_000);
      expect(container.querySelector('svg')).toBeNull();
    });
  });
});
