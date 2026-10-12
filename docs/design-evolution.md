# Design evolution delivery record

OpenChart's direction is editorial clarity, continuous interaction, and explainable authoring. Datawrapper is a quality reference; OpenChart remains a portable JSON visualization library with a standalone reference workbench. Motion belongs in application controls, not in the rendering runtime.

## Delivery and evidence

This record distinguishes implementation from release validation. No comprehension, authoring, or performance improvement is claimed without measurements. Breaking defaults remain reserved for the next major release.

| Phase | Scope retained | Status |
| --- | --- | --- |
| 0 | Eight compositions, rendering/motion baseline, browser profiles, reader and author tasks, scene/identity contracts | Baseline captures recorded; human/performance measurements pending |
| 1 | Editorial hierarchy, flat fills, authored focus, consistent formatting, responsive examples, source visibility, optional attribution | Opt-in theme and eight workbench compositions implemented; major defaults deferred |
| 2 | Retained compatible scenes, interruption, shared deterministic sampler, bounded springs, coordinated labels/axes/stacks, export parity | SVG retention, bounded springs, sampled updates and attached labels implemented; controller/velocity continuity and broader parity remain |
| 3 | Stable reader identity, preview/pin/compare, moving hit tests, semantic responsiveness, mobile tables | Chart reader, metadata comparisons, endpoint summaries and priority tables implemented; full renderer interaction parity remains |
| 4 | Reference workbench, imports/types, direct editing, undo/drafts, responsive preview, exports, Motion controls | Standalone client-side application implemented; deployment destination and SaaS services undecided |
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

The current delivery prioritizes production authoring infrastructure per the latest scope decision. See [workbench.md](workbench.md) for supported behavior and deployment boundaries. No remaining high-value roadmap item has been removed.

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
