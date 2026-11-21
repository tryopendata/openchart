---
title: "Frameworks"
description: "Install and use OpenChart in React, Vue, Svelte or plain JavaScript: the spec as state, updates, dark mode and themes."
section: get-started
slug: frameworks
order: 2
---
<!-- phase-4-stub -->

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

Switch chart types by changing the `mark` field. If the encoding channels are compatible (see [encoding by chart type](reference/marks.md#encoding-by-chart-type)), the same spec works across types.

These examples accept a category on x and a quantitative value on y, and switch only between `line`, `area` and vertical `bar`. They keep both positional channels required instead of accepting unrelated arc or map encodings.

### React

```tsx
import { useState } from "react";
import { Chart } from "@opendata-ai/openchart-react";
import type { ChartSpec, LineEncoding } from "@opendata-ai/openchart-core";

type CartesianMark = "line" | "area" | "bar";
type CartesianSpec = Omit<ChartSpec, "mark" | "encoding"> & {
  mark: CartesianMark;
  encoding: LineEncoding;
};
const MARK_OPTIONS: CartesianMark[] = ["line", "area", "bar"];

function ChartWithTypeSwitcher({ baseSpec }: { baseSpec: CartesianSpec }) {
  const [chartType, setMarkType] = useState<CartesianMark>(baseSpec.mark);

  // Immutable update: spread the spec, override mark
  const spec: ChartSpec = chartType === "line"
    ? { ...baseSpec, mark: "line" }
    : chartType === "area"
      ? { ...baseSpec, mark: "area" }
      : { ...baseSpec, mark: "bar" };

  return (
    <div>
      <select
        value={chartType}
        onChange={(e) => setMarkType(e.target.value as CartesianMark)}
      >
        {MARK_OPTIONS.map((t) => (
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
import type { ChartSpec, LineEncoding } from "@opendata-ai/openchart-core";

type CartesianMark = "line" | "area" | "bar";
type CartesianSpec = Omit<ChartSpec, "mark" | "encoding"> & {
  mark: CartesianMark;
  encoding: LineEncoding;
};
const props = defineProps<{ baseSpec: CartesianSpec }>();
const MARK_OPTIONS: CartesianMark[] = ["line", "area", "bar"];
const chartType = ref<CartesianMark>(props.baseSpec.mark);

const spec = computed<ChartSpec>(() => chartType.value === "line"
  ? { ...props.baseSpec, mark: "line" }
  : chartType.value === "area"
    ? { ...props.baseSpec, mark: "area" }
    : { ...props.baseSpec, mark: "bar" });
</script>

<template>
  <select v-model="chartType">
    <option v-for="t in MARK_OPTIONS" :key="t" :value="t">{{ t }}</option>
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
import type { ChartSpec, LineEncoding } from "@opendata-ai/openchart-core";

type CartesianMark = "line" | "area" | "bar";
type CartesianSpec = Omit<ChartSpec, "mark" | "encoding"> & {
  mark: CartesianMark;
  encoding: LineEncoding;
};
let { baseSpec }: { baseSpec: CartesianSpec } = $props();
const MARK_OPTIONS: CartesianMark[] = ["line", "area", "bar"];
let chartType: CartesianMark = $state(baseSpec.mark);

const spec: ChartSpec = $derived(chartType === "line"
  ? { ...baseSpec, mark: "line" }
  : chartType === "area"
    ? { ...baseSpec, mark: "area" }
    : { ...baseSpec, mark: "bar" });
</script>

<select bind:value={chartType}>
  {#each MARK_OPTIONS as t}
    <option value={t}>{t}</option>
  {/each}
</select>
<div style="width: 100%; height: 400px">
  <Chart {spec} />
</div>
```

All framework components detect spec changes and call `chart.update(spec)` internally. No manual lifecycle management needed.

### Encoding compatibility

Switching between `line`, `area`, and vertical `bar` usually works with a category on x and a quantitative value on y. `bar` orientation follows the encodings; there is no separate `column` mark.

Horizontal bars use the category on y and the value on x. Pie and donut charts use `mark: "arc"` with `encoding.theta` for the value and `encoding.color` for categories; `mark: { type: "arc", innerRadius: 0.55 }` makes a donut.

If the encoding doesn't match the new type, the engine returns a validation error. Check encoding requirements in the [encoding rules table](reference/marks.md#encoding-by-chart-type).

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

Each framework uses its native context system (React context, Vue provide/inject, Svelte context). A component `theme` prop deep-merges over the context theme, preserving unrelated nested provider values. Arrays and light/dark pairs replace atomically.

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

The mount `watermark` option takes precedence over the spec and active breakpoint values when both are set.

Chart-family specs also auto-hide the watermark when the compiled container is under 200px tall — chrome is already hidden at that height, so the brand band would paint over the plot. Set `watermark` explicitly (top level or in an active breakpoint override) to opt back in; an explicit `watermark: true` in that cramped state reserves a compact brand band instead of overlapping the chart. This auto-hide is scoped to charts — sankey, tilemap, graph, geo-map, and table watermarks are unaffected and still need an explicit `watermark: false`.

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

### Driving charts from scroll

Scrollytelling steps are just spec patches: hold a base spec, patch `data` / `encoding` / `annotations` per step, and call `update()` (or pass the new spec prop in React/Vue/Svelte). When the new spec is structurally compatible with the old one, `update()` runs a smooth transition instead of an instant swap.

**Transitions smoothly** (marks, axis ticks, and gridlines move as one system):

- Data-only changes (same keys, new values)
- Y-domain changes (values that force a rescale)
- Series or category add/remove — entering marks fade in, exiting marks fade out as ghosts
- Highlight changes (`encoding.color.highlight`) — strokes fade to the muted color
- Annotation add (fades in) and move (slides to the new position)
- Beeswarm steps — set `encoding.key` to a stable entity field (state, country) so each dot tracks its entity as values change. Without a key, the fallback `lane|value` identity changes whenever a value does and dots shuffle within the swarm instead of tracking.

**Snaps instead** (instant swap, no transition):

- Mark type or encoding field/type changes — structurally different specs tear down and rebuild; there is no spec-to-spec crossfade
- Removed annotations — they disappear immediately (no exit fade)
- Container dimension changes or more than 500 marks — a >500-dot beeswarm or scatter needs `animation: { update: { maxMarks } }` to tween on `update()`; `createChartStory` steps over the cap fall back to a whole-chart crossfade instead of snapping
- `prefers-reduced-motion` — every step snaps to its final state; no configuration needed
- Updates during the entrance animation window (see below)

**Scroll jitter is safe.** Calling `update()` while a transition is mid-flight retargets from the current interpolated position (mid-morph line/area paths freeze and crossfade). However fast the steps arrive, the chart settles on the last spec with no orphaned ghost elements.

**Disable the entrance phase for scroll-driven charts.** (`createChartStory` does this for you when the spec omits `animation`.) By default, an `update()` that lands while the entrance animation is still playing snaps instead of tweening. The window is the full entrance sequence — duration plus per-mark stagger plus buffer, roughly the first 1–3 seconds after mount depending on mark count. Use:

```ts
const baseSpec = {
  mark: "line" as const,
  data,
  encoding,
  animation: { enter: false }, // update/exit transitions stay enabled
};
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

## Responsive behavior

### How it works

By default, both charts and tables observe their container element with `ResizeObserver`. When the container resizes, the library recompiles at the new dimensions.

The responsive system also uses breakpoints to adjust layout strategy at smaller sizes:

- **Label density**: Fewer labels at smaller widths to avoid overcrowding
- **Legend position**: May shift from inline to top/bottom at narrow widths
- **Annotation placement**: Adjusts for available space
- **Tables**: Adapt density and switch to the chosen mobile layout

### Container sizing

The `<Chart>` and `<DataTable>` components render a wrapper div set to `width: 100%; height: 100%`. They fill whatever container you put them in.

An explicit height supplies the chart's figure budget. To keep an exact outer height even when annotations produce notes, set `chromeLayout: 'subtract'` on the spec. Without a height constraint, charts use a 400px visualization budget and add chrome:

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
  /* Automatic height: 400px visualization budget plus chrome */
}
<div>
  <Chart spec={spec} />
</div>;
```

Tables don't need explicit height since they expand with content. The wrapper has `overflow: auto` for scroll handling.

### Disabling responsive

Set `autoResize: false` on the mount or Chart component to disable ResizeObserver. The spec's `responsive` field controls layout adaptations; it does not disable observation.

```tsx
// Spec-level
const spec = { mark: "line", data, encoding, responsive: false };

// Vanilla adapter
createChart(container, spec, { autoResize: false });
```

### Forcing size for export

For exact export dimensions, set the container size, use `chromeLayout: 'subtract'` to prevent note-band growth, and disable automatic resize:

```ts
const container = document.createElement("div");
container.style.width = "1200px";
container.style.height = "800px";
document.body.appendChild(container);

const chart = createChart(container, { ...spec, chromeLayout: 'subtract' }, { autoResize: false });
const pngBlob = await chart.export("png", { dpi: 2 });

chart.destroy();
container.remove();
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

## Related docs

- [Chart types](chart-types.md) for a visual gallery with boilerplate specs and live examples
- [Tables](tables.md) for data table features (heatmaps, sparklines, flags, and more)
- [Graphs](graphs.md) for network/relationship visualizations
- [Spec reference](spec-reference.md) for field-by-field type details
- [Getting started](getting-started.md) for a hands-on tutorial
- [Architecture](architecture.md) for how the compilation pipeline works
