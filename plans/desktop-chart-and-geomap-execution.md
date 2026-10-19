# Desktop chart and GeoMap RFC execution

Status: P1/P2/B3 and P3 verified (2026-10-19). P4, P5 and C7 are authorized and in progress; main merge and release remain on hold.
Authorized: implement the reviewed RFC and commit the work to `codex/openchart-v9`.
Merge/release: explicitly on hold. No publishing or external repository work.
Source: [RFC](rfc-desktop-chart-and-geomap-design.md).

## Ownership and decisions

- Review agent committed its work as `93112314`; the v9 checkout was clean at handoff.
- User confirmed handoff and requested GPT-6.1 Sol implementation agents directly in this checkout.
- User asked to commit all completed work to the v9 branch; this supersedes the RFC suggestion of a branch/PR per phase.
- Revised RFC now has the complete B1/B2/B3 manifest. B1 and opt-ins proceed; B3 adoption follows concrete before/after review. Older five-default question is superseded by the revised manifest.
- Scope interpretation: all phases P0–P5; P3–P5 remain opt-in features.
- P0 gates every implementation phase. P1 then P2; P3 depends on P2 geometry contracts; P4 depends on typed semantic/index contracts and P3; P5 depends on P3/P4 view and identity contracts.

## Checklist

### P0 — Reconcile and establish design evidence

- [x] Confirm final PR #137 state and source symbols; preserve concurrent reviewer work.
- [x] Reconcile existing plan statuses and the reader/layout changes already delivered.
- [x] Produce before/after design prototypes for desktop bar, line, stacked area, choropleth, and bubble map at 1024px and 1440px; also 390px and 200% text checks.
- [x] Freeze the P1/P2 default-change manifest and proposed API spellings; record exclusions.
- [x] Capture performance/bundle baseline and use concrete examples for reader tasks.

Acceptance: each proposed default has a visible before/after, semantic justification, and migration/opt-out policy. P0 is validation, not permission to merge implementation. No public API should be invented solely to make a single screenshot fit.

### P1 — Desktop chart craft and narrow-layout completion

- [x] Test first: placement modes, signed/zero bars, measured gutters, all labels too wide, explicit sizing, unsupported grouped/stacked column mode.
- [x] Implement C1/C2 via bar/column label planning, existing scale padding, and optional row emphasis.
- [x] Implement C3 shared endpoint formatting/budgeting and C4 band anchors/interior labels.
- [x] Implement C5 optional scale headers and approved hierarchy changes; preserve explicit grid/domain decisions.
- [x] Reconcile C7 with existing v9 responsive and note infrastructure; fix only remaining gaps.
- [x] Add focus/overlap/composition gallery examples and update docs/migration fixtures.
- [x] Validate signed/normalized stacks, absent series rows versus explicit null/nonfinite/true zero, both endpoint columns, mixed units, facets, and layers. Assert synthetic pivot geometry never becomes an observed label value and resize never changes numeric provenance.

Acceptance: no accidental geometry changes in feature-disabled fixtures; all intended diffs match the manifest; labels preserve the correct source value and associated mark; no type/legend conversion occurs automatically. Annotation drag and stable-note invariants still pass.

### P2 — Map composition, legend, and symbol craft

- [x] Test first: top/bottom/side legend budgets, fixed-height aspect ratio, multiple point/color/size keys, no-data versus zero, class-boundary labels.
- [x] Implement G1/G3 static legend layout and semantic units/midpoints.
- [x] Preserve G6's existing point paint order/equal-radius ties; improve size-key placement, retain the knockout outline and correct size-legend documentation.
- [x] Implement G8 semantic border/no-data tokens with dark-mode and export parity.
- [x] Keep feature coverage/projection/fit semantics unchanged; no automatic map crop.
- [x] Add desktop world, US categorical, county, diverging, sparse-data, and bubble comparison plates.
- [x] Freeze the single public opt-in spelling for P4 active/distribution legend configuration.

Acceptance: map scale and color bins match legend values exactly; legends clear points/chrome; no geometry distortion; feature-disabled mode matches the reviewed baseline outside approved defaults.

