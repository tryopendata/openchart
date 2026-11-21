---
title: "Vanilla API"
description: "The vanilla chart and table lifecycle: create, update, resize and destroy, and the render-state attributes."
section: api
order: 1
---
<!-- phase-4-stub -->

# Vanilla API

## Vanilla lifecycle

For usage without a framework, the vanilla adapter provides direct instance control.

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

- `data-oc-fonts-state` — `"pending"` or `"ready"`. Webfonts (e.g. Inter via `display=swap`) often swap in after first paint, which changes text metrics and can rewrap titles or shift labels. On mount the value is `"pending"` if a font is still loading, and flips to `"ready"` exactly once, after the one-shot recompile that runs on `document.fonts.ready`. When the font is already cached (typical on desktop), it starts at `"ready"`. Crucially, `"ready"` means the layout reflects final font metrics: if an entrance animation is in flight, the flip is deferred until the recompile actually runs, so it never claims ready while layout still uses fallback metrics.
- `data-oc-render-gen` — a counter that increments on every full render (initial mount, `update()`, `resize()`, and the post-font recompile). Watch it to detect that a re-render happened.

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
