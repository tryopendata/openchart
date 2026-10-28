import { describe, expect, it } from 'vitest';
import { renderStaticSVG } from '../static';
import { siteSpecs } from './__fixtures__/static-specs';

// These 13 figures and cells are the consuming site's byte contract.
describe('consuming site standalone SVG goldens', () => {
  for (const [name, spec] of Object.entries(siteSpecs)) {
    for (const darkMode of ['off', 'force'] as const) {
      it(`${name} ${darkMode}`, async () => {
        expect(globalThis.document).toBeUndefined();
        const cell = name.endsWith('Cell');
        const svg = renderStaticSVG(spec, {
          darkMode,
          idPrefix: `site-${name}-${darkMode}`,
          width: cell ? 120 : 680,
          height: cell ? 16 : 320,
        });
        if (cell) expect(svg).toContain('viewBox="0 0 120 16"');
        await expect(svg).toMatchFileSnapshot(
          `./__snapshots__/static/site-${name}-${darkMode}.svg`,
        );
      });
    }
  }
});