### P3 — Geographic labels and callouts

- [x] Test first: feature/point/source/geographic anchors; concave/multipolygon interior points; preprojected rejection; stable IDs and duplicate errors.
- [x] Add typed spec/normalization/validation, bounded projected-ring records with hole/component associations, canonical fallback anchors, and the accessible label inventory.
- [x] Implement deterministic camera-dependent label placement, callout leaders, fixed note reserve, and bounded decluttering.
- [x] Add constant-screen-size rendering, zoom visibility thresholds, camera-settle reconciliation, and lifecycle cleanup.
- [x] Verify static export/SSR and multiple maps' clip/pattern ID isolation.
- [x] Test alternate visible multipolygon components, holes, geometry-budget fallback, coordinate-only labels omitted by collision, custom versus topology names, unjoined features, and zoom-hidden inventory entries. Verify the P3 disclosure works without enabling P4.
- [x] Add GeoMap API/docs/wrapper coverage; explicitly exclude annotation editing.

Acceptance: names remain attached through camera movement; no text jumps due to a second projection fit; callout content is never lost when moved to notes; same spec/camera/size gives the same exported placement regardless of interaction history.

### P4 — Reader comparison and map exploration

- [ ] Land role/source metadata for crosshair fields and close the remaining crosshair plan only after tests.
- [ ] Test typed slice keys, duplicate x ambiguity, sparse series, metadata compatibility, percent-point math, zero baseline, filtered/deleted/reordered pins.
- [ ] Extend existing reader with opt-in slice mode; preserve old observation-mode API/behavior.
- [ ] Add the GeoMap reader adapter with canonical join identity and selection outline.
- [ ] Implement fixed readout, local search/ranked companion, overlap chooser, active legend markers, and optional distribution counts.
- [ ] Integrate pointer/keyboard/camera/editor ownership and touch cancel/no-pin paths.
- [ ] Add matching wrapper lifecycle/controlled-state tests and accessibility checks.
- [ ] Implement explicit snapshot-readout export only with a portable layout; otherwise leave the feature excluded and clearly documented.
- [ ] Run formative reader tasks; record limitations instead of claiming untested usability gains.

Acceptance: a reader can compare two dates or places without remembering a vanished tooltip; no conflicting gesture fires twice; raw identity/value semantics survive data updates; unsupported bindings never display invented deltas. New interaction remains opt-in.

### P5 — Detail geography and intentional insets

- [ ] Prove fixed shared fit with Texas/Austin/RGV fixture and valid preprojected/geographic input contracts.
- [ ] Finalize view/layer scope and event compatibility before implementation.
- [ ] Add object selection, fixed fit object, contextual detail layers, and explicit inset views.
- [ ] Test point positions are unchanged when context detail becomes visible; test inset coverage/scale labels and shared observation selection.
- [ ] Verify focus, clipping, dark theme, label decluttering, SSR/export, and multi-map IDs in each view.
- [ ] Update and close the open multi-layer geo request only when its actual Austin use case passes.

Acceptance: detail context never changes primary projection fitting; insets are explicitly labeled separate views; no feature/data disappearance or ambiguous camera target. P5 remains a separately approved follow-up rather than an implicit v9.0 gate.

## Verification per phase

Record the commit range, focused test-first evidence, full test/lint/typecheck/build/generated results, visual/invariant results, boundaries, bundle delta, relevant performance, and manual 390/1024/1280/1440 zone scans. Review intended baseline differences individually. Update generated references, migration guide, changelog, wrappers, and codebase map with each affected phase.

A final ce:code-reviewer review is required after automated and manual verification. Fix findings before final commits. Do not merge or release.

## Worktree lifecycle

Reuse the active v9 worktree only after ownership is confirmed. Retain it while the PR remains open and merge is on hold. No additional disposable tree created during preparation.

## Current ownership

