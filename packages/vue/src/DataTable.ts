/**
 * DataTable component: Vue wrapper around the vanilla table adapter.
 *
 * Mounts a table instance on render, updates when spec changes,
 * and cleans up on unmount. Supports both controlled and uncontrolled modes
 * for sort, search, and pagination state.
 */

import type { DarkMode, SortState, TableSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  createTable,
  type TableInstance,
  type TableMountOptions,
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

export interface DataTableProps {
  spec: TableSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
  sort?: SortState | null;
  search?: string;
  page?: number;
}

export const DataTable = defineComponent({
  name: 'DataTable',
  props: {
    spec: {
      type: Object as PropType<TableSpec>,
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
    sort: {
      type: [Object, null] as PropType<SortState | null>,
      default: undefined,
    },
    search: {
      type: String,
      default: undefined,
    },
    page: {
      type: Number,
      default: undefined,
    },
  },
  emits: {
    'row-click': (_row: Record<string, unknown>) => true,
    'update:sort': (_sort: SortState | null) => true,
    'update:search': (_query: string) => true,
    'update:page': (_page: number) => true,
  },
  setup(props, { emit }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: TableInstance | null = null;

    // Inject theme/darkMode from provider as fallbacks
    const contextTheme = inject(VizThemeKey, undefined);
    const contextDarkMode = inject(VizDarkModeKey, undefined);

    function resolveTheme(): ThemeConfig | undefined {
      return props.theme ?? contextTheme?.value;
    }

    function resolveDarkMode(): DarkMode | undefined {
      return props.darkMode ?? contextDarkMode?.value;
    }

    function isControlled(): boolean {
      return props.sort !== undefined || props.search !== undefined || props.page !== undefined;
    }

    let prevSpec = '';

    function mountTable() {
      const container = containerRef.value;
      if (!container) return;

      const mountOptions: TableMountOptions = {
        theme: resolveTheme(),
        darkMode: resolveDarkMode(),
        onRowClick: (row: Record<string, unknown>) => emit('row-click', row),
        responsive: true,
        onStateChange: (state) => {
          if (state.sort !== undefined) emit('update:sort', state.sort);
          if (state.search !== undefined) emit('update:search', state.search);
          if (state.page !== undefined) emit('update:page', state.page);
        },
      };

      if (isControlled()) {
        mountOptions.externalState = {
          sort: props.sort ?? null,
          search: props.search ?? '',
          page: props.page ?? 0,
        };
      }

      instance = createTable(container, props.spec, mountOptions);
      prevSpec = JSON.stringify(props.spec);
    }

    function destroyTable() {
      instance?.destroy();
      instance = null;
      prevSpec = '';
    }

    onMounted(() => {
      mountTable();
    });

    onUnmounted(() => {
      destroyTable();
    });

    // Watch spec changes via JSON.stringify comparison (consistent with Chart/Graph)
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

    // Recreate when theme or darkMode change
    watch(
      [
        () => props.theme,
        () => props.darkMode,
        () => contextTheme?.value,
        () => contextDarkMode?.value,
      ],
      () => {
        if (!containerRef.value) return;
        destroyTable();
        mountTable();
      },
    );

    // Sync controlled state without remounting
    watch([() => props.sort, () => props.search, () => props.page], () => {
      if (!instance || !isControlled()) return;
      instance.setState({
        sort: props.sort ?? null,
        search: props.search ?? '',
        page: props.page ?? 0,
      });
    });

    const rootClass = () => {
      const base = 'viz-table-root';
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
