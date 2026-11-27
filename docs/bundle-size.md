---
title: "Bundle size"
description: "Import one OpenChart visualization and ship only that one: what each import costs, which imports pull in everything, and how to check your own bundle."
section: get-started
order: 4
---

# Bundle size

OpenChart tree-shakes by visualization type. Import `Sankey` and your bundle carries the Sankey compiler and renderer, without the bar, line, map or table code. This works with a bare named import from the package root in any bundler that tree-shakes ES modules (Vite, Rollup, esbuild, webpack, Next.js). There are no per-chart subpaths to learn.

```tsx
import { Sankey } from '@opendata-ai/openchart-react';
```

## What each import costs

Sizes are for one named import, minified, with gzip in the second column, measured at 9.2.2. They include OpenChart's own dependencies (the d3 modules it uses) and exclude your framework. The React column's sizes are shown; the vanilla mounts are 2 to 3 kB smaller and the Vue components match React.

| Import | Vanilla | React | Minified | Gzip |
| --- | --- | --- | --- | --- |
| Table | `createTable` | `DataTable` | 160 kB | 53 kB |
| Bar list | `createBarList` | `BarList` | 172 kB | 58 kB |
| Race | `createRace` | `Race` | 177 kB | 63 kB |
| Sankey | `createSankey` | `Sankey` | 178 kB | 60 kB |
| Graph | `createGraph` | `Graph` | 214 kB | 73 kB |
| Tile map | `createTileMap` | `TileMap` | 229 kB | 79 kB |
| Geo map | `createGeoMap` | `GeoMap` | 430 kB | 147 kB |
| Chart | `createChart` | `Chart` | 823 kB | 267 kB |
| Everything | `import *` | `Visualization` | 1,267 kB | 419 kB |

About 100 kB of each row is shared: themes, text measurement, chrome, tooltips, the entrance animation system and export. Two types on one page cost less than the sum of their rows; `Sankey` and `DataTable` together are 235 kB, where the rows add up to 338 kB.

`Chart` is the large one because a chart's `mark` is data. The spec can say `bar`, `line`, `arc` or any other mark at runtime, so the bundle has to carry every chart mark, its layout and its renderer. There is no way to import only the bar chart.

## Imports that pull in everything

`Visualization` accepts any spec and picks the renderer from `spec.type`, so it depends on all of them. Use it when the spec type really does vary at runtime, such as rendering specs an agent or a CMS produces. When you know the type, import that type's component.

```tsx
// 1,267 kB: every renderer
import { Visualization } from '@opendata-ai/openchart-react';

// 178 kB: the Sankey renderer
import { Sankey } from '@opendata-ai/openchart-react';
```

A namespace import that escapes analysis does the same thing. `import * as oc from '...'` is fine while you only read named members (`oc.createSankey`), and keeps the whole library the moment you pass `oc` somewhere, spread it, or index it with a variable.

`ChartStory` and the `@opendata-ai/openchart-vanilla/story` entry build on `Chart`, so they cost what a chart costs plus the story runtime.

## Load the heavy types on demand

If a page shows a chart or a map only after an interaction, or below the fold, load it with a dynamic import so it stays out of the initial bundle.

```tsx
import { lazy, Suspense } from 'react';

const GeoMap = lazy(() =>
  import('@opendata-ai/openchart-react').then((m) => ({ default: m.GeoMap })),
);

export function Coverage({ spec }) {
  return (
    <Suspense fallback={<div style={{ height: 420 }} />}>
      <GeoMap spec={spec} />
    </Suspense>
  );
}
```

Give the fallback the height of the finished visualization so the page doesn't shift when it arrives.

The same split works for a page that takes any spec type: switch on `spec.type` and dynamically import the matching component, and each reader downloads only the types they see.

## What is already loaded on demand

GIF export loads its encoder the first time you call it, and needs the optional `gifenc` peer only then. The 3D graph renderer lives behind its own entry, `@opendata-ai/openchart-react/graph-3d` (and the same subpath in the other packages), and brings in `three` only if you import it. Neither adds to the sizes above.

## Rendering without shipping the library

A chart that doesn't need interaction can be rendered to an SVG string at build time or on the server, and the reader downloads no OpenChart JavaScript at all. See [static rendering](static-rendering.md).

## Things that break tree shaking

The packages are ES modules with no import-time side effects, so a default bundler setup needs nothing. Three setups undo that.

Re-exporting the library from your own barrel file (`export * from '@opendata-ai/openchart-react'`) is fine in a module with no side effects, but a barrel inside a package that doesn't declare `"sideEffects": false` can keep everything. Import from OpenChart directly where you use it.

Transpiling `node_modules` to CommonJS, which some older Jest-era Babel configs do for the app build too, removes the `import`/`export` syntax bundlers analyze. Leave OpenChart as ES modules.

Development builds don't tree-shake. Measure a production build.

## Check your own bundle

Build for production and look at what landed. With Vite or Rollup, `rollup-plugin-visualizer` draws the bundle by module; with webpack or Next.js, use the bundle analyzer. An app that renders only a Sankey should show OpenChart at roughly the size in the table; if it shows over a megabyte, one of the imports above is in play.

OpenChart holds itself to these numbers in CI. `bun run check:tree-shaking` bundles each import above, fails if one grows past its budget, and fails if a non-chart bundle contains chart code.
