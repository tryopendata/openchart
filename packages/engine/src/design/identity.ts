import type {
  DataRow,
  DatasetBinding,
  FieldMetadata,
  ObservationIdentity,
  ReaderSelection,
} from '@opendata-ai/openchart-core';

/** Type-tagging avoids collisions between e.g. 1 and "1". Missing keys are invalid. */
export function observationKey(value: unknown): string | null {
  if (typeof value === 'string') return `string:${value}`;
  if (typeof value === 'number' && Number.isFinite(value)) return `number:${value}`;
  if (typeof value === 'boolean') return `boolean:${value}`;
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return `date:${value.toISOString()}`;
  return null;
}

export function resolveObservationIdentities(
  data: DataRow[],
  keyField?: string,
  seriesField?: string,
): ObservationIdentity[] {
  const keys = data.map((row) => (keyField ? observationKey(row[keyField]) : null));
  const counts = new Map<string, number>();
  for (const key of keys) if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  return data.map((row, index) => ({
    observation:
      keys[index] !== null && counts.get(keys[index]!) === 1
        ? keys[index]!
        : `revision-row:${index}`,
    persistent: keys[index] !== null && counts.get(keys[index]!) === 1,
    series: seriesField ? (observationKey(row[seriesField]) ?? undefined) : undefined,
  }));
}

/** Filtering supplies all rows plus visible keys; deletion supplies a new full dataset. */
export function reconcileReaderSelection(
  selection: ReaderSelection,
  rows: DataRow[],
  keyField?: string,
  seriesField?: string,
  visibleKeys?: ReadonlySet<string>,
): ReaderSelection {
  const identities = resolveObservationIdentities(rows, keyField, seriesField);
  const byKey = new Map(identities.filter((id) => id.persistent).map((id) => [id.observation, id]));
  const data = new Map(identities.map((id, i) => [id.observation, rows[i]]));
  let cleared = false;
  const pinned = selection.pinned.flatMap((item) => {
    const id = byKey.get(item.observation);
    if (!item.persistent || !id) {
      cleared = true;
      return [];
    }
    const datum = data.get(id.observation)!;
    return [
      {
        ...id,
        datum,
        previous: JSON.stringify(datum) === JSON.stringify(item.datum) ? undefined : item.datum,
        state:
          visibleKeys && !visibleKeys.has(id.observation)
            ? ('filtered' as const)
            : ('visible' as const),
      },
    ];
  });
  return {
    preview: null,
    pinned,
    announcement: cleared
      ? 'Selection cleared: the observation was removed or no longer has a unique key.'
      : '',
  };
}

export interface ObservationComparison {
  absolute: number;
  relative?: number;
  unit?: string;
}

/** Explicit metadata is required across views; same-field callers can share it. */
export function compareObservations(
  before: number,
  after: number,
  a: FieldMetadata,
  b: FieldMetadata,
): ObservationComparison | null {
  if (
    ![before, after].every(Number.isFinite) ||
    !a.measure ||
    a.measure !== b.measure ||
    a.unit !== b.unit ||
    a.representation !== b.representation
  )
    return null;
  const percent = a.representation === 'percent' || a.representation === 'proportion';
  return {
    absolute: (after - before) * (a.representation === 'proportion' ? 100 : 1),
    ...(before !== 0 ? { relative: (after - before) / Math.abs(before) } : {}),
    unit: percent ? 'percentage points' : a.unit,
  };
}

export function linkedEntityKeys(
  row: DataRow,
  source: DatasetBinding,
  target: DatasetBinding,
): string[] {
  if (source.dataset !== target.dataset) return [];
  const value = row[source.entityField];
  if (source.kind === target.kind && source.transform === target.transform) {
    const key = observationKey(value);
    return key ? [key] : [];
  }
  if (source.kind === 'group' && target.kind === 'row') {
    const group = String(value);
    const members =
      source.groupMembers && Object.hasOwn(source.groupMembers, group)
        ? source.groupMembers[group]
        : [];
    return members.flatMap((member) => {
      const key = observationKey(member);
      return key ? [key] : [];
    });
  }
  return [];
}
