import type { DataRow } from './spec';

export interface GeoEntityRef {
  kind: 'feature' | 'point';
  id: string | number;
  canonicalId: string;
}
export interface GeoReaderObservation {
  entity: GeoEntityRef;
  observation: string;
  persistent: boolean;
  datum: DataRow | null;
  previous?: DataRow | null;
  state: 'visible' | 'filtered';
}
export interface GeoReaderSelection {
  preview: GeoReaderObservation | null;
  pinned: GeoReaderObservation[];
  announcement: string;
}
