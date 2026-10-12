# OpenChart Studio reference workbench

Studio is a separately buildable, client-side authoring application in `apps/studio`. It uses the same `VizSpec` documents and public compiler/renderers as library consumers. Deployment location is deliberately undecided: the static artifact can live on its own origin, under a path, or be integrated into another application. Ladle remains the development and regression catalog.

## Run and deploy

```sh
bun install --frozen-lockfile
bun run build               # build the public OpenChart packages first
bun run dev:workbench        # http://127.0.0.1:6007/
bun run build:workbench      # apps/studio/dist/
bun run --cwd apps/studio preview # http://127.0.0.1:6008/
bun run test:workbench      # builds and tests the production artifact
```

Serve the entire `apps/studio/dist` directory as static files over HTTPS. `index.html` is the entry point; assets and the bundled Inter font use relative URLs. Serve subdirectory deployments with a trailing slash. No rewrite router, environment variables, account credentials, API server, database, or external fonts are required. Cache hashed assets immutably and revalidate HTML on each deployment. Retain the preceding build for rollback. Use a normal static host rather than the Vite development or preview server in production.

The application parses local CSV/TSV and JSON in the browser. It does not upload datasets. A hosting layer still owns authentication, project access, cloud persistence, publish/revoke, embeds, telemetry consent, and operational monitoring. Those workflows have not been implemented or claimed. The existing OpenData figure route has its own account/publishing/data contracts; integrating there should adapt document load/save around this boundary rather than introduce a second chart grammar.

## Authoring contract

- Start with one of eight compositions, paste CSV/TSV, open a local file, or import a supported chart/table/map JSON document. Other library visualization types remain available through their existing APIs.
- Plain document and delimited imports accept at most 5 MB (including normalized row expansion) and 20,000 rows. Studio project backups accept 20 MB to accommodate the source plus prepared document. Headers must be unique and nonempty; row lengths must match. Quoted delimiters and newlines work. Leading-zero identifiers remain text. Dates require valid ISO calendar dates or timezone-qualified timestamps.
- Imported rows receive unique persistent keys. Explicit type corrections persist in `fields[field].type`; internal keys have `role: 'identity'`. Data editing never guesses aggregation semantics.
- The optional JSON drawer reads/writes `VizSpec`. History contains complete immutable projects (source, preparation and document) with 100 undo steps. Native text-field undo applies while typing; document undo applies outside text controls.
- One local draft is saved after edits and flushed when the page is hidden. Drafts are scoped to this browser and origin, not an account. Use Download Studio project for a lossless backup or moving between hosts; plain VizSpec JSON contains the prepared chart, not its source recipe. Storage failures produce an explicit error; an invalid saved document is left untouched until an author makes another edit. Undo history and transient inspection are not saved across reloads.
- Canvas width is a target capped by available space. Data-view edits retain that composition for image export. Direct chart editing returns the preview to all years before any edit can be committed. Timeline scrubbing filters only the preview; the complete dataset remains editable and saved. SVG/PNG export the displayed time window; CSV and JSON retain the full dataset.
- Reader and editor modes are separate. Charts support preview, pinning two observations, arrows/Enter, and Escape. Maps and tables support a single click/tap pin, cleared when their document changes. Aggregate groups are explicitly identified and clear on data replacement. No unkeyed observation silently persists across a revision.
- SVG/PNG exports are available for charts/maps; tables support CSV. All supported documents can be downloaded as JSON. Static chart exports use final geometry even during an update.
- Suggest uses explicit field roles and deterministic rules. Review offers measurable diagnostics and optional snapshot-guarded patches. Suggestions cannot overwrite a later edit; every application is undoable. Review coverage is narrower than a complete editorial or accessibility audit.

## Product/library boundary and extraction

Studio is a private application workspace with its own dependencies, TypeScript, Vite, Biome, Vitest, Playwright, datasets and assets. Root library build, test, lint and typecheck do not include the app; its dedicated CI job checks it separately. Studio consumes built public package exports with no source aliases. React, Motion, CSV parsing and geography fixtures belong to the app; none enter an OpenChart consumer bundle. `bun run check:boundaries` checks dependency direction, and `bun run check:library-bundle` bundles a real `createChart` consumer and rejects product dependencies.

Run `bun run extract:studio /tmp/my-studio-checkout` with a new destination to produce an independent checkout. The script builds and packs this revision's core, engine and vanilla packages, replaces workspace dependencies with local tarballs, verifies installed entry points (including transitive dependencies), then installs, typechecks, tests and builds outside the workspace. These snapshots avoid relying on an npm release that may not yet contain these APIs. Commit the generated lockfile when moving the app into its own repository; switch the tarballs to pinned registry releases when those versions are published. From the extracted directory run `STUDIO_TEST_BASE_PATH=/tools/studio/ bun run test:e2e` to verify nested hosting in all browser profiles. The included server is for local QA only.

## Feature suite

