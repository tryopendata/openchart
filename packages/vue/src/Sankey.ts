/**
 * Vue Sankey component: thin wrapper around the vanilla adapter.
 *
 * Mounts a sankey instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createSankey() function.
 */

import type { DarkMode, SankeySpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  createSankey,
  type SankeyInstance,
  type SankeyMountOptions,
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

export interface SankeyProps {
  spec: SankeySpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
}

export const Sankey = defineComponent({
  name: 'Sankey',
  props: {
    spec: {
      type: Object as PropType<SankeySpec>,
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
    'node-click': (_node: Record<string, unknown>) => true,
    'link-click': (_link: Record<string, unknown>) => true,
    'node-hover': (_node: Record<string, unknown> | null) => true,
    'link-hover': (_link: Record<string, unknown> | null) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: SankeyInstance | null = null;
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

    function mountSankey() {
      const container = containerRef.value;
      if (!container) return;

      const options: SankeyMountOptions = {
        theme: resolveTheme(),
        darkMode: resolveDarkMode(),
        onNodeClick: (node: Record<string, unknown>) => emit('node-click', node),
        onLinkClick: (link: Record<string, unknown>) => emit('link-click', link),
        onNodeHover: (node: Record<string, unknown> | null) => emit('node-hover', node),
        onLinkHover: (link: Record<string, unknown> | null) => emit('link-hover', link),
        responsive: true,
      };

      instance = createSankey(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
    }

    function destroySankey() {
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
      mountSankey();
    });

    onUnmounted(() => {
      destroySankey();
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

    // Recreate sankey when theme or darkMode change
    watch(
      [
        () => props.theme,
        () => props.darkMode,
        () => contextTheme?.value,
        () => contextDarkMode?.value,
      ],
      () => {
        if (!containerRef.value) return;
        destroySankey();
        mountSankey();
      },
    );

    const rootClass = () => {
      const base = 'oc-sankey-root';
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
