import { expect, it } from 'vitest';
import { renderStaticSVG } from '../static';

it('preserves the full y category in a title when a fixed gutter shortens its visible label', () => {
  const category = 'An exceptionally long category label';
  const svg = renderStaticSVG(
    {
      mark: 'bar',
      data: [{ category, value: 1 }],
      frame: { left: 36, right: 20 },
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
      },
    },
    { width: 330, height: 300 },
  );
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const title = [...document.querySelectorAll('.oc-axis-tick title')].find(
    (element) => element.textContent === category,
  );
  expect(title).toBeDefined();
  expect(title?.parentElement?.firstChild?.textContent).toMatch(/…$/);
});
