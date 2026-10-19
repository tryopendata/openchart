import type { EditOp, EditTransaction } from '@opendata-ai/openchart-core';
import type { GestureEdit } from './gesture-edit';

type Node = Record<string, unknown>;
const object = (value: unknown): Node | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Node)
    : undefined;

export { annotationSource } from '@opendata-ai/openchart-core';

import { annotationSource } from '@opendata-ai/openchart-core';

/** Convert internal gesture descriptions to atomic authored operations. */
export function editToTransaction(
  spec: unknown,
  edit: GestureEdit,
  revision?: string | number,
): EditTransaction | null {
  const root = object(spec) ?? {};
  const source = annotationSource(spec);
  const ops: EditOp[] = [];
  const set = (path: string, value: unknown, expect?: EditOp['expect']) =>
    ops.push({ op: 'set', path, value, ...(expect ? { expect } : {}) });
  if (edit.type === 'add') {
    ops.push({ op: 'add', path: `${source.path}/-`, value: edit.annotation });
  } else if ('element' in edit && edit.element.type === 'annotation') {
    const expectedPath = `${source.path}/${edit.element.index}`;
    if (
      edit.element.path !== undefined &&
      edit.element.path !== expectedPath &&
      !edit.element.path.startsWith(`${expectedPath}/`)
    )
      return null;
    const annotation = source.annotations[edit.element.index];
    if (!annotation || (edit.element.id !== undefined && annotation.id !== edit.element.id))
      return null;
    const authored = 'annotation' in edit ? edit.annotation : annotation;
    // Non-text annotations carry their identifying text in `label`; the
    // precondition checks it there so reordered ID-less reflines still fail.
    const text = authored.type === 'text' ? authored.text : authored.label;
    const expected: EditOp['expect'] = {
      type: authored.type,
      ...(text !== undefined ? { text } : {}),
      ...(authored.id !== undefined ? { id: authored.id } : {}),
    };
    const path = `${source.path}/${edit.element.index}`;
    switch (edit.type) {
      case 'annotation':
        if (edit.anchor !== undefined) set(`${path}/anchor`, edit.anchor, expected);
        set(`${path}/offset`, edit.offset, expected);
        if (edit.responsive !== undefined) set(`${path}/responsive`, edit.responsive, expected);
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
      default:
        edit satisfies never;
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
  }
  return ops.length ? { ...(revision !== undefined ? { revision } : {}), ops } : null;
}
