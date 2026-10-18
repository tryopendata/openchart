# Migrating to OpenChart v9

v9 makes the annotation layout options introduced in 8.9.1 the default, consolidates theme precedence, and removes the deprecated authoring and editing APIs. Upgrade all six OpenChart packages together. This guide covers the library; OpenStudio's document envelope, migration dialog, and adoption are separate work.

## How to use this guide

If you are upgrading from v7 or earlier, work through [the v8 migration guide](migrating-v8.md) first. This guide starts from v8.9.1. Unlike v8's deprecation period, v9 rejects the retired spec forms listed below; it does not silently rewrite them during compilation.

1. Upgrade the OpenChart packages your app uses to the same 9.x version. Update your lockfile and run TypeScript before changing stored documents.
2. Run `migrateSpecV8` on a copy of each older spec and review its repairs. Choose whether to preserve v8 styling or adopt the new defaults.
3. Update callbacks, imports, wrapper props, and host CSS using the sections below. The spec migration cannot change application code.
4. Review narrow and exact-height embeds, edit/undo flows, and exports before saving migrated documents.

A useful first search in your application source is:

```sh
rg 'onEditTransaction|onAnnotationEdit|onTextEdit|ElementEdit|onDataPointClick|updateVisuals|footnoteBandHeight|TOP_PAD_NARROW_MAX|LABEL_GAP_NARROW_MAX|oc-table--compact'
```

