import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RaceSpec } from '@opendata-ai/openchart-core';
import {
  layoutRace,
  prepareRace,
  raceFrameAt,
  raceGeometryAt,
} from '@opendata-ai/openchart-engine';
import { describe, expect, it, onTestFinished } from 'vitest';
import { worldGdpRace } from '../../../../../examples/src/data/world-gdp-race';
import { createRace } from '../../race-mount';
import { createRaceTableRenderer } from '../render-table';
import { createRaceShell } from '../shell';

const alpine = '<b>Alpine</b>';
const spec = {
  type: 'race',
  mark: 'table',
  width: 800,
  height: 300,
  chrome: { title: 'Leaderboard', source: 'Source: Race fixture' },
  data: [
    { period: 0, place: alpine, value: 100 },
    { period: 0, place: 'Brook', value: 40 },
    { period: 0, place: 'Cedar', value: 10 },
    { period: 1, place: alpine, value: 45 },
    { period: 1, place: 'Brook', value: 120 },
    { period: 1, place: 'Cedar', value: 60 },
  ],
  encoding: { time: { field: 'period' }, key: { field: 'place' }, value: { field: 'value' } },
  race: { top: 2, autoplay: false, step: 1000, swap: 400 },
} satisfies RaceSpec;

function setup(raceSpec: RaceSpec = spec, hidden = false) {
  const container = document.createElement('div');
  const model = prepareRace(raceSpec, {});
  const layout = layoutRace(model, {
    width: raceSpec.width ?? spec.width,
    height: raceSpec.height ?? spec.height,
  });
  if (layout.mark !== 'table') throw new Error('Expected table layout');
  if (hidden) layout.a11y.hidden = true;
  const shell = createRaceShell(container, layout, 'fixture');
  const sibling = container.ownerDocument.createElement('p');
  sibling.textContent = 'Other content';
  shell.markHost.append(sibling);
  const renderer = createRaceTableRenderer(shell.markHost, layout.static, 'fixture');

  function draw(t: number) {
    const geometry = raceGeometryAt(model, layout, t);
    if (geometry.mark !== 'table') throw new Error('Expected table geometry');
    renderer.draw(geometry);
    return geometry;
  }

  return { container, shell, sibling, layout, model, renderer, draw };
}

