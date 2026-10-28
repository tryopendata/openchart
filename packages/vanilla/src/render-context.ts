import type { ResolvedAnimation } from '@opendata-ai/openchart-core';
import { defaultElementFactory, type ElementFactory } from './renderers/svg-dom';
import { type IdScope, pageIdScope } from './svg-ids';

export { createIdScope, type IdScope, pageIdScope } from './svg-ids';
export interface MarkRenderState {
  animation?: ResolvedAnimation;
  gradientMap: Map<string, string>;
  patternMap: Map<string, string>;
  surface: string;
}
export interface RenderContext {
  factory: ElementFactory;
  ids: IdScope;
  marks: MarkRenderState;
  interactive: boolean;
  precision: number | null;
}
export function createRenderContext(
  opts: {
    factory?: ElementFactory;
    ids?: IdScope;
    interactive?: boolean;
    precision?: number | null;
  } = {},
): RenderContext {
  return {
    factory: opts.factory ?? defaultElementFactory,
    ids: opts.ids ?? pageIdScope,
    marks: { gradientMap: new Map(), patternMap: new Map(), surface: '' },
    interactive: opts.interactive ?? true,
    precision: opts.precision === undefined ? 3 : opts.precision,
  };
}
