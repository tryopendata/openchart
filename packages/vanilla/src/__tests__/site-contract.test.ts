import { gzipSync } from 'node:zlib';
import { type Element, Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { renderStaticSVG } from '../static';
import {
  finding,
  historyRows,
  historySpec,
  intervalRowText,
  longStep,
  rateRows,
  rateSpec,
  siteSpec,
  siteSpecs,
} from './__fixtures__/static-specs';

// Explicit test-only parser: no global document/window assignment (U3 node project).
const testWindow = new Window();
const document = testWindow.document;
const DOMParser = testWindow.DOMParser;

type Spec = Parameters<typeof renderStaticSVG>[0];
const render = (spec: Spec, idPrefix = 'contract', darkMode: 'off' | 'force' = 'off') => {
  const cell = 'display' in spec && spec.display === 'sparkline';
  return renderStaticSVG(spec, {
    width: cell ? 120 : 680,
    height: cell ? 16 : 320,
    idPrefix,
    darkMode,
  });
};
const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml');
const pair = (spec: Spec, prefix: string) =>
  ['off', 'force'].map((mode, i) => render(spec, `${prefix}${i}`, mode as 'off' | 'force'));
function figure(spec: Spec, rows: string[], prefix = 'figure') {
  const host = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = finding;
  host.append(caption);
  for (const svg of pair(spec, prefix)) host.insertAdjacentHTML('beforeend', svg);
  const details = document.createElement('details');
  const table = document.createElement('table');
  const body = document.createElement('tbody');
  for (const text of rows) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = text;
    tr.append(td);
    body.append(tr);
  }
  table.append(body);
  details.append(table);
  host.append(details);
  return host;
}
function assertTitles(host: Element) {
  const marks = [...host.querySelectorAll('[data-mark]')];
  expect(marks.length).toBeGreaterThan(0);
  const rows = [
    ...host.querySelectorAll('details tbody tr, details tbody th, details tbody td'),
  ].map((row) => row.textContent);
  for (const mark of marks) {
    const title = mark.querySelector(':scope > title');
    expect(title).not.toBeNull();
    expect(rows).toContain(title?.textContent);
    expect(mark.hasAttribute('aria-label')).toBe(false);
  }
}
function numeric(element: Element, name: string) {
  expect(element.hasAttribute(name)).toBe(true);
  const value = Number(element.getAttribute(name));
  expect(Number.isFinite(value)).toBe(true);
  return value;
}

