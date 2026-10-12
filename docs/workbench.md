# OpenChart Studio reference workbench

Studio is a separately buildable, client-side authoring application in `examples/src/workbench`. It uses the same `VizSpec` documents and public compiler/renderers as library consumers. Deployment location is deliberately undecided: the static artifact can live on its own origin, under a path, or be integrated into another application. Ladle remains the development and regression catalog.

## Run and deploy

```sh
bun install --frozen-lockfile
bun run dev:workbench        # http://127.0.0.1:6007/workbench.html
bun run build:workbench     # examples/build-workbench/
bun run --cwd examples preview:workbench # http://127.0.0.1:6008/
bun run test:workbench      # builds and tests the production artifact
```

Serve the entire `examples/build-workbench` directory as static files over HTTPS. Both `index.html` and `workbench.html` are entry points; assets use relative URLs. Serve subdirectory deployments with a trailing slash. No rewrite router, environment variables, account credentials, API server, database, or external fonts are required. Cache hashed assets immutably and revalidate HTML on each deployment. Retain the preceding build for rollback. Use a normal static host rather than the Vite development or preview server in production.

The application parses local CSV/TSV and JSON in the browser. It does not upload datasets. A hosting layer still owns authentication, project access, cloud persistence, publish/revoke, embeds, telemetry consent, and operational monitoring. Those workflows have not been implemented or claimed. The existing OpenData figure route has its own account/publishing/data contracts; integrating there should adapt document load/save around this boundary rather than introduce a second chart grammar.

## Authoring contract

- Start with one of eight compositions, paste CSV/TSV, open a local file, or import a supported chart/table/map JSON document. Other library visualization types remain available through their existing APIs.
- Imports accept at most 5 MiB and 20,000 rows. Headers must be unique and nonempty; row lengths must match. Quoted delimiters and newlines work. Leading-zero identifiers remain text. Dates require valid ISO calendar dates or timezone-qualified timestamps.
- Imported rows receive unique persistent keys. Explicit type corrections persist in `fields[field].type`; internal keys have `role: 'identity'`. Data editing never guesses aggregation semantics.
- The optional JSON drawer reads/writes `VizSpec`. History contains complete immutable documents with 100 undo steps. Native text-field undo applies while typing; document undo applies outside text controls.
- One local draft is saved after edits and flushed when the page is hidden. Drafts are scoped to this browser and origin, not an account. Export JSON for backup or moving between hosts. Storage failures produce an explicit error; an invalid saved document is left untouched until an author makes another edit. Undo history and transient inspection are not saved across reloads.
- Canvas width is a target capped by available space. Data-view edits retain that composition for image export. Direct chart editing returns the preview to all years before any edit can be committed. Timeline scrubbing filters only the preview; the complete dataset remains editable and saved. SVG/PNG export the displayed time window; CSV and JSON retain the full dataset.
- Reader and editor modes are separate. Charts support preview, pinning two observations, arrows/Enter, and Escape. Maps and tables support a single click/tap pin, cleared when their document changes. Aggregate groups are explicitly identified and clear on data replacement. No unkeyed observation silently persists across a revision.
- SVG/PNG exports are available for charts/maps; tables support CSV. All supported documents can be downloaded as JSON. Static chart exports use final geometry even during an update.
- Suggest uses explicit field roles and deterministic rules. Review offers measurable diagnostics and optional snapshot-guarded patches. Suggestions cannot overwrite a later edit; every application is undoable. Review coverage is narrower than a complete editorial or accessibility audit.

## Host interfaces and additive library options

`clarity` is an opt-in Inter/ink/teal theme with 12px axes and small labels. `legacyEditorial` retains the previous editorial theme values; it does not promise an old layout engine. Existing v8 defaults and `animation: true` remain unchanged. `animation: 'fluid' | 'subtle' | 'legacy'` opts into named timing presets. An explicit phase overrides its preset. A spring phase accepts positive finite `stiffness`, `damping`, and `mass`; specifying duration/easing with a spring is rejected. Quantitative spring motion is bounded and snaps at a finite terminal time. Legacy specialized entrance choreography is retained where applicable.

`responsive: { preserveEnd: true, labelSummary: true }` prioritizes the final tick and provides wrapped series summaries when endpoint labels cannot fit. `chromeLayout: 'grow'` lets editorial figures reserve the required height. `mobileLayout: 'priority'` keeps identifying/priority columns and expands secondary table details; the existing cards mode remains the default.

`FieldMetadata` supplies type, identity role, label, unit, measure, provenance, representation, interval field references and a status field. It never computes uncertainty. `diagnoseChart`, `recommendCompositions`, `applySpecPatch`, observation identity/comparison helpers and explicit dataset bindings are exported from the engine. `CompileOptions.onDiagnostic` receives structured Cartesian checks; the existing `onWarn` contract is preserved. `createReader` and `ChartInstance.sampleLayout()` expose reader state and sampled geometry without requiring React or Motion.

## Verification and remaining release gates

`playwright.workbench.config.ts` tests the built static app in desktop Chromium, 390px Chromium with 4× CPU throttling, 320px Chromium, and 390px WebKit. It covers all eight patterns, fonts, bounded layout, import/type correction, edits, undo/redo, draft recovery, inspector state, exact keyboard values, selection invalidation, hidden-view exports, timeline edit preservation, reduced motion and resize. Screenshots and traces are written to ignored `workbench-test-results/` and failures are attached in CI. Unit/integration tests exercise real compilers/renderers and deterministic clocks, including mixed SVG text reconciliation, aggregate inspection, metadata validation, wrapped summaries and spring sample agreement.

This is a deployable local editor foundation. It is not the completion of every design-evolution phase. Retaining all controller state/velocity, full live-tooltip sampling, linked-view UI, uncertainty authoring, generalized narrative documents, diagnostic provenance at every layout decision, and measured comprehension/authoring ROI remain roadmap work. Human studies and reference hardware performance targets in [design-evolution.md](design-evolution.md) remain unvalidated.
