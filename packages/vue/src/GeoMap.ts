/**
 * Vue Map component: thin wrapper around the vanilla adapter.
 *
 * Mounts a map instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createGeoMap() function.
 */

import type {
  DarkMode,
  GeoMapSpec,
  GeoReaderSelection,
  ReaderChangeMeta,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { mergeThemeConfig } from '@opendata-ai/openchart-core';
import {
  type Camera,
  createGeoMap,
  createGeoReaderBinding,
  type GeoMapCameraChangeMeta,
  type GeoMapInstance,
  type GeoMapMarkEvent,
  type GeoMapMountOptions,
  type GeoReaderOptions,
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

export interface GeoMapProps {
  reader?: false | GeoReaderOptions;
  readerSelection?: GeoReaderSelection;
  labelInventory?: GeoMapMountOptions['labelInventory'];
  spec: GeoMapSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
}

export const GeoMap = defineComponent({
  name: 'GeoMap',
  props: {
    reader: { type: [Boolean, Object] as PropType<false | GeoReaderOptions>, default: undefined },
    readerSelection: { type: Object as PropType<GeoReaderSelection>, default: undefined },
    labelInventory: {
      type: [Boolean, Object] as PropType<GeoMapMountOptions['labelInventory']>,
      default: undefined,
    },
    spec: {
      type: Object as PropType<GeoMapSpec>,
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
    'reader-change': (_selection: GeoReaderSelection, _meta: ReaderChangeMeta) => true,
    'mark-click': (_event: GeoMapMarkEvent) => true,
    'mark-hover': (_event: GeoMapMarkEvent | null) => true,
    'camera-change': (_camera: Camera, _meta?: GeoMapCameraChangeMeta) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: GeoMapInstance | null = null;
    let prevSpec = '';
    const readerBinding = createGeoReaderBinding();
    function syncReader() {
      if (containerRef.value && instance)
        readerBinding.sync(
          containerRef.value,
          instance,
          props.spec,
          props.reader,
          props.readerSelection,
          (state, meta) => emit('reader-change', state, meta),
        );
    }

    // Inject theme/darkMode from provider as fallbacks
    const contextTheme = inject(VizThemeKey, undefined);
    const contextDarkMode = inject(VizDarkModeKey, undefined);

    function resolveTheme(): ThemeConfig | undefined {
      return mergeThemeConfig(contextTheme?.value, props.theme);
    }

    function resolveDarkMode(): DarkMode | undefined {
      return props.darkMode ?? contextDarkMode?.value;
    }

    function mountMap() {
      const container = containerRef.value;
      if (!container) return;

      const options: GeoMapMountOptions = {
        theme: resolveTheme(),
        darkMode: resolveDarkMode(),
        onMarkClick: (feature) => emit('mark-click', feature),
        onMarkHover: (feature) => emit('mark-hover', feature),
        onCameraChange: (camera, meta) =>
          meta ? emit('camera-change', camera, meta) : emit('camera-change', camera),
        autoResize: true,
        labelInventory: props.labelInventory,
      };

      instance = createGeoMap(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
      syncReader();
    }

    function destroyMap() {
      readerBinding.detach();
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
          syncReader();
        }
      },
    );

    watch(
      () => props.labelInventory,
      (value) => instance?.setLabelInventory(value),
    );

    watch([() => props.reader, () => props.readerSelection], () => syncReader(), { deep: false });

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
