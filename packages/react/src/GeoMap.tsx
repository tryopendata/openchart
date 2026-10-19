/**
 * React Map component: thin wrapper around the vanilla adapter.
 *
 * Mounts a map instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createGeoMap() function.
 *
 * Supports forwardRef for imperative control via the instance getter.
 */

import type {
  DarkMode,
  GeoMapSpec,
  GeoReaderSelection,
  ReaderChangeMeta,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { mergeThemeConfig } from '@opendata-ai/openchart-core';
import {
  type Camera,
  createGeoMap,
  createGeoReaderBinding,
  type GeoMapCameraChangeMeta,
  type GeoMapInstance,
  type GeoMapMarkEvent,
  type GeoMapMountOptions,
  type GeoReaderOptions,
} from '@opendata-ai/openchart-vanilla';
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useVizDarkMode, useVizTheme } from './ThemeContext';

export interface GeoMapProps {
  reader?: false | GeoReaderOptions;
  readerSelection?: GeoReaderSelection;
  onReaderChange?: (selection: GeoReaderSelection, meta: ReaderChangeMeta) => void;
  labelInventory?: GeoMapMountOptions['labelInventory'];
  /** The map spec to render. */
  spec: GeoMapSpec;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode: "auto", "force", or "off". */
  darkMode?: DarkMode;
  /** Callback when a map feature is clicked. */
  onMarkClick?: (feature: GeoMapMarkEvent) => void;
  /** Callback when a map feature is hovered (null when hover ends). */
  onMarkHover?: (feature: GeoMapMarkEvent | null) => void;
  /** Called whenever the camera moves (reader zoom/pan, zoomTo, focus). */
  onCameraChange?: (camera: Camera, meta?: GeoMapCameraChangeMeta) => void;
  /** CSS class name for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
}

export interface GeoMapHandle {
  /** The underlying map instance (null until mounted). */
  readonly instance: GeoMapInstance | null;
}

export const GeoMap = forwardRef<GeoMapHandle, GeoMapProps>(function GeoMap(
  {
    spec,
    reader,
    readerSelection,
    onReaderChange,
    theme: themeProp,
    darkMode,
    labelInventory,
    onMarkClick,
    onMarkHover,
    onCameraChange,
    className,
    style,
  },
  ref,
) {
  const contextTheme = useVizTheme();
  const contextDarkMode = useVizDarkMode();
  const theme = useMemo(() => mergeThemeConfig(contextTheme, themeProp), [contextTheme, themeProp]);
  const resolvedDarkMode = darkMode ?? contextDarkMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<GeoMapInstance | null>(null);
  const specRef = useRef<string>('');
  const readerBinding = useRef<ReturnType<typeof createGeoReaderBinding> | null>(null);
  readerBinding.current ??= createGeoReaderBinding();
  const readerConfig = useRef({ reader, readerSelection, onReaderChange });
  readerConfig.current = { reader, readerSelection, onReaderChange };
  const syncReader = () => {
    if (containerRef.current && instanceRef.current) {
      const config = readerConfig.current;
      readerBinding.current!.sync(
        containerRef.current,
        instanceRef.current,
        spec,
        config.reader,
        config.readerSelection,
        config.onReaderChange,
      );
    }
  };

  const handlersRef = useRef<{
    onMarkClick?: GeoMapProps['onMarkClick'];
    onMarkHover?: GeoMapProps['onMarkHover'];
    onCameraChange?: GeoMapProps['onCameraChange'];
  }>({});
  handlersRef.current = {
    onMarkClick,
    onMarkHover,
    onCameraChange,
  };

  const stableOnMarkClick = useCallback(
    (feature: GeoMapMarkEvent) => handlersRef.current.onMarkClick?.(feature),
    [],
  );
  const stableOnMarkHover = useCallback(
    (feature: GeoMapMarkEvent | null) => handlersRef.current.onMarkHover?.(feature),
    [],
  );
  const stableOnCameraChange = useCallback(
    (camera: Camera, meta?: GeoMapCameraChangeMeta) =>
      meta
        ? handlersRef.current.onCameraChange?.(camera, meta)
        : handlersRef.current.onCameraChange?.(camera),
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      get instance() {
        return instanceRef.current;
      },
    }),
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: spec intentionally excluded - spec changes handled via update() in Effect 2
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options: GeoMapMountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      onMarkClick: stableOnMarkClick,
      onMarkHover: stableOnMarkHover,
      onCameraChange: stableOnCameraChange,
      autoResize: true,
    };

    instanceRef.current = createGeoMap(container, spec, options);
    specRef.current = JSON.stringify(spec);
    syncReader();

    return () => {
      readerBinding.current?.detach();
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [theme, resolvedDarkMode, stableOnMarkClick, stableOnMarkHover, stableOnCameraChange]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sync reads current reader refs after the committed spec update
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;

    const specString = JSON.stringify(spec);
    if (specString === specRef.current) return;

    specRef.current = specString;
    instance.update(spec);
    syncReader();
  }, [spec]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reapply the host after theme-driven instance recreation
  useEffect(() => {
    instanceRef.current?.setLabelInventory(labelInventory);
  }, [labelInventory, theme, resolvedDarkMode]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sync uses stable instance and callback refs
  useEffect(() => {
    syncReader();
  }, [reader, readerSelection, onReaderChange]);

  return (
    <div
      ref={containerRef}
      className={className ? `oc-map-root ${className}` : 'oc-map-root'}
      style={style}
    />
  );
});
