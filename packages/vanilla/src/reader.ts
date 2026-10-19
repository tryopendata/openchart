import type {
  ChartSpec,
  LayerSpec,
  ReaderChangeMeta,
  ReaderSelection,
  ReaderSliceSelection,
} from '@opendata-ai/openchart-core';
import type { ChartInstance } from './mount';
import { createObservationReader, type ReaderController } from './observation-reader';
import type { ReaderPresentationOptions } from './reader-options';
import { createSliceReader, type SliceReaderController } from './slice-reader';

export type { ReaderController } from './observation-reader';
export type { ReaderPresentationOptions, ReaderSetOptions } from './reader-options';
export type { SliceReaderController } from './slice-reader';
export function createReader(
  container: HTMLElement,
  instance: ChartInstance,
  spec: ChartSpec | LayerSpec,
  onChange: (selection: ReaderSelection, meta: ReaderChangeMeta) => void,
  options?: ReaderPresentationOptions & { mode?: 'observations' },
): ReaderController;
export function createReader(
  container: HTMLElement,
  instance: ChartInstance,
  spec: ChartSpec | LayerSpec,
  onChange: (selection: ReaderSliceSelection, meta: ReaderChangeMeta) => void,
  options: ReaderPresentationOptions & { mode: 'slices' },
): SliceReaderController;
export function createReader(
  container: HTMLElement,
  instance: ChartInstance,
  spec: ChartSpec | LayerSpec,
  onChange:
    | ((selection: ReaderSelection, meta: ReaderChangeMeta) => void)
    | ((selection: ReaderSliceSelection, meta: ReaderChangeMeta) => void),
  options: ReaderPresentationOptions = {},
): ReaderController | SliceReaderController {
  return options.mode === 'slices'
    ? createSliceReader(
        container,
        instance,
        spec,
        onChange as (selection: ReaderSliceSelection, meta: ReaderChangeMeta) => void,
        options,
      )
    : createObservationReader(
        container,
        instance,
        spec,
        onChange as (selection: ReaderSelection, meta: ReaderChangeMeta) => void,
        options,
      );
}
