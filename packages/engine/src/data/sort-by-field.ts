import type { DataRow } from '@opendata-ai/openchart-core';

export function sortByField(data: DataRow[], field: string): DataRow[] {
  if (data.length <= 1) return [...data];

  return [...data].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    // Nulls last
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // Both numbers
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }

    // Both Dates
    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() - bVal.getTime();
    }

    // String values: try numeric parse, then lexicographic
    const aStr = String(aVal);
    const bStr = String(bVal);

    const aNum = Number(aStr);
    const bNum = Number(bStr);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
      return aNum - bNum;
    }

    return aStr.localeCompare(bStr);
  });
}