- `design_endpoints` (GPT-6.1 Sol): endpoint modules, area/line geometry metadata, line/area examples; test-first B1 then P1b.
- `design_bars` (GPT-6.1 Sol): bar/column label planning and four value-label font fixes (pie already honored the theme); isolated chart modules/examples.
- `design_maps` (GPT-6.1 Sol): geo layout extraction/diagnostics, side legends, map examples.
- Parent: shared types, validation, frame/plan/budget integration, axes, migration/docs/generated files, baseline evidence and whole-branch verification. Only parent stages/commits. No agent creates another worktree.

The revised RFC §13 is the authoritative detailed checklist; the earlier phase list above remains a coverage cross-check and must not override corrected API spellings.


## Implementation checkpoint (2026-10-18)

- [x] Audit the second RFC review; preserve P3/P4 program scope and C7 follow-up instead of rejecting them on narrow rationale.
- [x] Dispatch three GPT-6.1 Sol subsystem agents in the existing v9 tree; parent owns integration/commits.
- [x] P1a endpoint precision/measurement and four value-font fixes, explicit gallery format; tests reproduce failures before fixes.
- [x] P1b additive bar modes, measured facet value columns, axis headers, band/interior opt-ins and theme roles.
- [x] P2 pure geo layout extraction, measured side gutters, diagnostics, scale-faithful descriptions, clipping and map key correctness.
- [x] Migration docs and optional controls; original v8 oracle preserved; exact before/after exceptions prove earlier v9 geometry and current B1 corrections.
- [x] 144 chart plates, map alternatives, desktop/narrow/manual/doubled-text checks; rejected visually worse continuous hatch.
- [x] Finish endpoint minimum-plot fallback and specific impossible-layout diagnostic.
- [x] Finish measured map candidate 200% text evidence (24 measured profiles and 36 browser zoom captures; method recorded).
- [x] User B3 row decisions, then adopt only approved defaults with migration materializations.
- [x] Full final gates and ce:code-reviewer passed; findings fixed; source committed as `9be168d9`, this record committed separately.
- [ ] P3/P4 implementation and P5 spike gate remain outstanding; not marked complete.

Final source checkpoint: 7,919 unit tests passed across 360 files (three intentional expected failures). Build, lint, typecheck, generated files, boundaries and bundle checks passed. All 115 visual checks, 177 general browser checks (11 existing platform skips), and 106 annotation checks passed. The final cache optimization also passed cached/uncached equivalence, update-freshness and positive-corpus tests. The code reviewer independently passed 94 affected tests and approved the final correction set. No merge, push, release or publication.

Initial smoke measurement (retained as historical evidence): Apple M3 Max, 1,000-observation 1024×400 line, 10 warmups/100 samples; baseline p50=1.983ms, p95=3.516ms, first implementation p50=2.174ms, p95=3.535ms. The final paired measurement below supersedes this smaller separate-run comparison. These are local compile measurements, not interaction-performance claims.


### Corrective review disposition

The required code review found concrete composition defects, all fixed with regression tests: independent layers lost interior series names and mandatory band leaders; enlarged side-key No data labels exceeded their gutter; outside bar labels consumed the final plot after rotated ticks and chrome were reserved. Browser inspection then caught stacked domains pinned to raw observations, top-overflow endpoint anchors collapsing together, and a merged legend with positions for only its first leaf. Signed-area follow-through now shares the exact renderer pivot/order/offset semantics with domain measurement; negative/mixed stacks, duplicate observations, invalid gaps, normalized/center offsets and explicit domains are covered. No stack offset semantics changed.

Final manual corrective checks: positive and negative independent-area compositions at 390/1280; all four legend entries remain in the reserved row, endpoint names/values remain separated, and complete bands remain inside the plot. Enlarged bar capacity at 250/300/500 height and 24/32px map side keys also passed visual inspection. Evidence and reviewer report: `/Users/riley/.codex/visualizations/2026/10/18/openchart-design/corrective-review/`.

The v8 capture remains unchanged. The parity suite guards exact B1 and already-landed v9 geometry transitions, including nine endpoint label-center corrections; it does not exempt entire fixtures or categories. All 1,584 parity checks pass.


