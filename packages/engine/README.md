# @opendata-ai/openchart-engine

Headless compiler for OpenChart. Takes a spec (plain JSON), validates it, and produces a fully resolved layout with computed positions, scales, marks, and accessibility metadata. No DOM dependency.

## Install

```bash
npm install @opendata-ai/openchart-engine
```

You typically don't install this directly. The framework packages (`openchart-react`, `openchart-vue`, `openchart-svelte`) and the vanilla adapter include it as a dependency.

## Core API

### compile()

The main entry point. Accepts any `VizSpec` and returns the compiled layout:

```typescript
import { compile } from '@opendata-ai/openchart-engine';

const result = compile(spec, {
  width: 600,
  height: 400,
  darkMode: false,
});
// result is a ChartLayout, TableLayout, or GraphCompilation
```

### compileChart()

Compiles a `ChartSpec` into a `ChartLayout` with positioned marks, axes, gridlines, legends, and annotations:

```typescript
import { compileChart } from '@opendata-ai/openchart-engine';

const layout = compileChart(chartSpec, { width: 600, height: 400 });
// layout.marks: positioned line paths, bar rects, arc segments, etc.
// layout.axes: tick positions, labels, format strings
// layout.legend: entries, position, dimensions
// layout.endpointLabels: per-series chip+swatch labels at the trailing point (line/area), driven by `layout.endpointLabels: EndpointLabelsLayout` on the spec
// layout.annotations: pixel-positioned annotation elements
// layout.theme: fully resolved theme with all defaults filled
```

### compileTable()

Compiles a `TableSpec` into a `TableLayout` with resolved columns, formatted cells, and visual enhancements:

```typescript
import { compileTable } from '@opendata-ai/openchart-engine';

const layout = compileTable(tableSpec, { darkMode: false });
```

### compileGraph()

Compiles a `GraphSpec` into a `GraphCompilation` with resolved node/edge visuals and simulation config. Note: the engine doesn't compute node positions. That happens at runtime via a force simulation in the vanilla adapter.

```typescript
import { compileGraph } from '@opendata-ai/openchart-engine';

const compilation = compileGraph(graphSpec, { width: 600, height: 400 });
// compilation.nodes: visual properties (size, color, label) resolved
// compilation.edges: visual properties (width, color) resolved
// compilation.simulationConfig: force parameters for the layout engine
```

### validateSpec()

Runtime validation of any spec. Returns structured errors with paths and suggestions:

```typescript
import { validateSpec } from '@opendata-ai/openchart-engine';

const result = validateSpec(spec);
if (!result.valid) {
  for (const error of result.errors) {
    console.log(`${error.path}: ${error.message}`);
    console.log(`  Suggestion: ${error.suggestion}`);
  }
}
```

### normalizeSpec()

Fills in defaults and resolves shorthand without validation. Useful when you know the spec is valid and want the normalized form:

```typescript
import { normalizeSpec } from '@opendata-ai/openchart-engine';

const normalized = normalizeSpec(spec);
// All optional fields resolved to their defaults
```

## Chart renderer registry

Chart types are registered via a plugin pattern. The engine ships with all 8 types pre-registered (line, area, bar, column, pie, donut, dot, scatter). For advanced use, you can register custom renderers:

```typescript
import { registerChartRenderer, getChartRenderer, clearRenderers } from '@opendata-ai/openchart-engine';

registerChartRenderer('custom', myCustomRenderer);
```

## Re-exports

For convenience, this package re-exports all types from `@opendata-ai/openchart-core`, so you can import types from either package.

## Related docs

- [Architecture](../../docs/architecture.md) for how the compilation pipeline works
- [Spec reference](../../docs/spec-reference.md) for field-by-field type details
