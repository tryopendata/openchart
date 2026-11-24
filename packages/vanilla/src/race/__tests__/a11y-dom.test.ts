import type { RaceSpec } from '@opendata-ai/openchart-core';
import { layoutRace, prepareRace, raceFrameAt } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRaceA11y } from '../a11y-dom';
import { createRaceShell } from '../shell';

const spec: RaceSpec = {
  type: 'race',
  mark: 'bar',
  chrome: { title: 'Gross domestic product' },
  data: [
    { year: 1994, country: 'United States', gdp: 7 },
    { year: 1994, country: 'Japan', gdp: 5 },
    { year: 1994, country: 'Germany', gdp: 2 },
    { year: 1994, country: 'Canada', gdp: 1 },
    { year: 1995, country: 'United States', gdp: 8 },
    { year: 1995, country: 'Japan', gdp: 6 },
    { year: 1995, country: 'Germany', gdp: 3 },
    { year: 1995, country: 'Canada', gdp: 2 },
    { year: 1996, country: 'Japan', gdp: null },
  ],
  encoding: { time: { field: 'year' }, key: { field: 'country' }, value: { field: 'gdp' } },
  race: { top: 4 },
};

let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => host.remove());

function setup(nextSpec = spec) {
  const model = prepareRace(nextSpec, {});
  const layout = layoutRace(model, { width: 600, height: 400 });
  const shell = createRaceShell(host, layout, 'race-test');
  return { model, shell, a11y: createRaceA11y(shell, model) };
}

