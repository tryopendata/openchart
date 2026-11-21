---
title: "Export API"
description: "Export charts as SVG, PNG, JPG, CSV or an animated GIF, from a chart instance, a standalone function or a framework component."
section: api
order: 6
---

# Export API

Every mounted chart can export itself as SVG, PNG, JPG, CSV or an animated GIF through `chart.export()`. Tables export CSV. The standalone `exportSVG`, `exportSVGWithFonts`, `exportPNG`, `exportJPG` and `exportCSV` functions take an SVG element (or rows, for CSV) instead of an instance. `exportSpecSequence(specs, options)` mounts an offscreen chart, tweens it through a list of specs and returns a GIF `Blob`; `options` needs `width` and `height`, and like GIF export it needs the optional `gifenc` package. The React, Vue and Svelte packages re-export all six.

See it: [Export](https://openchart.steamfield.io/docs/output/export/).

## Export

### Vanilla API

`chart.export()` on the `ChartInstance` returned by `createChart` takes `'svg'`, `'svg-with-fonts'`, `'png'`, `'jpg'`, `'gif'` or `'csv'`. The common ones:

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

### Animated GIF export

GIF export captures a chart's entrance animation as a looping (or play-once) image. It's the format to reach for when you need an animated chart to autoplay inline somewhere that blocks iframes, video players, and animated SVG, like a Substack or newsletter article.

The setup is a little more involved than the other formats, so read this before wiring it up.

**Install the optional encoder.** GIF encoding uses [`gifenc`](https://github.com/mattdesl/gifenc), which is an *optional* peer dependency, it is not bundled with openchart and not pulled in unless you export GIFs. Install it yourself:

```bash
npm install gifenc
```

Calling `chart.export("gif")` without it throws a clear error telling you to install it. The encoder loads lazily (dynamic import), so it never weighs down your main bundle, only the code path that actually exports a GIF pays for it.

**How it works (and why the chart doesn't need to be mid-animation).** OpenChart's entrance animations are pure CSS, and CSS animation state lives in computed style, which doesn't survive SVG serialization. So GIF export does *not* screen-record the live animation. Instead it reproduces the entrance deterministically from the chart's final, settled render: it computes each mark's `clip-path`/`opacity` at every frame in JS, stamps them inline, rasterizes, and encodes. The upshot for you: just call `export("gif")` on a normally-rendered chart. No offscreen mounting, no forcing the animation to replay.

```ts
const chart = createChart(container, spec);

// Async, returns a Blob. Reproduces the entrance animation, then holds the
// final frame (play-once is the default).
const gifBlob = await chart.export("gif");

// Loop forever instead of holding the last frame:
const looping = await chart.export("gif", { loop: true });
```

**Options** (`GIFExportOptions`):

| Option | Default | Meaning |
| --- | --- | --- |
| `loop` | `false` | `false` plays once and holds the final frame; `true` loops forever; a positive number sets an explicit loop count. Note `0` maps to gifenc's loop-forever (same as `true`), so use `false`, not `0`, for play-once. |
| `fps` | `25` | Frames per second captured. |
| `dpi` | `2` | Resolution scaling, same as PNG. `2` keeps text crisp. |
| `durationMs` | animation total | Override the capture window length. |
| `backgroundColor` | the SVG's root background (or white) | Opaque fill. GIF can't carry partial alpha. A transparent, `currentColor` or `url()` root background falls back to white. |
| `embedFonts` | `true` | Embed fonts so text matches on-screen. |

**Scope and caveats:**

- Every instance that animates an entrance on screen exports one: charts, bar lists, tile maps, sankeys and geo maps. Tables and graphs have no GIF export.
- Frames follow the same keyframes, curves and timing the browser plays: bar and stack reveals, label slides, line draws, map fill colour sweeps and point scale-ups, bar list row slides. A map that has a focus keeps its dimmed features at the dim.
- It evaluates the author's `ease` (including `snappy`, `gentle` and spring), not just `smooth`.
- The motion is a faithful JS re-creation of the CSS entrance (same durations, stagger), not a pixel-for-pixel screen capture.
- GIF is a 256-color format. Solid fills and text hold up well at `dpi: 2`; heavy gradients will band. File size grows with duration, dimensions, and fps.
- A chart with no entrance animation configured produces a single-frame (effectively static) GIF.
- Some browsers restart a play-once GIF from the first frame when it scrolls out of view and back. For a scroll-past article this is a non-issue.

You can also import `exportGIF` directly from the subpath if you're not going through a chart instance:

```ts
import { exportGIF } from "@opendata-ai/openchart-vanilla/gif";

const gifBlob = await exportGIF(svgElement, resolvedAnimation, { loop: false });
```

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

const gifBlob = await chart.export("gif", { loop: false }); // needs `gifenc` installed
downloadBlob(gifBlob, "chart.gif");
```

### Framework export

Each `<Chart>` component exposes its instance: in React through a ref (`ref.current.instance`), in Vue through a template ref (`chartRef.value.instance`) and in Svelte through `bind:this` (`chart.getInstance()`). The `useChart` hook or composable also returns it:

**React:**

```tsx
import { useChart, type ChartSpec } from "@opendata-ai/openchart-react";

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

// Keep the object: `chart` is a getter, and destructuring would copy its first value, null.
const c = useChart(() => spec, () => ({ darkMode: "off" }));

async function handleExport(format: "svg" | "png" | "csv") {
  if (!c.chart) return;
  if (format === "png") {
    const blob = await c.chart.export("png");
    downloadBlob(blob, "chart.png");
  } else {
    const str = c.chart.export(format);
    downloadString(str, `chart.${format}`, format === "svg" ? "image/svg+xml" : "text/csv");
  }
}
</script>

<button onclick={() => handleExport("svg")}>Export SVG</button>
<button onclick={() => handleExport("png")}>Export PNG</button>
<div use:c.action style="width: 100%; height: 400px"></div>
```