Also inspect `responsive` in mount options or component props (every mount family, see [Interaction mode, chart specs, and resize options](#interaction-mode-chart-specs-and-resize-options)), `compact` in tables, `valueFormat` in specialized specs, `Theme` imports, and `labels.offsets`. Those names have valid uses elsewhere, so do not replace them globally.

## Choose how older documents should look

Run the public engine migration on the original authored document, before compiling it:

```ts
import { migrateSpecV8 } from '@opendata-ai/openchart-engine';

// Default: rewrite retired fields and materialize former v8 styling defaults.
const preserved = migrateSpecV8(legacyDocument);

// Rewrite retired fields, leaving omitted defaults to v9.
const adopted = migrateSpecV8(legacyDocument, { styling: 'v9' });

// Present these changes to the author or record them with the document.
console.table(preserved.repairs);
const spec = preserved.spec;
```

The helper is pure and idempotent. Repairs report `path`, `from`, `to`, and `reason`. Explicit authored values, including `false` and `null` opt-outs, remain authoritative. Keep the original document until you have reviewed and saved the result. The helper migrates spec data; it cannot rewrite JavaScript callbacks, TypeScript imports, or host CSS.

The default styling mode writes former annotation weights, subtitle sizes, curve arrows, unlimited wrapping/compact limits, legacy reference anchors, `chromeLayout: 'subtract'`, and v8 theme typography, spacing, and annotation colors. `legacyEditorial` remains available for v8 typography alone; it is not a full document migration.

**Keeping v8 styling does not promise pixel-identical v8 layout.** Placement scoring, note numbering, theme composition, rich-text notes, and other v9 layout rules still apply. Review migrated charts at their actual embed sizes. In particular, the legacy series-label rewrite moves labels into the endpoint column and drops manual per-series offsets; each dropped offset appears in `repairs`.

## Changed annotation and figure defaults

**Who is affected:** Charts relying on omitted styling, wrapping, placement, or height options. These are deliberate default changes and do not produce deprecation warnings. Use explicit settings from the table below or the default migration mode to retain the former authored styling.

| Setting | v8 default | v9 default / explicit override |
| --- | --- | --- |
| Small and axis tick text | 11px | 12px; set `theme.fonts.sizes.small` / `axisTick` explicitly |
| Source, byline, footer | 11px | 12px; set `theme.chrome.<element>.fontSize` |
| Chrome-to-chart / chart-to-footer gap | 8px / 8px | 16px / 12px; set the corresponding `theme.spacing` fields |
| Subtitled callout primary weight | 700 | 400; set `fontWeight: 700` for a bold lede |
| Subtitle size | `round(fontSize * 0.85)` | `round(fontSize * 12 / 13)`; set `subtitleFontSize` to override |
| Curve connector arrow | Implied | Off; use `connector: { type: 'curve', arrow: true }` |
| Labeled reference line | Legacy anchor placement | Automatic placement if neither `labelPlacement` nor `labelAnchor` is authored |
| Callout wrapping | Unlimited | Up to `min(240, plotWidth - 2 * padding)` pixels, with a positive minimum; `maxWidth: null` disables wrapping limits |
| Compact inline callout limit | Unlimited | One eligible text callout; `responsive.compactAnnotationLimit: null` removes this count limit |
| Reference/range label size | 11px | Theme `small`; explicit annotation `fontSize` wins |
| Reference rule ink | `#666666` in both modes | `#888888` light / `#9ca3af` dark |
| Range fill | `#000000` | `#f0c040`; opacity behavior is unchanged |
| Marker/label-plate fill | Fixed white / near-black | Resolved neutral surface, unless explicitly authored |

Callouts with `responsive: false` remain inline and do not count toward the compact limit. Annotations written in `overrides.compact.annotations` are exempt from the default limit; an explicit `responsive.compactAnnotationLimit` still applies to them. The limit uses the **outer container width**, including facets, at the compact breakpoint of 400px. It does not override the existing behavior of chart-level `responsive: false`, `responsive.autoThin: false`, or fixed-size specs: those still hide unpinned annotations at compact widths. Heights below 200px retain tooltip-only behavior.

Automatic placement processes higher-priority annotations first, breaking ties by authored source order. Placement also penalizes connector crossings. Those choices can move labels even when you preserve v8 styling. Explicit offsets remain pinned, including `{ dx: 0, dy: 0 }`.

- A text connector stops a few pixels short of its target's own value label instead of striking through it, including on callouts with explicit offsets (the label stays put). Automatic and anchor-nudged placement also prefer spots whose connector clears other value labels. The endpoint dot still sits on the data point, and a connector with too little length left before the value label is dropped.
- Default numeric tick labels use the least precision that tells the ticks apart and drop trailing zeros: `3.5 / 4 / 4.5` instead of `3.50 / 4 / 4.50`. An authored `axis.format` or field `format` is unchanged.
- A default temporal x-axis at compact widths always shows at least two ticks; it no longer collapses to a single date such as `2024`. When the compact tick cap drops the tick that names the year, the kept ticks use full labels (`Jul 2023`, `Apr 2024`) if they fit. Authored `axis.tickCount` and `axis.values` are unchanged.
- A right-lane outside reference label ends at the chrome padding, aligned with the title, source, and brand, instead of a fixed 16px from the edge. The plot narrows by the difference (1-4px at common sizes).
- Facet panels cap their top reference lane like single charts: each lane takes at most 25% of its grid row and leaves the panel its 100px minimum, admitting whole rows in source order. Labels that do not fit fall back inside the panel with the usual lane warning. A short grid still grows to its minimum height, measured with the rows that fit at that height.

Omitting `chromeLayout` now grows the figure by its note band while title, subtitle, source, and other chrome retain their existing subtraction behavior. The internal name for this mode is `notes`; it is **not** an authored spec value.

- Use `chromeLayout: 'subtract'` when an embed needs an exact outer height.
- Use `chromeLayout: 'grow'` to grow by all chrome, including facets.
- Read `layout.dimensions.height` for the resulting height. Engine-added height is reported in `layout.chrome.grownHeight`; mounts already account for it once.

The note band includes annotation notes and `seriesSummary`. Its reserved source capacity stays stable during annotation drags, so it can contain unused space. Use `layout.chrome.noteBandHeight`; the old core and vanilla `footnoteBandHeight` helpers are removed.

### Outside reference label lanes

**Who is affected:** Charts with `labelPlacement: 'outside'` on vertical reference lines (`x` rules), and charts whose y ticks were planned without a reserved band.

- **Rows pack.** Labels whose horizontal extents don't overlap share a row in the lane above the plot. Packing is greedy in source order, so the result is deterministic. In 8.9.1, each label had its own row, and facet panels still work that way.
- **The lane is capped.** It takes at most 25% of the requested height, which is the same basis as the 40% chrome cap. A row that doesn't fit is not admitted. Each of its labels falls back to automatic placement inside the plot on its own, and one "exceed their available lane" warning covers the whole compile. A row is reserved whole when admitted, so growing the figure past a row's threshold can shrink the plot by that row's height. The share cap bounds that step; in 8.9.1 an uncapped lane could take a 220px cliff.
- **The right lane fits its labels.** Horizontal outside labels reserve the width of the widest wrapped label (still capped at 160px or 25% of the width) instead of always reserving the cap, so the plot gets the slack back.
- **The lane yields before chrome.** When the plot would drop below its minimum, the lane shrinks first. Title and subtitle step down only if the plot still doesn't fit. In 8.9.1 the subtitle could be dropped to keep a label lane.
- **Tick counts can change.** The layout plan now sizes y ticks against the same margin stack as the final layout: the reference lane, metric bar, series-search band, and (with `chromeLayout: 'subtract'`) the note band. Charts with those bands can get a different number of y ticks than in v8, which planned for a taller plot than it drew and could pack ticks 16px apart. When d3's round steps would leave fewer than three default ticks, v9 asks for a denser set as long as ticks stay at least 20px apart.

### Endpoint markers and curved connectors

**Who is affected:** Line charts with `endpointLabels.showMarker`, and annotations with `connector: 'curve'`.

- Endpoint markers now sit centered on the line's last (or first) point, the same x as hover dots, the crosshair and annotation anchors. In 8.9.1 they were offset by their radius. The default marker fill is the opaque canvas color instead of the theme background, so the ring covers the line end; set `endpointLabels.markerStyle.fill` to keep a transparent ring.
- A text annotation whose default dot lands on an endpoint marker takes the marker's colors, so the point draws one ring.
- Curved connectors are shaped to the data point and shortened along their end tangent, so the tail aims at the marker.

### Table surface

Tables paint `theme.colors.background` (transparent by default) like charts do, instead of the mode's opaque `--oc-bg`, so a table sits on the host surface. The header, totals row, search input and pager buttons are transparent too; the opt-in sticky first column keeps `--oc-bg` so scrolled cells don't show through. Inline bar fills render at 40% opacity in dark mode (18% in light). Set a `theme.colors.background` to get an opaque table back.

## Notes and annotation identity

Notes include the complete primary text and subtitle, with wrapping and `**bold**` spans. Numbers are source-order ordinals of text annotations, assigned before filtering and thinning. Gaps are intentional: note 4 remains note 4 when another note is hidden. Inserting, deleting, or reordering authored annotations can renumber them. Facet instances share one source number and note.

Notes and their markers support linked focus/click/tap emphasis. This is transient reader state, not a spec edit, and is excluded from exports. Authored unique annotation IDs remain the recommended durable identity. Missing or duplicate IDs use revision-local source indices and produce diagnostics.

A label drag converts resolved placement into an explicit anchor/offset and sets `responsive: false` in one transaction. The annotation then stays inline on narrow screens; the position is clamped and can overlap other pinned annotations. Changing the data attachment remains a separate operation.

### Editing and keyboard navigation

**Search for:** `onEditTransaction`, `onAnnotationEdit`, `onTextEdit`, `ElementEdit`, and any `onEdit` handler that expects a single legacy element edit. Change the handler to consume the complete transaction, rather than reading the former payload fields.

`onEdit` now receives an `EditTransaction`. The old `ElementEdit` union and the
additive `onEditTransaction` callback are removed. Apply the complete transaction
atomically; its inverse supports one undo entry per gesture.

```ts
// v8 additive API
createChart(container, spec, { onEditTransaction: persist });

// v9
import { applyEditTransaction } from '@opendata-ai/openchart-core';

const chart = createChart(container, spec, {
  onEdit(transaction) {
    const result = applyEditTransaction(spec, transaction);
    if (!result.ok) return; // Stale or invalid target: keep the current document.
    spec = result.spec;
    undoStack.push(result.inverse);
    chart.update(spec);
  },
});
```

React uses `onEdit`, Vue uses `@edit` (or `onEdit`), and Svelte uses `onedit`.
`revision` still cancels an active gesture when the document revision changes.
Selection and transient visibility remain separate: use `onSelect`, `onDeselect`,
and `onLegendToggle`; legend toggles do not emit durable transactions.

In edit mode, arrow keys nudge the selected text annotation 1px; Shift+arrow nudges
10px. Tab/Shift+Tab cycle editable elements; past the last (or first) element
the selection clears and focus leaves the chart normally. A sequence of nudges
commits 500ms after the last arrow release, or immediately before selection,
another gesture, cancellation, or focus leaving the chart. Native text-editing
keys keep their usual behavior.

Edit mode (`interaction: 'edit'`, or an `onEdit` handler) replaces reader keyboard
navigation, because arrow keys nudge instead of moving between data points.
Select mode (`onSelect`/`onDeselect` alone) keeps reader navigation. See
[Interaction mode](#interaction-mode-chart-specs-and-resize-options).

Removed APIs and their replacements:

| Removed | Replacement |
| --- | --- |
| `onAnnotationEdit`, `onTextEdit` | `onEdit` transaction operations |
| `onDataPointClick` | `onMarkClick` (the old callback had no effect) |
| Chart mount/wrapper `responsive` option | `autoResize` (spec `responsive` is unchanged) |
| Graph `updateVisuals()` | `update()` |
| `ElementRef` series-label variant and `elementRef.seriesLabel()` | Endpoint labels; manual endpoint-label offsets are not supported |

For Chart mounts, move only the resize option:

```ts
// v8: mount option
createChart(container, spec, { responsive: false });
// v9: mount option; spec.responsive keeps its annotation behavior
createChart(container, spec, { autoResize: false });
```

Other mount families rename the same option; see
[Resize option on every mount](#resize-option-on-every-mount).

`applyEditTransaction` validates the whole operation list before returning a new spec. A failed transaction leaves the input unchanged. Annotation `expect` preconditions carry identity/type/text checks, so a stale edit cannot silently target a reordered ID-less annotation. The helper does not compare `revision`; hosts may use it for their own bookkeeping.

## Interaction mode, chart specs, and resize options

**Who is affected:** Hosts that pass `editable`, read `isEditing`, rely on selection callbacks to enable text editing, pass a graph spec to `<Chart>`/`createChart`, or pass `responsive` to a table, graph, sankey, tilemap, map, or barlist mount.

**Search for:**

```sh
rg '\beditable[:=]|\beditable=\{|\.isEditing\b|responsive:\s*(true|false)|responsive=\{'
rg '<Chart[^>]*spec=\{[^}]*[Gg]raph|createChart\([^)]*[Gg]raph'
```

### Interaction mode

The `editable` mount option and wrapper prop are removed. Use `interaction`, one of `'read'`, `'select'`, or `'edit'`:

| Mode | Selection | Edit gestures (drag, nudge, delete, text) | Arrow keys |
| --- | --- | --- | --- |
| `'read'` | None, including `select()` and `selectedElement` | None | Reader data navigation |
| `'select'` | Click and Tab; `onSelect`/`onDeselect` fire | None | Reader data navigation |
| `'edit'` | Click and Tab | All, emitted through `onEdit` | Nudge the selection |

When `interaction` is omitted it is inferred once per mount: `onEdit` gives `'edit'`, otherwise `onSelect`/`onDeselect` give `'select'`, otherwise `'read'`. Wrappers recreate the chart when `interaction` or the presence of those listeners changes, including Vue's `@select`/`@deselect` (previously read only at setup). `interaction: 'edit'` without `onEdit` warns once, because gestures have nowhere to send transactions. `youDrawIt`, chart stories, and `seriesSearch` suppression all use the resolved mode, so `interaction: 'read'` keeps a youDrawIt chart drawable even when an `onSelect` handler is passed.

**Behavior change:** in v8, selection callbacks alone enabled double-click and Enter text editing. In v9 that is select mode, which never edits; pass `interaction: 'edit'` (with `onEdit`) to keep text editing.

```ts
// v8
createChart(container, spec, { editable: false, onEdit, onSelect });
<Chart spec={spec} editable onEdit={persist} />
if (chart.isEditing) return;

// v9
createChart(container, spec, { interaction: 'read', onEdit, onSelect });
<Chart spec={spec} interaction="edit" onEdit={persist} />
if (chart.isTextEditing) return;
```

`editable: false` maps to `interaction: 'read'`; `editable: true` maps to `interaction: 'edit'`. Vue uses `:interaction="'edit'"`, Svelte uses `interaction="edit"`. `ChartInstance.isEditing` is renamed `isTextEditing`; it still means the inline text editor is open. `InteractionMode` and `resolveInteractionMode` are exported from the vanilla package (the type is also re-exported by each wrapper).

### Chart specs only

`<Chart>` (React, Vue, Svelte), `useChart`, `createChart`, `ChartInstance.update()`, `beginManualUpdate()`, and chart stories accept `ChartSpec | LayerSpec`. A graph spec passed there already threw at compile time; now TypeScript rejects it. Render graphs with `<Graph>`/`createGraph`, or `<Visualization>` when the spec type varies.

```tsx
// v8 (type-checked, failed at runtime)
<Chart spec={graphSpec} />
// v9
<Graph spec={graphSpec} />
```

### Resize option on every mount

Every mount family now names the resize option `autoResize`, matching Chart. Spec-level `responsive` (annotation and chart responsiveness) is unchanged.

```ts
// v8
createTable(container, spec, { responsive: false });
createGraph(container, spec, { responsive: false });
// v9
createTable(container, spec, { autoResize: false });
createGraph(container, spec, { autoResize: false });
```

This covers `createTable`, `createGraph`, `createSankey`, `createTileMap`, `createGeoMap`, `createBarList`, and the Svelte `useGraph` composable option. The wrappers already observe resizes, so component props are unaffected.

### Element references carry `path`

Every `ElementRef` emitted to `onSelect`, `onDeselect`, and `onAnnotationClick`, and returned by `getSelectedElement()`, now has `path`, including refs from Tab cycling, legend entries, and programmatic `select()` calls that omitted it. Chrome refs use `/chrome/<key>`; legend and legend-entry refs use `/legend`. Hosts that treated a missing `path` as "no authored object" should read `type` instead.

## Theme composition

**Search for:** `Theme` imports, `editorial` / `clarity` preset use, shallow theme spreads, and custom `--oc-*` CSS. Recheck nested overrides: previously discarded leaves now survive theme composition.

Authored theme layers now deep-merge: spec theme, provider theme, then component prop or mount/compile option. A layer resolves two scopes. The root (chrome, axes, legend) uses the layer theme when it has one and the first leaf's theme otherwise, as a whole object, like the layer's other root properties. Each leaf's marks use the leaf theme deep-merged over the layer theme. Host overrides apply on top of both. With independent y-scales, each side's marks and its own axis also use its merged leaf theme. Shared-axis layers match v8, so migration leaves them unchanged. A v8 dual-axis chart ignored leaf themes when the layer set a theme, so migration removes those leaf themes. This preserves unrelated nested fields that a shallow merge previously discarded.

Arrays and `{ light, dark }` color pairs replace atomically. `colors: string[]` remains shorthand for `colors.categorical`. An authored `chrome.<element>.fontSize` wins over propagation from the general `fonts.sizes` scale, even when those values originate in different layers. Presets no longer duplicate general title sizes in chrome defaults.

```ts
import { broadsheet, mergeThemeConfig } from '@opendata-ai/openchart-core';

// Preserve the preset, changing only the rule length.
const wideRule = mergeThemeConfig(broadsheet, { rule: { width: 80 } });
// Explicitly remove its rule.
const noRule = mergeThemeConfig(broadsheet, { rule: null });
```

`rule` accepts a partial object or `null`. Without a preset rule, omitted width/thickness resolve to 40px/3px and color uses theme text ink. The mount/compile `watermark` option overrides spec and breakpoint values. The graph mount `legend` option also takes precedence over the spec.

Use `ThemeConfig` for authored input and `ResolvedTheme` for compiled output; `Theme` is removed. The empty `editorial` preset is removed: omit `theme` or pass `{}`. `clarity` is deprecated for removal in v10 and now contains only its remaining background, axis, and eyebrow colors. The default background is still transparent; the default axis/eyebrow colors have not adopted clarity's colors.

Only authored theme tokens and their derived values are stamped inline. Omitted tokens stay available to host CSS, including `--oc-border-radius`. Removing an authored override restores the host value. Dark-mode defaults come from generated CSS; authored light/dark pairs still win. SVG/raster export preserves the live CSS token values before leaving the page. See [the token guide](theming-tokens.md).

## Retired spec forms and helpers

Retired spec forms are now validation errors, and removed imports stop compiling. `migrateSpecV8` handles spec rewrites in either styling mode; update imports and application options yourself.

| Removed form | Replacement |
| --- | --- |
| Table `compact: true` | `density: 'condensed'`; `false` becomes `'regular'` |
| `valueFormat` on Sankey/barlist | `encoding.value.format` |
| `valueFormat` on maps | `encoding.color.format` |
| Annotation `type: 'rule'` | `type: 'refline'` |
| Arc/waffle/parliament authoring through `encoding.y` | `encoding.theta` |
| `theme.chrome.title: '#333'` and other theme chrome strings | `theme.chrome.title: { color: '#333' }` |
| Spec `darkMode` | Mount/component `darkMode` option |
| `mark.render` | Mount/component `renderer` option |
| `encoding.radius`, `shape`, `href`, `order` | Remove them; these channels had no renderer |
| `animation: 'legacy'` / `animation.preset: 'legacy'` | Use `true` / omit `preset`; omitting animation itself still disables it |
| `labels.offsets` and legacy line-end series labels (`labels.density` no longer draws anything on line or area marks) | `endpointLabels` |
| `TOP_PAD_NARROW_MAX`, `LABEL_GAP_NARROW_MAX` imports | `NARROW_VIEWPORT_MAX` |

For example, the migration moves specialized formatting and renames annotation aliases:

```js
// v8 spec fragments
{ type: 'barlist', valueFormat: '$,.0f', encoding: { value: { field: 'amount' } } }
{ annotations: [{ type: 'rule', y: 0, label: 'Baseline' }] }

// v9
{ type: 'barlist', encoding: { value: { field: 'amount', format: '$,.0f' } } }
{ annotations: [{ type: 'refline', y: 0, label: 'Baseline' }] }
```

Move spec `darkMode` to the mount/component yourself: the migration removes the retired spec key and reports the repair, but cannot configure its host. Likewise, move `mark.render` to the host's `renderer` option if you still need that renderer selection.

The spec-level chrome text shorthand **stays**: `chrome: { title: 'A title' }` is valid. Tilemap `valueFormat` also stays, including for record data with no encoding channel. `colors: string[]`, ordinary Vega-Lite sugar, and chart-type value-label configuration remain supported.

Host table styles targeting `.oc-table--compact` must target `.oc-table--condensed` instead. `TableLayout.compact` is removed; read `density`.

For multi-series lines, the traditional legend and endpoint column are now the two series identifiers. If both are explicitly off, the compiler emits an accessibility warning. The old fallback of setting `legend: false`, `endpointLabels: false`, and relying on line-end labels no longer renders those labels. Migration replaces that fallback with:

```ts
endpointLabels: { content: 'label', showMarker: false }
```

Series ending before the last x value move to the right-edge column. Manual legacy label offsets are dropped; endpoint-label dragging is not part of v9.

Lines whose series come from `strokeDash` alone (no color encoding) now get the same identification as color series: the endpoint column by default, and otherwise a legend with dashed line swatches, as Vega-Lite builds for `strokeDash`. Both swatches show each series' dash pattern. v8 drew line-end labels on these charts whatever the legend and endpoint settings, so migration writes the endpoint rewrite above for any of them that had labels (`labels.density` not `'none'`). As with color series, that explicit config keeps the column at the compact breakpoint, where v8 drew no labels. `detail` groups without identifying, as in Vega-Lite: it gets no legend, endpoint column, or warning.

## Mark-specific options and field inference

`MarkDef` is now a discriminated union. Options must belong to the authored mark: density `bandwidth`, for example, is not a bar option. Validation checks authored paths before sugar expands histogram/density, and agrees with the published JSON Schema and TypeScript union. Correct the mark or remove the inapplicable option; the migration helper does not guess the intended mark.

A union cannot be extended with an interface. Replace:

```ts
// v8
interface AppMark extends MarkDef {
  editorLabel?: string;
}
```

with:

```ts
// v9
import type { MarkDef } from '@opendata-ai/openchart-core';
type AppMark = MarkDef & { editorLabel?: string };
```

Builders and compilation share one field-inference function. It examines up to 50 rows, ignores nulls, and requires more than 80% agreement. Numeric strings are considered numeric before date parsing, so an untyped column containing `'2020'` is quantitative. Other strings count as dates only when they are date-shaped (ISO dates and date-times such as `'2020-01'` or `'2020-01-01T12:00Z'`, month-name dates such as `'Jan 2020'`, and slash dates) and parse, so labels like `'Product 1'` stay nominal. Set `encoding.<channel>.type` explicitly when numeric-looking years should be ordinal or temporal. This avoids relying on inference for mixed columns.

A temporal channel whose values are all date-only ISO strings (`'2020'`, `'2020-04'`, `'2020-04-01'`) now gets a UTC time scale. JavaScript parses those strings as UTC midnight, and v8 ticked them in the host's local time, so the first or last date's tick went missing and labels changed with the machine's timezone. The compiled `xInvert.scaleType` / `yInvert.scaleType` for such data reads `'utc'` instead of `'time'`. Data with a time of day, or `Date` objects, keeps the local-time scale; set `scale: { type: 'time' }` to keep local time for date-only strings.

## Validation paths, diagnostic fixes, and annotation labels

**Search for:** `.path` on `validateSpec` errors (string comparisons such as `'encoding.x.field'`, `startsWith('encoding.')`, or code that splits on `.`/`[`), `ValidationResult.warnings`, `markOptionWarnings`, `applySpecPatch`, `SpecPatch`, `.fix.changes`, and `label` on `type: 'text'` annotations.

Every `ValidationError.path` is now a root-relative RFC 6901 JSON Pointer, the same form used by edit transactions, migration repairs, and diagnostics. Keys are escaped (`~` as `~0`, `/` as `~1`) and the root is `''`. Errors inside a layer carry the layer prefix; an error in a value the leaf inherits (shared `data`, or an encoding channel it does not override) points at the parent layer that authored it. `path` is always present. Messages remain prose.

```ts
// v8
errors.find((e) => e.path === 'encoding.y.field');
errors.find((e) => e.path === `data[${i}].${field}`);

// v9
import { jsonPointer } from '@opendata-ai/openchart-core';
errors.find((e) => e.path === '/encoding/y/field');
errors.find((e) => e.path === jsonPointer('data', i, field));
errors.find((e) => e.path === '/layer/1/encoding/y/field'); // formerly 'encoding.y.field'
```

The `Invalid spec:` error thrown by compilation prefixes each line with its pointer (`/encoding/y/field: Spec error: ...`) unless the message already names it. `ValidationResult.warnings` was never populated and is removed, as is the internal `compile(spec, { markOptionWarnings })` option.

Diagnostic fixes are edit operations. `SpecPatch.changes` is `EditOp[]`, and `applySpecPatch` applies it with `applyEditTransaction` and returns the inverse:

```ts
// v8
// fix.changes: [{ path: '/theme/fonts/sizes/axisTick', value: 12 }]
spec = applySpecPatch(spec, diagnostic.fix);

// v9
// fix.changes: [{ op: 'set', path: '/theme/fonts/sizes/axisTick', value: 12 }]
const { spec: next, inverse } = applySpecPatch(spec, diagnostic.fix);
undoStack.push(inverse); // applySpecPatch(next, inverse) restores spec
spec = next;
```

A fix that must create a missing object uses `add`; `set` requires the parent to exist. Stale or invalid patches still throw. The inverse is guarded by the patched document, so it is rejected after later edits.

`label` belongs only to `range` and `refline` annotations. On a `text` annotation it had no effect and is now a validation error at `/annotations/<i>/label`. `migrateSpecV8` removes it and reports the repair. Put the callout copy in `text`, and supporting copy in `subtitle`.

```js
// v8
{ type: 'text', x: '2020', y: 12, text: 'Peak', label: 'Peak' }
// v9
{ type: 'text', x: '2020', y: 12, text: 'Peak' }
```

`LayerSpec.responsive` now accepts the same `boolean | ResponsiveConfig` as `ChartSpec.responsive`, matching what validation and migration already wrote.

## Internal compile options

**Search for:** `footnoteReserve`, `footnotePass`, `facetHeightGrown`, `frozenChartArea`, `rightAxisReserve`, and `layered` in options passed to `compileChart`, `compileLayer`, or a mount.

These fields were on the public `CompileOptions` type in v8 but documented as internal: the engine set them when it re-entered its own compile for note bands, facet growth, and dual-axis layers. v9 sizes a chart in one pass, so the re-entry fields are gone and the layer fields moved to an engine-internal type. Remove them from any options object you build. `chromeLayout: 'subtract' | 'grow'` is unchanged.

A custom `measureText` whose note wrapping needs more lines than the reserved note band no longer triggers a second compile. In grow mode, and in the default layout, the figure grows by the extra height. With `chromeLayout: 'subtract'` the figure keeps its size and `onDiagnostic` receives a `layout.note-capacity` diagnostic. Monotone measures, including the built-in heuristic, never hit this case.

## Validate the upgrade

Review exact-height embeds, narrow charts, custom fonts/themes, layers/facets, and exported SVG/PNG. Exercise one edit, undo, cancelled drag, and keyboard nudge with the new transaction handler. Test application persistence against stale annotation identity. Library migration does not upgrade OpenStudio storage or publish packages; those release steps have their own validation.
