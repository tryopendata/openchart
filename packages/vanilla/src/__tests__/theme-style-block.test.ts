import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { buildThemeStyleBlock, injectThemeStyleBlock } from '../theme-style-block';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('buildThemeStyleBlock', () => {
  it('resolves every class-based chrome fill so exports survive detachment', () => {
    const css = buildThemeStyleBlock(resolveTheme());

    // These chrome elements take their fill from CSS classes, not inline attrs,
    // so they vanish in a serialized/rasterized export unless this block carries
    // them. Guard each one — a renderer that stops inlining a fill (as metrics
    // did) must be covered here.
    expect(css).toContain('.oc-metric-label');
    expect(css).toContain('.oc-metric-value');
    expect(css).toContain('.oc-metric-delta-up');
    expect(css).toContain('.oc-metric-delta-down');
    expect(css).toContain('.oc-brand-dot');
    expect(css).toContain('.oc-legend text');
    expect(css).toContain('.oc-endpoint-label');

    // The custom properties the rules reference must be defined on svg.oc-chart,
    // else the var() lookups resolve to nothing once detached from the page.
    expect(css).toMatch(/svg\.oc-chart\s*\{[^}]*--oc-text:/);
    expect(css).toMatch(/--oc-positive:/);
    expect(css).toMatch(/--oc-negative:/);
  });

  it('resolves --oc-text to a concrete color (no unresolved var references)', () => {
    const css = buildThemeStyleBlock(resolveTheme());
    // The default theme's text color is a hex, not a var() — the block must
    // carry a real value, not defer to a page variable that won't exist.
    expect(css).toMatch(/--oc-text:\s*#[0-9a-fA-F]/);
  });
});

describe('injectThemeStyleBlock', () => {
  function makeSvg(): SVGElement {
    return document.createElementNS(SVG_NS, 'svg');
  }

  it('adds a <style data-oc-theme> into <defs>', () => {
    const svg = makeSvg();
    injectThemeStyleBlock(svg, resolveTheme());

    const style = svg.querySelector('defs > style[data-oc-theme]');
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('.oc-metric-value');
  });

  it('creates <defs> when the SVG has none', () => {
    const svg = makeSvg();
    expect(svg.querySelector('defs')).toBeNull();
    injectThemeStyleBlock(svg, resolveTheme());
    expect(svg.querySelector('defs')).not.toBeNull();
  });

  it('is a no-op when theme is undefined', () => {
    const svg = makeSvg();
    injectThemeStyleBlock(svg, undefined);
    expect(svg.querySelector('style[data-oc-theme]')).toBeNull();
  });
});
