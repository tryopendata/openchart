import type { DatasetBinding, DesignDiagnostic } from '@opendata-ai/openchart-core';
export interface ReaderPresentationOptions {
  mode?: 'observations' | 'slices';
  panel?: false | { container: HTMLElement };
  comparison?: 'values' | 'absolute' | 'relative';
  allowNegativeRelative?: boolean;
  binding?: DatasetBinding;
  /** Source data revision. Geometry-only changes preserve the current revision. */
  revision?: string;
  onDiagnostic?: (diagnostic: DesignDiagnostic) => void;
}
export interface ReaderSetOptions {
  notify?: boolean;
}
