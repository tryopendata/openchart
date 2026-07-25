<!--
  Visualization routing component: renders Chart, DataTable, or Graph
  based on the spec type. Use this when rendering arbitrary VizSpec values.

  For event handlers, use the specific component (Chart, DataTable, Graph) directly.
-->
<script lang="ts">
import type { DarkMode, ThemeConfig, VizSpec } from '@opendata-ai/openchart-core';
import {
  isBarListSpec,
  isGeoMapSpec,
  isGraphSpec,
  isSankeySpec,
  isTableSpec,
  isTileMapSpec,
} from '@opendata-ai/openchart-core';
import BarList from './BarList.svelte';
import Chart from './Chart.svelte';
import DataTable from './DataTable.svelte';
import GeoMap from './GeoMap.svelte';
import Graph from './Graph.svelte';
import Sankey from './Sankey.svelte';
import TileMap from './TileMap.svelte';

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
{:else if isSankeySpec(spec)}
  <Sankey {spec} {theme} {darkMode} class={className} {style} />
{:else if isTileMapSpec(spec)}
  <TileMap {spec} {theme} {darkMode} class={className} {style} />
{:else if isBarListSpec(spec)}
  <BarList {spec} {theme} {darkMode} class={className} {style} />
{:else if isGeoMapSpec(spec)}
  <GeoMap {spec} {theme} {darkMode} class={className} {style} />
{:else}
  <Chart {spec} {theme} {darkMode} class={className} {style} />
{/if}
