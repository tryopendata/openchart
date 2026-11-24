import type { DarkMode, RaceFrame, RaceSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import { mergeThemeConfig } from '@opendata-ai/openchart-core';
import {
  createRace,
  type RaceInstance,
  type RaceMountOptions,
} from '@opendata-ai/openchart-vanilla';
import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useVizDarkMode, useVizTheme } from './ThemeContext';

/** Options and callbacks for a mounted race chart. */
export interface RaceProps {
  spec: RaceSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  className?: string;
  style?: CSSProperties;
  autoResize?: boolean;
  watermark?: boolean;
  onWarn?: RaceMountOptions['onWarn'];
  onPeriod?: (period: RaceFrame['period']) => void;
}

/** Ref handle for imperative race playback. */
export interface RaceHandle {
  readonly instance: RaceInstance | null;
}

/** Render an interactive race chart. */
export const Race = forwardRef<RaceHandle, RaceProps>(function Race(
  { spec, theme, darkMode, className, style, autoResize, watermark, onWarn, onPeriod },
  ref,
) {
  const contextTheme = useVizTheme();
  const contextDarkMode = useVizDarkMode();
  const resolvedDarkMode = darkMode ?? contextDarkMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useRef<{
    instance: RaceInstance;
    optionsKey: string;
    specKey: string;
  } | null>(null);
  const warnRef = useRef(onWarn);
  useEffect(() => {
    warnRef.current = onWarn;
  }, [onWarn]);

  const options = useMemo<RaceMountOptions>(
    () => ({
      theme: mergeThemeConfig(contextTheme, theme),
      darkMode: resolvedDarkMode,
      autoResize,
      watermark,
      onWarn: (message) => (warnRef.current ?? console.warn)(message),
    }),
    [contextTheme, theme, resolvedDarkMode, autoResize, watermark],
  );
  const optionsKey = JSON.stringify(options);

  useImperativeHandle(
    ref,
    () => ({
      get instance() {
        return mounted.current?.instance ?? null;
      },
    }),
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const current = mounted.current;
    const specKey = JSON.stringify(spec);
    if (current?.optionsKey === optionsKey) {
      if (specKey !== current.specKey) {
        current.instance.update(spec);
        current.specKey = specKey;
      }
      return;
    }

    const state = current?.instance.getState();
    const instance = createRace(container, spec, options);
    current?.instance.destroy();
    mounted.current = { instance, optionsKey, specKey };
    if (state) {
      // The old chart was still in the host during the replacement mount.
      instance.resize();
      // Leave the new mount's visibility trigger armed when playback has yet to start.
      if (state.ended) {
        instance.pause();
      } else if (state.t > 0 || state.playing) {
        instance.seek(state.t);
        if (state.playing) instance.play();
        else instance.pause();
      }
      instance.setSpeed(state.speed);
    }
  }, [spec, options, optionsKey]);

  useEffect(() => {
    const current = mounted.current;
    if (current?.optionsKey === optionsKey && onPeriod)
      return current.instance.on('period', onPeriod);
  }, [optionsKey, onPeriod]);

  useEffect(
    () => () => {
      mounted.current?.instance.destroy();
      mounted.current = null;
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className={className ? `oc-root ${className}` : 'oc-root'}
      style={style}
    />
  );
});
