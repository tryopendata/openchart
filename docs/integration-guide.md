# Integration guide

How to build apps on top of the viz library. Covers the interface contract: spec mutation, event handling, controlled components, responsive behavior, and export.

This guide shows React, Vue, and Svelte examples for key integration patterns. The vanilla JS API is covered in its own sections since the interface is different (imperative rather than declarative).

For field-by-field type details, see the [spec reference](spec-reference.md). For a tutorial, see [getting started](getting-started.md).

## Core concept: specs are plain objects

Every visualization starts as a plain JavaScript object (a `VizSpec`). There's no class to instantiate, no builder chain to follow. Change the object, pass it to the renderer, get a new chart.

```ts
// This is the whole interface contract
const spec = { mark: 'line', data: [...], encoding: {...} };
```

The library uses an immutable update pattern: every spec change triggers a full recompile. The engine is fast enough that this is the intended workflow. Don't try to mutate the layout directly.

---

## Chart type switching

Switch chart types by changing the `mark` field. If the encoding channels are compatible (see [encoding by chart type](spec-reference.md#encoding-by-chart-type)), the same spec works across types.

### React

```tsx
import { useState } from "react";
import { Chart } from "@opendata-ai/openchart-react";
import type { ChartType, ChartSpec } from "@opendata-ai/openchart-core";

const CHART_TYPES: ChartType[] = ["line", "column", "area", "bar"];

function ChartWithTypeSwitcher({ baseSpec }: { baseSpec: ChartSpec }) {
  const [chartType, setChartType] = useState<ChartType>(baseSpec.type);

  // Immutable update: spread the spec, override type
  const spec = { ...baseSpec, type: chartType };

  return (
    <div>
      <select
        value={chartType}
        onChange={(e) => setChartType(e.target.value as ChartType)}
      >
        {CHART_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <div style={{ width: "100%", height: 400 }}>
        <Chart spec={spec} />
      </div>
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import { Chart } from "@opendata-ai/openchart-vue";
import type { ChartType, ChartSpec } from "@opendata-ai/openchart-core";

const props = defineProps<{ baseSpec: ChartSpec }>();
const CHART_TYPES: ChartType[] = ["line", "column", "area", "bar"];
const chartType = ref<ChartType>(props.baseSpec.type);

const spec = computed(() => ({ ...props.baseSpec, type: chartType.value }));
</script>

<template>
  <select v-model="chartType">
    <option v-for="t in CHART_TYPES" :key="t" :value="t">{{ t }}</option>
  </select>
  <div style="width: 100%; height: 400px">
    <Chart :spec="spec" />
  </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
import { Chart } from "@opendata-ai/openchart-svelte";
import type { ChartType, ChartSpec } from "@opendata-ai/openchart-core";

let { baseSpec }: { baseSpec: ChartSpec } = $props();
const CHART_TYPES: ChartType[] = ["line", "column", "area", "bar"];
let chartType: ChartType = $state(baseSpec.type);

const spec = $derived({ ...baseSpec, type: chartType });
</script>

<select bind:value={chartType}>
  {#each CHART_TYPES as t}
    <option value={t}>{t}</option>
  {/each}
</select>
<div style="width: 100%; height: 400px">
  <Chart {spec} />
</div>
```

All framework components detect spec changes and call `chart.update(spec)` internally. No manual lifecycle management needed.

### Encoding compatibility

Switching between `line`, `area`, and `column` usually works without encoding changes since they all use x (temporal/ordinal) and y (quantitative).

Switching to `bar` requires swapping axes: bar expects the category on y and the value on x. Switching to `pie`/`donut` requires dropping x and making color required.

If the encoding doesn't match the new type, the engine returns a validation error. Check encoding requirements in the [encoding rules table](spec-reference.md#encoding-by-chart-type).

---

## Dark mode toggle

### React

```tsx
import { useState } from "react";
import { Chart } from "@opendata-ai/openchart-react";
import type { DarkMode } from "@opendata-ai/openchart-core";

function ChartWithDarkMode({ spec }: { spec: ChartSpec }) {
  const [darkMode, setDarkMode] = useState<DarkMode>("off");

  return (
    <div>
      <select
        value={darkMode}
        onChange={(e) => setDarkMode(e.target.value as DarkMode)}
      >
        <option value="off">Light</option>
        <option value="force">Dark</option>
        <option value="auto">System</option>
      </select>
      <div style={{ width: "100%", height: 400 }}>
        <Chart spec={spec} darkMode={darkMode} />
      </div>
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Chart } from "@opendata-ai/openchart-vue";
import type { DarkMode } from "@opendata-ai/openchart-core";

const darkMode = ref<DarkMode>("off");
</script>

<template>
  <select v-model="darkMode">
    <option value="off">Light</option>
    <option value="force">Dark</option>
    <option value="auto">System</option>
  </select>
  <div style="width: 100%; height: 400px">
    <Chart :spec="spec" :dark-mode="darkMode" />
  </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
import { Chart } from "@opendata-ai/openchart-svelte";
import type { DarkMode } from "@opendata-ai/openchart-core";

let darkMode: DarkMode = $state("off");
</script>

<select bind:value={darkMode}>
  <option value="off">Light</option>
  <option value="force">Dark</option>
  <option value="auto">System</option>
</select>
<div style="width: 100%; height: 400px">
  <Chart {spec} {darkMode} />
</div>
```

The `darkMode` prop is reactive. Changing it destroys and recreates the chart instance with the new dark mode setting. The engine handles all color adaptations automatically (background swap, text inversion, palette brightness adjustment).

### Vanilla

```ts
import { createChart } from "@opendata-ai/openchart-vanilla";

const chart = createChart(container, spec, { darkMode: "auto" });
```

In vanilla mode, `darkMode: 'auto'` checks `window.matchMedia('(prefers-color-scheme: dark)')` at mount time. To react to live system preference changes, destroy and recreate the chart, or use a framework wrapper which handles this for you.

### useDarkMode hook

For more control over dark mode, all three frameworks provide a `useDarkMode` hook/composable that reactively tracks system preference:

**React:**

```tsx
import { useDarkMode } from "@opendata-ai/openchart-react";

function App() {
  const isDark = useDarkMode("auto");
  return <div className={isDark ? "dark-bg" : "light-bg"}>...</div>;
}
```

**Vue:**

```vue
<script setup lang="ts">
import { useDarkMode } from "@opendata-ai/openchart-vue";

const isDark = useDarkMode("auto");
</script>
```

**Svelte:**

```svelte
<script lang="ts">
import { useDarkMode } from "@opendata-ai/openchart-svelte";

const isDark = useDarkMode("auto");
</script>
```

`useDarkMode` subscribes to `matchMedia` change events, so the value updates automatically when the user switches their system preference.

---

## Theme management

Browse built-in themes: [theme gallery](https://tryopendata.github.io/openchart/?story=features--theming#named-themes)

### Per-component theme

Pass `theme` as a prop. It's deep-merged onto `DEFAULT_THEME` during compilation:

```tsx
<Chart spec={spec} theme={{ colors: { background: "#f5f0e8" } }} />
```

### Global theme via provider

`VizThemeProvider` sets a theme for all descendant components. Individual components can still override with their own `theme` prop.

**React:**

```tsx
import { VizThemeProvider, Chart, DataTable } from "@opendata-ai/openchart-react";

<VizThemeProvider theme={brandTheme}>
  <Chart spec={revenueSpec} />
  <DataTable spec={tableSpec} />
</VizThemeProvider>
```

**Vue:**

```vue
<script setup lang="ts">
import { VizThemeProvider, Chart, DataTable } from "@opendata-ai/openchart-vue";
</script>

<template>
  <VizThemeProvider :theme="brandTheme">
    <Chart :spec="revenueSpec" />
    <DataTable :spec="tableSpec" />
  </VizThemeProvider>
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { VizThemeProvider, Chart, DataTable } from "@opendata-ai/openchart-svelte";
</script>

<VizThemeProvider theme={brandTheme}>
  <Chart spec={revenueSpec} />
  <DataTable spec={tableSpec} />
</VizThemeProvider>
```

Each framework uses its native context system (React context, Vue provide/inject, Svelte context). A `theme` prop on a component takes precedence over the context theme.

### Reading the theme in custom components

If you're building UI that should match the chart theme (custom legends, data cards, etc.), read the theme from context:

**React:** `useVizTheme()` and `useVizDarkMode()`

```tsx
import { useVizTheme } from "@opendata-ai/openchart-react";

function DataCard({ label, value }: { label: string; value: string }) {
  const theme = useVizTheme();
  return (
    <div style={{ fontFamily: theme?.fonts?.family, color: theme?.colors?.text }}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
```

**Vue:** `useVizTheme()` and `useVizDarkMode()`

```vue
<script setup lang="ts">
import { useVizTheme } from "@opendata-ai/openchart-vue";

const theme = useVizTheme();
</script>
```

**Svelte:** `getVizTheme()` and `getVizDarkMode()`

```svelte
<script lang="ts">
import { getVizTheme } from "@opendata-ai/openchart-svelte";

const theme = getVizTheme();
</script>
```

---

## Watermark

By default, all charts display a "tryOpenData.ai" watermark in the bottom-right corner. To hide it, set `watermark: false` on the spec:

```ts
const spec = {
  mark: "bar",
  data: [...],
  encoding: { x: { field: "category" }, y: { field: "value" } },
  watermark: false,
};
```

To disable the watermark globally without modifying every spec, pass it as a mount option:

```ts
// Vanilla
createChart(container, spec, { watermark: false });
createTable(container, tableSpec, { watermark: false });
createGraph(container, graphSpec, { watermark: false });
createSankey(container, sankeySpec, { watermark: false });
```

Spec-level `watermark` takes precedence over the mount option when both are set.

---

## Spec mutation patterns

Specs are plain objects. The library expects immutable updates: create a new object, don't mutate in place.

### Adding/removing annotations

```tsx
function addAnnotation(spec: ChartSpec, annotation: Annotation): ChartSpec {
  return {
    ...spec,
    annotations: [...(spec.annotations ?? []), annotation],
  };
}

function removeAnnotation(spec: ChartSpec, index: number): ChartSpec {
  return {
    ...spec,
    annotations: spec.annotations?.filter((_, i) => i !== index),
  };
}
```

### Updating encoding

```tsx
function setAxisFormat(
  spec: ChartSpec,
  channel: "x" | "y",
  format: string,
): ChartSpec {
  const encoding = { ...spec.encoding };
  const ch = encoding[channel];
  if (ch) {
    encoding[channel] = { ...ch, axis: { ...ch.axis, format } };
  }
  return { ...spec, encoding };
}
```

### Filtering data

```tsx
function filterData(
  spec: ChartSpec,
  predicate: (row: DataRow) => boolean,
): ChartSpec {
  return { ...spec, data: spec.data.filter(predicate) };
}
```

### Performance tips

The `<Chart>` component compares specs via `JSON.stringify`. If the serialized form hasn't changed, it skips the update. But avoiding unnecessary object allocations is still good practice for complex component trees.

**React:** Use `useMemo` to stabilize the spec reference:

```tsx
const spec = useMemo(
  () => ({
    mark: "line" as const,
    data: filteredData,
    encoding: { x: xChannel, y: yChannel },
    chrome: { title: chartTitle },
  }),
  [filteredData, xChannel, yChannel, chartTitle],
);
```

**Vue:** Use `computed` for the same effect:

```ts
const spec = computed(() => ({
  mark: "line" as const,
  data: filteredData.value,
  encoding: { x: xChannel.value, y: yChannel.value },
  chrome: { title: chartTitle.value },
}));
```

**Svelte:** Use `$derived` to avoid recalculating on every render:

```ts
const spec = $derived({
  mark: "line" as const,
  data: filteredData,
  encoding: { x: xChannel, y: yChannel },
  chrome: { title: chartTitle },
});
```

---

## Event handling

### Chart mark events

Handle clicks on data marks (bars, points, lines, arcs). All three frameworks expose the same event handlers:

**React:**

```tsx
<Chart
  spec={spec}
  onMarkClick={(event) => console.log(event.datum)}
  onMarkHover={(event) => setHighlighted(event.datum)}
  onMarkLeave={() => setHighlighted(null)}
/>
```

**Vue:**

```vue
<Chart
  :spec="spec"
  @mark-click="(event) => console.log(event.datum)"
  @mark-hover="(event) => highlighted = event.datum"
  @mark-leave="() => highlighted = null"
/>
```

**Svelte:**

```svelte
<Chart
  {spec}
  onMarkClick={(event) => console.log(event.datum)}
  onMarkHover={(event) => highlighted = event.datum}
  onMarkLeave={() => highlighted = null}
/>
```

The `MarkEvent` object contains:

```tsx
import type { MarkEvent } from "@opendata-ai/openchart-core";

// event.datum   - the data row for this mark
// event.series  - series identifier (color field value)
// event.position - { x, y } relative to chart container
// event.event   - the raw browser MouseEvent
```

### Click-to-drill-down pattern

```tsx
import { useState, useMemo } from "react";
import { Chart } from "@opendata-ai/openchart-react";
import type { MarkEvent, ChartSpec } from "@opendata-ai/openchart-core";

interface SalesData {
  region: string;
  city?: string;
  revenue: number;
}

function DrillDownChart({ data }: { data: SalesData[] }) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const spec = useMemo((): ChartSpec => {
    if (selectedRegion) {
      // Drilled-down view: cities within the selected region
      const cityData = data.filter(
        (d) => d.region === selectedRegion && d.city,
      );
      return {
        mark: "bar",
        data: cityData,
        encoding: {
          x: { field: "revenue", type: "quantitative" },
          y: { field: "city", type: "nominal" },
        },
        chrome: {
          title: `Revenue: ${selectedRegion}`,
          subtitle: "Click a bar for details. Press back to return.",
        },
      };
    }

    // Top-level view: revenue by region
    const regionData = data.filter((d) => !d.city);
    return {
      mark: "bar",
      data: regionData,
      encoding: {
        x: { field: "revenue", type: "quantitative" },
        y: { field: "region", type: "nominal" },
      },
      chrome: {
        title: "Revenue by region",
        subtitle: "Click a bar to drill down",
      },
    };
  }, [data, selectedRegion]);

  const handleClick = (event: MarkEvent) => {
    if (!selectedRegion) {
      setSelectedRegion(event.datum.region as string);
    }
  };

  return (
    <div>
      {selectedRegion && (
        <button onClick={() => setSelectedRegion(null)}>Back to regions</button>
      )}
      <div style={{ width: "100%", height: 400 }}>
        <Chart spec={spec} onMarkClick={handleClick} />
      </div>
    </div>
  );
}
```

### Legend toggle

Legend entries are interactive by default. Clicking a legend swatch hides/shows the corresponding series. To react to these toggles:

```tsx
<Chart
  spec={spec}
  onLegendToggle={(series, visible) => {
    console.log(`${series} is now ${visible ? "visible" : "hidden"}`);
  }}
/>
```

A click triggers a full recompile through the engine's `hiddenSeries` filter — the y-axis rebalances to the visible series, endpoint labels and series-bound chrome refresh, the color scale stays locked to the original palette indices (visible series don't shift colors), and text annotations are suppressed while any series is hidden (range and refline annotations remain since they anchor to constant axis values). Toggling off the last visible series is a no-op rather than producing an empty chart. The callback fires with the post-toggle visible state so external UI can mirror it.

### Annotation click

```tsx
<Chart
  spec={spec}
  onAnnotationClick={(annotation, event) => {
    // Open a detail panel for the clicked annotation
    if (annotation.type === "text") {
      showDetailPanel(annotation.label);
    }
  }}
/>
```

---

## Table: controlled vs uncontrolled

### Uncontrolled (default)

The table manages its own sort, search, and pagination state internally. You get callbacks when state changes but don't need to manage state yourself.

**React:**

```tsx
import { DataTable } from "@opendata-ai/openchart-react";

<DataTable
  spec={tableSpec}
  onSortChange={(sort) => console.log("Sort changed:", sort)}
  onSearchChange={(query) => console.log("Search:", query)}
  onPageChange={(page) => console.log("Page:", page)}
/>;
```

**Vue:**

```vue
<template>
  <DataTable
    :spec="tableSpec"
    @sort-change="(sort) => console.log('Sort changed:', sort)"
    @search-change="(query) => console.log('Search:', query)"
    @page-change="(page) => console.log('Page:', page)"
  />
</template>
```

**Svelte:**

```svelte
<DataTable
  spec={tableSpec}
  onSortChange={(sort) => console.log("Sort changed:", sort)}
  onSearchChange={(query) => console.log("Search:", query)}
  onPageChange={(page) => console.log("Page:", page)}
/>
```

### Controlled

Pass `sort`, `search`, and/or `page` props to take over state management. When any of these are provided, the table reads state from props instead of managing it internally.

**React:**

```tsx
import { useState } from "react";
import { DataTable } from "@opendata-ai/openchart-react";
import type { SortState } from "@opendata-ai/openchart-core";

function ControlledTable({ spec }: { spec: TableSpec }) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  return (
    <div>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0); // Reset to first page on search
        }}
        placeholder="Search..."
      />
      <button onClick={() => setSort({ column: "name", direction: "asc" })}>
        Sort by name
      </button>
      <button onClick={() => setSort(null)}>Clear sort</button>

      <DataTable
        spec={spec}
        sort={sort}
        search={search}
        page={page}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
      />
    </div>
  );
}
```

**Vue:**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { DataTable } from "@opendata-ai/openchart-vue";
import type { SortState } from "@opendata-ai/openchart-core";

const sort = ref<SortState | null>(null);
const search = ref("");
const page = ref(0);

function onSearch(value: string) {
  search.value = value;
  page.value = 0; // Reset to first page on search
}
</script>

<template>
  <input :value="search" @input="onSearch($event.target.value)" placeholder="Search..." />
  <button @click="sort = { column: 'name', direction: 'asc' }">Sort by name</button>
  <button @click="sort = null">Clear sort</button>

  <DataTable
    :spec="spec"
    :sort="sort"
    :search="search"
    :page="page"
    @sort-change="(s) => sort = s"
    @search-change="(q) => search = q"
    @page-change="(p) => page = p"
  />
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { DataTable } from "@opendata-ai/openchart-svelte";
import type { SortState } from "@opendata-ai/openchart-core";

let sort: SortState | null = $state(null);
let search = $state("");
let page = $state(0);

function onSearch(value: string) {
  search = value;
  page = 0; // Reset to first page on search
}
</script>

<input value={search} oninput={(e) => onSearch(e.target.value)} placeholder="Search..." />
<button onclick={() => sort = { column: "name", direction: "asc" }}>Sort by name</button>
<button onclick={() => sort = null}>Clear sort</button>

<DataTable
  {spec}
  {sort}
  {search}
  {page}
  onSortChange={(s) => sort = s}
  onSearchChange={(q) => search = q}
  onPageChange={(p) => page = p}
/>
```

### useTableState hook/composable

For a quick way to get controlled state without wiring it all manually. Available in all three frameworks:

**React:**

```tsx
import { DataTable, useTableState } from "@opendata-ai/openchart-react";

function TableWithManagedState({ spec }: { spec: TableSpec }) {
  const { sort, search, page, setSort, setSearch, setPage, resetState } =
    useTableState();

  return (
    <div>
      <button onClick={resetState}>Reset</button>
      <DataTable
        spec={spec}
        sort={sort}
        search={search}
        page={page}
        onSortChange={setSort}
        onSearchChange={setSearch}
        onPageChange={setPage}
      />
    </div>
  );
}
```

**Vue:**

```vue
<script setup lang="ts">
import { DataTable, useTableState } from "@opendata-ai/openchart-vue";

const { sort, search, page, setSort, setSearch, setPage, resetState } =
  useTableState();
</script>

<template>
  <button @click="resetState">Reset</button>
  <DataTable
    :spec="spec"
    :sort="sort"
    :search="search"
    :page="page"
    @sort-change="setSort"
    @search-change="setSearch"
    @page-change="setPage"
  />
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { DataTable, useTableState } from "@opendata-ai/openchart-svelte";

const { sort, search, page, setSort, setSearch, setPage, resetState } =
  useTableState();
</script>

<button onclick={resetState}>Reset</button>
<DataTable
  {spec}
  sort={sort}
  search={search}
  page={page}
  onSortChange={setSort}
  onSearchChange={setSearch}
  onPageChange={setPage}
/>
```

All versions accept optional initial values:

```ts
const state = useTableState({
  sort: { column: "name", direction: "asc" },
  search: "",
  page: 0,
});
```

### useTable hook/composable (advanced)

For cases where you need direct access to the vanilla `TableInstance`:

**React:**

```tsx
import { useTable } from "@opendata-ai/openchart-react";

function AdvancedTable({ spec }: { spec: TableSpec }) {
  const { ref, table, state } = useTable(spec, {
    onRowClick: (row) => console.log("Clicked:", row),
    responsive: true,
  });

  return (
    <div>
      <p>Current page: {state.page}</p>
      <p>Sort: {state.sort?.column ?? "none"}</p>
      <button onClick={() => table?.export("csv")}>Export CSV</button>
      <div ref={ref} style={{ width: "100%", height: 500 }} />
    </div>
  );
}
```

**Vue:**

```vue
<script setup lang="ts">
import { useTable } from "@opendata-ai/openchart-vue";

const { containerRef, table, layout } = useTable(spec, {
  onRowClick: (row) => console.log("Clicked:", row),
  responsive: true,
});
</script>

<template>
  <button @click="table?.export('csv')">Export CSV</button>
  <div ref="containerRef" style="width: 100%; height: 500px" />
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { useTable } from "@opendata-ai/openchart-svelte";

const { action, table, layout } = useTable(spec, {
  onRowClick: (row) => console.log("Clicked:", row),
  responsive: true,
});
</script>

<button onclick={() => table?.export("csv")}>Export CSV</button>
<div use:action style="width: 100%; height: 500px"></div>
```

### Table sort cycling

Sort behavior follows a three-state cycle:

- Click column: sort ascending
- Click same column again: sort descending
- Click same column again: clear sort

Clicking a different column resets to ascending for that column.

---

## Responsive behavior

### How it works

By default, both charts and tables observe their container element with `ResizeObserver`. When the container resizes, the library recompiles at the new dimensions.

The responsive system also uses breakpoints to adjust layout strategy at smaller sizes:

- **Label density**: Fewer labels at smaller widths to avoid overcrowding
- **Legend position**: May shift from inline to top/bottom at narrow widths
- **Annotation placement**: Adjusts for available space
- **Tables**: Auto-apply compact mode at small breakpoints

### Container sizing

The `<Chart>` and `<DataTable>` components render a wrapper div set to `width: 100%; height: 100%`. They fill whatever container you put them in.

For charts, the container needs an explicit height (charts don't have intrinsic height):

```tsx
{
  /* Works: explicit height */
}
<div style={{ width: "100%", height: 400 }}>
  <Chart spec={spec} />
</div>;

{
  /* Works: flex layout */
}
<div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
  <header>...</header>
  <div style={{ flex: 1 }}>
    <Chart spec={spec} />
  </div>
</div>;

{
  /* Won't work: no height constraint, chart collapses to minimum */
}
<div>
  <Chart spec={spec} />
</div>;
```

Tables don't need explicit height since they expand with content. The wrapper has `overflow: auto` for scroll handling.

### Disabling responsive

Set `responsive: false` on the spec or component prop to disable ResizeObserver. The chart renders once at the initial container dimensions and doesn't resize.

```tsx
// Spec-level
const spec = { mark: "line", data, encoding, responsive: false };

// Vanilla adapter
createChart(container, spec, { responsive: false });
```

### Forcing size for export

When you need a chart at specific dimensions (for image export, thumbnails, etc.), set the container to the exact size you want, disable responsive, and export:

```ts
const container = document.createElement("div");
container.style.width = "1200px";
container.style.height = "800px";
document.body.appendChild(container);

const chart = createChart(container, spec, { responsive: false });
const pngBlob = await chart.export("png", { dpi: 2 });

chart.destroy();
container.remove();
```

---

## Export

### Vanilla API

The `ChartInstance` returned by `createChart` supports three export formats:

```ts
const chart = createChart(container, spec);

// SVG: synchronous, returns an XML string
const svgString = chart.export("svg");

// PNG: async, returns a Blob. Optional DPI scaling (default: 2x for retina).
const pngBlob = await chart.export("png");
const hiResPng = await chart.export("png", { dpi: 3 });

// CSV: synchronous, returns the data as comma-separated text
const csvString = chart.export("csv");
```

Tables support CSV export through `TableInstance`:

```ts
const table = createTable(container, tableSpec);
const csvString = table.export("csv");
```

Table CSV export respects the current sort and search state but exports all rows (ignores pagination), so you get the full filtered dataset.

### Download helper

The library doesn't include download utilities, but wiring one up is straightforward:

```ts
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadString(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  downloadBlob(blob, filename);
}

// Usage
const svgString = chart.export("svg");
downloadString(svgString, "chart.svg", "image/svg+xml");

const pngBlob = await chart.export("png");
downloadBlob(pngBlob, "chart.png");

const csvString = chart.export("csv");
downloadString(csvString, "data.csv", "text/csv");
```

### Framework export

The `<Chart>` component doesn't expose the instance directly. For export access, use the `useChart` hook/composable:

**React:**

```tsx
import { useChart } from "@opendata-ai/openchart-react";

function ExportableChart({ spec }: { spec: ChartSpec }) {
  const { ref, chart } = useChart(spec, { darkMode: "off" });

  const handleExport = async (format: "svg" | "png" | "csv") => {
    if (!chart) return;
    if (format === "png") {
      const blob = await chart.export("png");
      downloadBlob(blob, "chart.png");
    } else {
      const str = chart.export(format);
      downloadString(str, `chart.${format}`, format === "svg" ? "image/svg+xml" : "text/csv");
    }
  };

  return (
    <div>
      <button onClick={() => handleExport("svg")}>Export SVG</button>
      <button onClick={() => handleExport("png")}>Export PNG</button>
      <div ref={ref} style={{ width: "100%", height: 400 }} />
    </div>
  );
}
```

**Vue:**

```vue
<script setup lang="ts">
import { useChart } from "@opendata-ai/openchart-vue";

const { containerRef, chart } = useChart(spec, { darkMode: "off" });

async function handleExport(format: "svg" | "png" | "csv") {
  if (!chart.value) return;
  if (format === "png") {
    const blob = await chart.value.export("png");
    downloadBlob(blob, "chart.png");
  } else {
    const str = chart.value.export(format);
    downloadString(str, `chart.${format}`, format === "svg" ? "image/svg+xml" : "text/csv");
  }
}
</script>

<template>
  <button @click="handleExport('svg')">Export SVG</button>
  <button @click="handleExport('png')">Export PNG</button>
  <div ref="containerRef" style="width: 100%; height: 400px" />
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { useChart } from "@opendata-ai/openchart-svelte";

const { action, chart } = useChart(spec, { darkMode: "off" });

async function handleExport(format: "svg" | "png" | "csv") {
  if (!chart) return;
  if (format === "png") {
    const blob = await chart.export("png");
    downloadBlob(blob, "chart.png");
  } else {
    const str = chart.export(format);
    downloadString(str, `chart.${format}`, format === "svg" ? "image/svg+xml" : "text/csv");
  }
</script>

<button onclick={() => handleExport("svg")}>Export SVG</button>
<button onclick={() => handleExport("png")}>Export PNG</button>
<div use:action style="width: 100%; height: 400px"></div>
```

---

## Vanilla lifecycle

For usage without a framework, the vanilla adapter provides direct instance control.

### Chart lifecycle

```ts
import { createChart } from "@opendata-ai/openchart-vanilla";

// Mount
const chart = createChart(container, spec, {
  darkMode: "auto",
  responsive: true,
  onMarkClick: (event) => console.log(event.datum),
});

// Update spec (triggers full recompile + re-render)
chart.update(newSpec);

// Force resize (usually handled by ResizeObserver)
chart.resize();

// Read current layout for custom overlays or debugging
const layout = chart.layout;
console.log(layout.dimensions, layout.marks.length);

// Export
const svg = chart.export("svg");

// Clean up: removes DOM, disconnects observers
chart.destroy();
```

### Render-state attributes

The vanilla mount stamps two attributes on the container so external code (tests, screenshot pipelines) can observe render state without reaching into internals. These are set by every mount type: chart, sankey, barlist, and tilemap.

- `data-oc-fonts-state` — `"pending"` or `"ready"`. Webfonts (e.g. Inter via `display=swap`) often swap in after first paint, which changes text metrics and can rewrap titles or shift labels. On mount the value is `"pending"` if a font is still loading, and flips to `"ready"` exactly once, after the one-shot recompile that runs on `document.fonts.ready`. When the font is already cached (typical on desktop), it starts at `"ready"`. Crucially, `"ready"` means the layout reflects final font metrics: if an entrance animation is in flight, the flip is deferred until the recompile actually runs, so it never claims ready while layout still uses fallback metrics.
- `data-oc-render-gen` — a counter that increments on every full render (initial mount, `update()`, `resize()`, and the post-font recompile). Watch it to detect that a re-render happened.

Wait for `data-oc-fonts-state="ready"` before screenshotting so you capture final-font layout rather than a fallback-metric frame:

```ts
const chart = createChart(container, spec, { responsive: false });

// Wait until the layout reflects the final webfont metrics.
if (container.dataset.ocFontsState !== "ready") {
  await new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (container.dataset.ocFontsState === "ready") {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(container, {
      attributes: true,
      attributeFilter: ["data-oc-fonts-state"],
    });
  });
}

const png = await chart.export("png", { dpi: 2 });
```

In Playwright the same wait is one line: `await page.waitForSelector('[data-oc-fonts-state="ready"]')`.

### Table lifecycle

```ts
import { createTable } from "@opendata-ai/openchart-vanilla";

const table = createTable(container, tableSpec, {
  darkMode: "auto",
  responsive: true,
  onRowClick: (row) => console.log(row),
  onStateChange: (state) => {
    // state: { sort: SortState | null, search: string, page: number }
    console.log("Table state:", state);
  },
});

// Update spec
table.update(newTableSpec);

// Read/set state programmatically
const state = table.getState();
table.setState({ sort: { column: "name", direction: "asc" } });
table.setState({ search: "query", page: 0 });

// Export
const csv = table.export("csv");

// Clean up
table.destroy();
```

### Controlled table (vanilla)

Pass `externalState` in mount options to use controlled mode:

```ts
const table = createTable(container, tableSpec, {
  externalState: { sort: null, search: "", page: 0 },
  onStateChange: (state) => {
    // Update your external state store, then call table.setState()
    myStore.update(state);
    table.setState(state);
  },
});
```

---

## Accessibility

The library generates accessibility features automatically:

- **Alt text**: Auto-generated chart description (type, data summary, encoding)
- **Screen reader table**: Visually hidden HTML table with chart data, alongside the SVG
- **ARIA attributes**: Role, roledescription, and label on the chart container
- **Keyboard navigation**: Arrow keys navigate between marks, Enter/Space shows tooltip, Escape hides it

These are built into the vanilla adapter and inherited by all framework components (React, Vue, Svelte). No extra configuration needed. For author controls (custom alt text, pattern fills, dev-mode contrast warnings) and the WCAG mapping, see the [accessibility guide](accessibility.md).

For tables, the HTML structure uses semantic elements (`<table>`, `<thead>`, `<th scope="col">`, `<tbody>`) with ARIA grid roles, sort state attributes, and a live region that announces sort/search changes to screen readers.

---

## Graph visualization

Graphs render force-directed network visualizations on canvas. The input is a `GraphSpec` with `nodes` and `edges` instead of `data` and `encoding`. See the [graphs guide](graphs.md) for layout and encoding details, and the [spec reference](spec-reference.md#graphspec) for the full type definition. Live examples: [basic](https://tryopendata.github.io/openchart/?story=graphs--graphs#basic), [search](https://tryopendata.github.io/openchart/?story=graphs--graphs#search)

### React

```tsx
import { Graph } from "@opendata-ai/openchart-react";

<Graph
  spec={graphSpec}
  theme={theme}
  darkMode="auto"
  onNodeClick={(node) => console.log("Clicked:", node)}
  onNodeDoubleClick={(node) => console.log("Double-clicked:", node)}
  onSelectionChange={(nodeIds) => console.log("Selected:", nodeIds)}
  style={{ width: "100%", height: 500 }}
/>;
```

### Vue

```vue
<script setup lang="ts">
import { Graph } from "@opendata-ai/openchart-vue";
</script>

<template>
  <Graph
    :spec="graphSpec"
    :theme="theme"
    dark-mode="auto"
    @node-click="(node) => console.log('Clicked:', node)"
    @node-double-click="(node) => console.log('Double-clicked:', node)"
    @selection-change="(nodeIds) => console.log('Selected:', nodeIds)"
    style="width: 100%; height: 500px"
  />
</template>
```

### Svelte

```svelte
<script lang="ts">
import { Graph } from "@opendata-ai/openchart-svelte";
</script>

<Graph
  spec={graphSpec}
  theme={theme}
  darkMode="auto"
  onNodeClick={(node) => console.log("Clicked:", node)}
  onNodeDoubleClick={(node) => console.log("Double-clicked:", node)}
  onSelectionChange={(nodeIds) => console.log("Selected:", nodeIds)}
  style="width: 100%; height: 500px"
/>
```

### Graph props

| Prop                | Type                                      | Description                                 |
| ------------------- | ----------------------------------------- | ------------------------------------------- |
| `spec`              | `GraphSpec`                               | The graph spec. Required.                   |
| `theme`             | `ThemeConfig`                             | Theme overrides.                            |
| `darkMode`          | `DarkMode`                                | Dark mode: `'auto'`, `'force'`, or `'off'`. |
| `onNodeClick`       | `(node: Record<string, unknown>) => void` | Fires when a node is clicked.               |
| `onNodeDoubleClick` | `(node: Record<string, unknown>) => void` | Fires when a node is double-clicked.        |
| `onSelectionChange` | `(nodeIds: string[]) => void`             | Fires when the selected nodes change.       |

### useGraph hook/composable

For imperative control over the graph (search, zoom, selection), each framework provides a hook/composable:

**React:**

```tsx
import { Graph, useGraph } from "@opendata-ai/openchart-react";

function SearchableGraph({ spec }: { spec: GraphSpec }) {
  const { ref, search, clearSearch, zoomToFit, zoomToNode, selectNode } =
    useGraph();

  return (
    <div>
      <input
        onChange={(e) => search(e.target.value)}
        placeholder="Search nodes..."
      />
      <button onClick={zoomToFit}>Fit all</button>
      <button onClick={clearSearch}>Clear search</button>
      <div style={{ width: "100%", height: 500 }}>
        <Graph ref={ref} spec={spec} />
      </div>
    </div>
  );
}
```

**Vue:**

```vue
<script setup lang="ts">
import { Graph, useGraph } from "@opendata-ai/openchart-vue";

const { componentRef, search, clearSearch, zoomToFit } = useGraph();
</script>

<template>
  <input @input="(e) => search(e.target.value)" placeholder="Search nodes..." />
  <button @click="zoomToFit">Fit all</button>
  <div style="width: 100%; height: 500px">
    <Graph ref="componentRef" :spec="spec" />
  </div>
</template>
```

**Svelte:**

```svelte
<script lang="ts">
import { Graph, useGraph } from "@opendata-ai/openchart-svelte";

const { action, search, clearSearch, zoomToFit } = useGraph(spec, {});
</script>

<input oninput={(e) => search(e.target.value)} placeholder="Search nodes..." />
<button onclick={zoomToFit}>Fit all</button>
<div style="width: 100%; height: 500px" use:action>
</div>
```

All frameworks return the same control methods:

| Property             | Type               | Description                         |
| -------------------- | ------------------ | ----------------------------------- |
| `ref`                | `RefObject`        | Pass to `<Graph ref={ref}>`.        |
| `search(query)`      | `(string) => void` | Highlight nodes matching the query. |
| `clearSearch()`      | `() => void`       | Clear search highlights.            |
| `zoomToFit()`        | `() => void`       | Fit all nodes in the viewport.      |
| `zoomToNode(id)`     | `(string) => void` | Center and zoom to a specific node. |
| `selectNode(id)`     | `(string) => void` | Programmatically select a node.     |
| `getSelectedNodes()` | `() => string[]`   | Get currently selected node IDs.    |

### Vanilla

```ts
import { createGraph } from "@opendata-ai/openchart-vanilla";

const graph = createGraph(container, graphSpec, {
  darkMode: "auto",
  responsive: true,
  onNodeClick: (node) => console.log("Clicked:", node),
  onNodeDoubleClick: (node) => console.log("Double-clicked:", node),
  onSelectionChange: (nodeIds) => console.log("Selected:", nodeIds),
});

// Imperative control
graph.search("alice");
graph.clearSearch();
graph.zoomToFit();
graph.zoomToNode("node-42");
graph.selectNode("node-42");
console.log(graph.getSelectedNodes());

// Update with new spec
graph.update(newGraphSpec);

// Clean up
graph.destroy();
```

`createGraph` returns a `GraphInstance` with these methods:

| Method               | What it does                                                 |
| -------------------- | ------------------------------------------------------------ |
| `update(spec)`       | Recompile and re-render with a new spec.                     |
| `search(query)`      | Highlight nodes matching the query string.                   |
| `clearSearch()`      | Clear search highlights.                                     |
| `zoomToFit()`        | Fit all nodes in the viewport.                               |
| `zoomToNode(id)`     | Center and zoom to a specific node.                          |
| `selectNode(id)`     | Programmatically select a node.                              |
| `getSelectedNodes()` | Get currently selected node IDs.                             |
| `resize()`           | Manually trigger resize (usually handled by ResizeObserver). |
| `destroy()`          | Remove DOM, stop simulation, disconnect observers.           |

### Graph interaction model

Nodes support click, drag, and double-click. Dragging a node pins it in place temporarily; when released, the simulation takes over again. Multi-select isn't built in (each click selects one node), but you can track selections via `onSelectionChange`.

The force simulation runs in a web worker to keep the main thread responsive. Nodes auto-fit to the viewport once the simulation settles.

---

## Related docs

- [Chart types](chart-types.md) for a visual gallery with boilerplate specs and live examples
- [Tables](tables.md) for data table features (heatmaps, sparklines, flags, and more)
- [Graphs](graphs.md) for network/relationship visualizations
- [Spec reference](spec-reference.md) for field-by-field type details
- [Getting started](getting-started.md) for a hands-on tutorial
- [Architecture](architecture.md) for how the compilation pipeline works
