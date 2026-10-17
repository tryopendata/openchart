import type { ChartEventHandlers, EditTransaction } from '@opendata-ai/openchart-core';
import { describe, expectTypeOf, it } from 'vitest';
import type { GraphInstance } from '../graph-mount';
import type { MountOptions } from '../mount';

describe('v9 editing surface', () => {
  it('exposes one transaction callback and no retired callbacks or mount aliases', () => {
    expectTypeOf<
      Parameters<NonNullable<ChartEventHandlers['onEdit']>>[0]
    >().toEqualTypeOf<EditTransaction>();
    expectTypeOf<
      Extract<
        keyof MountOptions,
        'onEditTransaction' | 'onAnnotationEdit' | 'onTextEdit' | 'onDataPointClick' | 'responsive'
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<Extract<keyof GraphInstance, 'updateVisuals'>>().toEqualTypeOf<never>();
  });
});