function mountWithStyles(container: HTMLElement) {
  const styles = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../core/src/styles');
  const entry = readFileSync(resolve(styles, 'index.css'), 'utf8');
  const style = document.createElement('style');
  if (entry.includes('@import "./race-table.css";')) {
    // Happy DOM does not apply cascade layers. Use the rules from the imported layer.
    style.textContent = readFileSync(resolve(styles, 'race-table.css'), 'utf8').replace(
      /^@layer [^{]+\{|}\s*$/g,
      '',
    );
  }
  document.head.append(style);
  document.body.append(container);
  onTestFinished(() => {
    container.remove();
    style.remove();
  });
}

describe('race table renderer', () => {
  it('places an HTML table with column headers in the drawable part of the shell', () => {
    const { shell, layout, draw } = setup();
    draw(0);
    const table = shell.markHost.querySelector('table');
    expect(table?.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    expect(
      Array.from(
        table?.querySelectorAll('thead > tr > th[scope="col"]') ?? [],
        (cell) => cell.textContent,
      ),
    ).toEqual(['Rank', 'Change', 'Name', '', 'Value', 'Share']);
    expect(shell.svg.querySelector('table')).toBeNull();
    expect(shell.root.style.position).toBe('relative');
    expect(shell.markHost.style.position).toBe('absolute');
    expect(shell.markHost.style.top).toBe(`${layout.area.y}px`);
    expect(shell.markHost.style.left).toBe(`${layout.area.x}px`);
    expect(shell.markHost.style.width).toBe(`${layout.area.width}px`);
    expect(shell.markHost.style.height).toBe(`${layout.area.height}px`);
    expect(shell.markHost.nextElementSibling).toBe(shell.controlsSlot);
    expect(table?.querySelector<HTMLTableRowElement>('thead > tr')?.style.height).toBe(
      `${layout.static.headerHeight}px`,
    );
  });

  it('writes cell text literally and draws the inline bar and identity chip', () => {
    const { shell, layout, draw } = setup();
    const geometry = draw(0);
    const row = shell.markHost.querySelector<HTMLTableRowElement>('tbody > tr');
    const bar = geometry.rows[0].cells.find(({ column }) => column === 'bar');
    if (bar?.column !== 'bar') throw new Error('Expected inline bar geometry');

    expect(Array.from(row?.cells ?? [], (cell) => cell.textContent)).toEqual([
      '1',
      '',
      alpine,
      '',
      '100',
      '66.7%',
    ]);
    expect(row?.querySelector('b')).toBeNull();
    expect(
      row?.cells[2].querySelector<HTMLElement>('[aria-hidden="true"]')?.style.backgroundColor,
    ).toBeTruthy();
    const fill = row?.cells[3].querySelector('div');
    expect(Number.parseFloat(fill?.style.width ?? '')).toBeCloseTo(layout.static.columns[3].width);
    expect(fill?.style.transform).toBe('translateX(0px) scaleX(1)');
  });

  it('positions the positive bar to the right of zero in a signed table', () => {
    const { container, draw, layout, shell } = setup({
      ...spec,
      data: [0, 1].flatMap((period) => [
        { period, place: 'Gain', value: 10 },
        { period, place: 'Loss', value: -10 },
      ]),
    });
    mountWithStyles(container);
    const geometry = draw(0);
    const positive = geometry.rows[0].cells[3];
    if (positive.column !== 'bar') throw new Error('Expected positive bar');
    const [gain, loss] = shell.markHost.querySelectorAll<HTMLDivElement>('tbody td div');
    expect(positive.x).toBeGreaterThan(0);
    expect(gain.style.left).toBe('');
    expect(getComputedStyle(gain).transformOrigin).toBe('0 50%');
    expect(gain.style.transform).toBe(`translateX(${positive.x}px) scaleX(0.5)`);
    expect(loss.style.transform).toBe('translateX(0px) scaleX(0.5)');
    expect(Number.parseFloat(gain.style.width)).toBeCloseTo(layout.static.columns[3].width);
    expect(Number.parseFloat(loss.style.width)).toBeCloseTo(layout.static.columns[3].width);
  });

  it('leaves unchanged row and cell attributes alone across redraws', () => {
    const { shell, draw } = setup();
    draw(0);
    const table = shell.markHost.querySelector('table');
    if (!table) throw new Error('Expected a table');
    const observer = new MutationObserver(() => {});
    onTestFinished(() => observer.disconnect());
    observer.observe(table, { subtree: true, attributes: true, childList: true });
    draw(0);
    expect(observer.takeRecords()).toHaveLength(0);

    const [firstRow] = table.querySelectorAll('tbody tr');
    const chip = firstRow.querySelector('[aria-hidden="true"]');
    draw(0.1);
    const changes = observer.takeRecords();
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.some(({ target }) => target === chip)).toBe(false);
    expect(changes.some(({ attributeName }) => attributeName === 'data-direction')).toBe(false);
  });

  it('keeps the background and slot rules fixed during a crossing', () => {
    const { container, shell, layout, draw } = setup();
    shell.root.style.setProperty('--oc-bg', '#fff');
    shell.root.style.setProperty('--oc-border', '#ddd');
    mountWithStyles(container);
    draw(0);
    const body = shell.markHost.querySelector('tbody');
    const row = body?.querySelector('tr');
    if (!body || !row) throw new Error('Expected table rows');
    expect(
      Number.parseFloat(body.style.getPropertyValue('--oc-race-table-row-height')),
    ).toBeCloseTo(layout.static.rowHeight);
    expect(getComputedStyle(row).maxHeight).toContain('- 1px');
    expect(['', 'none']).toContain(getComputedStyle(row).boxShadow);
    const rulesStyle = body.getAttribute('style');
    const originalRowPosition = row.style.transform;
    draw(0.5);
    expect(row.style.transform).not.toBe(originalRowPosition);
    expect(body.getAttribute('style')).toBe(rulesStyle);
  });

  it.each(['#f6f6f6', '#18181b'])('lets the page surface %s show through the table', (surface) => {
    const { container, shell, draw } = setup();
    shell.root.style.setProperty('--oc-bg', '#fff');
    container.style.backgroundColor = surface;
    mountWithStyles(container);
    draw(0);
    const body = shell.markHost.querySelector('tbody');
    const row = body?.querySelector('tr');
    if (!body || !row) throw new Error('Expected table rows');
    for (const element of [shell.root, shell.markHost, body, row]) {
      expect(['', 'transparent', 'rgba(0, 0, 0, 0)']).toContain(
        getComputedStyle(element).backgroundColor,
      );
    }
  });

  it.each([
    800, 360,
  ])('keeps all positive-opacity GDP rows readable through the crossing at %i px', (width) => {
    const { container, layout, model, shell, draw } = setup({
      ...spec,
      width,
      height: 476,
      data: worldGdpRace.map(({ country, year, gdp }) => ({
        period: year,
        place: country,
        value: gdp,
      })),
      race: { autoplay: false },
    });
    mountWithStyles(container);
    const body = shell.markHost.querySelector('tbody');
    if (!body) throw new Error('Expected table body');
    const { rowHeight, fontSize, headerHeight } = layout.static;
    const contentHeight = fontSize * 1.2;
    const bodyHeight = layout.area.height - headerHeight;

    let sawFadingRow = false;
    for (let tick = 820; tick <= 905; tick++) {
      const t = tick / 100;
      const frame = raceFrameAt(model, t);
      draw(t);
      const nodes = [...body.querySelectorAll<HTMLTableRowElement>('tr')];
      const rendered = new Map(
        nodes.map((node) => [node.querySelector('.oc-race-table-name')?.textContent, node]),
      );
      const bands = frame.items
        .filter(({ opacity }) => opacity > 0)
        .map(({ key, rankPos, opacity }) => {
          if (opacity < 1) sawFadingRow = true;
          const row = rendered.get(key);
          if (!row) throw new Error(`Missing ${key} at ${t}`);
          const rowY = Number.parseFloat(row.style.transform.slice('translateY('.length));
          expect(rowY, `${key} at ${t}`).toBeCloseTo(rankPos * rowHeight);
          expect(Number.parseFloat(row.style.opacity), `${key} at ${t}`).toBeCloseTo(opacity);
          const offset =
            Number.parseFloat(row.style.getPropertyValue('--oc-race-table-content-offset')) || 0;
          if (t === 8.8 && (key === 'United Kingdom' || key === 'Italy')) {
            expect(offset).not.toBe(0);
            expect(getComputedStyle(row.cells[2]).getPropertyValue('translate')).toBe(
              `0 ${offset}px`,
            );
          }
          return { key, top: rowY + (rowHeight - 1 - contentHeight) / 2 + offset };
        })
        .sort((a, b) => a.top - b.top);
      expect(rendered.size).toBe(bands.length);
      for (const [index, band] of bands.entries()) {
        expect(band.top, `${band.key} at ${t}`).toBeGreaterThanOrEqual(-0.02);
        expect(band.top + contentHeight, `${band.key} at ${t}`).toBeLessThanOrEqual(
          bodyHeight + 0.02,
        );
        if (index > 0) {
          expect(
            band.top,
            `${band.key} overlaps ${bands[index - 1].key} at ${t}`,
          ).toBeGreaterThanOrEqual(bands[index - 1].top + contentHeight - 0.02);
        }
      }
    }
    expect(sawFadingRow).toBe(true);
  });

  it('renders matching headers and cells in the resolved custom column order', () => {
    const { draw, shell } = setup({
      ...spec,
      width: 360,
      mark: { type: 'table', columns: ['value', 'bar', 'rank'] },
    });
    draw(0);
    expect(Array.from(shell.markHost.querySelectorAll('th'), (cell) => cell.textContent)).toEqual([
      'Value',
      'Rank',
    ]);
    const first = shell.markHost.querySelector<HTMLTableRowElement>('tbody tr');
    expect(Array.from(first?.cells ?? [], (cell) => cell.textContent)).toEqual(['100', '1']);
  });

  it('hides the table as well as the SVG when accessibility metadata requests it', () => {
    const { shell, draw } = setup(spec, true);
    draw(0);
    expect(shell.markHost.querySelector('table')).toBeTruthy();
    expect(shell.markHost.getAttribute('aria-hidden')).toBe('true');
    expect(shell.svg.getAttribute('aria-hidden')).toBe('true');
    expect(shell.controlsSlot.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('renders text in the same theme weights used to measure it', () => {
    const { container, shell, draw } = setup({
      ...spec,
      theme: { fonts: { weights: { normal: 500, semibold: 700 } } },
    });
    mountWithStyles(container);
    draw(0);
    const header = shell.markHost.querySelector('th');
    const body = shell.markHost.querySelector('td');
    if (!header || !body) throw new Error('Expected table cells');
    expect(getComputedStyle(header).fontWeight).toBe('700');
    expect(getComputedStyle(body).fontWeight).toBe('500');
  });

  it('clips ten slots to the drawable area in a 360×180 race and keeps numeric styles', () => {
    const container = document.createElement('div');
    mountWithStyles(container);
    const race = createRace(
      container,
      {
        ...spec,
        width: 360,
        height: 180,
        race: { ...spec.race, top: 10 },
        data: [0, 1].flatMap((period) =>
          Array.from({ length: 10 }, (_, index) => ({
            period,
            place: `Place ${index}`,
            value: 10 - index,
          })),
        ),
      },
      { autoResize: false },
    );
    onTestFinished(() => race.destroy());
    const table = container.querySelector('table');
    const header = table?.querySelector<HTMLTableRowElement>('thead tr');
    const rows = table?.querySelectorAll<HTMLTableRowElement>('tbody tr');
    const first = rows?.[0];
    const host = table?.parentElement;
    const rank = first?.cells[0];
    if (!host || !header || !first || !rank) throw new Error('Expected rendered table rows');
    const headerHeight = Number.parseFloat(header.style.height);
    const rowHeight = Number.parseFloat(first.style.height);
    expect(rows).toHaveLength(10);
    expect(headerHeight + 10 * rowHeight).toBeCloseTo(Number.parseFloat(host.style.height));
    expect(rowHeight).toBeLessThan(Number.parseFloat(getComputedStyle(rank).fontSize));
    expect(getComputedStyle(host).overflow).toBe('hidden');
    expect(getComputedStyle(first).position).toBe('absolute');
    expect(getComputedStyle(rank).textAlign).toBe('right');
    expect(getComputedStyle(rank).fontVariantNumeric).toBe('tabular-nums');
  });

  it('reuses rows and cells, applies transforms and opacity, and paints in geometry order', () => {
    const { shell, renderer, draw } = setup();
    const body = shell.markHost.querySelector('tbody');
    const bodyRows = () => Array.from(body?.querySelectorAll<HTMLTableRowElement>('tr') ?? []);
    const initial = draw(0);
    const [alpineRow, brookRow] = bodyRows();
    const valueCell = brookRow?.cells[4];
    expect(alpineRow?.textContent).toContain(alpine);
    expect(brookRow?.textContent).toContain('Brook');

    const moving = draw(0.5);
    expect(bodyRows().map((row) => row.cells[2].textContent)).toEqual(
      moving.rows.map(({ key }) => key),
    );
    for (const [index, row] of bodyRows().entries()) {
      expect(row.style.transform).toMatch(/^translateY\([\d.]+px\)$/);
      expect(Number.parseFloat(row.style.transform.slice(11))).toBeCloseTo(moving.rows[index].y);
    }
    expect(body?.lastElementChild).toBe(brookRow);
    expect(brookRow?.cells[4]).toBe(valueCell);
    expect(valueCell?.textContent).toBe('80');
    expect([brookRow?.cells[0].textContent, brookRow?.cells[1].textContent]).toEqual(['2', '']);

    const fading = draw(0.75);
    expect(fading.rows.some(({ opacity }) => opacity < 1)).toBe(true);
    for (const [index, row] of bodyRows().entries()) {
      expect(Number.parseFloat(row.style.opacity)).toBeCloseTo(fading.rows[index].opacity, 5);
    }

    draw(1);
    expect(bodyRows().map((row) => row.cells[2].textContent)).toEqual(['Brook', 'Cedar']);
    expect(bodyRows()[0]).toBe(brookRow);
    expect([brookRow?.cells[0].textContent, brookRow?.cells[1].textContent]).toEqual(['1', '↑1']);
    expect(alpineRow?.parentElement).toBeNull();
    renderer.draw(initial);
    expect(bodyRows()[1]).toBe(brookRow);
  });

  it('destroys only what it added and ignores later draws', () => {
    const { shell, sibling, renderer, draw } = setup();
    draw(0);
    renderer.destroy();
    renderer.destroy();
    draw(1);
    expect(Array.from(shell.markHost.children)).toEqual([sibling]);
    expect(shell.root.contains(shell.svg)).toBe(true);
    expect(shell.root.contains(shell.controlsSlot)).toBe(true);
  });

  it('swaps from bar to table at the current playhead and keeps the period controls', () => {
    const container = document.createElement('div');
    const race = createRace(container, { ...spec, mark: 'bar' }, { autoResize: false });
    try {
      race.seek(0.75);
      race.play();
      expect(container.querySelector('table.oc-race-table-grid')).toBeNull();
      race.update(spec);
      expect(race.getState()).toMatchObject({ t: 0.75, period: { index: 0 }, playing: true });
      const brook = Array.from(
        container.querySelectorAll<HTMLTableRowElement>('table.oc-race-table-grid tbody tr'),
      ).find((row) => row.cells[2].textContent === 'Brook');
      expect(brook?.cells[4].textContent).toBe('100');
      expect(container.querySelector('input[type="range"]')?.getAttribute('aria-valuetext')).toBe(
        '0',
      );
      race.pause();
      race.seek(1);
      expect(container.querySelector('table.oc-race-table-grid tbody > tr')?.textContent).toContain(
        'Brook',
      );
      expect(container.querySelector('input[type="range"]')?.getAttribute('aria-valuetext')).toBe(
        '1',
      );
    } finally {
      race.destroy();
    }
  });
});
