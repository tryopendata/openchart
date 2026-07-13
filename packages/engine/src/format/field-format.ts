import type { FieldFormatContext, NumberFormatter } from '@opendata-ai/openchart-core';
import {
  computeFieldFormatContext,
  defaultNumberFormatter,
  resolveNumberFormatter,
} from '@opendata-ai/openchart-core';

export interface FieldFormatOptions {
  surfaceFormat?: string;
  channelFormat?: string;
  values?: Iterable<unknown>;
  context?: FieldFormatContext;
  surface?: 'chart' | 'table';
  step?: number;
}

export function resolveFieldFormatter(opts: FieldFormatOptions): NumberFormatter {
  const surfFmt = opts.surfaceFormat || undefined;
  const chanFmt = opts.channelFormat || undefined;
  const ctx: FieldFormatContext = opts.context
    ? { ...opts.context }
    : computeFieldFormatContext(opts.values ?? [], opts.surface);
  if (opts.step != null) ctx.step = opts.step;
  if (opts.surface) ctx.surface = opts.surface;
  const fmt = resolveNumberFormatter(surfFmt ?? chanFmt, ctx);
  return fmt ?? defaultNumberFormatter(ctx);
}
