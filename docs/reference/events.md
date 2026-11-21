---
title: "Events"
description: "Chart and table event handlers, their payloads, interaction modes and common event patterns."
section: api
order: 5
---
<!-- phase-4-stub -->

# Events

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

### Interaction mode

The `interaction` mount option (and wrapper prop) sets what a reader can do with
chart elements:

| Mode | Selection | Edit gestures (drag, nudge, delete, text) | Arrow keys |
| --- | --- | --- | --- |
| `'read'` | None | None | Reader data navigation |
| `'select'` | Click and Tab; `onSelect`/`onDeselect` fire | None | Reader data navigation |
| `'edit'` | Click and Tab | All, emitted through `onEdit` | Nudge the selection |

When `interaction` is omitted it is inferred once per mount: an `onEdit` handler
gives `'edit'`, otherwise `onSelect`/`onDeselect` give `'select'`, otherwise
`'read'`. Selection callbacks alone never enable text editing.

```tsx
<Chart spec={spec} interaction="edit" onEdit={persist} />
```

Vue uses `:interaction="'edit'"`, Svelte uses `interaction="edit"`. Every
`ElementRef` passed to `onSelect`, `onDeselect` and `onAnnotationClick`, or
returned by `getSelectedElement()`, carries a JSON Pointer `path` (`/chrome/<key>`
for chrome, `/legend` for the legend and its entries). `chart.isTextEditing` is
true while the inline text editor is open.

### Persisting edits

In edit mode, `onEdit` receives one `EditTransaction` per committed gesture.
Apply it atomically with `applyEditTransaction` from core, persist the returned
spec, and retain the inverse for undo. A rejected transaction leaves the original
unchanged. Do not persist transient selection, note emphasis, or legend visibility
as gesture edits. Cancelled pointer gestures emit nothing.

React uses `onEdit`, Vue uses `@edit`, and Svelte uses `onedit`. The former
`onEditTransaction` and element-edit callbacks are removed. See the complete
[persistence example and keyboard contract](../migrating-v9.md#editing-and-keyboard-navigation).

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

## Event handlers

Interaction callbacks. Source: `core/src/types/events.ts`.

Pass these through `MountOptions` (vanilla) or `ChartProps` (React).

### ChartEventHandlers

| Handler             | Signature                                             | When it fires                                     |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `onMarkClick`       | `(event: MarkEvent) => void`                          | User clicks a data mark (bar, point, line, arc).  |
| `onMarkFocus` | `(event: MarkFocusEvent) => void` | Keyboard navigation reaches a different data mark. |
| `onMarkHover`       | `(event: MarkEvent) => void`                          | Mouse enters a data mark.                         |
| `onMarkLeave`       | `() => void`                                          | Mouse leaves a data mark.                         |
| `onEdit` | `(transaction: EditTransaction) => void` | One committed authored edit; apply atomically with `applyEditTransaction` and retain its inverse for undo. |
| `onLegendToggle`    | `(series: string, visible: boolean) => void`          | User clicks a legend entry to show/hide a series. |
| `onAnnotationClick` | `(annotation: Annotation, event: MouseEvent, element: ElementRef) => void` | User clicks an annotation element.                |
| `onSelect` | `(element: ElementRef) => void` | An element is selected by click, Tab, or `select()`. Requires `interaction` `'select'` or `'edit'`. |
| `onDeselect` | `(element: ElementRef) => void` | The selected element is deselected. |

The `interaction` mount option (`'read' | 'select' | 'edit'`) gates selection and editing; when omitted, `onEdit` implies `'edit'` and `onSelect`/`onDeselect` imply `'select'`. Every `ElementRef` carries a JSON Pointer `path`. See [Editing and keyboard navigation](../migrating-v9.md#editing-and-keyboard-navigation) for transaction persistence and cancelled-gesture behavior. See [Interaction mode](#interaction-mode) for the full table.

### MarkEvent

| Field      | Type                       | Description                                                                                      |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| `datum`    | `DataRow`                  | The data row associated with the mark. For line/area marks, this is the first row of the series. |
| `series`   | `string \| undefined`      | Series identifier for multi-series charts. Matches the color encoding field value.               |
| `position` | `{ x: number, y: number }` | Click/hover position relative to the chart container.                                            |
| `event`    | `MouseEvent`               | The raw browser MouseEvent.                                                                      |

### MarkFocusEvent

| Field | Type | Description |
| --- | --- | --- |
| `datum` | `DataRow` | Data row associated with the focused mark. |
| `series` | `string \| undefined` | Optional series identifier. |
| `key` | `string` | Stable mark key. |
| `description` | `string \| undefined` | The navigated element's current `aria-label`: authored description when supplied, otherwise its generated mark label. Undefined only when that element has no label. |
| `element` | `SVGElement` | Navigated element selected by `data-mark-id`; it may be a wrapper `<g>` for bar, line or area marks rather than the inner data shape. |
| `event` | `FocusEvent \| KeyboardEvent` | Event that moved focus; not a `MouseEvent`. |

Use `onMarkFocus` to update a host-owned live region; see the [accessibility example](../accessibility.md#keyboard-inspection-and-host-announcements).

### Table event handlers

Table events are passed through `TableMountOptions` (vanilla) or `DataTableProps` (React).

| Handler          | Signature                                | When it fires                                         |
| ---------------- | ---------------------------------------- | ----------------------------------------------------- |
| `onRowClick`     | `(row: Record<string, unknown>) => void` | User clicks a table row.                              |
| `onSortChange`   | `(sort: SortState \| null) => void`      | Sort state changes (React `DataTable` only).          |
| `onSearchChange` | `(query: string) => void`                | Search query changes (React `DataTable` only).        |
| `onPageChange`   | `(page: number) => void`                 | Page changes (React `DataTable` only).                |
| `onStateChange`  | `(state: TableState) => void`            | Any table state changes (vanilla `createTable` only). |
