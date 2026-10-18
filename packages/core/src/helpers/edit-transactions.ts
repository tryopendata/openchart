import type { EditOp, EditTransaction } from '../types/events';
import { jsonPointer } from './json-pointer';

export type EditTransactionResult<T> =
  | { ok: true; spec: T; inverse: EditTransaction }
  | { ok: false; error: { opIndex: number; path: string; reason: string } };

type Container = Record<string, unknown> | unknown[];

function isContainer(value: unknown): value is Container {
  return (
    Array.isArray(value) ||
    (value !== null &&
      typeof value === 'object' &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null))
  );
}

// Preserve non-JSON data values (e.g. Dates), without exposing any mutable spec
// containers to the transaction. Such values cannot be traversed by a pointer.
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (!isContainer(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)])) as T;
}

function tokens(path: string): string[] {
  if (!path.startsWith('/')) throw new Error('Expected a non-root JSON Pointer beginning with /.');
  return path
    .slice(1)
    .split('/')
    .map((token) => {
      if (/~(?:[^01]|$)/.test(token)) throw new Error('Invalid JSON Pointer escape.');
      const decoded = token.replace(/~1/g, '/').replace(/~0/g, '~');
      if (['__proto__', 'prototype', 'constructor'].includes(decoded)) {
        throw new Error('Unsafe property in edit path.');
      }
      return decoded;
    });
}

function keyAt(parent: Container, token: string, insert = false): string | number {
  if (!Array.isArray(parent)) return token;
  if (insert && token === '-') return parent.length;
  if (!/^(0|[1-9]\d*)$/.test(token)) throw new Error('Expected an array index.');
  const index = Number(token);
  if (
    !Number.isSafeInteger(index) ||
    index > parent.length ||
    (!insert && index === parent.length)
  ) {
    throw new Error('Array index is out of bounds.');
  }
  return index;
}

function read(parent: Container, key: string | number): unknown {
  return (parent as Record<string, unknown>)[key];
}

function checkExpectation(root: unknown, parts: string[], expected: EditOp['expect']): void {
  if (!expected) return;
  let end = -1;
  for (let i = 0; i + 1 < parts.length; i++) {
    if (parts[i] === 'annotations' && /^(0|[1-9]\d*)$/.test(parts[i + 1])) end = i + 2;
  }
  if (end === -1) throw new Error('Annotation precondition requires an annotation path.');
  let target = root;
  for (const part of parts.slice(0, end)) {
    if (!isContainer(target)) throw new Error('Annotation target no longer exists.');
    const key = keyAt(target, part);
    if (!Object.hasOwn(target, key)) throw new Error('Annotation target no longer exists.');
    target = read(target, key);
  }
  if (!isContainer(target) || Array.isArray(target))
    throw new Error('Annotation target is invalid.');
  for (const field of ['id', 'type', 'text'] as const) {
    // Reflines and ranges expose their text as `label`.
    const actual = field === 'text' && target.type !== 'text' ? target.label : target[field];
    if (Object.hasOwn(expected, field) && actual !== expected[field]) {
      throw new Error(`Annotation ${field} changed; discard the stale edit.`);
    }
  }
}

/**
 * Apply an ordered transaction to a private copy, returning it only when every
 * operation validates. The original spec is never mutated, even on failure.
 * The inverse restores both values and optional containers created by add.
 */
export function applyEditTransaction<T>(spec: T, tx: EditTransaction): EditTransactionResult<T> {
  const result = clone(spec);
  const inverse: EditOp[] = [];
  for (const [opIndex, op] of tx.ops.entries()) {
    try {
      if (!['set', 'add', 'remove'].includes(op.op)) throw new Error('Unknown edit operation.');
      if (op.op !== 'remove' && !Object.hasOwn(op, 'value'))
        throw new Error('Edit value is missing.');
      const parts = tokens(op.path);
      checkExpectation(result, parts, op.expect);
      let parent: unknown = result;
      const created: string[] = [];
      for (let i = 0; i < parts.length - 1; i++) {
        if (!isContainer(parent)) throw new Error('Cannot traverse a primitive or non-JSON value.');
        const key = keyAt(parent, parts[i]);
        if (!Object.hasOwn(parent, key)) {
          if (op.op !== 'add' || Array.isArray(parent))
            throw new Error('Intermediate container is missing.');
          parent[key] = /^(0|[1-9]\d*|-)$/.test(parts[i + 1]) ? [] : {};
          created.push(jsonPointer(...parts.slice(0, i + 1)));
        }
        parent = read(parent, key);
      }
      if (!isContainer(parent)) throw new Error('Edit parent is not a JSON container.');
      const key = keyAt(parent, parts.at(-1)!, op.op === 'add');
      const exists = Object.hasOwn(parent, key);
      const old = read(parent, key);
      const path = jsonPointer(...parts.slice(0, -1), key);
      let undo: EditOp;
      if (op.op === 'remove') {
        if (!exists) throw new Error('Edit target no longer exists.');
        if (Array.isArray(parent)) parent.splice(Number(key), 1);
        else delete parent[key];
        undo = { op: 'add', path, value: old };
      } else if (op.op === 'add' && Array.isArray(parent)) {
        parent.splice(Number(key), 0, clone(op.value));
        undo = { op: 'remove', path };
      } else {
        (parent as Record<string, unknown>)[key] = clone(op.value);
        undo = exists ? { op: 'set', path, value: old } : { op: 'remove', path };
      }
      inverse.unshift(undo, ...created.reverse().map((path): EditOp => ({ op: 'remove', path })));
    } catch (error) {
      return {
        ok: false,
        error: {
          opIndex,
          path: op.path,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
  return {
    ok: true,
    spec: result,
    inverse: { ...(tx.revision !== undefined ? { revision: tx.revision } : {}), ops: inverse },
  };
}
