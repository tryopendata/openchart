/**
 * React TileMap component: thin wrapper around the vanilla adapter.
 *
 * Mounts a tilemap instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createTileMap() function.
 *
 * Supports forwardRef for imperative control via the instance getter.
 */

import type { DarkMode, ThemeConfig, TileMapSpec } from '@opendata-ai/openchart-core';
import {
  createTileMap,
  type TileMapInstance,
  type TileMapMountOptions,
} from '@opendata-ai/openchart-vanilla';
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { useVizDarkMode, useVizTheme } from './ThemeContext';

export interface TileMapProps {
  /** The tilemap spec to render. */
  spec: TileMapSpec;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode: "auto", "force", or "off". */
  darkMode?: DarkMode;
  /** Callback when a tile is clicked. */
  onTileClick?: (tile: {
    stateCode: string;
    stateName: string;
    value: number | null;
    data: Record<string, unknown>;
  }) => void;
  /** Callback when a tile is hovered (null when hover ends). */
  onTileHover?: (
    tile: {
      stateCode: string;
      stateName: string;
      value: number | null;
      data: Record<string, unknown>;
    } | null,
  ) => void;
  /** CSS class name for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
}

export interface TileMapHandle {
  /** The underlying tilemap instance (null until mounted). */
  readonly instance: TileMapInstance | null;
}

/**
 * React component that renders a tilemap from a TileMapSpec.
 *
 * Uses the vanilla adapter internally. The spec is compiled and rendered
 * as SVG inside a wrapper div. Spec changes trigger re-renders via the
 * vanilla adapter's update() method.
 */
export const TileMap = forwardRef<TileMapHandle, TileMapProps>(function TileMap(
  { spec, theme: themeProp, darkMode, onTileClick, onTileHover, className, style },
  ref,
) {
  const contextTheme = useVizTheme();
  const contextDarkMode = useVizDarkMode();
  const theme = themeProp ?? contextTheme;
  const resolvedDarkMode = darkMode ?? contextDarkMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<TileMapInstance | null>(null);
  const specRef = useRef<string>('');

  // Store event handlers in refs so they don't trigger recreation.
  const handlersRef = useRef<{
    onTileClick?: TileMapProps['onTileClick'];
    onTileHover?: TileMapProps['onTileHover'];
  }>({});
  handlersRef.current = {
    onTileClick,
    onTileHover,
  };

  // Stable callback wrappers that read from refs
  const stableOnTileClick = useCallback(
    (tile: {
      stateCode: string;
      stateName: string;
      value: number | null;
      data: Record<string, unknown>;
    }) => handlersRef.current.onTileClick?.(tile),
    [],
  );
  const stableOnTileHover = useCallback(
    (
      tile: {
        stateCode: string;
        stateName: string;
        value: number | null;
        data: Record<string, unknown>;
      } | null,
    ) => handlersRef.current.onTileHover?.(tile),
    [],
  );

  // Expose imperative handle
  useImperativeHandle(
    ref,
    () => ({
      get instance() {
        return instanceRef.current;
      },
    }),
    [],
  );

  // Mount tilemap and recreate when theme/darkMode change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: spec intentionally excluded - spec changes handled via update() in Effect 2
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options: TileMapMountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      onTileClick: stableOnTileClick,
      onTileHover: stableOnTileHover,
      responsive: true,
    };

    instanceRef.current = createTileMap(container, spec, options);
    specRef.current = JSON.stringify(spec);

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [theme, resolvedDarkMode, stableOnTileClick, stableOnTileHover]);

  // Update tilemap when spec changes.
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
      className={className ? `oc-tilemap-root ${className}` : 'oc-tilemap-root'}
      style={style}
    />
  );
});
