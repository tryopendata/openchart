import type { DarkMode, RaceFrame, RaceSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import { mergeThemeConfig } from '@opendata-ai/openchart-core';
import {
  createRace,
  type RaceInstance,
  type RaceMountOptions,
} from '@opendata-ai/openchart-vanilla';
import {
  type CSSProperties,
  computed,
  defineComponent,
  h,
  inject,
  onMounted,
  onUnmounted,
  type PropType,
  ref,
  watch,
} from 'vue';
import { VizDarkModeKey, VizThemeKey } from './context';

/** Options and callbacks for a mounted race chart. */
export interface RaceProps {
  spec: RaceSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
  autoResize?: boolean;
  watermark?: boolean;
  onWarn?: RaceMountOptions['onWarn'];
  onPeriod?: (period: RaceFrame['period']) => void;
}

/** Render an interactive race chart. */
export const Race = defineComponent({
  name: 'Race',
  props: {
    spec: { type: Object as PropType<RaceSpec>, required: true },
    theme: { type: Object as PropType<ThemeConfig>, default: undefined },
    darkMode: { type: String as PropType<DarkMode>, default: undefined },
    class: { type: String, default: undefined },
    style: { type: [String, Object] as PropType<string | CSSProperties>, default: undefined },
    autoResize: { type: Boolean, default: undefined },
    watermark: { type: Boolean, default: undefined },
    onWarn: { type: Function as PropType<RaceProps['onWarn']>, default: undefined },
    // Vue skips listener-only changes for declared emits. Track this listener as a prop.
    onPeriod: { type: Function as PropType<RaceProps['onPeriod']>, default: undefined },
    onPeriodOnce: { type: Function as PropType<RaceProps['onPeriod']>, default: undefined },
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: RaceInstance | null = null;
    let mountedOptionsKey = '';
    let mountedThemeKey = '';
    let mountedSpecKey = '';
    let unsubscribe: (() => void) | undefined;
    const contextTheme = inject(VizThemeKey, undefined);
    const contextDarkMode = inject(VizDarkModeKey, undefined);
    const options = computed<RaceMountOptions>(() => ({
      theme: mergeThemeConfig(contextTheme?.value, props.theme),
      darkMode: props.darkMode ?? contextDarkMode?.value,
      autoResize: props.autoResize,
      watermark: props.watermark,
      onWarn: (message) => (props.onWarn ?? console.warn)(message),
    }));
    const optionsKey = computed(() =>
      JSON.stringify({ autoResize: props.autoResize, watermark: props.watermark }),
    );
    const themeKey = computed(() => {
      const { theme, darkMode } = options.value;
      return JSON.stringify({ theme, darkMode });
    });
    const specKey = computed(() => JSON.stringify(props.spec));

    function subscribe() {
      unsubscribe?.();
      unsubscribe =
        props.onPeriod || props.onPeriodOnce
          ? instance?.on('period', (period) => emit('period', period))
          : undefined;
    }

    function destroyRace() {
      unsubscribe?.();
      unsubscribe = undefined;
      instance?.destroy();
      instance = null;
    }

    function mountRace() {
      const container = containerRef.value;
      if (!container) return;
      const state = instance?.getState();
      const current = createRace(container, props.spec, options.value);
      destroyRace();

      instance = current;
      mountedOptionsKey = optionsKey.value;
      mountedThemeKey = themeKey.value;
      mountedSpecKey = specKey.value;
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
      subscribe();
    }

    expose({
      get instance() {
        return instance;
      },
    });

    onMounted(mountRace);
    onUnmounted(destroyRace);

    watch(
      [optionsKey, themeKey, specKey, () => props.onPeriod, () => props.onPeriodOnce],
      (
        [nextOptionsKey, nextThemeKey, nextSpecKey, onPeriod, onPeriodOnce],
        [, , , previous, previousOnce],
      ) => {
        if (onPeriod !== previous || onPeriodOnce !== previousOnce) subscribe();
        if (!instance || nextOptionsKey !== mountedOptionsKey) {
          mountRace();
          return;
        }
        if (nextSpecKey !== mountedSpecKey) {
          instance.update(props.spec);
          mountedSpecKey = nextSpecKey;
        }
        if (nextThemeKey !== mountedThemeKey) {
          instance.setTheme(options.value);
          mountedThemeKey = nextThemeKey;
        }
      },
      { flush: 'post' },
    );

    return () =>
      h('div', {
        ref: containerRef,
        class: ['oc-root', props.class],
        style: props.style,
      });
  },
});
