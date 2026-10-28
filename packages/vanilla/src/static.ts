import { renderStaticParts, type StaticRenderOptions, type StaticSpec } from './static-render';

export type { StaticRenderOptions } from './static-render';

/** Render standalone SVG using a per-call element tree and id scope. */
export function renderStaticSVG(spec: StaticSpec, options?: StaticRenderOptions): string {
  return renderStaticParts(spec, options).serialize();
}
