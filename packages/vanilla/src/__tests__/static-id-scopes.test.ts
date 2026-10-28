import { expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { geoLabelSpec } from '../__test-fixtures__/geo-label-spec';
import { lineSpec } from '../__test-fixtures__/specs';
import { createGeoMap } from '../map-mount';
import { createChart } from '../mount';
import { createSankey } from '../sankey-mount';
import { renderStaticSVG } from '../static';

it('keeps all live figure ids disjoint across charts, maps and sankeys around static renders', () => {
  const sankey = {
    type: 'sankey' as const,
    data: [{ from: 'A', to: 'B', amount: 10 }],
    encoding: {
      source: { field: 'from', type: 'nominal' as const },
      target: { field: 'to', type: 'nominal' as const },
      value: { field: 'amount', type: 'quantitative' as const },
    },
  };
  const instances: Array<{ destroy(): void }> = [];
  const containers: HTMLElement[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      for (const kind of ['chart', 'map', 'sankey']) {
        const container = createContainer();
        containers.push(container);
        instances.push(
          kind === 'chart'
            ? createChart(container, lineSpec, { autoResize: false })
            : kind === 'map'
              ? createGeoMap(container, geoLabelSpec, { autoResize: false })
              : createSankey(container, sankey, { autoResize: false }),
        );
        renderStaticSVG(lineSpec);
      }
    }
    const ids = containers.flatMap((container) =>
      [...container.querySelectorAll('[id]')].map((node) => node.id),
    );
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids).size).toBe(ids.length);
    for (const container of containers)
      for (const node of container.querySelectorAll('[fill]')) {
        const id = /^url\(#(.+)\)$/.exec(node.getAttribute('fill') ?? '')?.[1];
        if (id) expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
      }
  } finally {
    for (const instance of instances) instance.destroy();
    for (const container of containers) container.remove();
  }
});
