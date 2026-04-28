/**
 * Vue TileMap component: thin wrapper around the vanilla adapter.
 *
 * Mounts a tilemap instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createTileMap() function.
 */

import type { DarkMode, ThemeConfig, TileMapSpec } from '@opendata-ai/openchart-core';
import {
  createTileMap,
  type TileMapInstance,
  type TileMapMountOptions,
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

export interface TileMapTileEvent {
  stateCode: string;
  stateName: string;
  value: number | null;
  data: Record<string, unknown>;
}

export interface TileMapProps {
  spec: TileMapSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
}

export const TileMap = defineComponent({
  name: 'TileMap',
  props: {
    spec: {
      type: Object as PropType<TileMapSpec>,
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
    'tile-click': (_tile: TileMapTileEvent) => true,
    'tile-hover': (_tile: TileMapTileEvent | null) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: TileMapInstance | null = null;
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

    function mountTileMap() {
      const container = containerRef.value;
      if (!container) return;

      const options: TileMapMountOptions = {
        theme: resolveTheme(),
        darkMode: resolveDarkMode(),
        onTileClick: (tile: TileMapTileEvent) => emit('tile-click', tile),
        onTileHover: (tile: TileMapTileEvent | null) => emit('tile-hover', tile),
        responsive: true,
      };

      instance = createTileMap(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
    }

    function destroyTileMap() {
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
      mountTileMap();
    });

    onUnmounted(() => {
      destroyTileMap();
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

    // Recreate tilemap when theme or darkMode change
    watch(
      [
        () => props.theme,
        () => props.darkMode,
        () => contextTheme?.value,
        () => contextDarkMode?.value,
      ],
      () => {
        if (!containerRef.value) return;
        destroyTileMap();
        mountTileMap();
      },
    );

    const rootClass = () => {
      const base = 'oc-tilemap-root';
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
