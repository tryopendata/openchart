/**
 * Vue BarList component: thin wrapper around the vanilla adapter.
 */

import type { BarListSpec, DarkMode, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  type BarListInstance,
  type BarListMountOptions,
  createBarList,
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

export interface BarListRowEvent {
  label: string;
  value: number;
  data: Record<string, unknown>;
}

export interface BarListProps {
  spec: BarListSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
}

export const BarList = defineComponent({
  name: 'BarList',
  props: {
    spec: {
      type: Object as PropType<BarListSpec>,
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
    'row-click': (_row: BarListRowEvent) => true,
    'row-hover': (_row: BarListRowEvent | null) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: BarListInstance | null = null;
    let prevSpec = '';

    const contextTheme = inject(VizThemeKey, undefined);
    const contextDarkMode = inject(VizDarkModeKey, undefined);

    function resolveTheme(): ThemeConfig | undefined {
      return props.theme ?? contextTheme?.value;
    }

    function resolveDarkMode(): DarkMode | undefined {
      return props.darkMode ?? contextDarkMode?.value;
    }

    function mountBarList() {
      const container = containerRef.value;
      if (!container) return;

      const options: BarListMountOptions = {
        theme: resolveTheme(),
        darkMode: resolveDarkMode(),
        onRowClick: (row: BarListRowEvent) => emit('row-click', row),
        onRowHover: (row: BarListRowEvent | null) => emit('row-hover', row),
        responsive: true,
      };

      instance = createBarList(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
    }

    function destroyBarList() {
      instance?.destroy();
      instance = null;
      prevSpec = '';
    }

    expose({
      get instance() {
        return instance;
      },
    });

    onMounted(() => {
      mountBarList();
    });

    onUnmounted(() => {
      destroyBarList();
    });

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

    watch(
      [
        () => props.theme,
        () => props.darkMode,
        () => contextTheme?.value,
        () => contextDarkMode?.value,
      ],
      () => {
        if (!containerRef.value) return;
        destroyBarList();
        mountBarList();
      },
    );

    const rootClass = () => {
      const base = 'oc-barlist-root';
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
