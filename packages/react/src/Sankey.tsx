/**
 * React Sankey component: thin wrapper around the vanilla adapter.
 *
 * Mounts a sankey instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createSankey() function.
 *
 * Supports forwardRef for imperative control via the instance getter.
 */

import type { DarkMode, SankeySpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  createSankey,
  type SankeyInstance,
  type SankeyMountOptions,
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

export interface SankeyProps {
  /** The sankey spec to render. */
  spec: SankeySpec;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode: "auto", "force", or "off". */
  darkMode?: DarkMode;
  /** Callback when a node is clicked. */
  onNodeClick?: (node: Record<string, unknown>) => void;
  /** Callback when a link is clicked. */
  onLinkClick?: (link: Record<string, unknown>) => void;
  /** Callback when a node is hovered (null when hover ends). */
  onNodeHover?: (node: Record<string, unknown> | null) => void;
  /** Callback when a link is hovered (null when hover ends). */
  onLinkHover?: (link: Record<string, unknown> | null) => void;
  /** CSS class name for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
}

export interface SankeyHandle {
  /** The underlying sankey instance (null until mounted). */
  readonly instance: SankeyInstance | null;
}

/**
 * React component that renders a sankey diagram from a SankeySpec.
 *
 * Uses the vanilla adapter internally. The spec is compiled and rendered
 * as SVG inside a wrapper div. Spec changes trigger re-renders via the
 * vanilla adapter's update() method.
 */
export const Sankey = forwardRef<SankeyHandle, SankeyProps>(function Sankey(
  {
    spec,
    theme: themeProp,
    darkMode,
    onNodeClick,
    onLinkClick,
    onNodeHover,
    onLinkHover,
    className,
    style,
  },
  ref,
) {
  const contextTheme = useVizTheme();
  const contextDarkMode = useVizDarkMode();
  const theme = themeProp ?? contextTheme;
  const resolvedDarkMode = darkMode ?? contextDarkMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<SankeyInstance | null>(null);
  const specRef = useRef<string>('');

  // Store event handlers in refs so they don't trigger recreation.
  const handlersRef = useRef<{
    onNodeClick?: SankeyProps['onNodeClick'];
    onLinkClick?: SankeyProps['onLinkClick'];
    onNodeHover?: SankeyProps['onNodeHover'];
    onLinkHover?: SankeyProps['onLinkHover'];
  }>({});
  handlersRef.current = {
    onNodeClick,
    onLinkClick,
    onNodeHover,
    onLinkHover,
  };

  // Stable callback wrappers that read from refs
  const stableOnNodeClick = useCallback(
    (node: Record<string, unknown>) => handlersRef.current.onNodeClick?.(node),
    [],
  );
  const stableOnLinkClick = useCallback(
    (link: Record<string, unknown>) => handlersRef.current.onLinkClick?.(link),
    [],
  );
  const stableOnNodeHover = useCallback(
    (node: Record<string, unknown> | null) => handlersRef.current.onNodeHover?.(node),
    [],
  );
  const stableOnLinkHover = useCallback(
    (link: Record<string, unknown> | null) => handlersRef.current.onLinkHover?.(link),
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

  // Mount sankey and recreate when theme/darkMode change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: spec intentionally excluded - spec changes handled via update() in Effect 2
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options: SankeyMountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      onNodeClick: stableOnNodeClick,
      onLinkClick: stableOnLinkClick,
      onNodeHover: stableOnNodeHover,
      onLinkHover: stableOnLinkHover,
      responsive: true,
    };

    instanceRef.current = createSankey(container, spec, options);
    specRef.current = JSON.stringify(spec);

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [
    theme,
    resolvedDarkMode,
    stableOnNodeClick,
    stableOnLinkClick,
    stableOnNodeHover,
    stableOnLinkHover,
  ]);

  // Update sankey when spec changes.
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
      className={className ? `oc-sankey-root ${className}` : 'oc-sankey-root'}
      style={style}
    />
  );
});
