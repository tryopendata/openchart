/**
 * useTable: composable for manual table lifecycle control.
 *
 * Returns a Svelte action and exposes the table instance and current state.
 *
 * Usage:
 * ```svelte
 * <script>
 *   const { action, table, state } = useTable(spec);
 * </script>
 * <div use:action></div>
 * ```
 *
 * Uses .svelte.ts extension so runes ($state, $effect) work outside
 * .svelte components.
 */

import type { TableSpec } from '@opendata-ai/openchart-core';
import {
  createTable,
  type TableInstance,
  type TableMountOptions,
  type TableState,
} from '@opendata-ai/openchart-vanilla';

export interface UseTableReturn {
  /** Svelte action to attach to a container div. */
  action: (node: HTMLElement) => { destroy: () => void };
  /** The table instance (null until mounted). */
  readonly table: TableInstance | null;
  /** The current table state (sort, search, page). */
  readonly state: TableState;
}

export function useTable(
  spec: () => TableSpec,
  options?: () => TableMountOptions | undefined,
): UseTableReturn {
  let table = $state<TableInstance | null>(null);
  let state = $state<TableState>({
    sort: null,
    search: '',
    page: 0,
  });

  function action(node: HTMLElement) {
    $effect(() => {
      const currentSpec = spec();
      const opts = options?.();

      const mountOpts: TableMountOptions = {
        ...opts,
        onStateChange: (newState) => {
          state = newState;
          opts?.onStateChange?.(newState);
        },
      };

      const instance = createTable(node, currentSpec, mountOpts);
      table = instance;
      state = instance.getState();

      return () => {
        instance.destroy();
        table = null;
      };
    });

    return {
      destroy() {
        // $effect cleanup handles teardown
      },
    };
  }

  return {
    action,
    get table() {
      return table;
    },
    get state() {
      return state;
    },
  };
}
