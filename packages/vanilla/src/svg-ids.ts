/** A monotonic page scope prevents fragment-reference collisions across live charts. */
export interface IdScope {
  next(kind: string): string;
  readonly prefix: string;
}
export function createIdScope(prefix = ''): IdScope {
  let counter = 0;
  return { prefix, next: (kind) => `${prefix ? `${prefix}-` : ''}${kind}-${counter++}` };
}
export const pageIdScope = createIdScope();
/** Compatibility entry point for one release; new renderers use their context. */
export function nextSvgId(kind: string): string {
  return pageIdScope.next(kind);
}
