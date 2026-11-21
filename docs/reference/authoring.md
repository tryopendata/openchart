---
title: "Authoring and reader APIs"
description: "Library interfaces for authoring and reader apps: numeric observations, interaction contracts and callout limits."
section: spec
order: 17
---
<!-- phase-4-stub -->

# Authoring and reader APIs

## Authoring foundation additions

These library interfaces support authoring and reader applications. OpenStudio adoption is separate; see [Migrating to v9](../migrating-v9.md) for the changed defaults and removed APIs.

- **Theme:** v9 defaults include 12px axes/small text and larger chrome gaps. `clarity` is deprecated and retains only background, axis, and eyebrow colors. `legacyEditorial` restores v8 typography; `migrateSpecV8` can materialize the wider v8 styling contract without freezing layout behavior.
- **Motion:** `animation: 'fluid' | 'subtle' (omit the preset for v8 timing)`; explicit phases override their preset. A phase can use `spring: { stiffness: 320, damping: 36, mass: 1 }` or the existing duration/easing configuration. Combining a spring with duration/easing in the same phase is an error. Quantitative springs are bounded, with a finite terminal state. Omitted animation is on by default; `false` disables it.
- **Responsiveness:** `responsive: { preserveEnd: true, labelSummary: true }` retains the final x-axis boundary and moves overflowing endpoint identities to a wrapped list. Explicit axis values and author choices remain authoritative. `chromeLayout: 'grow'` gives that content space. Tables may opt into `mobileLayout: 'priority'`; `cards` remains the default, with `scroll` also available.
- **Field metadata:** chart, table and map documents accept `fields`, keyed by field name. Each entry may declare `type` (`text`, `number`, `date`), `role: 'identity'`, `label`, `unit`, `measure`, `provenance`, `representation` (`number`, `percent`, `proportion`), `interval: { lower: 'lowerField', upper: 'upperField' }`, or `statusField`. Supplied intervals are never synthesized. Percent means 0–100 and proportion means 0–1.
- **Reader identity:** a unique authored `encoding.key` supports observation persistence. Missing/duplicate keys clear observation pins on data replacement. Aggregated observations are groups, not raw rows, and the reference reader clears them on data/grouping revision. The `createReader` controller is independent from editor selection and uses `ChartInstance.sampleLayout()` for supported moving geometry. Call `reader.update(spec)` after `chart.update(spec)`; it reconciles visibility against the compiled destination marks even when the source data array is unchanged. An explicit `visibleKeys` override remains supported. Layered charts retain per-layer hover/crosshair inspection, but reader pinning across layers is not yet supported: a `LayerSpec` clears pins with an announcement rather than guessing cross-layer identity.
- **Design review:** `diagnoseChart(spec, layout)` returns structured checks with code, severity, checkability, path, viewport, explanation and origin. `CompileOptions.onDiagnostic` receives these checks. `recommendCompositions(data, question, roles)` requires explicit field roles and returns explained alternatives. A diagnostic `fix` is a `SpecPatch` whose `changes` are `EditOp`s. `applySpecPatch(spec, patch)` rejects stale snapshot preconditions, applies the operations atomically through `applyEditTransaction`, and returns `{ spec, inverse }`; apply `inverse` to the patched document to undo. Hosts should preview patches before applying them. The reference editor uses the full authored document for patches even while previewing a filtered scene.

Host-neutral identity, comparison and explicit dataset-binding helpers are also exported from the engine. They provide foundations for future linked views, without implicitly declaring compatible measures or raw-row/aggregate relationships. See the [delivery record](../design-evolution.md) for the advanced capabilities and release gates still pending.

### Numeric observations and interaction contracts

Measured channels accept finite numbers and nonblank numeric strings, including zero. Null, blank text, booleans, `NaN` and infinities are absent measurements, not zeroes. This applies to chart quantities, map coordinates/colors, size/domain extraction, aggregates, bins, density and window differences/percentage changes. Supplied missing line/area observations remain gaps during rendering, updates and exports. Sankey requires positive finite flow values; omitted flows produce a warning and an all-invalid dataset produces an empty finite layout. Cumulative sums skip absent/non-numeric contributions; window and density groups distinguish numeric and string keys. Layer domains and continuous legends use the same finite-measurement policy. Text-size fallback and absent-series stack conventions are unchanged.

Maps, tile maps, bar lists and Sankey support arrows for inspection and Enter/Space for their existing click callbacks, including when `tooltip: false`. Escape dismisses inspection; Tab exits naturally. A keyboard-focused map mark uses arrows for mark navigation; the map root retains its separate zoom/pan shortcuts. Tables restore keyed cell/header focus across updates and keep native mobile detail disclosures operable.

Table `rowKey` values must be unique to support identity across revisions. Numeric `1` and string `"1"` are distinct. Missing/duplicate keys emit `TABLE_ROW_KEY_AMBIGUOUS` and use revision-local identities. Treat compiled row IDs as opaque. CSV export includes all filtered and sorted rows, not just the current pagination page.


### Compact callout limits and note sizing

`responsive.compactAnnotationLimit?: number | null` is an optional nonnegative
integer limit below 400px outer width. Omitted means one; null means unlimited,
and zero demotes all eligible callouts. `responsive: false` callouts are exempt. Priority/source
order precedes coverage/collision thinning. Existing disabled-response and
short-height rules still apply. Facet panel width does not trigger this limit.

Read `layout.chrome.noteBandHeight` for note space and `layout.dimensions.height`
for the final rendered/exported height. `chromeLayout: 'grow'` also supports facets;
`chrome.grownHeight` reports engine-added height for auto-height consumers.
See [annotation migration guidance](../migrating-v9.md#changed-annotation-and-figure-defaults).
