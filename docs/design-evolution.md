# Design evolution delivery record

OpenChart's direction is editorial clarity, continuous interaction, and explainable authoring. Datawrapper is a quality reference; OpenChart remains a portable JSON visualization library consumed by the separate [OpenStudio application](https://github.com/tryopendata/openstudio). Motion belongs in application controls, not in the rendering runtime.

## Delivery and evidence

This record distinguishes implementation from release validation. No comprehension, authoring, or performance improvement is claimed without measurements. Breaking defaults are recorded separately from publication and release validation.

| Phase | Scope retained | Status |
| --- | --- | --- |
| 0 | Eight compositions, rendering/motion baseline, browser profiles, reader and author tasks, scene/identity contracts | Baseline captures recorded; human/performance measurements pending |
| 1 | Editorial hierarchy, flat fills, authored focus, consistent formatting, responsive examples, source visibility, optional attribution | Opt-in theme and eight workbench compositions implemented; major defaults deferred |
| 2 | Retained compatible scenes, interruption, shared deterministic sampler, bounded springs, coordinated labels/axes/stacks, export parity | SVG retention, bounded springs, sampled updates and attached labels implemented; controller/velocity continuity and broader parity remain |
| 3 | Stable reader identity, preview/pin/compare, moving hit tests, semantic responsiveness, mobile tables | Chart reader, metadata comparisons, endpoint summaries and priority tables implemented; full renderer interaction parity remains |
| 4 | Reference workbench, imports/types, direct editing, undo/drafts, responsive preview, exports, Motion controls | Moved to OpenStudio; client-side GitHub Pages demo, no backend services |
| 5 | Structured diagnostics, deterministic recommendations, explained reversible patches, host APIs | Additive APIs and editor UI implemented; full compiler decision provenance remains |
| 6 | Linked exploration, supplied uncertainty, narrative continuity, full mobile authoring | Roadmap |

## Reference compositions

| Composition | Existing dataset | Intended takeaway and acceptance task | Proposed treatment |
| --- | --- | --- | --- |
| Ranking | Population by country | Identify the largest two populations and their order | Flat bars, readable labels, units once |
| Multiple lines | Big Tech revenue | Identify Amazon's final value and nearest peer | Authored teal focus; named neutral peers; final year retained |
| Composition | Energy mix | Identify the dominant energy sources and change | Shared stack progression; units and source visible |
| Distribution | Income distribution | Compare spread without mistaking the sample for population microdata | Explicit illustrative provenance; shared scale |
| Before/after | Life expectancy change | Read both endpoints and absolute change | Connected endpoints, years stated, no implied causality |
| Geography | World GDP per capita | Find a country and distinguish missing data from low values | Readable legend and pinned evidence |
| Rich table | Stock performance | Find an entity and compare its priority measures on a phone | Identifying columns, secondary details, explicit illustrative provenance |
| Narrative | Existing scrollytelling | Retain the selected entity through a sequence | Stable identity, compatible motion, incompatible crossfade |

Stress cases include empty data, long labels, missing observations, negative values, crowded series, dense scatter, duplicate keys, filtering, deletion, aggregation changes, and incompatible measures.

