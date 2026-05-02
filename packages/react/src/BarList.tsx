/**
 * React BarList component: thin wrapper around the vanilla adapter.
 *
 * Mounts a barlist instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createBarList() function.
 */

import type { BarListSpec, DarkMode, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  type BarListInstance,
  type BarListMountOptions,
  createBarList,
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

export interface BarListProps {
  spec: BarListSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onRowClick?: (row: { label: string; value: number; data: Record<string, unknown> }) => void;
  onRowHover?: (
    row: {
      label: string;
      value: number;
      data: Record<string, unknown>;
    } | null,
  ) => void;
  className?: string;
  style?: CSSProperties;
}

export interface BarListHandle {
  readonly instance: BarListInstance | null;
}

export const BarList = forwardRef<BarListHandle, BarListProps>(function BarList(
  { spec, theme: themeProp, darkMode, onRowClick, onRowHover, className, style },
  ref,
) {
  const contextTheme = useVizTheme();
  const contextDarkMode = useVizDarkMode();
  const theme = themeProp ?? contextTheme;
  const resolvedDarkMode = darkMode ?? contextDarkMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<BarListInstance | null>(null);
  const specRef = useRef<string>('');

  const handlersRef = useRef<{
    onRowClick?: BarListProps['onRowClick'];
    onRowHover?: BarListProps['onRowHover'];
  }>({});
  handlersRef.current = { onRowClick, onRowHover };

  const stableOnRowClick = useCallback(
    (row: { label: string; value: number; data: Record<string, unknown> }) =>
      handlersRef.current.onRowClick?.(row),
    [],
  );
  const stableOnRowHover = useCallback(
    (row: { label: string; value: number; data: Record<string, unknown> } | null) =>
      handlersRef.current.onRowHover?.(row),
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

  // Mount barlist and recreate when theme/darkMode change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: spec intentionally excluded - spec changes handled via update() in Effect 2
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options: BarListMountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      onRowClick: stableOnRowClick,
      onRowHover: stableOnRowHover,
      responsive: true,
    };

    instanceRef.current = createBarList(container, spec, options);
    specRef.current = JSON.stringify(spec);

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [theme, resolvedDarkMode, stableOnRowClick, stableOnRowHover]);

  // Update barlist when spec changes.
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
      className={className ? `oc-barlist-root ${className}` : 'oc-barlist-root'}
      style={style}
    />
  );
});