Compile performance follow-through: the first exact signed-stack implementation increased the 1,000-observation area fixture median by 20.3%. Investigation found repeat pivot/offset work in scale-planning passes and rendering. A fresh render-spec-local cache now shares immutable stack geometry and its cumulative extent within one compilation, keyed by row-array identity and the complete encoding tuple. No global cache or input mutation; changing the same authored data array and compiling again creates new results. Tests compare cached/uncached domains and marks and verify one build across repeated scale measurement and rendering. Initial regression and loaded follow-up measurements are retained; the final quiet paired measurement is recorded below. A 200-sample quiet run had a variable area p95, so the final comparison used 100 warmups and 1,000 alternating paired samples; both results remain available.

Bundle comparison against `93112314`, using the same source-alias consumer build and dependencies: 197,573 to 205,235 gzip bytes (+7,662; 3.88%). The standard public-package bundle gate reports 204,411 gzip bytes and zero product dependencies. These are different build methods, explicitly recorded rather than mixing their absolute values.

Remaining work is explicit: B3 row decisions/adoption and migration materializations; the P0 runtime contract and implementation for row hover; P3 map labels/callouts/inventory; P4 reader comparison/exploration and wrapper lifecycle coverage; P5's separately specified geometry spike. C7 remains a dedicated attribution follow-up. This checkpoint does not mark the RFC complete or move it to `plans/done`.


## Final foundation handoff

Source commit: `9be168d9` on `codex/openchart-v9`. No push, merge, tag, release or publication. Full RFC is intentionally not marked complete.

| Gate | Final result |
| --- | --- |
| Unit tests | 7,919 passed; three intentional expected-failure cases; 360 files |
| Lint / typecheck / build | Passed; all three framework packages included |
| Generated files | Schema, LLM references and CSS tokens current |
| Visual | 115 passed; 21 individually reviewed baselines changed, each identified in `regression-review/manifest.json`; no further baseline refresh for final stack/sweep/legend corrections |
| General browser invariants | 177 passed; 11 existing platform skips |
| Annotation invariants | 106 passed in the existing Chromium/WebKit projects |
| Package boundaries / bundle | Passed; zero product dependencies; 204,411 gzip bytes |
| Required code review | APPROVE after corrective inspection; additional cache review approved |
| Migration corpus | 1,584 exact parity checks passed; released v8 capture unchanged |

Final paired compile measurement on Apple M3 Max, 1024×400, 1,000 observations; 100 warmups and 1,000 alternating samples after the browser suites and development server stopped. Comparing `93112314` engine with current engine using the same built core runtime:

| Fixture | Baseline median / p95 | Final median / p95 | Median change |
| --- | --- | --- | --- |
| Line | 1.780 / 3.084 ms | 1.796 / 3.081 ms | +0.9% |
| Four-series stacked area | 3.785 / 5.456 ms | 3.747 / 5.414 ms | −1.0% |

The paired compile guard is met. Earlier regression, loaded runs and smaller quiet run remain recorded in the evidence directory so the final result is auditable.

Evidence: `/Users/riley/.codex/visualizations/2026/10/18/openchart-design/`. The static review gallery remains served at `http://127.0.0.1:61900/index.html` for the pending B3 choices. The task's Ladle server and browser are stopped. The temporary source-only performance comparison directory and its dependency symlink were removed; no dependencies or build caches were copied.

Worktree cleanup verification: no new worktrees were created. `/Users/riley/.codex/worktrees/openchart-v9/openchart` is retained for the unmerged branch and unfinished RFC. Supported archival requests for `/Users/riley/.codex/worktrees/v9-mark-contract/openchart` and `/Users/riley/.codex/worktrees/v9-themes/openchart` returned queued; final checks still find both checkout directories and Git registrations. Their patch-equivalent work is preserved, but removal is not confirmed. No chat was archived, and unrelated trees/caches were untouched.


## Approved-default batch (2026-10-19)

User approved grid/zero hierarchy, stacked-area band anchors, clearer map keys, collision-aware size-key placement, and quieter map borders from the reviewed gallery. Retain existing bar/column proportions, endpoint sizes/gaps, and no-data hatch. No merge/release approval.

