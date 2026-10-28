import type { MarkType } from '@opendata-ai/openchart-core';

// Compile-only provenance survives repeated sugar expansion and object spreads.
export const SOURCE_MARK_TYPE = Symbol('openchart.sourceMarkType');
export type SourceMarkSpec = { [SOURCE_MARK_TYPE]?: MarkType };
