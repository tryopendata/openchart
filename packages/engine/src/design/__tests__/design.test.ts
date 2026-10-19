import type { ChartSpec, ReaderSelection } from '@opendata-ai/openchart-core';
import { FLUID_SPRING } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { resolveAnimation } from '../../compiler/animation';
import { validateSpec } from '../../compiler/validate';
import { diagnoseChart } from '../diagnostics';
import {
  compareObservations,
  linkedEntityKeys,
  reconcileReaderSelection,
  resolveObservationIdentities,
} from '../identity';
import { applySpecPatch } from '../patch';
import { recommendCompositions } from '../recommend';

const spec: ChartSpec = {
  mark: 'bar',
  theme: { fonts: { sizes: { axisTick: 11 } } },
  data: [
    { id: 'a', category: 'Alpha', value: 10 },
    { id: 'b', category: 'Beta', value: 20 },
  ],
  encoding: {
    key: { field: 'id', type: 'nominal' },
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'category', type: 'nominal' },
  },
};
describe('design contracts', () => {
  it('does not silently rebind ambiguous or unkeyed observations', () => {
    const ids = resolveObservationIdentities(
      [{ id: 1 }, { id: '1' }, { id: null }, { id: 'same' }, { id: 'same' }],
      'id',
    );
    expect(ids.map((id) => id.persistent)).toEqual([true, true, false, false, false]);
    expect(new Set(ids.map((id) => id.observation)).size).toBe(5);
  });
  it('preserves pinned identity through sorting/filtering and announces deletion', () => {
    const id = resolveObservationIdentities(spec.data, 'id')[0];
    const state: ReaderSelection = {
      preview: null,
      pinned: [{ ...id, datum: spec.data[0], state: 'visible' }],
      announcement: '',
    };
    expect(reconcileReaderSelection(state, [...spec.data].reverse(), 'id').pinned[0].datum).toEqual(
      spec.data[0],
    );
    expect(
      reconcileReaderSelection(state, spec.data, 'id', undefined, new Set()).pinned[0].state,
    ).toBe('filtered');
    expect(reconcileReaderSelection(state, spec.data.slice(1), 'id').announcement).toContain(
      'removed',
    );
    expect(reconcileReaderSelection(state, spec.data).pinned).toEqual([]);
  });
  it('compares compatible supplied measures and distinguishes percentage points', () => {
    const percent = { measure: 'share', unit: '%', representation: 'percent' as const };
    expect(compareObservations(20, 25, percent, percent)).toEqual({
      absolute: 5,
      relative: 0.25,
      unit: 'percentage points',
    });
    expect(compareObservations(0, 25, percent, percent)?.relative).toBeUndefined();
    expect(compareObservations(20, 25, percent, { ...percent, unit: 'USD' })).toBeNull();
    expect(compareObservations(20, 25, {}, {})).toBeNull();
  });
  it('requires declared aggregate expansion and matching dataset', () => {
    const source = {
      dataset: 'energy',
      entityField: 'group',
      kind: 'group' as const,
      transform: 'sum',
    };
    const target = { dataset: 'energy', entityField: 'id', kind: 'row' as const };
    expect(linkedEntityKeys({ group: 'A' }, source, target)).toEqual([]);
    expect(
      linkedEntityKeys({ group: 'A' }, { ...source, groupMembers: { A: ['x'] } }, target),
    ).toEqual(['string:x']);
    expect(linkedEntityKeys({ group: 'A' }, source, { ...target, dataset: 'other' })).toEqual([]);
    for (const group of ['toString', 'constructor', '__proto__']) {
      expect(linkedEntityKeys({ group }, { ...source, groupMembers: {} }, target)).toEqual([]);
      expect(
        linkedEntityKeys({ group }, { ...source, groupMembers: { [group]: ['member'] } }, target),
      ).toEqual(['string:member']);
    }
  });
  it('makes fixes reversible and refuses stale or unsafe paths', () => {
    const layout = compileChart(spec, { width: 600, height: 400 });
    const patch = diagnoseChart(spec, layout).find((item) => item.fix)!.fix!;
    expect(patch.changes).toEqual([{ op: 'set', path: '/theme/fonts/sizes/axisTick', value: 12 }]);
    const { spec: next, inverse } = applySpecPatch(spec, patch);
    expect(next.theme?.fonts?.sizes?.axisTick).toBe(12);
    expect(spec.theme?.fonts?.sizes?.axisTick).toBe(11);
    expect(() => applySpecPatch(next, patch)).toThrow('stale');
    expect(applySpecPatch(next, inverse).spec).toEqual(spec);
    expect(() => applySpecPatch(spec, inverse)).toThrow('stale');
    expect(() =>
      applySpecPatch(spec, {
        ...patch,
        changes: [{ op: 'add', path: '/__proto__/polluted', value: true }],
      }),
    ).toThrow('Unsafe');
  });
  it('creates missing theme containers with add and removes them on undo', () => {
    const bare: ChartSpec = { ...spec };
    delete bare.theme;
    // A host theme can shrink axis text without the spec authoring any theme.
    const layout = compileChart(bare, {
      width: 600,
      height: 400,
      theme: { fonts: { sizes: { axisTick: 10 } } },
    });
    const patch = diagnoseChart(bare, layout).find((item) => item.fix)!.fix!;
    expect(patch.changes).toEqual([{ op: 'add', path: '/theme/fonts/sizes/axisTick', value: 12 }]);
    const { spec: next, inverse } = applySpecPatch(bare, patch);
    expect(next.theme).toEqual({ fonts: { sizes: { axisTick: 12 } } });
    expect(applySpecPatch(next, inverse).spec).toEqual(bare);
    expect(() =>
      applySpecPatch(bare, { ...patch, changes: [{ ...patch.changes[0], op: 'set' }] }),
    ).toThrow('Intermediate container is missing');
  });
  it('distinguishes uncheckable contrast and emits compiler diagnostics', () => {
    const codes: string[] = [];
    const layout = compileChart(spec, {
      width: 600,
      height: 400,
      onDiagnostic: (item) => codes.push(item.code),
    });
    expect(codes).toContain('contrast.unknown-background');
    expect(
      diagnoseChart(spec, layout).find((item) => item.code === 'contrast.unknown-background')
        ?.status,
    ).toBe('uncheckable');
  });
  it('diagnoses expanded and transformed data without losing the authored patch precondition', () => {
    const authored = {
      ...spec,
      data: { values: spec.data },
      transform: [{ calculate: { op: '*', field: 'value', value: 2 }, as: 'doubled' }],
      encoding: { ...spec.encoding, x: { field: 'doubled', type: 'quantitative' } },
    };
    const diagnostics: ReturnType<typeof diagnoseChart> = [];
    expect(() =>
      compileChart(authored, {
        width: 600,
        height: 400,
        onDiagnostic: (item) => diagnostics.push(item),
      }),
    ).not.toThrow();
    expect(diagnostics.some((item) => item.code === 'data.missing')).toBe(false);
    const patch = diagnostics.find((item) => item.fix)!.fix!;
    expect(patch.precondition).toBe(JSON.stringify(authored));
  });
  it('diagnoses the active breakpoint encoding against transformed rows', () => {
    const authored = {
      ...spec,
      transform: [
        { aggregate: [{ op: 'sum', field: 'value', as: 'total' }], groupby: ['category'] },
      ],
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
      },
      overrides: {
        compact: { encoding: { x: { field: 'total', type: 'quantitative' } } },
      },
    };
    const diagnostics: ReturnType<typeof diagnoseChart> = [];
    const layout = compileChart(authored, {
      width: 360,
      height: 400,
      onDiagnostic: (item) => diagnostics.push(item),
    });
    expect(layout.marks.filter((mark) => mark.type === 'rect')).toHaveLength(2);
    expect(diagnostics.filter((item) => item.code === 'data.missing')).toEqual([]);
    const patch = diagnostics.find((item) => item.fix)!.fix!;
    expect(patch.precondition).toBe(JSON.stringify(authored));
  });
  it('requests explicit roles/aggregation and preserves source order', () => {
    expect(recommendCompositions(spec.data, 'comparison', {}).missingRoles).toEqual([
      'measure',
      'category',
    ]);
    const result = recommendCompositions(spec.data, 'comparison', {
      measure: 'value',
      category: 'category',
    });
    expect(result.recommendations[0].spec).toMatchObject({ data: spec.data });
    expect(result.recommendations.every((item) => item.tradeoff.length > 0)).toBe(true);
    expect(
      recommendCompositions([...spec.data, spec.data[0]], 'composition', {
        measure: 'value',
        category: 'category',
      }).missingRoles,
    ).toContain('aggregation or a unique category');
  });
  it('resolves phase overrides without silently mixing motion modes', () => {
    expect(resolveAnimation('fluid')?.update?.spring).toEqual(FLUID_SPRING);
    expect(
      resolveAnimation({ preset: 'fluid', update: { duration: 200 } })?.update?.spring,
    ).toBeUndefined();
    expect(
      validateSpec({ ...spec, animation: { update: { spring: {}, duration: 300 } } }).valid,
    ).toBe(false);
    expect(resolveAnimation(false)).toBeUndefined();
    expect(resolveAnimation(undefined)).toBeUndefined();
  });
  it('compiles optional undefined spring settings while rejecting unknown settings', () => {
    const authored: ChartSpec = {
      ...spec,
      animation: { enter: { spring: { stiffness: undefined, damping: undefined } } },
    };
    expect(validateSpec(authored).valid).toBe(true);
    const layout = compileChart(authored, { width: 600, height: 400 });
    const defaults = compileChart(
      { ...spec, animation: { enter: { spring: {} } } },
      { width: 600, height: 400 },
    );
    expect(layout.animation?.enter?.duration).toBe(defaults.animation?.enter?.duration);
    expect(layout.marks).toEqual(defaults.marks);
    expect(
      validateSpec({ ...spec, animation: { enter: { spring: { typo: undefined } } } }).valid,
    ).toBe(false);
  });
});
