/**
 * Minimal ambient types for `d3-force-3d`, which ships untyped (no `types`
 * field, no `@types/` package as of 3.0.6). Only the surface the 3D adapter
 * uses is declared; widen it here rather than reaching for `any` at call sites.
 */

declare module 'd3-force-3d' {
  /** A simulation node as d3-force-3d mutates it. */
  export interface Force3DNode {
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
  }

  /** A force function with d3's optional `initialize` hook. */
  export interface Force3D<N> {
    (alpha: number): void;
    initialize?(nodes: N[], random?: () => number): void;
  }

  export interface CollideForce<N> extends Force3D<N> {
    radius(): (node: N, i: number, nodes: N[]) => number;
    radius(radius: number | ((node: N, i: number, nodes: N[]) => number)): CollideForce<N>;
    strength(): number;
    strength(strength: number): CollideForce<N>;
    iterations(): number;
    iterations(iterations: number): CollideForce<N>;
  }

  export function forceCollide<N extends Force3DNode>(
    radius?: number | ((node: N, i: number, nodes: N[]) => number),
  ): CollideForce<N>;
}
