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
let mountedThemeKey = '';
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
const optionsKey = $derived(JSON.stringify({ autoResize, watermark }));
const themeKey = $derived(JSON.stringify({ theme: options.theme, darkMode: options.darkMode }));

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
  const nextThemeKey = themeKey;

  untrack(() => {
    const previous = instance;
    if (previous && nextOptionsKey === mountedOptionsKey) {
      if (nextSpecKey !== mountedSpecKey) {
        previous.update(spec);
        mountedSpecKey = nextSpecKey;
      }
      if (nextThemeKey !== mountedThemeKey) {
        previous.setTheme(options);
        mountedThemeKey = nextThemeKey;
      }
      return;
    }

    const state = previous?.getState();
    const current = createRace(container, spec, { ...options, initialState: state });
    previous?.destroy();
    if (state) current.resize();
    instance = current;
    mountedOptionsKey = nextOptionsKey;
    mountedThemeKey = nextThemeKey;
    mountedSpecKey = nextSpecKey;
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
