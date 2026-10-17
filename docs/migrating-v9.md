# Migrating to OpenChart v9

v9 makes the annotation layout options introduced in 8.9.1 the default, consolidates theme precedence, and removes the deprecated authoring and editing APIs. Upgrade all six OpenChart packages together. This guide covers the library; OpenStudio's document envelope, migration dialog, and adoption are separate work.

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

Callouts with `responsive: false` remain inline and do not count toward the compact limit. The limit uses the **outer container width**, including facets, at the compact breakpoint of 400px. It does not override the existing behavior of chart-level `responsive: false`, `responsive.autoThin: false`, or fixed-size specs: those still hide unpinned annotations at compact widths. Heights below 200px retain tooltip-only behavior.

Automatic placement processes higher-priority annotations first, breaking ties by authored source order. Placement also penalizes connector crossings. Those choices can move labels even when you preserve v8 styling. Explicit offsets remain pinned, including `{ dx: 0, dy: 0 }`.

Omitting `chromeLayout` now grows the figure by its note band while title, subtitle, source, and other chrome retain their existing subtraction behavior. The internal name for this mode is `notes`; it is **not** an authored spec value.

- Use `chromeLayout: 'subtract'` when an embed needs an exact outer height.
- Use `chromeLayout: 'grow'` to grow by all chrome, including facets.
- Read `layout.dimensions.height` for the resulting height. Engine-added height is reported in `layout.chrome.grownHeight`; mounts already account for it once.

The note band includes annotation notes and `seriesSummary`. Its reserved source capacity stays stable during annotation drags, so it can contain unused space. Use `layout.chrome.noteBandHeight`; the old core and vanilla `footnoteBandHeight` helpers are removed.

## Notes and annotation identity

Notes include the complete primary text and subtitle, with wrapping and `**bold**` spans. Numbers are source-order ordinals of text annotations, assigned before filtering and thinning. Gaps are intentional: note 4 remains note 4 when another note is hidden. Inserting, deleting, or reordering authored annotations can renumber them. Facet instances share one source number and note.

Notes and their markers support linked focus/click/tap emphasis. This is transient reader state, not a spec edit, and is excluded from exports. Authored unique annotation IDs remain the recommended durable identity. Missing or duplicate IDs use revision-local source indices and produce diagnostics.

A label drag converts resolved placement into an explicit anchor/offset and sets `responsive: false` in one transaction. The annotation then stays inline on narrow screens; the position is clamped and can overlap other pinned annotations. Changing the data attachment remains a separate operation.

### Editing and keyboard navigation

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
10px. Tab/Shift+Tab cycle editable elements. A sequence of nudges commits 500ms
after the last arrow release, or immediately before selection, another gesture,
or cancellation. Native text-editing keys keep their usual behavior.

Removed APIs and their replacements:

| Removed | Replacement |
| --- | --- |
| `onAnnotationEdit`, `onTextEdit` | `onEdit` transaction operations |
| `onDataPointClick` | `onMarkClick` (the old callback had no effect) |
| Chart mount/wrapper `responsive` option | `autoResize` (spec `responsive` is unchanged) |
| Graph `updateVisuals()` | `update()` |
| `ElementRef` series-label variant and `elementRef.seriesLabel()` | Endpoint labels; manual endpoint-label offsets are not supported |

Other mount families retain their existing `responsive` resize option.

`applyEditTransaction` validates the whole operation list before returning a new spec. A failed transaction leaves the input unchanged. Annotation `expect` preconditions carry identity/type/text checks, so a stale edit cannot silently target a reordered ID-less annotation. The helper does not compare `revision`; hosts may use it for their own bookkeeping.

## Theme composition

Authored theme layers now deep-merge: spec theme, provider theme, then component prop or mount/compile option. In a layer, the leaf theme overrides its parent before host overrides apply. This preserves unrelated nested fields that a shallow merge previously discarded.

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

These retired authoring forms are now validation errors. `migrateSpecV8` handles their spec rewrites in either styling mode.

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
| `labels.offsets` and legacy line-end series labels | `endpointLabels` |
| `TOP_PAD_NARROW_MAX`, `LABEL_GAP_NARROW_MAX` imports | `NARROW_VIEWPORT_MAX` |

The spec-level chrome text shorthand **stays**: `chrome: { title: 'A title' }` is valid. Tilemap `valueFormat` also stays, including for record data with no encoding channel. `colors: string[]`, ordinary Vega-Lite sugar, and chart-type value-label configuration remain supported.

Host table styles targeting `.oc-table--compact` must target `.oc-table--condensed` instead. `TableLayout.compact` is removed; read `density`.

For multi-series lines, the traditional legend and endpoint column are now the two series identifiers. If both are explicitly off, the compiler emits an accessibility warning. The old fallback of setting `legend: false`, `endpointLabels: false`, and relying on line-end labels no longer renders those labels. Migration replaces that fallback with:

```ts
endpointLabels: { content: 'label', showMarker: false }
```

Series ending before the last x value move to the right-edge column. Manual legacy label offsets are dropped; endpoint-label dragging is not part of v9.

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

Builders and compilation share one field-inference function. It examines up to 50 rows, ignores nulls, and requires more than 80% agreement. Numeric strings are considered numeric before date parsing, so an untyped column containing `'2020'` is quantitative. Set `encoding.<channel>.type` explicitly when numeric-looking years should be ordinal or temporal. This avoids relying on inference for mixed columns.

## Validate the upgrade

Review exact-height embeds, narrow charts, custom fonts/themes, layers/facets, and exported SVG/PNG. Exercise one edit, undo, cancelled drag, and keyboard nudge with the new transaction handler. Test application persistence against stale annotation identity. Library migration does not upgrade OpenStudio storage or publish packages; those release steps have their own validation.
