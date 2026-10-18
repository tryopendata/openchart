import type { ChartSpec, EditTransaction, LayerSpec } from '@opendata-ai/openchart-core';
import { applyEditTransaction } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { barSpec } from '../__test-fixtures__/specs';
import { buildElementRef, findElementByRef } from '../interactions/selection';
import { createChart } from '../mount';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('annotation source and instance identity', () => {
  it('clicks the source annotation after filtering an out-of-domain entry', () => {
    const spec: ChartSpec = {
      ...barSpec,
      annotations: [
        { type: 'text', x: 10, y: 'missing', text: 'Hidden', id: 'hidden' },
        { type: 'text', x: 10, y: 'A', text: 'Visible', id: 'visible' },
      ],
    };
    const onAnnotationClick = vi.fn();
    const container = createContainer();
    const chart = createChart(container, spec, { onAnnotationClick });
    container
      .querySelector('[data-annotation-index="1"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onAnnotationClick.mock.calls[0][0]).toEqual(spec.annotations![1]);
    expect(onAnnotationClick.mock.calls[0][2]).toMatchObject({
      type: 'annotation',
      index: 1,
      id: 'visible',
      path: '/annotations/1',
    });
    expect(
      findElementByRef(container.querySelector('svg')!, {
        type: 'annotation',
        index: 1,
        id: 'visible',
        path: '/layer/0/annotations/1',
      }),
    ).toBeNull();
    chart.destroy();
  });

  it('links a numbered note to its source annotation, not its note number', () => {
    const annotations = Array.from({ length: 15 }, (_, i) => ({
      type: 'text' as const,
      x: 10,
      y: 'A',
      text: `A long callout number ${i}`,
      id: `note-${i}`,
    }));
    const spec = { ...barSpec, annotations };
    const onAnnotationClick = vi.fn();
    const container = createContainer();
    const chart = createChart(container, spec, { onAnnotationClick });
    const note = container.querySelector('[data-note-spec-index]')!;
    expect(note).not.toBeNull();
    const index = Number(note.getAttribute('data-note-spec-index'));
    note.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onAnnotationClick.mock.calls[0][0]).toEqual(annotations[index]);
    expect(onAnnotationClick.mock.calls[0][2]).toMatchObject({
      index,
      path: `/annotations/${index}`,
      id: `note-${index}`,
    });
    chart.destroy();
  });

  it('deletes the first leaf annotation atomically with the current revision', () => {
    const spec: LayerSpec = {
      layer: [
        { ...barSpec, annotations: [{ type: 'text', x: 10, y: 'A', text: 'Leaf', id: 'leaf' }] },
      ],
    };
    const transactions: EditTransaction[] = [];
    const container = createContainer();
    const chart = createChart(container, spec, {
      revision: 1,
      onEdit: (tx) => transactions.push(tx),
    });
    const el = container.querySelector('[data-annotation-index="0"]')!;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    container
      .querySelector('svg')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      revision: 1,
      ops: [
        {
          op: 'remove',
          path: '/layer/0/annotations/0',
          expect: { id: 'leaf', type: 'text', text: 'Leaf' },
        },
      ],
    });
    expect(applyEditTransaction(spec, transactions[0])).toMatchObject({
      ok: true,
      spec: { layer: [{ annotations: [] }] },
    });
    chart.destroy();
  });

  it('selects the clicked facet instance even with shared source identity', () => {
    const spec = {
      ...barSpec,
      data: barSpec.data.flatMap((row) => [
        { ...row, panel: 'one' },
        { ...row, panel: 'two' },
      ]),
      encoding: { ...barSpec.encoding, facet: { field: 'panel', type: 'nominal' } },
      annotations: [
        { type: 'text', x: 10, y: 'A', text: 'Shared', id: 'shared', responsive: false },
      ],
    } as ChartSpec;
    const container = createContainer();
    const chart = createChart(container, spec, { interaction: 'edit' });
    const elements = container.querySelectorAll<SVGElement>('[data-annotation-index="0"]');
    expect(elements).toHaveLength(2);
    const ref = buildElementRef(elements[1], spec.annotations!)!;
    expect(ref).toMatchObject({ facetInstance: elements[1].getAttribute('data-facet-instance') });
    expect(findElementByRef(container.querySelector('svg')!, ref)).toBe(elements[1]);
    expect(
      findElementByRef(container.querySelector('svg')!, {
        type: 'annotation',
        index: 0,
        id: 'removed',
      }),
    ).toBeNull();
    chart.destroy();
  });
});
