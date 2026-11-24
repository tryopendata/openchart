import type { RaceSpec } from '@opendata-ai/openchart-core';
import { renderStaticParts, type StaticRenderOptions, type StaticSpec } from './static-render';

export type { StaticRenderOptions } from './static-render';

/** Render standalone SVG using a per-call element tree and id scope. */
export function renderStaticSVG(spec: StaticSpec, options?: StaticRenderOptions): string {
  return renderStaticParts(spec, options).serialize();
}

/** Render a race's final period as a standalone SVG. Size includes any authored controls strip. */
export function renderRaceStaticSVG(spec: RaceSpec, options?: StaticRenderOptions): string {
  return renderStaticSVG(spec, options);
}
