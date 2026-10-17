import type { ChartSpec, MeasureTextFn, ResolvedChromeElement } from '@opendata-ai/openchart-core';
import { broadsheet } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { renderChrome, renderChromeElement } from '../renderers/chrome';
import { renderStaticSVG } from '../static';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Deterministic monospace-style measure so wrapping is independent of the
// happy-dom font heuristic: every character is 10px wide at any size.
const measureText: MeasureTextFn = (text: string) => ({ width: text.length * 10 });

function makeElement(overrides: Partial<ResolvedChromeElement>): ResolvedChromeElement {
  return {
    text: '',
    x: 0,
    y: 0,
    maxWidth: 100,
    style: {
      fontFamily: 'sans-serif',
      fontSize: 16,
      fontWeight: 700,
      fill: '#000',
      lineHeight: 1.3,
      textAnchor: 'start',
    },
    ...overrides,
  };
}

describe('renderChromeElement maxLines truncation', () => {
  it('caps a long title to maxLines tspans and ellipsizes the last line', () => {
    const parent = document.createElementNS(SVG_NS, 'g');
    const element = makeElement({
      text: 'Global Economic Recovery Trends Show Surprising Resilience Across Major Markets',
      maxWidth: 100, // ~10 chars per line at 10px/char
      maxLines: 2,
    });

    renderChromeElement(parent, element, 'oc-title', 'title', measureText);

    const text = parent.querySelector('text');
    expect(text).not.toBeNull();
    const tspans = text!.querySelectorAll('tspan');
    expect(tspans.length).toBe(2);
    expect(tspans[1].textContent?.endsWith('…')).toBe(true);
    // The last line carries exactly one ellipsis, not a doubled '……' from the
    // truncation helper appending to an already-ellipsized string.
    expect(tspans[1].textContent?.endsWith('……')).toBe(false);
  });

  it('does not truncate when the wrapped output is within maxLines', () => {
    const parent = document.createElementNS(SVG_NS, 'g');
    const element = makeElement({
      text: 'Short title',
      maxWidth: 1000, // fits on one line
      maxLines: 2,
    });

    renderChromeElement(parent, element, 'oc-title', 'title', measureText);

    const text = parent.querySelector('text');
    expect(text!.textContent).toBe('Short title');
    expect(text!.querySelectorAll('tspan').length).toBe(0);
    expect(text!.textContent?.endsWith('…')).toBe(false);
  });
});

describe('editorial rule', () => {
  const spec: ChartSpec = {
    mark: 'bar',
    data: [
      { x: 'A', y: 3 },
      { x: 'B', y: 5 },
    ],
    encoding: {
      x: { field: 'x', type: 'nominal' },
      y: { field: 'y', type: 'quantitative' },
    },
    chrome: { eyebrow: 'Kicker', title: 'A Headline', subtitle: 'A subtitle' },
  };

  it('draws an oc-chrome-rule rect in the theme rule color', () => {
    const svg = renderStaticSVG({ ...spec, theme: broadsheet }, { width: 640, height: 420 });
    expect(svg).toContain('class="oc-chrome-rule"');
    expect(svg).toContain('fill="#e3120b"');
    expect(svg).toContain('height="3"');
  });

  it('draws nothing when the theme has no rule', () => {
    const svg = renderStaticSVG(spec, { width: 640, height: 420 });
    expect(svg).not.toContain('oc-chrome-rule');
  });
});

it('uses the engine note lines for rendering, footer spacing, and static export', () => {
  const spec: ChartSpec = {
    mark: 'line',
    data: [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ],
    encoding: { x: { field: 'x', type: 'ordinal' }, y: { field: 'y', type: 'quantitative' } },
    chrome: { source: 'Source' },
    annotations: [0, 1].map((x) => ({
      type: 'text',
      id: `note-${x}`,
      x,
      y: x + 1,
      text: 'A very long callout heading that must become a note',
      subtitle: 'A subtitle that should wrap without overlapping the next note or the source row.',
    })),
  };
  const layout = compileChart(spec, { width: 292, height: 500 });
  const parent = document.createElementNS(SVG_NS, 'g');
  renderChrome(parent, layout);
  const notes = [...parent.querySelectorAll('.oc-footnotes')];
  expect(notes.length).toBeGreaterThan(0);
  let previousBottom = 0;
  for (const [i, note] of notes.entries()) {
    const resolved = layout.chrome.footnotes![i];
    expect([...note.querySelectorAll('tspan')].map((span) => span.textContent)).toEqual(
      resolved.lines,
    );
    expect(note.getAttribute('data-note-id')).toBe(resolved.id);
    const top = Number(note.getAttribute('y'));
    expect(top).toBeGreaterThan(previousBottom);
    previousBottom = top + (resolved.lines!.length - 1) * layout.theme.fonts.sizes.small * 1.3;
  }
  expect(Number(parent.querySelector('.oc-source')!.getAttribute('y'))).toBeGreaterThan(
    previousBottom,
  );
  const svg = renderStaticSVG(spec, { width: 292, height: 500 });
  const exported = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(
    [...exported.querySelectorAll('.oc-footnotes tspan')].map((span) => span.textContent),
  ).toEqual([...parent.querySelectorAll('.oc-footnotes tspan')].map((span) => span.textContent));
});
