import type { Annotation, EditOp, EditTransaction, ElementEdit } from '@opendata-ai/openchart-core';

type Node = Record<string, unknown>;
const object = (value: unknown): Node | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Node)
    : undefined;

/** Matches layer compilation's parent-or-first-leaf annotation ownership. */
export function annotationSource(spec: unknown): { annotations: Annotation[]; path: string } {
  const root = object(spec);
  if (Array.isArray(root?.annotations))
    return { annotations: root.annotations, path: '/annotations' };
  function firstLeaf(
    node: Node | undefined,
    path: string,
  ): { annotations: Annotation[]; path: string } | undefined {
    if (Array.isArray(node?.layer)) {
      for (const [index, child] of node.layer.entries()) {
        const result = firstLeaf(object(child), `${path}/layer/${index}`);
        if (result) return result;
      }
    } else if (node && 'mark' in node) {
      return {
        annotations: Array.isArray(node.annotations) ? node.annotations : [],
        path: `${path}/annotations`,
      };
    }
  }
  return firstLeaf(root, '') ?? { annotations: [], path: '/annotations' };
}

/** Bridge existing gesture events to authored operations without changing legacy callbacks. */
export function editToTransaction(
  spec: unknown,
  edit: ElementEdit,
  revision?: string | number,
): EditTransaction | null {
  const root = object(spec) ?? {};
  const source = annotationSource(spec);
  const ops: EditOp[] = [];
  const set = (path: string, value: unknown, expect?: EditOp['expect']) =>
    ops.push({ op: 'set', path, value, ...(expect ? { expect } : {}) });
  if (edit.type === 'legend-toggle') return null;
  if (edit.type === 'add') {
    ops.push({ op: 'add', path: `${source.path}/-`, value: edit.annotation });
  } else if ('element' in edit && edit.element.type === 'annotation') {
    const annotation = source.annotations[edit.element.index];
    if (!annotation || (edit.element.id !== undefined && annotation.id !== edit.element.id))
      return null;
    const authored = 'annotation' in edit ? edit.annotation : annotation;
    const expected: EditOp['expect'] = {
      type: authored.type,
      text: authored.type === 'text' ? authored.text : (authored.label ?? ''),
      ...(authored.id ? { id: authored.id } : {}),
    };
    // Non-text annotations have a label rather than a text property. The
    // precondition uses their authored text value (absent), not the display label.
    if (authored.type !== 'text') expected.text = undefined;
    const path = `${source.path}/${edit.element.index}`;
    switch (edit.type) {
      case 'annotation':
        set(`${path}/offset`, edit.offset, expected);
        break;
      case 'annotation-connector':
        set(
          `${path}/connectorOffset`,
          {
            ...(authored.type === 'text' ? authored.connectorOffset : {}),
            [edit.endpoint]: edit.offset,
          },
          expected,
        );
        break;
      case 'range-label':
      case 'refline-label':
        set(`${path}/labelOffset`, edit.labelOffset, expected);
        break;
      case 'annotation-anchor':
        set(`${path}/x`, edit.x, expected);
        set(`${path}/y`, edit.y, expected);
        break;
      case 'text-edit':
        set(`${path}/${annotation.type === 'text' ? 'text' : 'label'}`, edit.newText, expected);
        break;
      case 'delete':
        ops.push({ op: 'remove', path, expect: expected });
        break;
    }
  } else if (edit.type === 'chrome' || ('element' in edit && edit.element.type === 'chrome')) {
    const key =
      edit.type === 'chrome'
        ? edit.key
        : edit.element.type === 'chrome'
          ? edit.element.key
          : 'title';
    const chrome = object(root.chrome);
    const sugar = !Object.hasOwn(chrome ?? {}, key) && Object.hasOwn(root, key);
    const path = sugar ? `/${key}` : `/chrome/${key}`;
    const old = sugar ? root[key] : chrome?.[key];
    if (edit.type === 'delete') {
      ops.push({ op: 'remove', path });
    } else {
      const text =
        edit.type === 'text-edit' ? edit.newText : edit.type === 'chrome' ? edit.text : '';
      const value =
        edit.type === 'text-edit' && sugar && typeof old === 'string'
          ? text
          : {
              ...(object(old) ?? {}),
              text,
              ...(edit.type === 'chrome' ? { offset: edit.offset } : {}),
            };
      ops.push({ op: chrome || sugar ? 'set' : 'add', path, value });
    }
  } else if (edit.type === 'legend') {
    ops.push({
      op: 'add',
      path: '/legend',
      value: { ...(object(root.legend) ?? {}), offset: edit.offset },
    });
  } else if (edit.type === 'delete' && edit.element.type === 'legend') {
    ops.push({
      op: 'add',
      path: '/legend',
      value: { ...(object(root.legend) ?? {}), show: false },
    });
  } else if (edit.type === 'series-label') {
    const key = edit.series.replace(/~/g, '~0').replace(/\//g, '~1');
    ops.push({ op: 'add', path: `/labels/offsets/${key}`, value: edit.offset });
  }
  return ops.length ? { ...(revision !== undefined ? { revision } : {}), ops } : null;
}
