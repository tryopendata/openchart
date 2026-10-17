import { describe, expect, it } from 'vitest';
import { expandSpecSugar } from '../../compile/spec-sugar';
import { collectMarkOptionWarnings } from '../mark-options';

const types = [
  'bar',
  'line',
  'area',
  'point',
  'circle',
  'arc',
  'text',
  'rule',
  'tick',
  'rect',
  'lollipop',
  'beeswarm',
  'range',
  'waffle',
  'calendar',
  'parliament',
  'histogram',
  'density',
];
const cases: Array<[string, string[]]> = [
  ['orient', ['bar', 'histogram']],
  ['cornerRadius', ['bar', 'rect', 'histogram', 'waffle']],
  ['point', ['line', 'area', 'density']],
  ['interpolate', ['line', 'area', 'density']],
  ['innerRadius', ['arc']],
  ['outerRadius', ['arc']],
  ['startAngle', ['arc']],
  ['endAngle', ['arc']],
  ['centerLabel', ['arc']],
  ['binCount', ['histogram']],
  ['normalize', ['histogram']],
  ['bandwidth', ['density']],
  ['cumulative', ['density']],
  ['steps', ['density']],
  ['trendline', ['point']],
  ['dx', ['text']],
  ['dy', ['text']],
  ['align', ['text']],
  ['baseline', ['text']],
  ['fontSize', ['text']],
  ['style', ['range']],
  ['colorByDirection', ['range']],
  ['units', ['waffle']],
  ['columns', ['waffle']],
  ['other', ['waffle']],
  ['weekStart', ['calendar']],
  ['cellRadius', ['calendar']],
  ['shape', ['parliament']],
  ['seatRadius', ['parliament']],
  ['majorityLine', ['parliament']],
];
describe('mark option applicability (8.x warnings)', () => {
  it.each(types)('checks every specialized option on %s', (type) => {
    for (const [option, allowed] of cases) {
      const warnings = collectMarkOptionWarnings({ mark: { type, [option]: true } });
      expect(warnings.length, `${type}.${option}`).toBe(allowed.includes(type) ? 0 : 1);
      if (warnings.length) {
        expect(warnings[0]).toContain(`/mark/${option}`);
        expect(warnings[0]).toContain('Remove');
      }
    }
  });
  it('reports nested authored paths before density sugar strips options', () => {
    const warnings: string[] = [];
    expandSpecSugar(
      {
        layer: [
          {
            layer: [
              {
                mark: { type: 'density', binCount: 8, bandwidth: 2 },
                data: [{ v: 1 }],
                encoding: { x: { field: 'v', type: 'quantitative' } },
              },
            ],
          },
        ],
      },
      warnings,
    );
    expect(warnings.some((w) => w.includes('/layer/0/layer/0/mark/binCount'))).toBe(true);
    expect(warnings.some((w) => w.includes('/mark/bandwidth'))).toBe(false);
  });
});

it('emits only authored paths and mark names through nested layer compilation', async () => {
  const { compileLayer } = await import('../../compile');
  const warnings: string[] = [];
  compileLayer(
    {
      layer: [
        {
          layer: [
            {
              mark: { type: 'density', binCount: 8 },
              data: [{ x: 1 }, { x: 2 }, { x: 3 }],
              encoding: { x: { field: 'x', type: 'quantitative' } },
            },
          ],
        },
      ],
    },
    { width: 600, height: 400, onWarn: (w) => warnings.push(w) },
  );
  expect(warnings.filter((w) => w.includes('binCount'))).toEqual([
    '[openchart] /layer/0/layer/0/mark/binCount has no effect on mark "density". Remove binCount, or use a supported mark: histogram.',
  ]);
});

it('accepts waffle corner radius, which the renderer consumes', () => {
  expect(collectMarkOptionWarnings({ mark: { type: 'waffle', cornerRadius: 3 } })).toEqual([]);
});
