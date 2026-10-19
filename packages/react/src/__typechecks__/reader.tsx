import type { ChartSpec, ReaderSelection } from '@opendata-ai/openchart-core';
import { Chart } from '../Chart';
/** Compile-only fixtures: callback selection follows the configured mode. */
export function readerPropsContract(spec: ChartSpec) {
  const slices = (
    <Chart
      spec={spec}
      reader={{ mode: 'slices' }}
      onReaderChange={(state) => {
        const kind: 'slices' = state.kind;
        void kind;
      }}
    />
  );
  const observations = (
    <Chart
      spec={spec}
      reader={{ mode: 'observations' }}
      onReaderChange={(state) => {
        const datum = state.pinned[0]?.datum;
        void datum;
      }}
    />
  );
  const observationCallback = (state: ReaderSelection) => {
    void state;
  };
  // @ts-expect-error A slice reader cannot call an observation-only callback.
  // biome-ignore format: keep the compile diagnostic on the expected-error line
  const invalid=<Chart spec={spec} reader={{mode:'slices'}} onReaderChange={observationCallback}/>;
  return { slices, observations, invalid };
}
