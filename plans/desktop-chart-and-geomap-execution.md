# Desktop chart and GeoMap RFC execution

Status: P1/P2 foundations verified and committed as `9be168d9` after review handoff at `93112314` (2026-10-18). The full RFC remains open at the concrete B3/P0 decisions and subsequent work listed below.
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
- [ ] Freeze the P1/P2 default-change manifest and proposed API spellings; record exclusions.
- [x] Capture performance/bundle baseline and use concrete examples for reader tasks.

Acceptance: each proposed default has a visible before/after, semantic justification, and migration/opt-out policy. P0 is validation, not permission to merge implementation. No public API should be invented solely to make a single screenshot fit.

### P1 — Desktop chart craft and narrow-layout completion

- [x] Test first: placement modes, signed/zero bars, measured gutters, all labels too wide, explicit sizing, unsupported grouped/stacked column mode.
- [ ] Implement C1/C2 via bar/column label planning, existing scale padding, and optional row emphasis.
- [x] Implement C3 shared endpoint formatting/budgeting and C4 band anchors/interior labels.
- [ ] Implement C5 optional scale headers and approved hierarchy changes; preserve explicit grid/domain decisions.
- [x] Reconcile C7 with existing v9 responsive and note infrastructure; fix only remaining gaps.
- [x] Add focus/overlap/composition gallery examples and update docs/migration fixtures.
- [x] Validate signed/normalized stacks, absent series rows versus explicit null/nonfinite/true zero, both endpoint columns, mixed units, facets, and layers. Assert synthetic pivot geometry never becomes an observed label value and resize never changes numeric provenance.

Acceptance: no accidental geometry changes in feature-disabled fixtures; all intended diffs match the manifest; labels preserve the correct source value and associated mark; no type/legend conversion occurs automatically. Annotation drag and stable-note invariants still pass.

### P2 — Map composition, legend, and symbol craft

- [x] Test first: top/bottom/side legend budgets, fixed-height aspect ratio, multiple point/color/size keys, no-data versus zero, class-boundary labels.
- [ ] Implement G1/G3 static legend layout and semantic units/midpoints.
- [ ] Refine G6's existing point paint order with stable equal-radius ties and improved size-key placement; retain the current knockout outline and correct stale size-legend documentation.
- [x] Implement G8 semantic border/no-data tokens with dark-mode and export parity.
- [x] Keep feature coverage/projection/fit semantics unchanged; no automatic map crop.
- [x] Add desktop world, US categorical, county, diverging, sparse-data, and bubble comparison plates.
- [x] Freeze the single public opt-in spelling for P4 active/distribution legend configuration.

Acceptance: map scale and color bins match legend values exactly; legends clear points/chrome; no geometry distortion; feature-disabled mode matches the reviewed baseline outside approved defaults.

### P3 — Geographic labels and callouts

- [ ] Test first: feature/point/source/geographic anchors; concave/multipolygon interior points; preprojected rejection; stable IDs and duplicate errors.
- [ ] Add typed spec/normalization/validation, bounded projected-ring records with hole/component associations, canonical fallback anchors, and the accessible label inventory.
- [ ] Implement deterministic camera-dependent label placement, callout leaders, fixed note reserve, and bounded decluttering.
- [ ] Add constant-screen-size rendering, zoom visibility thresholds, camera-settle reconciliation, and lifecycle cleanup.
- [ ] Verify static export/SSR and multiple maps' clip/pattern ID isolation.
- [ ] Test alternate visible multipolygon components, holes, geometry-budget fallback, coordinate-only labels omitted by collision, custom versus topology names, unjoined features, and zoom-hidden inventory entries. Verify the P3 disclosure works without enabling P4.
- [ ] Add GeoMap API/docs/wrapper coverage; explicitly exclude annotation editing.

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
- [ ] User B3 row decisions, then adopt only approved defaults with migration materializations.
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