describe('createRaceA11y', () => {
  it('gives the figure its title and a unique description, and exposes a visually hidden table', () => {
    const { shell } = setup();
    const other = setup();
    const description = shell.svg.getAttribute('aria-describedby') ?? '';
    expect(shell.svg.getAttribute('aria-label')).toBe('Gross domestic product');
    expect(document.getElementById(description)?.textContent).toBe(
      '1994 to 1996. United States leads in 1994. No ranked entries in 1996.',
    );
    expect(other.shell.svg.getAttribute('aria-describedby')).not.toBe(description);

    const table = shell.root.querySelector('table');
    expect(table?.querySelector('tbody tr > th[scope="row"]:first-child')?.textContent).toBe(
      '1994',
    );
    expect(table?.getAttribute('aria-label')).toBeNull();
    expect(table?.caption?.textContent).toBe('Gross domestic product by period.');
    expect(
      Array.from(table?.querySelectorAll('th[scope="col"]') ?? [], (th) => th.textContent),
    ).toEqual(['Period', 'Rank 1', 'Rank 2', 'Rank 3', 'Rank 4']);
    expect(
      Array.from(table?.querySelectorAll('tbody tr') ?? [], (row) =>
        Array.from(row.querySelectorAll('th[scope="row"], td'), (cell) => cell.textContent),
      ),
    ).toEqual([
      ['1994', 'United States (7)', 'Japan (5)', 'Germany (2)', 'Canada (1)'],
      ['1995', 'United States (8)', 'Japan (6)', 'Germany (3)', 'Canada (2)'],
      ['1996', '', '', '', ''],
    ]);
    expect(table?.parentElement?.style.clipPath).toBe('inset(50%)');
    expect(table?.parentElement?.style.overflow).toBe('clip');
  });

  it('includes the sampling note in the table name and marks each period as a row header', () => {
    const { shell } = setup({
      ...spec,
      race: { top: 1 },
      data: Array.from({ length: 121 }, (_, index) => ({
        year: 1900 + index,
        country: 'Japan',
        gdp: index,
      })),
    });
    const table = shell.root.querySelector('table');
    expect(table?.caption?.textContent).toBe(
      'Gross domestic product by period. Showing 60 of 121 periods, evenly sampled.',
    );
    expect(table?.hasAttribute('aria-label')).toBe(false);
    const headers = table?.querySelectorAll('tbody tr > th[scope="row"]:first-child');
    expect(headers).toHaveLength(60);
    expect(headers?.[0].textContent).toBe('1900');
    expect(headers?.[59].textContent).toBe('2020');
  });

  it('reattaches the same nodes for matching metadata and rejects changed rows', () => {
    const { shell, a11y } = setup();
    const table = shell.root.querySelector('table');
    const matching = prepareRace(spec, {});
    const next = createRaceShell(host, layoutRace(matching, { width: 400, height: 400 }), 'next');
    expect(a11y.attach(next, matching)).toBe(true);
    expect(next.root.querySelector('table')).toBe(table);
    const changed = prepareRace(
      {
        ...spec,
        data: spec.data.map((row) => ({
          ...row,
          gdp: typeof row.gdp === 'number' ? row.gdp * 2 : row.gdp,
        })),
      },
      {},
    );
    const layout = layoutRace(changed, { width: 400, height: 400 });
    expect(layout.a11y.altText).toBe(
      document.getElementById(next.svg.getAttribute('aria-describedby') ?? '')?.textContent,
    );
    const updated = createRaceShell(host, layout, 'updated');
    expect(a11y.attach(updated, changed)).toBe(false);
    expect(next.root.querySelector('table')).toBe(table);
  });

  it('announces up to three current leaders and handles a period with no ranked entries', () => {
    const { model, shell, a11y } = setup();
    const live = shell.root.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(live?.textContent).toBe('');
    a11y.announce(raceFrameAt(model, 1));
    expect(live?.textContent).toBe('1995: United States, Japan, Germany lead');
    a11y.announce(raceFrameAt(model, 2));
    expect(live?.textContent).toBe('1996: No ranked entries');
  });

  it('announces keys for blank labels in exact tie order', () => {
    const { model, shell, a11y } = setup({
      ...spec,
      encoding: { ...spec.encoding, label: { field: 'label' } },
      data: spec.data.map((row) => ({
        ...row,
        label: ' ',
        gdp: row.year === 1995 && row.country === 'Germany' ? 6 : row.gdp,
      })),
    });
    a11y.announce(raceFrameAt(model, 1));
    expect(shell.root.querySelector('[aria-live]')?.textContent).toBe(
      '1995: United States, Japan, Germany lead',
    );
  });

  it('uses a fallback title and keeps announcements when the table is disabled', () => {
    const { model, shell, a11y } = setup({
      ...spec,
      chrome: { title: '  ' },
      a11y: { description: 'Authored description', table: false },
      race: { top: 1 },
    });
    expect(shell.svg.getAttribute('aria-label')).toBe('Race chart');
    const description = shell.svg.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(description)?.textContent).toBe('Authored description');
    expect(shell.root.querySelector('table')).toBeNull();
    a11y.announce(raceFrameAt(model, 0));
    expect(shell.root.querySelector('[aria-live]')?.textContent).toBe('1994: United States leads');
  });

  it('keeps a decorative figure hidden and omits the hidden table and live region', () => {
    const { model, shell, a11y } = setup({ ...spec, a11y: { hidden: true } });
    a11y.announce(raceFrameAt(model, 0));
    expect(shell.svg.getAttribute('aria-hidden')).toBe('true');
    expect(shell.svg.getAttribute('aria-describedby')).toBeNull();
    expect(shell.root.querySelector('table, [aria-live]')).toBeNull();
  });

  it('removes its table, announcements and description association on destroy', () => {
    const { model, shell, a11y } = setup();
    const live = shell.root.querySelector('[aria-live]');
    const description = shell.svg.getAttribute('aria-describedby') ?? '';
    a11y.destroy();
    a11y.destroy();
    a11y.announce(raceFrameAt(model, 1));
    expect(live?.textContent).toBe('');
    expect(shell.root.querySelector('table, [aria-live]')).toBeNull();
    expect(document.getElementById(description)).toBeNull();
    expect(shell.svg.getAttribute('aria-describedby')).toBeNull();
    expect(host.contains(shell.svg)).toBe(true);
    expect(host.contains(shell.controlsSlot)).toBe(true);
  });
});