- [x] Test and adopt exact approved light/dark grid and border colors; preserve authored overrides, absent grids and domains.
- [x] Default stacked-area endpoints to band centers without changing source values, mark geometry or nonstacked anchors; preserve explicit boundary.
- [x] Measure static map title/unit/neutral-context rows before projection fit; retain authored formats and class semantics.
- [x] Place size keys against measured text/circle bounds and projected obstacles; preserve old corner on clear/tie and diagnose infeasible placement.
- [x] Materialize expressible v8 appearance in migration; test styles, inheritance, explicit values, repeat runs; report unavoidable map-key layout differences with exact parity guards.
- [x] Update docs, migration guide, generated schema/tokens/references and changelog; preserve before/after review stories.
- [x] Run focused/full gates, review every intended visual baseline change, manually inspect narrow/desktop/dark/enlarged text, and obtain code review before committing.

This batch implements B3 adoption and the row-hover opt-in. P3/P4, the separate P5 spike and C7 remain tracked above. Full-RFC completion is not claimed.

Row-hover runtime contract is finalized as `MountOptions.rowHover?: boolean`, forwarded by all three Chart wrappers. It is independent passive presentation for simple horizontal ungrouped bars; omission adds no DOM/listeners. Editor/layer/facet/stack/color grouping exclude the treatment. The existing keyboard navigation supplies logical focus; this option creates no persistent reader state. Focused tests cover pointer/cancel/touch/control exclusion, update/destroy, and all wrapper toggles.


### B3 and row-hover verification

The user approved the selected B3 defaults on 2026-10-19. All approved choices are implemented; rejected proportion, spacing and hatch retunes remain unchanged. The required code review approved after three fixes: cache row-hover screen coordinates with scroll/resize invalidation, restrict the opt-in to actual bar specs (range bars are excluded), and include the complete point-color title/unit/tick ink in overlay bounds and collision obstacles. Each correction has a failing-first regression test.

| Gate | Result |
| --- | --- |
| Unit tests | 7,966 passed; three intentional expected-failure cases; 362 files |
| Lint / build / typecheck | Passed, including React/Vue/Svelte |
| Generated files | Schema, LLM references and CSS tokens current |
| Visual | 115 passed after seven individually reviewed approved baseline changes; no further baseline changes for review fixes |
| General browser invariants | 177 passed; 11 existing platform skips |
| Annotation invariants | 106 passed in existing Chromium/WebKit projects |
| Boundaries / library bundle | Passed; zero product dependencies; 205,453 gzip bytes (+1,042 vs foundation) |
| Migration | 1,903 focused tests passed (53 migration, 1,584 released-v8 corpus, 266 existing parity); released capture unchanged |
| Code review | APPROVE; zero outstanding findings |

The exact migration manifest records 18 affected fixture-widths and 7,603 old→new geometry paths, rather than exempting whole fixtures. Expressible v8 grid/border/endpoint styling remains materialized; fuller static keys and size-key placement have a documented preservation limitation.

Seven baseline changes and their before/after/diff images are listed in `/Users/riley/.codex/visualizations/2026/10/19/openchart-b3/baselines/manifest.json`. Chrome, axes, plot, legend and edges were inspected; map coverage, border hierarchy, no-data texture and key bounds were checked at 390/1280, with enlarged-text variants. Desktop chart plates include 1024/1440 and light/dark at 200% text. Row-hover pointer/keyboard checks at 390/1280 keep logical row identity; controls, touch/cancel and editing exclusions have focused regression tests. Fixed-height world maps can shrink to accommodate honest key content; the migration guide tells hosts to increase height rather than promising automatic crop or key relocation.

Quiet paired compile on Apple M3 Max, same built core runtime, e049c87f versus B3 engine; 100 warmups/1,000 alternating samples at 1024×400:

| Fixture | Before median / p95 | After median / p95 |
| --- | --- | --- |
| US topology, 56 data rows | 17.858 / 20.225 ms | 17.780 / 19.973 ms |
| Line, 1,000 observations | 1.720 / 2.982 ms | 1.698 / 2.921 ms |
| Four-series area, 1,000 observations | 3.709 / 5.789 ms | 3.677 / 5.909 ms |

