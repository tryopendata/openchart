import type { ChartSpec, ReaderSelection } from '@opendata-ai/openchart-core';
import type { ChartInstance } from '../mount';
import { createReader } from '../reader';
/** Compile-only fixtures for the preserved four-argument API and slice overload. */
export function readerContract(container: HTMLElement, instance: ChartInstance, spec: ChartSpec) {
  const observations = createReader(container, instance, spec, (state) => {
    const datum = state.pinned[0]?.datum;
    void datum;
  });
  const slices = createReader(
    container,
    instance,
    spec,
    (state) => {
      const kind: 'slices' = state.kind;
      void kind;
    },
    { mode: 'slices' },
  );
  const observationCallback = (state: ReaderSelection) => {
    void state;
  };
  // @ts-expect-error The slice overload must not accept an observation-only callback.
  // biome-ignore format: keep the compile diagnostic on the expected-error line
  createReader(container,instance,spec,observationCallback,{mode:'slices'});
  return { observations, slices };
}
