import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { SVG_NS } from '../renderers/svg-dom';
import { __renderStaticParts, renderStaticSVG } from '../static';
import { GEOMETRY_ATTRIBUTES, roundGeometryValue } from '../static-dom';
import { staticPlatformSpecs } from './__fixtures__/static-platform-specs';

describe('static element tree serialization parity', () => {
  for (const [name, spec] of Object.entries(staticPlatformSpecs))
    for (const darkMode of ['off', 'force'] as const)
      it(`${name} ${darkMode}`, () => {
        const win = new Window();
        try {
          const opts = {
            darkMode,
            idPrefix: name,
            precision: 3,
            width: name === 'legend-notes' ? 330 : 640,
          };
          const { svg } = __renderStaticParts(spec, opts, {
            svg: (tag) => win.document.createElementNS(SVG_NS, tag) as unknown as SVGElement,
            html: (tag) => win.document.createElement(tag) as unknown as HTMLElement,
            text: (data) => win.document.createTextNode(data) as unknown as Text,
          });
          for (const el of [svg, ...svg.querySelectorAll('*')])
            for (const attr of Array.from(el.attributes))
              if (GEOMETRY_ATTRIBUTES.has(attr.name))
                el.setAttribute(attr.name, roundGeometryValue(attr.value, 3));
          let legacy = new win.XMLSerializer()
            .serializeToString(svg as never)
            .replaceAll('&nbsp;', '\u00a0');
          // happy-dom omits the namespace declaration for namespaced xlink attributes.
          if (legacy.includes('xlink:href') && !legacy.includes('xmlns:xlink'))
            legacy = legacy.replace(
              'xmlns="http://www.w3.org/2000/svg"',
              'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"',
            );
          const actual = renderStaticSVG(spec, opts);
          const diff = [...actual].findIndex((value, i) => legacy[i] !== value);
          if (actual !== legacy)
            throw new Error(
              `First difference ${diff}: legacy=${legacy.slice(Math.max(0, diff - 80), diff + 180)} actual=${actual.slice(Math.max(0, diff - 80), diff + 180)}`,
            );
          expect(actual).toBe(legacy);
        } finally {
          win.close();
        }
      });
});
