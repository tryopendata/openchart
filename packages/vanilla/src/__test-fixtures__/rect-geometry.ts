/**
 * Bar/column geometry readers for tests.
 *
 * A bar with `cornerRadiusSides` renders as a `<path>`, not a `<rect>` — SVG's
 * `rx` rounds all four corners or none, and the default bar rounds only its
 * value end. Tests that care about a bar's size have to read either shape, so
 * they go through here instead of querying `rect` directly.
 */

export interface RectGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bounds of a path emitted by `rectPathWithCorners`, whose grammar is
 * M/H/V/A/Z with absolute coordinates only.
 */
function pathBounds(d: string): RectGeometry | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const command of d.match(/[A-Z][^A-Z]*/g) ?? []) {
    const nums = (command.slice(1).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    switch (command[0]) {
      case 'M':
        xs.push(nums[0]);
        ys.push(nums[1]);
        break;
      case 'H':
        xs.push(nums[0]);
        break;
      case 'V':
        ys.push(nums[0]);
        break;
      case 'A':
        // rx ry rotation large-arc sweep x y
        xs.push(nums[5]);
        ys.push(nums[6]);
        break;
      default:
        break;
    }
  }
  if (xs.length === 0 || ys.length === 0) return null;
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Geometry of one rect mark's shape element (a `<rect>` or a corner `<path>`). */
export function rectMarkGeometry(group: Element | null | undefined): RectGeometry | null {
  if (!group) return null;
  const rect = group.querySelector('rect');
  if (rect) {
    return {
      x: Number(rect.getAttribute('x')),
      y: Number(rect.getAttribute('y')),
      width: Number(rect.getAttribute('width')),
      height: Number(rect.getAttribute('height')),
    };
  }
  const path = group.querySelector('path');
  const d = path?.getAttribute('d');
  return d ? pathBounds(d) : null;
}

/** Geometry of every `.oc-mark-rect` under `root`, in document order. */
export function rectMarkGeometries(root: ParentNode): RectGeometry[] {
  return Array.from(root.querySelectorAll('.oc-mark-rect'))
    .map(rectMarkGeometry)
    .filter((g): g is RectGeometry => g !== null);
}

/** The shape element (`<rect>` or `<path>`) drawn for a rect mark. */
export function rectMarkShape(group: Element | null | undefined): Element | null {
  return group?.querySelector('rect, path') ?? null;
}
