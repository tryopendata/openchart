import type { SpecPatch, VizSpec } from '@opendata-ai/openchart-core';

const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
/** JSON-pointer patch application is atomic: validate all paths before returning a new document. */
export function applySpecPatch(spec: VizSpec, patch: SpecPatch): VizSpec {
  if (JSON.stringify(spec) !== patch.precondition)
    throw new Error('This suggestion is stale. Review the current document again.');
  const copy = structuredClone(spec);
  for (const change of patch.changes) {
    if (!change.path.startsWith('/')) throw new Error('Patch paths must be JSON pointers.');
    const keys = change.path
      .slice(1)
      .split('/')
      .map((key) => key.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (keys.some((key) => unsafe.has(key) || key.length === 0))
      throw new Error('Unsafe patch path.');
    let parent = copy as unknown as Record<string, unknown>;
    for (const key of keys.slice(0, -1)) {
      if (parent[key] === undefined) parent[key] = {};
      if (!parent[key] || typeof parent[key] !== 'object')
        throw new Error('Patch path is no longer an object.');
      parent = parent[key] as Record<string, unknown>;
    }
    parent[keys[keys.length - 1]] = structuredClone(change.value);
  }
  return copy;
}
