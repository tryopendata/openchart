/**
 * Vue Map component: thin wrapper around the vanilla adapter.
 *
 * Mounts a map instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createMap() function.
 */

import type { DarkMode, MapSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  createMap,
  type MapInstance,
  type MapMarkEvent,
  type MapMountOptions,
} from '@opendata-ai/openchart-vanilla';
import {
  type CSSProperties,
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

export interface MapProps {
  spec: MapSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
}

export const GeoMap = defineComponent({
  name: 'GeoMap',
  props: {
    spec: {
      type: Object as PropType<MapSpec>,
      required: true,
    },
    theme: {
      type: Object as PropType<ThemeConfig>,
      default: undefined,
    },
    darkMode: {
      type: String as PropType<DarkMode>,
      default: undefined,
    },
    class: {
      type: String,
      default: undefined,
    },
    style: {
      type: [String, Object] as PropType<string | CSSProperties>,
      default: undefined,
    },
  },
  emits: {
    'mark-click': (_event: MapMarkEvent) => true,
    'mark-hover': (_event: MapMarkEvent | null) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: MapInstance | null = null;
    let prevSpec = '';

    // Inject theme/darkMode from provider as fallbacks
    const contextTheme = inject(VizThemeKey, undefined);
    const contextDarkMode = inject(VizDarkModeKey, undefined);

    function resolveTheme(): ThemeConfig | undefined {
      return props.theme ?? contextTheme?.value;
    }

    function resolveDarkMode(): DarkMode | undefined {
      return props.darkMode ?? contextDarkMode?.value;
    }

    function mountMap() {
      const container = containerRef.value;
      if (!container) return;

      const options: MapMountOptions = {
        theme: resolveTheme(),
        darkMode: resolveDarkMode(),
        onMarkClick: (feature) => emit('mark-click', feature),
        onMarkHover: (feature) => emit('mark-hover', feature),
        responsive: true,
      };

      instance = createMap(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
    }

    function destroyMap() {
      instance?.destroy();
      instance = null;
      prevSpec = '';
    }

    // Expose imperative access to the instance
    expose({
      get instance() {
        return instance;
      },
    });

    onMounted(() => {
      mountMap();
    });

    onUnmounted(() => {
      destroyMap();
    });

    // Watch spec changes
    watch(
      () => JSON.stringify(props.spec),
      (newVal) => {
        if (!instance) return;
        if (newVal !== prevSpec) {
          prevSpec = newVal;
          instance.update(props.spec);
        }
      },
    );

    // Recreate map when theme or darkMode change
    watch(
      [
        () => props.theme,
        () => props.darkMode,
        () => contextTheme?.value,
        () => contextDarkMode?.value,
      ],
      () => {
        if (!containerRef.value) return;
        destroyMap();
        mountMap();
      },
    );

    const rootClass = () => {
      const base = 'oc-map-root';
      return props.class ? `${base} ${props.class}` : base;
    };

    return () =>
      h('div', {
        ref: containerRef,
        class: rootClass(),
        style: props.style,
      });
  },
});
