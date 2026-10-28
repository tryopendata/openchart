import { describe, expect, it, vi } from 'vitest';
import { renderStaticSVG } from '../static';
import {
  chromeSpec,
  legendNotesSpec,
  staticPlatformSpecs,
} from './__fixtures__/static-platform-specs';

const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');
describe('static output contract', () => {
  for (const [name, spec] of Object.entries(staticPlatformSpecs))
    for (const darkMode of ['off', 'force'] as const) {
      it(`${name} ${darkMode} matches its standalone SVG`, async () => {
        await expect(
          renderStaticSVG(spec, {
            darkMode,
            idPrefix: name,
            precision: 3,
            width: name === 'legend-notes' ? 330 : 640,
          }),
        ).toMatchFileSnapshot(`./__snapshots__/static/${name}-${darkMode}.svg`);
      });
    }
  it('keeps note markers without interactive affordances', () => {
    const doc = parse(renderStaticSVG(legendNotesSpec, { width: 330 }));
    expect(doc.querySelectorAll('[tabindex], [role="button"], .oc-animate, animate')).toHaveLength(
      0,
    );
    expect(doc.querySelectorAll('[data-note-marker-index]').length).toBeGreaterThan(0);
  });
  it('names the theme and gives prefixed roots a stable id', () => {
    const dark = parse(
      renderStaticSVG(chromeSpec, { darkMode: 'force', idPrefix: 'figure' }),
    ).documentElement;
    expect(dark.getAttribute('data-theme')).toBe('dark');
    expect(dark.id).toBe('figure-oc-root');
    expect(parse(renderStaticSVG(chromeSpec)).documentElement.hasAttribute('id')).toBe(false);
  });
  it('forwards font metrics and rounds only geometry', () => {
    const measureText = vi.fn((text: string, size: number) => ({
      width: (text.length * size) / 2,
      height: size,
    }));
    const rounded = renderStaticSVG(chromeSpec, { measureText, precision: 3 });
    expect(measureText).toHaveBeenCalled();
    expect(renderStaticSVG(chromeSpec, { precision: null })).not.toEqual(rounded);
    for (const el of parse(rounded).querySelectorAll('*'))
      for (const attr of Array.from(el.attributes)) {
        if (
          /^(x|y|x1|y1|x2|y2|width|height|r|rx|ry|cx|cy|dx|dy|d|points|transform|viewBox)$/.test(
            attr.name,
          )
        )
          expect(attr.value).not.toMatch(/\d+\.\d{4}/);
      }
  });
});