The current delivery prioritizes production authoring infrastructure per the latest scope decision. See [OpenStudio](https://github.com/tryopendata/openstudio) for application features and deployment; this repository owns the reusable library contracts. No remaining high-value roadmap item has been removed.

## Contracts (target architecture; not all gates complete)

- Author choices and row order take precedence over defaults. Titles never determine semantic focus.
- Series and observations have separate identity. Authored unique keys persist across revisions; absent or duplicate keys cannot silently bind an old selection to a new row.
- Geometry is sampled independently of the DOM. Hit tests target visible geometry but resolve real observations. Numeric readouts show exact source/destination values, never invented observations.
- Quantitative motion is bounded. UI decorations may overshoot. Interrupted motion retargets from its sampled state. Dependent geometry shares progress.
- The same finite sampler drives live and exported frames. Springs settle at a normalized distance/velocity threshold of 0.001, with a 1,200ms maximum and exact terminal state.
- Default animation remains disabled when omitted or false. New presets are additive in v8. Existing duration/ease settings remain tween mode.
- VizSpec remains the canonical document. Draft/history/view state is application state, not a second grammar.
- Diagnostics state their origin and checkability. Patches have preconditions and never silently change aggregation, order, or scale meaning.

## Release gates

Automated: all eight compositions at 320/390/768/1280px; desktop Chromium, 390px Chromium with 4× CPU throttle, 390px WebKit; dark/light, fonts, keyboard/touch, reduced motion, resize round trips, interruption, intermediate export parity and exact terminal geometry. Record host hardware and browser versions. Keep CI tripwires separate from reference measurements.

Performance targets: 60fps reference motion; desktop p95 frame interval below 33.3ms; p95 visible input response below 50ms desktop and 100ms throttled mobile. Reduce choreography or crossfade above the workload budget.

Human validation (requires real participants, not simulated results): matched baseline comprehension tasks, at least 80% correct, no accuracy regression and 20% lower median response time; at least five representative authors, four completing import/refine/mobile check/undo/reopen/export without JSON. Record completion time and corrections. These gates remain pending until the study is conducted.

Technical architecture and product UX reviewers must independently approve the implementation after fix/review cycles before the final commit, merge, and push. This does not substitute for the human release gates.


## v9 chart clarity and annotation contract (implementation record)

The additive Track A work shipped in 8.9.1. The v9 implementation adopts the
accepted chart-clarity plan's defaults and removes its compatibility APIs. This
record describes the library changes in the v9 branch; it does not claim that an
RC or final release has been published, that Studio has adopted it, or that the
human studies above have been conducted.

| Decision | v9 contract and reason |
| --- | --- |
| Figure budget | Omitted `chromeLayout` adds only the note band; public `grow` and `subtract` retain their meanings. The engine reports total and grown heights so mounts/exports count growth once. Exact-height embeds author `subtract`. |
| Editorial typography | Small/axis/footer text becomes 12px, with 16px chrome-to-chart and 12px chart-to-footer gaps. Background, axis, and eyebrow defaults retain their prior choices. Subtitle ratio becomes 12/13 and a subtitle no longer implies a bold primary label. |
| Annotation placement | Automatic labels use priority then source order, measured wrapping, and connector-crossing costs. Curves no longer imply arrows. Reference labels default to automatic placement unless a legacy anchor is explicitly authored. |
| Compact reading | One eligible inline callout is the compact default; null removes that count limit. Pinned annotations remain inline and may overlap after narrow clamping. Existing chart-level responsive opt-outs retain their behavior. |
| Note identity | Rich primary/subtitle content wraps in the engine. Numbers follow source text-annotation order before filtering, allow gaps, and are shared across facet instances. Linked note/marker emphasis is transient reader state. |
| Surface and ink | D19 reference/range colors are retuned; marker and plate colors derive from the neutral surface. Authored annotation and theme colors remain authoritative. |
| Editing | `onEdit` receives atomic transactions; hosts use `applyEditTransaction` and its inverse. Arrows nudge, Shift accelerates, Tab cycles selection. Engine geometry remains authoritative through preview, commit, animation, and export. |
| Theme composition | Spec, provider, and host overrides deep-merge; leaves override parent themes. Authored chrome sizes beat general font propagation. Arrays/color pairs are atomic and null clears rules. Unauthored CSS tokens remain available to host styles. |
| Authoring grammar | `MarkDef` is a discriminated union with pre-sugar errors and schema/type/runtime parity. Inference has one core implementation. Retired aliases fail validation; endpoint labels replace legacy line-end labels. |
| Migration | Default `migrateSpecV8` rewrites aliases and materializes former styling. `{ styling: 'v9' }` rewrites aliases only. Neither mode promises v8 pixel layout; every repair is inspectable. |

The implementation retains the portable boundary: core owns pure contracts and
theme/inference helpers, engine owns geometry and layout, and vanilla/framework
packages own rendering and interaction. OpenStudio's v2 envelope, migration
choice, storage recovery, and version adoption remain separate application work.
The external authoring-skill synchronization and publication are separate release
steps, not implied by this implementation record.

Validation locations: `e2e/annotation-invariants/` owns the two annotation browser
projects; the existing `invariants*` projects keep their original scope. The
preview benchmark is `packages/engine/src/annotations/__tests__/preview.bench.ts`.
Theme and transaction behavior have direct integration tests. Visual baselines
must be reviewed once for the completed v9 composition before release; this
record does not substitute for that review or claim reader-comprehension gains.
See [the migration guide](migrating-v9.md) for the public before/after contract.
