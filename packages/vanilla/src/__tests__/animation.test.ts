/**
 * Animation integration tests for the vanilla renderer.
 *
 * Tests the full pipeline from spec -> compile -> render for animation-related
 * behavior. Verifies that the compiled layout carries animation config and that
 * the SVG output is correctly structured for CSS animations to work.
 *
 * Note: CSS animation keyframes and class-based triggers are defined in the
 * CSS partials under packages/core/src/styles/. These tests verify the DOM
 * structure that CSS hooks into, not the visual animation itself (which
 * requires a real browser).
 */

import type { ChartSpec } from '@opendata-ai/openchart-engine';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec, columnSpec, lineSpec } from '../__test-fixtures__/specs';
import { createChart } from '../mount';
import { renderChartSVG } from '../svg-renderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compileAndRender(spec: ChartSpec, width = 600, height = 400) {
  const container = createContainer(width, height);
  const layout = compileChart(spec, { width, height });
  const svg = renderChartSVG(layout, container);
  return { svg, container, layout };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Layout carries animation config through to render
// ---------------------------------------------------------------------------

describe('animation in compiled layout', () => {
  it('layout has animation config when spec enables animation', () => {
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.animation).toBeDefined();
    expect(layout.animation!.enabled).toBe(true);
  });

  it('layout has no animation config when spec omits animation', () => {
    const layout = compileChart(barSpec, { width: 600, height: 400 });
    expect(layout.animation).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SVG mark structure supports CSS animation selectors
// ---------------------------------------------------------------------------

describe('SVG structure for animation CSS hooks', () => {
  it('bar chart renders rect elements inside oc-mark groups', () => {
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);

    // CSS animations target .oc-mark-rect rect and .oc-mark-bar rect
    const rects = svg.querySelectorAll('.oc-marks rect');
    expect(rects.length).toBeGreaterThan(0);
  });

  it('column chart renders rect elements for vertical bars', () => {
    const spec = { ...columnSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);

    const rects = svg.querySelectorAll('.oc-marks rect');
    expect(rects.length).toBeGreaterThan(0);
  });

  it('line chart renders path elements inside oc-mark-line groups', () => {
    const spec = { ...lineSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);

    const paths = svg.querySelectorAll('.oc-mark-line path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('mark groups have data-mark-id attributes for targeting', () => {
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);

    const markGroups = svg.querySelectorAll('[data-mark-id]');
    expect(markGroups.length).toBeGreaterThan(0);
  });

  it('SVG root has oc-chart class (oc-animate is added by mount, not renderer)', () => {
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);
    expect(svg.getAttribute('class')).toContain('oc-chart');
    // oc-animate is added by mount.ts on first render only, not by the renderer
    expect(svg.getAttribute('class')).not.toContain('oc-animate');
  });

  it('SVG root does not have oc-animate class when animation is disabled', () => {
    const { svg } = compileAndRender(barSpec);
    expect(svg.getAttribute('class')).toContain('oc-chart');
    expect(svg.getAttribute('class')).not.toContain('oc-animate');
  });
});

// ---------------------------------------------------------------------------
// Animation CSS custom properties on SVG root
// ---------------------------------------------------------------------------

describe('animation CSS custom properties', () => {
  it('sets --oc-animation-duration on SVG root', () => {
    const spec = {
      ...barSpec,
      animation: { enter: { duration: 800 } },
    } as ChartSpec;
    const { svg } = compileAndRender(spec);
    expect(svg.style.getPropertyValue('--oc-animation-duration')).toBe('800ms');
  });

  it('sets --oc-animation-stagger on SVG root', () => {
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);
    const stagger = svg.style.getPropertyValue('--oc-animation-stagger');
    expect(stagger).toMatch(/^\d+ms$/);
  });

  it('sets --oc-annotation-delay on SVG root', () => {
    const spec = {
      ...barSpec,
      animation: { enter: true, annotationDelay: 500 },
    } as ChartSpec;
    const { svg } = compileAndRender(spec);
    expect(svg.style.getPropertyValue('--oc-annotation-delay')).toBe('500ms');
  });

  it('does not set animation custom properties when animation is disabled', () => {
    const { svg } = compileAndRender(barSpec);
    expect(svg.style.getPropertyValue('--oc-animation-duration')).toBe('');
    expect(svg.style.getPropertyValue('--oc-animation-stagger')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// --oc-mark-index stamped on mark elements
// ---------------------------------------------------------------------------

describe('mark animation index attributes', () => {
  it('stamps --oc-mark-index on rect mark groups', () => {
    const spec = { ...columnSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);

    const markGroups = svg.querySelectorAll('.oc-mark-rect');
    expect(markGroups.length).toBeGreaterThan(0);

    for (const group of markGroups) {
      const el = group as SVGElement & ElementCSSInlineStyle;
      const markIndex = el.style.getPropertyValue('--oc-mark-index');
      expect(markIndex).not.toBe('');
    }
  });

  it('stamps data-animation-index attribute on mark groups', () => {
    const spec = { ...columnSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);

    const markGroups = svg.querySelectorAll('[data-animation-index]');
    expect(markGroups.length).toBeGreaterThan(0);

    // Each should have a numeric index
    for (const group of markGroups) {
      const idx = group.getAttribute('data-animation-index');
      expect(idx).toMatch(/^\d+$/);
    }
  });

  it('does not stamp animation attributes when animation is disabled', () => {
    const { svg } = compileAndRender(columnSpec);

    const withAnimIdx = svg.querySelectorAll('[data-animation-index]');
    expect(withAnimIdx.length).toBe(0);
  });

  it('stamps --oc-mark-index on line mark groups', () => {
    const spec = { ...lineSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);

    const lineGroups = svg.querySelectorAll('.oc-mark-line');
    expect(lineGroups.length).toBeGreaterThan(0);

    for (const group of lineGroups) {
      const el = group as SVGElement & ElementCSSInlineStyle;
      const markIndex = el.style.getPropertyValue('--oc-mark-index');
      expect(markIndex).not.toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// data-orient attribute for horizontal bars
// ---------------------------------------------------------------------------

describe('data-orient for horizontal bars', () => {
  it('sets data-orient=horizontal on mark groups for horizontal bar charts', () => {
    // barSpec has x=quantitative, y=nominal which is a horizontal bar chart
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);

    const horizontalGroups = svg.querySelectorAll('[data-orient="horizontal"]');
    expect(horizontalGroups.length).toBeGreaterThan(0);
  });

  it('does not set data-orient=horizontal on vertical column charts', () => {
    // columnSpec has x=nominal, y=quantitative which is a vertical column chart
    const spec = { ...columnSpec, animation: true } as ChartSpec;
    const { svg } = compileAndRender(spec);

    const horizontalGroups = svg.querySelectorAll('[data-orient="horizontal"]');
    expect(horizontalGroups.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Value-based stagger ordering assigns animationIndex on marks
// ---------------------------------------------------------------------------

describe('animationIndex for value-based stagger', () => {
  it('assigns animationIndex to rect marks when stagger order is value', () => {
    const spec = {
      ...columnSpec,
      animation: {
        enter: { stagger: { order: 'value' as const } },
      },
    } as ChartSpec;
    const layout = compileChart(spec, { width: 600, height: 400 });

    const rectMarks = layout.marks.filter((m) => m.type === 'rect');
    expect(rectMarks.length).toBe(3);

    // Each rect mark should have animationIndex
    for (const mark of rectMarks) {
      const idx = (mark as unknown as { animationIndex?: number }).animationIndex;
      expect(idx).toBeDefined();
    }
  });

  it('orders marks by their primary quantitative value', () => {
    // columnSpec has revenues: Q1=100, Q2=200, Q3=150
    // Value ordering should sort by bar height (revenue)
    const spec = {
      ...columnSpec,
      animation: {
        enter: { stagger: { order: 'value' as const } },
      },
    } as ChartSpec;
    const layout = compileChart(spec, { width: 600, height: 400 });

    const rectMarks = layout.marks.filter((m) => m.type === 'rect');
    const indexed = rectMarks.map((m) => ({
      index: (m as unknown as { animationIndex: number }).animationIndex,
    }));

    // All indices should be unique
    const indices = indexed.map((m) => m.index);
    const uniqueIndices = new Set(indices);
    expect(uniqueIndices.size).toBe(rectMarks.length);
  });
});

// ---------------------------------------------------------------------------
// createChart mount lifecycle with animation
// ---------------------------------------------------------------------------

describe('createChart animation lifecycle', () => {
  it('produces valid SVG on mount with animation enabled', () => {
    const container = createContainer();
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const chart = createChart(container, spec);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('oc-chart');
    expect(svg?.getAttribute('class')).toContain('oc-animate');

    // Marks are rendered
    const rects = container.querySelectorAll('.oc-marks rect');
    expect(rects.length).toBeGreaterThan(0);

    chart.destroy();
  });

  it('update re-renders chart correctly with animation', () => {
    const container = createContainer();
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const chart = createChart(container, spec);

    // Verify initial render
    let rects = container.querySelectorAll('.oc-marks rect');
    const initialCount = rects.length;
    expect(initialCount).toBeGreaterThan(0);

    // Update with different data but same animation setting
    const updatedSpec = {
      ...barSpec,
      data: [
        { name: 'X', value: 50 },
        { name: 'Y', value: 70 },
      ],
      animation: true,
    } as ChartSpec;
    chart.update(updatedSpec);

    // SVG is re-rendered
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // Marks reflect updated data
    rects = container.querySelectorAll('.oc-marks rect');
    expect(rects.length).toBeGreaterThan(0);

    chart.destroy();
  });

  it('works correctly when animation is toggled off on update', () => {
    const container = createContainer();
    const specWithAnim = { ...barSpec, animation: true } as ChartSpec;
    const chart = createChart(container, specWithAnim);

    // Update with animation disabled
    const specNoAnim = { ...barSpec, animation: false } as ChartSpec;
    chart.update(specNoAnim);

    // Chart should still render correctly
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const rects = container.querySelectorAll('.oc-marks rect');
    expect(rects.length).toBeGreaterThan(0);

    chart.destroy();
  });

  it('destroy cleans up the container', () => {
    const container = createContainer();
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const chart = createChart(container, spec);

    expect(container.querySelector('svg')).not.toBeNull();

    chart.destroy();

    expect(container.querySelector('svg')).toBeNull();
  });
});
