import {
  applyEditTransaction,
  type ChartSpec,
  type ElementEdit,
} from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { annotationSource, editToTransaction } from '../interactions/edit-transactions';

const annotation = { type: 'text' as const, x: 1, y: 2, text: 'Note', id: 'note' };
const spec = { mark: 'point', data: [], encoding: {}, annotations: [annotation] } as ChartSpec;

describe('durable edit bridge', () => {
  it('addresses the first leaf and includes source preconditions', () => {
    const layered = { layer: [spec, { ...spec, annotations: [] }] };
    const tx = editToTransaction(
      layered,
      {
        type: 'annotation',
        element: { type: 'annotation', index: 0 },
        annotation,
        offset: { dx: 3 },
      },
      7,
    );
    expect(tx).toEqual({
      revision: 7,
      ops: [
        {
          op: 'set',
          path: '/layer/0/annotations/0/offset',
          value: { dx: 3 },
          expect: { id: 'note', type: 'text', text: 'Note' },
        },
      ],
    });
    expect(applyEditTransaction(layered, tx!).ok).toBe(true);
    expect(annotationSource({ ...layered, annotations: [] }).path).toBe('/annotations');
  });

  it('edits chrome shorthand and top-level sugar without dropping styles', () => {
    for (const [source, path, value] of [
      [{ chrome: { title: 'Old' } }, '/chrome/title', { text: 'New' }],
      [{ title: 'Old' }, '/title', 'New'],
      [
        { chrome: { title: { text: 'Old', color: 'red' } } },
        '/chrome/title',
        { text: 'New', color: 'red' },
      ],
    ] as const) {
      const tx = editToTransaction(source, {
        type: 'text-edit',
        element: { type: 'chrome', key: 'title' },
        oldText: 'Old',
        newText: 'New',
      });
      expect(tx?.ops).toEqual([{ op: 'set', path, value }]);
      expect(applyEditTransaction(source, tx!).ok).toBe(true);
    }
  });

  it('keeps transient visibility outside transactions', () => {
    expect(
      editToTransaction(spec, { type: 'legend-toggle', series: 'A', hidden: true }),
    ).toBeNull();
  });

  it('adds annotations to an absent array and removes the container on undo', () => {
    const source = { title: 'Chart' };
    const tx = editToTransaction(source, { type: 'add', annotation });
    const result = applyEditTransaction(source, tx!);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(applyEditTransaction(result.spec, result.inverse)).toMatchObject({
        ok: true,
        spec: source,
      });
  });

  it.each([
    { type: 'annotation-connector', endpoint: 'from', offset: { dx: 2 }, annotation },
    { type: 'annotation-anchor', x: 2, y: 3, annotation },
    { type: 'text-edit', oldText: 'Note', newText: 'Revised' },
    { type: 'delete' },
  ] as const)('emits applicable annotation operations for $type', (edit) => {
    const tx = editToTransaction(spec, {
      ...edit,
      element: { type: 'annotation', index: 0 },
    } as ElementEdit);
    expect(tx?.ops.length).toBeGreaterThan(0);
    expect(tx?.ops.every((op) => op.expect?.text === 'Note')).toBe(true);
    expect(applyEditTransaction(spec, tx!).ok).toBe(true);
  });
});