All median compile changes meet the 10% guard. The source-only benchmark directory and dependency symlink were removed; dependencies were not copied. Evidence and gate logs: `/Users/riley/.codex/visualizations/2026/10/19/openchart-b3/`.

Cleanup corrective pass: supported archival again returned `queued` for `/Users/riley/.codex/worktrees/v9-mark-contract/openchart` and `/Users/riley/.codex/worktrees/v9-themes/openchart`. Both checkout directories and Git registrations still exist. Their commits are patch-equivalent to v9, source trees are clean and ignored review logs were preserved; no active task process uses them. Removal is unconfirmed, so both are reported retained pending app archival. The active v9 checkout remains needed for the unmerged branch and P3/P4. No unrelated worktree or chat was removed.

Final corrected point-key caption browser checks at 390/1280 confirm long title/unit/tick ink stays inside the overlay backdrop and clear of the size key. Evidence: `maps/final-point-caption-390.png` and `maps/final-point-caption-1280.png`.


## P3 implementation start — after `ca0782a8`

P1/P2 approved-default checkpoint is committed on `codex/openchart-v9`. The user again requested integration into v9 and cleanup; work continues directly in that branch. No main-branch merge is authorized.

- [x] Freeze portable projected geometry, measured text, note-slot and inventory types; emit one optional `GeoMapLayout.labels` bundle only on enabled paths.
- [x] Add optional text/textPriority/callouts authoring types, normalization, strict validation, schema/reference generation and keyed feature/point/source/geographic anchor tests.
- [x] Prove projection-stream ring capture, holes and cuts, largest visible multipolygon component, validated bounded interior anchors, atomic 50k vertex fallback and 200 text-candidate limit.
- [x] Resolve overlays statelessly for camera/spec/viewport; reserve complete authored callout-note capacity before fit, retain every custom/unjoined/coordinate/zoom-hidden entry in the inventory.
- [x] Paint constant-screen text and leaders; preserve accepted identities during gesture, settle/coalesce programmatic camera changes, cancel owned work on replacement/destroy.
- [x] Ship hidden accessible inventory and independent host-placed disclosure; reconcile host replacement without remount/camera loss in all three framework wrappers.
- [x] Verify current-camera export, deterministic SSR, complete descriptions and multi-map clip/pattern/inventory IDs.
- [x] Add separate chart/map design browser invariants and editorial examples; no new visual baselines or modification of existing invariant projects.
- [x] Measure memory and 200-candidate placement p95; feature-disabled compile budget, all phase gates, 390/1024/1280/1440 manual zones, required code review and commit.

Ownership: `design_b3_migration` owns portable layout types plus pure projected geometry/overlay modules; `design_map_defaults` owns spec/validation/normalization, candidates and compile/note integration; `design_row_hover` owns vanilla rendering/camera/inventory/SSR and wrapper lifecycle. Parent owns integration, examples/browser invariants, docs/generated files, gates and commits. All use the shared v9 checkout; no additional worktrees.

### P3 integration checkpoint before review fixes

All phase gates passed: 8,039 unit tests plus three intentional expected-failure cases; 115 visual checks with no baseline change; 177 existing general invariants with 11 existing skips; 106 annotation invariants; 16 new Chromium/WebKit geographic-label checks. Build, all framework/example typechecks, lint, generated artifacts, two script tests, package boundaries and the public chart bundle check passed (210,187 gzip bytes, zero product dependencies). Manual preview scans cover 390/1024/1280/1440, light/dark, doubled text, schematic holes/islands, SVG/SSR and PNG/JPG rasterization. Evidence: `/Users/riley/.codex/visualizations/2026/10/19/openchart-p3/`.

Parent integration fixes preserve feature/point geometry: labels avoid every point symbol; zoom controls are a hard size-key obstacle; numbered note markers scale with theme text, use engine-measured radius, and disappear when obstructed while complete notes remain. No new baseline story or changes to existing invariant projects. The control/key correction is part of the approved collision-aware key policy.

