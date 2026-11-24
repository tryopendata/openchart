import type { RaceSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createMeasureText } from '../../measure-text';
import { createRace } from '../../race-mount';
import { renderRaceStaticSVG, renderStaticSVG } from '../../static';

const size = { width: 640, height: 280 };
const theme = { fonts: { family: 'sans-serif' } };
const spec: RaceSpec = {
  type: 'race',
  mark: 'bar',
  ...size,
  data: [
    [100, 50, 40, 30],
    [70, 90, 89, 88],
    [100, 99, 98, 97],
  ].flatMap((values, year) =>
    values.map((value, key) => ({
      year: 2000 + year,
      key: ['A&B', 'Brook', 'Cedar', 'Delta'][key],
      value,
    })),
  ),
  encoding: { time: { field: 'year' }, key: { field: 'key' }, value: { field: 'value' } },
  race: { top: 4, autoplay: false, swap: 0 },
  chrome: { title: 'Annual standings', source: 'Annual survey' },
  watermark: false,
};

function frames(mark: RaceSpec['mark']) {
  const input = { ...spec, mark };
  const host = document.createElement('div');
  document.body.append(host);
  const race = createRace(host, input, { autoResize: false, theme });
  onTestFinished(() => {
    race.destroy();
    host.remove();
  });
  race.seek(1);
  race.seek(2);
  const options = {
    ...size,
    theme,
    measureText: createMeasureText(theme.fonts.family),
    precision: null,
  };
  const source = renderRaceStaticSVG(input, options);
  expect(renderStaticSVG(input, options)).toBe(source);
  const staticSvg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  return { live: host, staticSvg };
}

function attributes(root: Element) {
  return [...root.querySelectorAll('*')].map((element) => [
    element.localName,
    [...element.attributes]
      .filter(({ name }) => name !== 'id')
      .map(({ name, value }) => [name, name === 'clip-path' ? 'clipped' : value])
      .sort(),
    element.children.length === 0 ? element.textContent : '',
  ]);
}

describe('static race final frame', () => {
  it.each([
    { type: 'bar', cornerRadius: 100 },
    { type: 'line' },
  ] as const)('shares the live $type elements, paint order, and attributes', (mark) => {
    const { live, staticSvg } = frames(mark);
    const final = live.querySelector('.oc-race-mark');
    const snapshot = staticSvg.querySelector('.oc-race-mark');
    if (!final || !snapshot) throw new Error('Expected live and static marks');
    expect(attributes(snapshot)).toEqual(attributes(final));
    expect(attributes(staticSvg.querySelector('.oc-chrome')!)).toEqual(
      attributes(live.querySelector('.oc-chrome')!),
    );
    expect(staticSvg.getAttribute('viewBox')).toBe('0 0 640 280');
  });

  it('places the same final table cells, chips and inline bars in the SVG', () => {
    const { live, staticSvg } = frames('table');
    const host = live.querySelector<HTMLElement>('.oc-race-table')!;
    const rows = [...host.querySelectorAll<HTMLTableRowElement>('tbody tr')];
    const snapshot = [...staticSvg.querySelectorAll('.oc-race-mark g[data-key]')];
    expect(rows).toHaveLength(4);
    expect(snapshot).toHaveLength(4);
    for (const [index, row] of rows.entries()) {
      const svgRow = snapshot[index];
      const cells = [...row.querySelectorAll('td')].filter((cell) => cell.textContent);
      expect([...svgRow.querySelectorAll('text')].map((text) => text.textContent)).toEqual(
        cells.map((cell) => cell.textContent),
      );
      expect(svgRow.getAttribute('opacity')).toBe(row.style.opacity);
      expect(svgRow.querySelectorAll('circle, rect')).toHaveLength(2);
      const head = host.querySelector<HTMLElement>('thead tr')!;
      const rowY = Number.parseFloat(row.style.transform.slice('translateY('.length));
      const offset =
        Number.parseFloat(row.style.getPropertyValue('--oc-race-table-content-offset')) || 0;
      const y =
        Number.parseFloat(host.style.top) +
        Number.parseFloat(head.style.height) +
        rowY +
        offset +
        (Number.parseFloat(row.style.height) - 1) / 2;
      expect(Number(svgRow.querySelector('circle')?.getAttribute('cy'))).toBeCloseTo(y, 2);
      const rect = svgRow.querySelector('rect');
      const bar = row.querySelector<HTMLElement>('.oc-race-table-fill')!;
      const factor = Number(/scaleX\(([^)]+)\)/.exec(bar.style.transform)?.[1]);
      expect(Number(rect?.getAttribute('width'))).toBeCloseTo(
        Number.parseFloat(bar.style.width) * factor,
        2,
      );
      expect(Number(rect?.getAttribute('rx'))).toBeCloseTo(2 * factor, 2);
      expect(Number(rect?.getAttribute('ry'))).toBe(2);
    }
  });
});
