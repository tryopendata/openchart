/**
 * useTable: composable for manual table lifecycle control.
 *
 * Attaches to a container ref, mounts a vanilla table instance,
 * and exposes the instance and current state.
 */

import type { TableSpec } from '@opendata-ai/openchart-core';
import {
  createTable,
  type TableInstance,
  type TableMountOptions,
  type TableState,
} from '@opendata-ai/openchart-vanilla';
import { onMounted, onUnmounted, type Ref, ref, type ShallowRef, shallowRef, watch } from 'vue';

export interface UseTableReturn {
  /** Template ref to attach to the container div. */
  containerRef: Ref<HTMLDivElement | null>;
  /** The table instance (null until mounted). */
  table: ShallowRef<TableInstance | null>;
  /** The current table state (sort, search, page). */
  state: Ref<TableState>;
}

/**
 * Composable for manual table lifecycle control.
 *
 * Attach the returned containerRef to a container div via `ref="containerRef"`.
 * The table mounts automatically and updates when the spec changes.
 */
export function useTable(spec: Ref<TableSpec>, options?: TableMountOptions): UseTableReturn {
  const containerRef = ref<HTMLDivElement | null>(null);
  const table = shallowRef<TableInstance | null>(null);
  const state = ref<TableState>({
    sort: null,
    search: '',
    page: 0,
  });

  const originalOnStateChange = options?.onStateChange;

  function handleStateChange(newState: TableState) {
    state.value = newState;
    originalOnStateChange?.(newState);
  }

  function mount() {
    const container = containerRef.value;
    if (!container) return;

    const mountOpts: TableMountOptions = {
      ...options,
      onStateChange: handleStateChange,
    };

    const instance = createTable(container, spec.value, mountOpts);
    table.value = instance;
    state.value = instance.getState();
  }

  function destroy() {
    table.value?.destroy();
    table.value = null;
  }

  onMounted(() => {
    mount();
  });

  onUnmounted(() => {
    destroy();
  });

  // Update on spec change
  watch(spec, (newSpec) => {
    const instance = table.value;
    if (!instance) return;
    instance.update(newSpec);
    state.value = instance.getState();
  });

  return {
    containerRef,
    table,
    state,
  };
}