Paired feature-disabled compile (Apple M3 Max, owned browsers/dev server stopped, same core runtime, 100 warmups/1,000 alternating samples, ca0782a8 versus P3): map median 26.445→26.007 ms and p95 41.357→40.910; line 2.232→2.221 and 7.290→7.617; area 4.744→4.610 and 13.988→14.309. All changes are inside the 10% budget; raw paired results retain machine noise rather than claiming a speedup. Placement p95: 200 real counties 0.84 ms; 200 dense polygons/50k retained vertices at clipped zoom 16.02 ms; the same plus 1,000 point obstacles 15.15 ms (20 ms target). Retained JSON payloads: 221,240 bytes for the counties, 2,352,611 for the dense fixture. Capture memory deltas are GC-sensitive and include projection buffers: the 120k-vertex fallback retained no rings, with ~7.3 MB heap and ~18.1 MB RSS delta in this run. Source-only benchmark checkout/symlink was removed; no dependencies copied.

The required full P3 code review found two geometry issues, now being fixed before commit: quadratic ring nesting at only 18,004 vertices, and false anchors for opposite-wound coincident polygon groups whose SVG fill cancels. The review examined all 52 changed/new files and found no other actionable API, lifecycle, wrapper or export issue. P3 remains uncommitted pending regression fixes and reviewer recheck.

The user's linked-app build request was completed successfully on `codex/openchart-v9`; all six global Bun link registrations resolve to this worktree, all export targets exist, and built core/engine/vanilla/React/Vue imports plus a real engine compile passed. This is an active consumer checkout: retain its build outputs while linked apps use them. No merge to main or release occurred.


## Completion authorization — 2026-10-19

The user explicitly requested finishing the remaining implementation, all checks, committing and pushing `codex/openchart-v9`, rebuilding every Bun-linked package, and removing disposable worktrees. Main merge and release remain prohibited. The user then explicitly included P5 detail geography/insets and C7 cross-visualization attribution in this completion. P5's geometry spike still precedes freezing its API; its separate follow-up status no longer excludes execution.

### P4 execution checklist (before coding)

- [ ] Add explicit/default tooltip role and source metadata, remove display-string crosshair guessing, preserve authored supplemental field ordering and test duplicate display strings.
- [ ] Publish discriminated typed-domain slice and comparison contracts; preserve existing four-argument observation API and last-two policy.
- [ ] Build per-revision indexed slices from actual transformed observations, with panel-scoped facets, sparse-member states and duplicate `(series,x)` ambiguity; never persist pixel coordinates or invent pivot observations.
- [ ] Reconcile reorder, filter, delete, dataset/measure/transform/key changes, ID-less replacement and theme/resize; silent controlled set/clear with equality guards and reason metadata.
- [ ] Implement opt-in chart slice preview, persistent A/B guides and fixed host-placed readout; third pin replaces B, toggling A promotes B; missing/ambiguous/filtered data cannot produce deltas.
- [ ] Share conservative comparison semantics through the existing numeric helper: explicit matching measure/unit/representation/grouping, percentage points, unavailable zero-relative change, negative-relative opt-in.
- [ ] Add map reader from actual joined feature/point layout, separate canonical namespaces, no-data findable places, selection outlines and explicit Show on map; selection never implicitly zooms or filters.
- [ ] Add local name search, opt-in ranking with stable ties and missing values unranked, paginated keyboard-accessible companion, and actual screen-space overlapping-symbol chooser.
- [ ] Add optional `colorKey.activeValue`/`distribution`, measured fixed reserves, exact existing scale/bin mapping, A/B/no-data/out-of-range/category markers, finite joined feature counts and static export of distribution.
- [ ] Introduce explicit private navigation ownership and successful-layout subscriptions; editor priority, camera drag/pinch cancellation, stationary touch only, controls excluded, cached coordinate bounds and at-most-once-per-frame pointer processing.
- [ ] Forward options/state/events in React/Vue/Svelte Chart and GeoMap wrappers; StrictMode/reactive lifecycle, callback/host replacement without visualization recreation, controlled no-echo and complete cleanup.
- [ ] Keep transient pins/panels out of static export; document snapshot-readout exclusion until a portable layout exists. Do not use DOM screenshots or foreignObject.
- [ ] Add gallery journeys and Chromium/WebKit interactions, desktop/narrow/dark/large-text/manual keyboard/touch verification, 1k-observation pointer p95<8ms, no hover compilation, whole-phase gates and required code review.
- [ ] Record that expert/manual reader tasks are not a recruited human usability study; do not claim untested usability gains.