describe('consuming site contract (RFC §5.2 and §8)', () => {
  // All original U0 expected failures now satisfy the consuming-site contract.
  for (const [name, spec] of Object.entries(siteSpecs)) {
    it(`[4.2f#19a] ${name}: marks agree with table descriptions [U4/U5/U6/U9/U14]`, () => {
      const rows = [
        ...rateRows.flatMap((row) => [row.intervalText, row.rateText]),
        ...historyRows.map((row) => row.pointText),
        intervalRowText,
        'Published green rate',
        '40 projects',
        '11 Oct: 40 projects',
        'median 14 min to p75 26 min',
        'first passing test 6 min',
        'default: 40 projects',
        'sandbox: 25 projects',
        `${longStep}: 35%`,
        'environment: 10%',
        'kept: 80%',
        'attach: 40%',
        'A: 2× as likely',
        'v1 85%',
        'v2 15%',
        'v1 share',
      ];
      assertTitles(figure(spec, rows));
    });
  }
  it('[4.2f#12] two builds emit identical SVG bytes for every figure [U3/U5/U9]', () => {
    const build = () => Object.entries(siteSpecs).map(([name, spec]) => pair(spec, name));
    expect(build()).toEqual(build());
  });
  it('[4.2f#12] A-B-A rendering preserves light and dark bytes [U2/U3]', () => {
    const first = pair(siteSpecs.countCell, 'a');
    pair(siteSpecs.sparkCell, 'b');
    expect(pair(siteSpecs.countCell, 'a')).toEqual(first);
  });
  it('[4.2f#13] page ids are unique and all reference forms resolve within the figure [U1/U2/U9]', () => {
    const hosts = Object.entries(siteSpecs).map(([name, spec]) => figure(spec, [], name));
    const ids = hosts.flatMap((host) => [...host.querySelectorAll('[id]')].map((el) => el.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const host of hosts)
      for (const root of host.querySelectorAll('svg'))
        for (const el of [root, ...root.querySelectorAll('*')]) {
          for (const attr of el.attributes) {
            const value = attr.value ?? '';
            const refs = [...value.matchAll(/url\(["']?#([^\s)'"]+)["']?\)/g)].map(
              (match) => match[1],
            );
            if (['href', 'xlink:href'].includes(attr.name) && value.startsWith('#'))
              refs.push(value.slice(1));
            if (['aria-labelledby', 'aria-describedby'].includes(attr.name))
              refs.push(...value.split(/\s+/));
            for (const ref of refs)
              expect([root, ...root.querySelectorAll('[id]')].some((node) => node.id === ref)).toBe(
                true,
              );
          }
        }
  });
  it('assertFigures: layered and barlist root names equal the finding [U7/U9]', () => {
    for (const spec of [siteSpecs.history, siteSpecs.byAgent, siteSpecs.stepFailures]) {
      const host = figure(spec, []);
      const roots = host.querySelectorAll('svg[role="img"]');
      expect(roots).toHaveLength(2);
      for (const root of roots)
        expect(root.getAttribute('aria-label')).toBe(host.querySelector('figcaption')?.textContent);
    }
  });
  it('[4.2f#14] static pages add no scripts or interactive affordances [U1/U9]', () => {
    for (const spec of Object.values(siteSpecs)) {
      const doc = parse(render(spec));
      expect(
        doc.querySelector('script, [tabindex], [role="button"], animate, .oc-animate'),
      ).toBeNull();
    }
  });
  it('[4.2f#19c] weekly columns stack 40:25 and keep date marker [U4/U14]', () => {
    for (const width of [330, 360, 680])
      for (const axisTick of [12, 14]) {
        const doc = parse(
          renderStaticSVG(siteSpecs.weekly, {
            width,
            height: 320,
            theme: { fonts: { sizes: { axisTick } } },
          }),
        );
        const a = doc.querySelector(
          'rect[data-mark="bar"][data-day="2026-10-25"][data-preset="default"]',
        );
        const b = doc.querySelector(
          'rect[data-mark="bar"][data-day="2026-10-25"][data-preset="sandbox"]',
        );
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        if (!a || !b) throw new Error('Missing stacked segments');
        expect(numeric(a, 'x')).toBeCloseTo(numeric(b, 'x'), 2);
        expect(numeric(a, 'width')).toBeGreaterThan(0);
        expect(numeric(a, 'width')).toBeCloseTo(numeric(b, 'width'), 2);
        expect(numeric(a, 'height')).toBeGreaterThan(0);
        expect(numeric(b, 'height')).toBeGreaterThan(0);
        expect(numeric(a, 'height') / numeric(b, 'height')).toBeCloseTo(40 / 25, 2);
        expect(
          Math.min(
            Math.abs(numeric(a, 'y') + numeric(a, 'height') - numeric(b, 'y')),
            Math.abs(numeric(b, 'y') + numeric(b, 'height') - numeric(a, 'y')),
          ),
        ).toBeLessThanOrEqual(0.01);
        expect(doc.documentElement.textContent).toContain('20 Oct 2026');
      }
  });
  it('[4.2f#8] history has a dated dashed change marker [U8]', () => {
    const doc = parse(render(siteSpecs.history));
    expect(doc.documentElement.textContent).toContain('20 Oct 2026');
    expect(doc.querySelector('line[stroke-dasharray], path[stroke-dasharray]')).not.toBeNull();
  });
  it('[4.2f#6] hidden codex retains an empty alphabetical band [U4/U5/U7]', () => {
    const doc = parse(render(siteSpecs.byAgent));
    expect([
      ...new Set(
        [...doc.querySelectorAll('[data-agent][data-mark="point"]')].map((el) =>
          el.getAttribute('data-agent'),
        ),
      ),
    ]).toEqual(['claude', 'cursor', 'opencode', 'other']);
    expect(
      doc.querySelector('[data-agent="codex"] [data-mark], [data-agent="codex"][data-mark]'),
    ).toBeNull();
    expect([...doc.querySelectorAll('text')].map((el) => el.textContent)).toContain('codex');
    const empty = parse(
      render(
        rateSpec(
          [
            {
              agent: 'codex',
              row: 'codex',
              lower: null,
              upper: null,
              value: null,
              intervalText: 'Unpublished',
              rateText: 'Unpublished',
            },
          ],
          true,
        ),
      ),
    );
    expect(empty.querySelector('path[data-mark], rect[data-mark], circle[data-mark]')).toBeNull();
  });
  it('rate cells omit axes and retain their authored boundary descriptions', () => {
    for (const darkMode of ['off', 'force'] as const) {
      const doc = parse(render(rateSpec([rateRows[0], rateRows[3]], true), 'rate-cell', darkMode));
      expect(doc.querySelectorAll('text')).toHaveLength(0);
      expect(doc.querySelectorAll('[data-mark="point"]')).toHaveLength(2);
      expect(
        [...doc.querySelectorAll('[data-mark="point"] > title')].map((el) => el.textContent),
      ).toEqual(['claude: 0% n=40', 'other: 100% n=40']);
    }
  });
  it('full rate figures retain percent axes without a regression across nominal rows', () => {
    for (const spec of [siteSpecs.byAgent, siteSpecs.byPreset]) {
      const doc = parse(render(spec));
      expect([...doc.querySelectorAll('text')].some((el) => el.textContent?.includes('%'))).toBe(
        true,
      );
      expect(doc.querySelectorAll('[data-mark="point"]')).toHaveLength(rateRows.length);
      expect(doc.querySelectorAll('path[stroke-dasharray]')).toHaveLength(0);
    }
  });
  it('[4.2f#23] zero and perfect whiskers stay within shared viewBox [U5/U6/U7]', () => {
    const doc = parse(render(rateSpec([rateRows[0], rateRows[3]], true)));
    const whiskers = doc.querySelectorAll('[data-mark="errorbar"]');
    expect(whiskers.length).toBeGreaterThanOrEqual(2);
    const box = doc.documentElement.getAttribute('viewBox')!.split(/\s+/).map(Number);
    for (const whisker of whiskers)
      for (const name of ['x1', 'x2']) {
        const x = numeric(whisker, name);
        expect(x).toBeGreaterThanOrEqual(box[0]);
        expect(x).toBeLessThanOrEqual(box[0] + box[2]);
      }
  });
  it('[4.2f#24] lone history point is a dot without a line and retains 85% [U4/U6]', () => {
    const doc = parse(render(historySpec([historyRows[0]])));
    expect(doc.querySelectorAll('[data-mark="point"]').length).toBeGreaterThan(0);
    expect(doc.querySelectorAll('[data-mark="line"]')).toHaveLength(0);
    expect(doc.documentElement.textContent).toContain('85%');
  });
  it('[4.2f#24] unpublished history emits zero data marks [U6]', () => {
    const doc = parse(render(historySpec([historyRows[1]])));
    expect(doc.querySelectorAll('[data-mark]')).toHaveLength(0);
    expect(
      doc.querySelector('.oc-mark-line path, .oc-mark-area path, circle.oc-mark-point'),
    ).toBeNull();
  });
  it('[4.2f#22] one category has an interval, sample and finite usable axes [U5/U7]', () => {
    const host = figure(rateSpec([rateRows[1]], false), [rateRows[1].intervalText]);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.querySelector('svg')).not.toBeNull();
    expect(host.textContent).toMatch(/\d+-\d+%.*n=\d+/);
    expect(host.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(host.querySelector('[data-mark="errorbar"]')).not.toBeNull();
  });
  it('[4.2f#21] long steps truncate while table retains complete label [U9]', () => {
    const host = figure(siteSpecs.stepFailures, [longStep]);
    expect(
      [...host.querySelectorAll('svg text')].some(
        (el) =>
          el.textContent?.startsWith('xxxxxxxx') &&
          el.textContent.endsWith('…') &&
          el.textContent.length < 80,
      ),
    ).toBe(true);
    expect(host.querySelector('td')?.textContent).toBe(longStep);
  });
  it('[4.2f#20] names survive escaping in text, mark titles and figure names [U3/U4]', () => {
    const name = '<tag> & other > names';
    const spec = siteSpec({
      data: [{ category: name, value: 5 }],
      mark: 'bar',
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
        description: { value: name },
      },
      a11y: { description: name },
      watermark: false,
    });
    const doc = parse(render(spec));
    expect(doc.querySelector('tag')).toBeNull();
    expect([...doc.querySelectorAll('text')].some((el) => el.textContent === name)).toBe(true);
    expect(doc.querySelector('[data-mark] > title')?.textContent).toBe(name);
    expect(doc.documentElement.getAttribute('aria-label')).toBe(name);
  });
  it('[4.2f#25] static light/dark SVGs carry their theme [U1]', () => {
    for (const [i, svg] of pair(siteSpecs.countCell, 'theme').entries())
      expect(parse(svg).documentElement.getAttribute('data-theme')).toBe(
        i === 0 ? 'light' : 'dark',
      );
  });
  it('renders budget cells at 120 by 16 and budget figures at 680 by 320', () => {
    for (const name of ['rateCell', 'countCell', 'sparkCell'] as const)
      for (const svg of pair(siteSpecs[name], `cell-size-${name}`))
        expect(parse(svg).documentElement.getAttribute('viewBox')).toBe('0 0 120 16');
    for (const name of [
      'byPreset',
      'byAgent',
      'timeToGreen',
      'history',
      'weekly',
      'stepFailures',
      'keptAttach',
      'majorShares',
    ] as const)
      for (const svg of pair(siteSpecs[name], `figure-size-${name}`))
        expect(parse(svg).documentElement.getAttribute('viewBox')).toBe('0 0 680 320');
  });
  it('[4.2f#18] two-theme stack-page chart share fits the 80KB allocation [U1/U3/U9]', () => {
    const figures = [
      siteSpecs.byPreset,
      siteSpecs.byAgent,
      siteSpecs.timeToGreen,
      siteSpecs.history,
      siteSpecs.weekly,
      siteSpecs.stepFailures,
      siteSpecs.keptAttach,
      siteSpecs.majorShares,
    ];
    const strings = figures.flatMap((spec, i) => pair(spec, `budget${i}`));
    for (let i = 0; i < 30; i++)
      for (const spec of [siteSpecs.rateCell, siteSpecs.countCell, siteSpecs.sparkCell])
        strings.push(...pair(spec, `cell${i}${strings.length}`));
    expect(gzipSync(strings.join('')).byteLength).toBeLessThanOrEqual(80_000);
  });
});
