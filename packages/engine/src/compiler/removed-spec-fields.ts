import { encodePointerToken } from '@opendata-ai/openchart-core';
import type { ValidationError } from './types';

type Node = Record<string, unknown>;
const node = (value: unknown): Node | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Node)
    : undefined;

/** Reject retired authoring forms before sugar can hide them. Migration accepts raw v8 input. */
export function collectRemovedSpecErrors(value: unknown, prefix = ''): ValidationError[] {
  const spec = node(value);
  if (!spec) return [];
  const errors: ValidationError[] = [];
  const suggestion = 'Run migrateSpecV8 on older documents before compiling.';
  // Paths are JSON Pointers, matching mark-option errors and migration repairs.
  const reject = (path: string, replacement: string) =>
    errors.push({
      code: 'INVALID_VALUE',
      path: `${prefix}/${path}`,
      message: `${prefix}/${path} was removed in v9. ${replacement} ${suggestion}`,
      suggestion,
    });
  if ('darkMode' in spec) reject('darkMode', 'Set darkMode on the mount option.');
  if (spec.type === 'table' && 'compact' in spec) reject('compact', 'Use density: "condensed".');
  if (['sankey', 'map', 'barlist'].includes(String(spec.type)) && 'valueFormat' in spec)
    reject('valueFormat', `Use encoding.${spec.type === 'map' ? 'color' : 'value'}.format.`);
  if (node(spec.labels) && 'offsets' in node(spec.labels)!)
    reject('labels/offsets', 'Use endpointLabels.');
  if (spec.animation === 'legacy' || node(spec.animation)?.preset === 'legacy')
    reject('animation', 'Omit the preset for the former timing.');
  const mark = node(spec.mark);
  if (mark && 'render' in mark) reject('mark/render', 'Use the renderer mount option.');
  const encoding = node(spec.encoding);
  for (const key of ['radius', 'shape', 'href', 'order'])
    if (encoding && key in encoding) reject(`encoding/${key}`, 'This channel has no renderer.');
  const markType = typeof spec.mark === 'string' ? spec.mark : mark?.type;
  // Sugar mirrors theta into y, so only a y that disagrees with theta is authored.
  if (
    ['arc', 'waffle', 'parliament'].includes(String(markType)) &&
    encoding?.y &&
    JSON.stringify(encoding.y) !== JSON.stringify(encoding.theta)
  )
    reject(
      'encoding/y',
      encoding.theta
        ? 'Remove encoding.y; encoding.theta already sets the angle.'
        : 'Use encoding.theta.',
    );
  const chrome = node(node(spec.theme)?.chrome);
  for (const [key, entry] of Object.entries(chrome ?? {}))
    if (typeof entry === 'string')
      reject(`theme/chrome/${encodePointerToken(key)}`, 'Use a { color } object.');
  if (Array.isArray(spec.annotations))
    spec.annotations.forEach((entry, index) => {
      const annotation = node(entry);
      if (annotation?.type === 'rule') reject(`annotations/${index}/type`, 'Use refline.');
      if (annotation?.type === 'text' && 'label' in annotation)
        reject(
          `annotations/${index}/label`,
          'label had no effect on text annotations; put the callout copy in text (and supporting copy in subtitle).',
        );
    });
  if (Array.isArray(spec.layer))
    spec.layer.forEach((entry, index) => {
      errors.push(...collectRemovedSpecErrors(entry, `${prefix}/layer/${index}`));
    });
  for (const [breakpoint, override] of Object.entries(node(spec.overrides) ?? {}))
    errors.push(
      ...collectRemovedSpecErrors(
        override,
        `${prefix}/overrides/${encodePointerToken(breakpoint)}`,
      ),
    );
  return errors;
}