| Workflow | Supported authoring |
| --- | --- |
| Data | Source editing, explicit field types, exact-value filters, grouped sum/mean/min/max/count, source/prepared previews and CSV downloads |
| Replace data | Explicit one-to-one column mapping; retain the design, preparation and headline; undo as one transaction |
| Compose | Bars, lines, areas, scatter, lollipop, intervals/before-after, histograms and tables using chosen field roles |
| Chart design | Axis titles/visibility/number formats/baselines/order, series colors, label density, facets, area stacking, anchored text/reference lines and motion presets |
| Tables | Column order/labels/formats/priority, inline bars, heatmaps, change chips, search, pagination and phone layouts |
| Maps | Join fields, color measure/format/palette, zoom and explicit duplicate/missing/unmatched join feedback |
| Recovery | 100-step undo/redo, local draft, portable project backup, canonical VizSpec JSON and responsive preview |

Sample patterns replace a document; Change composition retains its data and editorial context. Repeated category/series observations require an explicit filter or summary before composing bars or lines (or after restoring source rows to such a chart); the app never silently decides which year or aggregate to display. Existing authored transform pipelines are retained for chart-to-chart composition. Summarizing those pipelines requires starting from the source table, where the operation is explicit. Converting to a table exposes source rows rather than inventing another aggregation.

The app-owned `StudioProject` envelope preserves the source, its identity/metadata, preparation and an ordinary `VizSpec`. It is a persistence format, not a second visualization grammar. Prepared counts use a separate row-count measure without inherited percentage/currency formatting. Numeric summaries exclude missing/non-numeric observations and return null for groups with no measurements; count counts rows. Bars omit missing measurements instead of drawing zero marks. Map joins leave ambiguous observations uncolored and report diagnostics; no duplicate silently wins. Named sequential palettes affect both map marks and their key. Missing-data hatches remain stable during updates. Crowded class-boundary labels stagger into reserved rows rather than dropping irregular thresholds; `ContinuousLegendTick.offsetY` carries this optional baseline offset for host renderers. Supplied interval bounds are used as supplied, never calculated as confidence intervals.

Mobile authoring uses sheets and preserves unfinished composition/annotation choices across dismissal. Preparing a new source clears obsolete pending field choices. The app does not yet expose every library chart family, layer grammar, transform or annotation option through controls; supported documents can retain those existing settings through JSON. Full linked exploration, uncertainty-band authoring and narrative document orchestration remain separate roadmap work.

## Host interfaces and additive library options

`clarity` is an opt-in Inter/ink/teal theme with 12px axes and small labels. `legacyEditorial` retains the previous editorial theme values; it does not promise an old layout engine. Existing v8 defaults and `animation: true` remain unchanged. `animation: 'fluid' | 'subtle' | 'legacy'` opts into named timing presets. An explicit phase overrides its preset. A spring phase accepts positive finite `stiffness`, `damping`, and `mass`; specifying duration/easing with a spring is rejected. Quantitative spring motion is bounded and snaps at a finite terminal time. Legacy specialized entrance choreography is retained where applicable.

`responsive: { preserveEnd: true, labelSummary: true }` prioritizes the final tick and provides wrapped series summaries when endpoint labels cannot fit. `chromeLayout: 'grow'` lets editorial figures reserve the required height. `mobileLayout: 'priority'` keeps identifying/priority columns and expands secondary table details; the existing cards mode remains the default.

`FieldMetadata` supplies type, identity role, label, unit, measure, provenance, representation, interval field references and a status field. It never computes uncertainty. `diagnoseChart`, `recommendCompositions`, `applySpecPatch`, observation identity/comparison helpers and explicit dataset bindings are exported from the engine. `CompileOptions.onDiagnostic` receives structured Cartesian checks; the existing `onWarn` contract is preserved. `createReader` and `ChartInstance.sampleLayout()` expose reader state and sampled geometry without requiring React or Motion.

## Verification and remaining release gates

`apps/studio/playwright.config.ts` tests the built static app in desktop Chromium, 390px Chromium with 4× CPU throttling, 320px Chromium, and 390px WebKit. It covers all eight patterns, fonts, bounded layout, import/type correction, edits, undo/redo, draft recovery, inspector state, exact keyboard values, selection invalidation, hidden-view exports, timeline edit preservation, reduced motion and resize. Screenshots and traces are written to ignored `apps/studio/test-results/` and failures are attached in CI. Unit/integration tests exercise real compilers/renderers and deterministic clocks, including mixed SVG text reconciliation, aggregate inspection, metadata validation, wrapped summaries and spring sample agreement.

This is a deployable local editor foundation. It is not the completion of every design-evolution phase. Retaining all controller state/velocity, full live-tooltip sampling, linked-view UI, uncertainty authoring, generalized narrative documents, diagnostic provenance at every layout decision, and measured comprehension/authoring ROI remain roadmap work. Human studies and reference hardware performance targets in [design-evolution.md](design-evolution.md) remain unvalidated.
