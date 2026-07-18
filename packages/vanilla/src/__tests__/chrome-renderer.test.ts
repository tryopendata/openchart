import type { MeasureTextFn, ResolvedChromeElement } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { renderChromeElement } from '../renderers/chrome';

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
