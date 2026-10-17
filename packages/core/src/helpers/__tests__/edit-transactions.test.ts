import { describe, expect, it } from 'vitest';
import type { EditTransaction } from '../../types/events';
import { applyEditTransaction } from '../edit-transactions';

function roundTrip<T>(spec: T, tx: EditTransaction, expected: unknown) {
  const before = structuredClone(spec);
  const result = applyEditTransaction(spec, tx);
  expect(spec).toEqual(before);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.reason);
  expect(result.spec).toEqual(expected);
  const undone = applyEditTransaction(result.spec, result.inverse);
  expect(undone).toMatchObject({ ok: true, spec: before });
}

describe('applyEditTransaction', () => {
  it('sets existing and missing final properties with exact inverses', () => {
    roundTrip(
      { chrome: { title: 'Old' } },
      {
        ops: [
          { op: 'set', path: '/chrome/title', value: 'New' },
          { op: 'set', path: '/chrome/source', value: 'Source' },
        ],
      },
      { chrome: { title: 'New', source: 'Source' } },
    );
  });

  it('inserts, appends, replaces and removes array entries in sequence', () => {
    roundTrip(
      { annotations: ['a', 'c'] },
      {
        ops: [
          { op: 'add', path: '/annotations/1', value: 'b' },
          { op: 'add', path: '/annotations/-', value: 'd' },
          { op: 'set', path: '/annotations/0', value: 'A' },
          { op: 'remove', path: '/annotations/2' },
        ],
      },
      { annotations: ['A', 'b', 'd'] },
    );
  });

  it('creates optional containers for add and removes them on undo', () => {
    roundTrip(
      {},
      {
        ops: [
          { op: 'add', path: '/annotations/0', value: { type: 'text', text: 'New' } },
          { op: 'add', path: '/chrome/title/text', value: 'Title' },
        ],
      },
      { annotations: [{ type: 'text', text: 'New' }], chrome: { title: { text: 'Title' } } },
    );
  });

  it('restores object properties overwritten by add or deleted by remove', () => {
    roundTrip(
      { title: 'Old', source: 'Source' },
      {
        ops: [
          { op: 'add', path: '/title', value: 'New' },
          { op: 'remove', path: '/source' },
        ],
      },
      { title: 'New' },
    );
  });

  it('decodes escaped keys and resolves first-leaf annotation paths', () => {
    const annotation = { id: 'a', type: 'text', text: 'Original' };
    roundTrip(
      { layer: [{ annotations: [annotation] }], labels: {} },
      {
        revision: 4,
        ops: [
          {
            op: 'set',
            path: '/layer/0/annotations/0/offset',
            value: { dx: 2 },
            expect: annotation,
          },
          { op: 'add', path: '/labels/a~1b~0c', value: 3 },
        ],
      },
      { layer: [{ annotations: [{ ...annotation, offset: { dx: 2 } }] }], labels: { 'a/b~c': 3 } },
    );
  });

  it('rejects reordered ID-less annotations by text, without changing input', () => {
    const spec = {
      annotations: [
        { type: 'text', text: 'B' },
        { type: 'text', text: 'A' },
      ],
    };
    const before = structuredClone(spec);
    expect(
      applyEditTransaction(spec, {
        ops: [
          {
            op: 'set',
            path: '/annotations/0/offset',
            value: {},
            expect: { type: 'text', text: 'A' },
          },
        ],
      }),
    ).toMatchObject({ ok: false, error: { opIndex: 0, path: '/annotations/0/offset' } });
    expect(spec).toEqual(before);
  });

  it.each([
    { op: 'set', path: '/missing/child', value: 1 },
    { op: 'remove', path: '/annotations/0' },
    { op: 'add', path: '/annotations/2', value: {} },
    { op: 'set', path: '/annotations/0/text', value: 'New', expect: { text: 'Gone' } },
    { op: 'set', path: '/title/text', value: 'New' },
    { op: 'add', path: '/__proto__/polluted', value: true },
    { op: 'add', path: '/constructor/prototype/polluted', value: true },
    { op: 'add', path: '/bad~2key', value: true },
  ] as const)('rejects invalid operation atomically: $path', (op) => {
    const spec = { title: 'Original', annotations: [] };
    const before = structuredClone(spec);
    const result = applyEditTransaction(spec, {
      ops: [{ op: 'set', path: '/title', value: 'First' }, op],
    });
    expect(result).toMatchObject({ ok: false, error: { opIndex: 1, path: op.path } });
    expect(spec).toEqual(before);
  });

  it('checks each expected field, and accepts revision as host bookkeeping', () => {
    const spec = { annotations: [{ id: 'a', type: 'text', text: 'A' }] };
    for (const expected of [{ id: 'b' }, { type: 'range' }, { text: 'B' }]) {
      expect(
        applyEditTransaction(spec, {
          ops: [{ op: 'remove', path: '/annotations/0', expect: expected }],
        }).ok,
      ).toBe(false);
    }
    roundTrip(
      spec,
      {
        revision: 'old',
        ops: [{ op: 'remove', path: '/annotations/0', expect: spec.annotations[0] }],
      },
      { annotations: [] },
    );
  });
});