### P5 and C7 follow-through

- [ ] P5: prove fixed primary fit using Texas/Austin/RGV geographic and source-space fixtures before API freeze; then object/fit selection, contextual detail thresholds, independently labeled/covered inset views, scoped camera/events/anchors, shared observation identity, multi-map/export IDs and all gates.
- [ ] C7: measure attribution and branding together in shared chrome; preserve explicit text/style/offsets and stable note bands; verify chart, map, table, sankey, barlist, tilemap and graph paths at narrow/desktop widths, long text, large fonts, dark themes, hidden/compact modes and export. Record intentional appearance changes and v8 migration behavior.


### P5 spike evidence before public API implementation

`/Users/riley/.codex/visualizations/2026/10/19/openchart-p5/` contains the executable prototype, source URL/provenance, measured coordinates and manually inspected1440px plate. A fixed projection of254 Texas counties paints290 real Travis County Census2020 tracts without changing any Austin/McAllen/Brownsville/San Antonio point coordinate (0px drift). Refitting against tract detail instead moves points by up to2750.50px at the tested frame. An identity-projection source-space fixture also preserves the fitted coordinates. Tract geometry came from the official Census TIGERweb2020 service, simplified0.002° and normalized to D3's spherical ring orientation; no new runtime dependency.

Independent Alaska/Hawaii feature insets were inspected. EqualEarth with its default central meridian gave Alaska an unusably wide antimeridian fit; using the existing Albers USA projection produced coherent labeled views. Implementation must make inset projection choice explicit when the parent's projection cannot represent a compact inset; do not claim arbitrary projection/topology combinations work. Source-space detail must explicitly declare the same decoded coordinate plane as its primary topology; reject geographic detail under identity projection. Inset view labels must disclose separate scale and coverage. This prototype freezes fit independence, not a claim that the later view/controller implementation is already complete.


### P3 final verified checkpoint

All review findings are fixed, including bounded topology/nesting work and proof against the complete SVG nonzero fill. Camera candidates use the original transformed geometry; cancelled coincident rings and degenerate components cannot produce false anchors. The independent focused re-review approved all 41 geometry tests with no outstanding findings.

Final gates: 8,050 unit tests passed (three intentional expected failures), 20 new Chromium/WebKit geographic-label tests passed, and 398 existing browser checks passed with 11 existing skips (115 visual, 177 general, 106 annotation). No visual baseline changed. Lint, typecheck, six-package build, generated files, boundaries, script tests and bundle gate passed; public bundle 210,189 gzip bytes with zero product dependencies.

Quiet final geometry measurement after all browser workers exited: real 200 counties p95 0.786ms; clipped dense 200 polygons/50k vertices p95 15.753ms; same with 1,000 symbol obstacles p95 15.447ms, all below 20ms. Retained county geometry 227,662 JSON bytes; dense geometry 2,352,611 bytes. The final run supersedes the loaded 21.06ms result without discarding it. Logs: /tmp/v9-p3-final-*.log and /tmp/v9-p3-geometry-final.log; durable manual/review evidence in the P3 visualization directory.

The reported multiple-map error came from a gallery button deliberately submitting duplicate callout IDs. Normal controls no longer expose that failure action. Validation coverage remains through a private fixture event; new 390/1280 browser tests prove ordinary controls never show an error or change the second map. Manual preview scans on the user's localhost:6006 server passed at both widths, including zoom and complete narrow-layout notes.
