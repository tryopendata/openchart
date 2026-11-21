---
title: "Vanilla API"
description: "The create* mount functions, MountOptions, the ChartInstance methods, the chart and table lifecycle, and the render-state attributes."
section: api
order: 1
---

# Vanilla API

`@opendata-ai/openchart-vanilla` mounts a spec into a DOM element without a framework. The React, Vue and Svelte components wrap these functions, so their props map onto the mount options below. Source: `vanilla/src/index.ts` and `vanilla/src/mount-types.ts`.

See it: [Frameworks](/docs/get-started/frameworks/) shows the same chart mounted from each package.

```bash
npm install @opendata-ai/openchart-vanilla
```

Import the stylesheet once: `import "@opendata-ai/openchart-vanilla/styles.css"`.

## Mount functions

Each function takes a container element, a spec and optional mount options, and returns an instance. The spec kind decides the function.

| Function | Spec | Options | Returns |
| --- | --- | --- | --- |
| `createChart` | `ChartSpec \| LayerSpec` | `MountOptions` | `ChartInstance` |
| `createTable` | `TableSpec` | `TableMountOptions` | `TableInstance` |
| `createGraph` | `GraphSpec` | `GraphMountOptions` | `GraphInstance` |
| `createSankey` | `SankeySpec` | `SankeyMountOptions` | `SankeyInstance` |
| `createTileMap` | `TileMapSpec` | `TileMapMountOptions` | `TileMapInstance` |
| `createGeoMap` | `GeoMapSpec` | `GeoMapMountOptions` | `GeoMapInstance` |
| `createBarList` | `BarListSpec` | `BarListMountOptions` | `BarListInstance` |

Other entry points:

- `renderStaticSVG(spec, options?)` from `@opendata-ai/openchart-vanilla/static` returns an SVG string with no DOM. See [static rendering](../static-rendering.md).
- `createChartStory` from `@opendata-ai/openchart-vanilla/story` drives a chart through scroll steps.
- `exportGIF` from `@opendata-ai/openchart-vanilla/gif` encodes an entrance animation. See [Export API](./export.md#animated-gif-export).
- `createReader(container, chart, spec, onChange, options?)` adds reader pinning to a mounted chart. See [Authoring and reader APIs](./authoring.md).

## MountOptions

Options for `createChart`. It extends `ChartEventHandlers`, so every handler in [Events](./events.md#charteventhandlers) is also an option.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `theme` | `ThemeConfig` | `undefined` | Theme overrides, merged over the spec's `theme`. |
| `darkMode` | `'auto' \| 'force' \| 'off'` | `'off'` | `'auto'` follows the system setting. See [DarkMode](./theme.md#darkmode). |
| `interaction` | `'read' \| 'select' \| 'edit'` | inferred | What the reader can do with chart elements. Omitted, `onEdit` gives `'edit'`, `onSelect` or `onDeselect` gives `'select'`, and anything else `'read'`. See [Interaction mode](./events.md#interaction-mode). |
| `renderer` | `'auto' \| 'svg' \| 'canvas'` | `'auto'` | Backend for point marks. `'auto'` moves scatters above 1,000 points to canvas. Ignored, with a console warning, for other marks and for faceted, layered and sparkline charts. See [Canvas mark mode](./marks.md#canvas-mark-mode). |
| `autoResize` | `boolean` | `true` | Re-render when the container resizes, through `ResizeObserver`. |
| `watermark` | `boolean` | `true` | Show the OpenData watermark. Overrides the spec's `watermark`. |
| `selectedElement` | `ElementRef` | `undefined` | Element selected at mount. |
| `rowHover` | `boolean` | `undefined` | Quiet row inspection on simple horizontal bar charts. |
| `revision` | `string \| number` | `undefined` | Source revision stamped on emitted edit transactions. |

## ChartInstance

What `createChart` returns.

| Member | Signature | Description |
| --- | --- | --- |
| `update` | `(spec, options?: { revision?, selectedElement? }) => void` | Recompile and re-render with a new spec. Data changes tween when animation is on. Omitting `selectedElement` keeps the current selection. |
| `resize` | `() => void` | Recompile at the container's current size. `autoResize` usually calls it for you. |
| `export` | `(format, options?) => string \| Promise<Blob> \| Promise<string>` | `'svg'` and `'csv'` return a string; `'svg-with-fonts'` a promise of a string; `'png'`, `'jpg'` and `'gif'` a promise of a `Blob`. See [Export API](./export.md). |
| `destroy` | `() => void` | Remove the chart's DOM and disconnect its observers. |
| `layout` | `ChartLayout` (read-only) | The current compiled layout: dimensions, scales and marks. |
| `sampleLayout` | `() => ChartLayout` | The geometry on screen right now, including mid-transition, for hit testing. |
| `beginManualUpdate` | `(spec) => TransitionHandle \| null` | Render a new spec and return a transition you step yourself with `handle.step(elapsedMs)`, for frame capture. `null` when no transition applies. |
| `getSelectedElement` | `() => ElementRef \| null` | The selected element. |
| `select` | `(ref: ElementRef) => void` | Select an element. Does nothing if it isn't found. |
| `deselect` | `() => void` | Clear the selection. |
| `isTextEditing` | `boolean` (read-only) | True while the inline text editor is open. |
| `setHighlight` | `(values: string[] \| null) => void` | Highlight these color-field values and re-render. `null` clears. |
| `resetDrawing` | `() => void` | Clear a `youDrawIt` guess and return to drawing. |
| `revealDrawing` | `() => void` | Reveal a `youDrawIt` chart, as the reveal button does. |

Every other instance has `update`, `resize` and `destroy`, and all but `GraphInstance` have `export`. `TableInstance` adds `getState()` and `setState()`, shown below. `GraphInstance` adds search, selection, highlight and camera methods (see [GraphSpec](./graph-spec.md#vanilla)). `GeoMapInstance` adds `zoomTo`, `panTo`, `fitBounds`, `resetView`, `getCamera` and `setCamera`.

## Vanilla lifecycle

### Chart lifecycle

```ts
import { createChart } from "@opendata-ai/openchart-vanilla";

// Mount
const chart = createChart(container, spec, {
  darkMode: "auto",
  autoResize: true,
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

- `data-oc-fonts-state`: `"pending"` or `"ready"`. Webfonts (e.g. Inter via `display=swap`) often swap in after first paint, which changes text metrics and can rewrap titles or shift labels. On mount the value is `"pending"` if a font is still loading, and flips to `"ready"` exactly once, after the one-shot recompile that runs on `document.fonts.ready`. When the font is already cached (typical on desktop), it starts at `"ready"`. Crucially, `"ready"` means the layout reflects final font metrics: if an entrance animation is in flight, the flip is deferred until the recompile actually runs, so it never claims ready while layout still uses fallback metrics.
- `data-oc-render-gen`: a counter that increments on every full render (initial mount, `update()`, `resize()`, and the post-font recompile). Watch it to detect that a re-render happened.

Wait for `data-oc-fonts-state="ready"` before screenshotting so you capture final-font layout rather than a fallback-metric frame:

```ts
const chart = createChart(container, spec, { autoResize: false });

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
  autoResize: true,
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
