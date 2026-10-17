import type { Annotation } from '../types/spec';

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
