<script module lang="ts">
import type { DarkMode, RaceFrame, RaceSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import type { RaceMountOptions } from '@opendata-ai/openchart-vanilla';

/** Options and callbacks for a mounted race chart. */
export interface RaceProps {
  spec: RaceSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string;
  autoResize?: boolean;
  watermark?: boolean;
  onWarn?: RaceMountOptions['onWarn'];
  onperiod?: (period: RaceFrame['period']) => void;
}
</script>

<script lang="ts">
import { mergeThemeConfig } from '@opendata-ai/openchart-core';
import { createRace, type RaceInstance } from '@opendata-ai/openchart-vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  theme,
  darkMode,
  class: className,
  style,
  autoResize,
  watermark,
  onWarn,
  onperiod,
}: RaceProps = $props();

let containerEl: HTMLDivElement;
let instance = $state.raw<RaceInstance | null>(null);
let mountedOptionsKey = '';
let mountedSpecKey = '';
let periodSubscription:
  | { instance: RaceInstance; callback: NonNullable<RaceProps['onperiod']>; unsubscribe: () => void }
  | undefined;

const contextTheme = getVizTheme();
const contextDarkMode = getVizDarkMode();
const options = $derived<RaceMountOptions>({
  theme: mergeThemeConfig(contextTheme?.(), theme),
  darkMode: darkMode ?? contextDarkMode?.(),
  autoResize,
  watermark,
  onWarn: (message) => (untrack(() => onWarn) ?? console.warn)(message),
});
const optionsKey = $derived(JSON.stringify(options));

/** Read the current race instance through bind:this. */
export function getInstance(): RaceInstance | null {
  return instance;
}

onMount(() => () => {
  periodSubscription?.unsubscribe();
  periodSubscription = undefined;
  instance?.destroy();
  instance = null;
});

$effect(() => {
  const container = containerEl;
  const nextSpecKey = JSON.stringify(spec);
  const nextOptionsKey = optionsKey;

  untrack(() => {
    const previous = instance;
    if (previous && nextOptionsKey === mountedOptionsKey) {
      if (nextSpecKey !== mountedSpecKey) {
        previous.update(spec);
        mountedSpecKey = nextSpecKey;
      }
      return;
    }

    const state = previous?.getState();
    const current = createRace(container, spec, options);
    previous?.destroy();
    instance = current;
    mountedOptionsKey = nextOptionsKey;
    mountedSpecKey = nextSpecKey;
    if (state) {
      // The old chart was still in the host during the replacement mount.
      current.resize();
      // Leave the new mount's visibility trigger armed when playback has yet to start.
      if (state.ended) {
        current.pause();
      } else if (state.t > 0 || state.playing) {
        current.seek(state.t);
        if (state.playing) current.play();
        else current.pause();
      }
      current.setSpeed(state.speed);
    }
  });
});

$effect(() => {
  const current = instance;
  const callback = onperiod;
  if (periodSubscription?.instance === current && periodSubscription.callback === callback) return;
  periodSubscription?.unsubscribe();
  periodSubscription =
    current && callback
      ? { instance: current, callback, unsubscribe: current.on('period', callback) }
      : undefined;
});
</script>

<div bind:this={containerEl} class={className ? `oc-root ${className}` : 'oc-root'} {style}></div>
