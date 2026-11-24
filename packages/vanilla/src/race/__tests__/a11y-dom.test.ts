import type { RaceSpec } from '@opendata-ai/openchart-core';
import { layoutRace, prepareRace, raceFrameAt } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(table?.getAttribute('aria-label')).toBe('Data table: Gross domestic product');
    expect(
      Array.from(table?.querySelectorAll('th[scope="col"]') ?? [], (th) => th.textContent),
    ).toEqual(['Period', 'Rank 1', 'Rank 2', 'Rank 3', 'Rank 4']);
    expect(
      Array.from(table?.querySelectorAll('tbody tr') ?? [], (row) =>
        Array.from(row.querySelectorAll('td'), (cell) => cell.textContent),
      ),
    ).toEqual([
      ['1994', 'United States (7)', 'Japan (5)', 'Germany (2)', 'Canada (1)'],
      ['1995', 'United States (8)', 'Japan (6)', 'Germany (3)', 'Canada (2)'],
      ['1996', '', '', '', ''],
    ]);
    expect(table?.parentElement?.style.clipPath).toBe('inset(50%)');
    expect(table?.parentElement?.style.overflow).toBe('clip');
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

  it('announces keys for blank labels and resolves a tie without reranking each tied key', () => {
    const { model, shell, a11y } = setup({
      ...spec,
      encoding: { ...spec.encoding, label: { field: 'label' } },
      data: spec.data.map((row) => ({
        ...row,
        label: ' ',
        gdp: row.year === 1995 && row.country === 'Germany' ? 6 : row.gdp,
      })),
    });
    const frame = raceFrameAt(model, 1);
    using exactRank = vi.spyOn(model.timeline, 'exactRank');
    a11y.announce(frame);
    expect(shell.root.querySelector('[aria-live]')?.textContent).toBe(
      '1995: United States, Japan, Germany lead',
    );
    expect(exactRank).not.toHaveBeenCalled();
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
