/**
 * React Map component: thin wrapper around the vanilla adapter.
 *
 * Mounts a map instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createMap() function.
 *
 * Supports forwardRef for imperative control via the instance getter.
 */

import type { DarkMode, MapSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import { createMap, type MapInstance, type MapMountOptions } from '@opendata-ai/openchart-vanilla';
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { useVizDarkMode, useVizTheme } from './ThemeContext';

type MapFeatureEvent = {
  id: string | number;
  name?: string;
  data: Record<string, unknown> | null;
};

export interface MapProps {
  /** The map spec to render. */
  spec: MapSpec;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode: "auto", "force", or "off". */
  darkMode?: DarkMode;
  /** Callback when a map feature is clicked. */
  onMarkClick?: (feature: MapFeatureEvent) => void;
  /** Callback when a map feature is hovered (null when hover ends). */
  onMarkHover?: (feature: MapFeatureEvent | null) => void;
  /** CSS class name for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
}

export interface MapHandle {
  /** The underlying map instance (null until mounted). */
  readonly instance: MapInstance | null;
}

export const GeoMap = forwardRef<MapHandle, MapProps>(function GeoMap(
  { spec, theme: themeProp, darkMode, onMarkClick, onMarkHover, className, style },
  ref,
) {
  const contextTheme = useVizTheme();
  const contextDarkMode = useVizDarkMode();
  const theme = themeProp ?? contextTheme;
  const resolvedDarkMode = darkMode ?? contextDarkMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<MapInstance | null>(null);
  const specRef = useRef<string>('');

  const handlersRef = useRef<{
    onMarkClick?: MapProps['onMarkClick'];
    onMarkHover?: MapProps['onMarkHover'];
  }>({});
  handlersRef.current = {
    onMarkClick,
    onMarkHover,
  };

  const stableOnMarkClick = useCallback(
    (feature: MapFeatureEvent) => handlersRef.current.onMarkClick?.(feature),
    [],
  );
  const stableOnMarkHover = useCallback(
    (feature: MapFeatureEvent | null) => handlersRef.current.onMarkHover?.(feature),
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

    const options: MapMountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      onMarkClick: stableOnMarkClick,
      onMarkHover: stableOnMarkHover,
      responsive: true,
    };

    instanceRef.current = createMap(container, spec, options);
    specRef.current = JSON.stringify(spec);

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [theme, resolvedDarkMode, stableOnMarkClick, stableOnMarkHover]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;

    const specString = JSON.stringify(spec);
    if (specString === specRef.current) return;

    specRef.current = specString;
    instance.update(spec);
  }, [spec]);

  return (
    <div
      ref={containerRef}
      className={className ? `oc-map-root ${className}` : 'oc-map-root'}
      style={style}
    />
  );
});
