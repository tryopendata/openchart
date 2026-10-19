import type { DatasetBinding, FieldMetadata, ReaderObservation } from './design';

export type ReaderDomainValue =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'date'; value: string };
export interface ReaderBindingScope {
  dataset: string;
  transform: string;
  grouping: string[];
  xField: string;
  valueField: string;
}
export interface ReaderPanelScope {
  id: string;
  facet?: { field: string; values: ReaderDomainValue[] };
}
export interface ReaderSeries {
  key: string;
  label: string;
  color?: string;
  valueField: string;
  metadata?: FieldMetadata;
}
export interface ReaderSliceMember {
  series: ReaderSeries;
  status: 'observed' | 'no-observation' | 'ambiguous';
  observations: ReaderObservation[];
  value?: number;
  valueStatus?: 'finite' | 'missing' | 'invalid';
  formattedValue?: string;
}
export interface ReaderSlice {
  kind: 'slice';
  key: string;
  binding: ReaderBindingScope;
  panel: ReaderPanelScope;
  x: ReaderDomainValue;
  xLabel: string;
  revision: string;
  members: ReaderSliceMember[];
  persistent: boolean;
  state: 'visible' | 'filtered';
}
export interface ReaderSliceSelection {
  kind: 'slices';
  preview: ReaderSlice | null;
  pinned: ReaderSlice[];
  announcement: string;
}
export interface ReaderChangeMeta {
  reason: 'user' | 'data' | 'filter' | 'programmatic';
}
export interface ReaderComparisonScope {
  dataset: string;
  transform: string;
  grouping: string[];
  panelId: string;
}
export interface ReaderComparisonOperand {
  value: number;
  metadata?: FieldMetadata;
  binding: ReaderComparisonScope;
}
export type ReaderComparisonResult =
  | {
      status: 'comparable';
      absolute: number;
      relative?: number;
      unit: string;
      relativeUnavailable?: 'zero-baseline' | 'negative-baseline';
    }
  | {
      status: 'unavailable';
      reason: 'nonfinite' | 'missing-metadata' | 'incompatible-metadata' | 'incompatible-binding';
      message: string;
    };
export interface ReaderSliceIndexOptions {
  revision: string;
  binding?: DatasetBinding;
}
