/**
 * Deep merge for applying partial patches onto a spec-shaped object.
 *
 * Used by the scrollytelling story layer (`vanilla/story`) to apply
 * cumulative deep-partial spec patches onto a base spec. Arrays REPLACE
 * rather than merge element-by-element: predictable behavior for things
 * like `annotations` or `data`, where index-wise merging would silently
 * produce nonsense. Plain objects merge key-by-key, recursively.
 */
// biome-ignore lint/suspicious/noExplicitAny: recursive object merge requires dynamic typing
export function deepMergeSpec(target: any, source: any): any {
  if (source === undefined) return target;
  if (source === null) return source;
  if (
    typeof source !== 'object' ||
    Array.isArray(source) ||
    typeof target !== 'object' ||
    target === null ||
    Array.isArray(target)
  ) {
    return source;
  }

  const result = { ...target };
  for (const key of Object.keys(source)) {
    result[key] = deepMergeSpec(target[key], source[key]);
  }
  return result;
}
