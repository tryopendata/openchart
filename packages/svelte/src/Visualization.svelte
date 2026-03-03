<!--
  Visualization routing component: renders Chart, DataTable, or Graph
  based on the spec type. Use this when rendering arbitrary VizSpec values.

  For event handlers, use the specific component (Chart, DataTable, Graph) directly.
-->
<script lang="ts">
import type { DarkMode, ThemeConfig, VizSpec } from '@opendata-ai/openchart-core';
import { isGraphSpec, isTableSpec } from '@opendata-ai/openchart-core';
import Chart from './Chart.svelte';
import DataTable from './DataTable.svelte';
import Graph from './Graph.svelte';

let {
  spec,
  theme,
  darkMode,
  class: className,
  style,
}: {
  spec: VizSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string;
} = $props();
</script>

{#if isTableSpec(spec)}
  <DataTable {spec} {theme} {darkMode} class={className} {style} />
{:else if isGraphSpec(spec)}
  <Graph {spec} {theme} {darkMode} class={className} {style} />
{:else}
  <Chart {spec} {theme} {darkMode} class={className} {style} />
{/if}
