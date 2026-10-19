/** Framework lifecycle bridge; reader state survives a renderer-only remount. */
import type {
  ChartSpec,
  GeoMapSpec,
  GeoReaderSelection,
  LayerSpec,
  ReaderChangeMeta,
  ReaderSelection,
  ReaderSliceSelection,
} from '@opendata-ai/openchart-core';
import type { GeoMapInstance } from './map-mount';
import { createGeoReader, type GeoReaderController, type GeoReaderOptions } from './map-reader';
import type { ChartInstance } from './mount';
import { createReader, type ReaderController, type SliceReaderController } from './reader';
import type { ReaderPresentationOptions } from './reader-options';
export type ChartReaderSelection = ReaderSelection | ReaderSliceSelection;
export type ChartReaderProps =
  | {
      reader?: false | (ReaderPresentationOptions & { mode?: 'observations' });
      readerSelection?: ReaderSelection;
      onReaderChange?: (selection: ReaderSelection, meta: ReaderChangeMeta) => void;
    }
  | {
      reader: ReaderPresentationOptions & { mode: 'slices' };
      readerSelection?: ReaderSliceSelection;
      onReaderChange?: (selection: ReaderSliceSelection, meta: ReaderChangeMeta) => void;
    };
export function createChartReaderBinding() {
  let controller: ReaderController | SliceReaderController | undefined,
    lastInstance: ChartInstance | undefined,
    lastSpec: ChartSpec | LayerSpec | undefined,
    mode: 'observations' | 'slices' | undefined;
  let retained: ChartReaderSelection | undefined;
  let callback: ((selection: ChartReaderSelection, meta: ReaderChangeMeta) => void) | undefined;
  const detach = () => {
    if (controller) {
      retained = controller.selection;
      controller.destroy();
      controller = undefined;
    }
    lastInstance = undefined;
  };
  return {
    sync(
      container: HTMLElement,
      instance: ChartInstance,
      spec: ChartSpec | LayerSpec,
      options: ReaderPresentationOptions | false | undefined,
      selection: ChartReaderSelection | undefined,
      onChange?: (selection: ChartReaderSelection, meta: ReaderChangeMeta) => void,
    ) {
      callback = onChange;
      if (!options) {
        detach();
        retained = undefined;
        mode = undefined;
        lastSpec = spec;
        return;
      }
      const nextMode = options.mode ?? 'observations';
      if (instance !== lastInstance || nextMode !== mode) {
        const oldMode = mode;
        detach();
        if (nextMode !== oldMode) retained = undefined;
        mode = nextMode;
        lastInstance = instance;
        controller =
          nextMode === 'slices'
            ? createReader(
                container,
                instance,
                lastSpec ?? spec,
                (state, meta) => callback?.(state, meta),
                { ...options, mode: 'slices' },
              )
            : createReader(
                container,
                instance,
                lastSpec ?? spec,
                (state, meta) => callback?.(state, meta),
                { ...options, mode: 'observations' },
              );
        if (retained) {
          if ('kind' in retained && nextMode === 'slices')
            (controller as SliceReaderController).setSelection(retained);
          else if (!('kind' in retained) && nextMode === 'observations')
            (controller as ReaderController).setSelection(retained);
        }
        if (lastSpec && lastSpec !== spec) controller.update(spec);
      }
      lastSpec = spec;
      controller!.setOptions(options);
      if (selection) {
        if ('kind' in selection && mode === 'slices')
          (controller as SliceReaderController).setSelection(selection);
        else if (!('kind' in selection) && mode === 'observations')
          (controller as ReaderController).setSelection(selection);
      }
    },
    detach,
    destroy() {
      detach();
      retained = undefined;
      lastSpec = undefined;
      mode = undefined;
      callback = undefined;
    },
  };
}
export function createGeoReaderBinding() {
  let controller: GeoReaderController | undefined,
    lastInstance: GeoMapInstance | undefined,
    lastSpec: GeoMapSpec | undefined,
    retained: GeoReaderSelection | undefined;
  let callback: ((selection: GeoReaderSelection, meta: ReaderChangeMeta) => void) | undefined;
  const detach = () => {
    if (controller) {
      retained = controller.selection;
      controller.destroy();
      controller = undefined;
    }
    lastInstance = undefined;
  };
  return {
    sync(
      container: HTMLElement,
      instance: GeoMapInstance,
      spec: GeoMapSpec,
      options: GeoReaderOptions | false | undefined,
      selection: GeoReaderSelection | undefined,
      onChange?: typeof callback,
    ) {
      callback = onChange;
      if (!options) {
        detach();
        retained = undefined;
        lastSpec = spec;
        return;
      }
      if (instance !== lastInstance) {
        detach();
        lastInstance = instance;
        controller = createGeoReader(
          container,
          instance,
          lastSpec ?? spec,
          (state, meta) => callback?.(state, meta),
          options,
        );
        if (retained) controller.setSelection(retained);
        if (lastSpec && lastSpec !== spec) controller.update(spec);
      }
      lastSpec = spec;
      controller!.setOptions(options);
      if (selection) controller!.setSelection(selection);
    },
    detach,
    destroy() {
      detach();
      retained = undefined;
      lastSpec = undefined;
      callback = undefined;
    },
  };
}
