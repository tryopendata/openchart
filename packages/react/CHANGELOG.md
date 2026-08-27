# Changelog

## [8.2.3](https://github.com/tryopendata/openchart/compare/core-v8.2.2...core-v8.2.3) (2026-08-27)


### Features

* live-simulated dashboards, incident intelligence layout, container-query gallery ([df754ef](https://github.com/tryopendata/openchart/commit/df754ef))
* arc data-update transitions, sparkline updates, barlist label truncation ([ac78ae8](https://github.com/tryopendata/openchart/commit/ac78ae8))


### Bug Fixes

* preserve spec-declared focus padding through resize cycles ([9d7837d](https://github.com/tryopendata/openchart/commit/9d7837d))
* crosshair tooltip picks wrong field from explicit tooltip encoding ([0a6c7d4](https://github.com/tryopendata/openchart/commit/0a6c7d4))
* hide the screen-reader data table on a wrapper div ([fcbfc2b](https://github.com/tryopendata/openchart/commit/fcbfc2b))
* load the gallery webfont relative to the deploy base ([c34eca7](https://github.com/tryopendata/openchart/commit/c34eca7))
* dark-mode page canvas and phone-width gallery layout ([fcf477d](https://github.com/tryopendata/openchart/commit/fcf477d))
* stage the release commit on GitHub before API tagging ([a2431f4](https://github.com/tryopendata/openchart/commit/a2431f4))


### Performance

* dedupe renders and hoist per-element scans ([ea5421d](https://github.com/tryopendata/openchart/commit/ea5421d))
* eliminate per-frame allocations and DOM queries in transitions ([58e487c](https://github.com/tryopendata/openchart/commit/58e487c))
* single-pass field extraction and fewer per-row allocations ([bd1877c](https://github.com/tryopendata/openchart/commit/bd1877c))
* cache constant formatters and hoist text-measure allocations ([00b4e99](https://github.com/tryopendata/openchart/commit/00b4e99))
* externalize d3 from package builds ([3df381f](https://github.com/tryopendata/openchart/commit/3df381f))


### Refactoring

* consolidate fieldIterable and simplify resize dedupe (review) ([e2abd18](https://github.com/tryopendata/openchart/commit/e2abd18))

## [8.2.2](https://github.com/tryopendata/openchart/compare/core-v8.2.1...core-v8.2.2) (2026-08-24)


### Features

* live-simulated dashboards, incident intelligence layout, container-query gallery ([df754ef](https://github.com/tryopendata/openchart/commit/df754ef))
* arc data-update transitions, sparkline updates, barlist label truncation ([ac78ae8](https://github.com/tryopendata/openchart/commit/ac78ae8))


### Bug Fixes

* crosshair tooltip picks wrong field from explicit tooltip encoding ([0a6c7d4](https://github.com/tryopendata/openchart/commit/0a6c7d4))
* hide the screen-reader data table on a wrapper div ([fcbfc2b](https://github.com/tryopendata/openchart/commit/fcbfc2b))
* load the gallery webfont relative to the deploy base ([c34eca7](https://github.com/tryopendata/openchart/commit/c34eca7))
* dark-mode page canvas and phone-width gallery layout ([fcf477d](https://github.com/tryopendata/openchart/commit/fcf477d))
* stage the release commit on GitHub before API tagging ([a2431f4](https://github.com/tryopendata/openchart/commit/a2431f4))
* clamp outer categorical x tick labels inside the container ([345c246](https://github.com/tryopendata/openchart/commit/345c246))


### Performance

* dedupe renders and hoist per-element scans ([ea5421d](https://github.com/tryopendata/openchart/commit/ea5421d))
* eliminate per-frame allocations and DOM queries in transitions ([58e487c](https://github.com/tryopendata/openchart/commit/58e487c))
* single-pass field extraction and fewer per-row allocations ([bd1877c](https://github.com/tryopendata/openchart/commit/bd1877c))
* cache constant formatters and hoist text-measure allocations ([00b4e99](https://github.com/tryopendata/openchart/commit/00b4e99))
* externalize d3 from package builds ([3df381f](https://github.com/tryopendata/openchart/commit/3df381f))


### Refactoring

* consolidate fieldIterable and simplify resize dedupe (review) ([e2abd18](https://github.com/tryopendata/openchart/commit/e2abd18))

## [8.2.1](https://github.com/tryopendata/openchart/compare/core-v8.2.0...core-v8.2.1) (2026-08-19)


### Bug Fixes

* hide the screen-reader data table on a wrapper div ([fcbfc2b](https://github.com/tryopendata/openchart/commit/fcbfc2b))

## [8.2.0](https://github.com/tryopendata/openchart/compare/core-v8.1.1...core-v8.2.0) (2026-08-16)


### Features

* live-simulated dashboards, incident intelligence layout, container-query gallery ([df754ef](https://github.com/tryopendata/openchart/commit/df754ef))
* arc data-update transitions, sparkline updates, barlist label truncation ([ac78ae8](https://github.com/tryopendata/openchart/commit/ac78ae8))
* four composed dashboard layouts and a dashboards guide ([67b4ff5](https://github.com/tryopendata/openchart/commit/67b4ff5))
* layer highlight over the category filter, add a first-class seedNode ([39885c7](https://github.com/tryopendata/openchart/commit/39885c7))
* tween beeswarm dots on data update ([0fc421e](https://github.com/tryopendata/openchart/commit/0fc421e))


### Bug Fixes

* load the gallery webfont relative to the deploy base ([c34eca7](https://github.com/tryopendata/openchart/commit/c34eca7))
* dark-mode page canvas and phone-width gallery layout ([fcf477d](https://github.com/tryopendata/openchart/commit/fcf477d))
* stage the release commit on GitHub before API tagging ([a2431f4](https://github.com/tryopendata/openchart/commit/a2431f4))
* clamp outer categorical x tick labels inside the container ([345c246](https://github.com/tryopendata/openchart/commit/345c246))
* auto-hide the watermark in cramped containers ([16301e9](https://github.com/tryopendata/openchart/commit/16301e9))
* run line/area categorical axes flush to the plot edges ([76458b5](https://github.com/tryopendata/openchart/commit/76458b5))
* correct invalid spec examples and harden release tooling ([4f5d9e2](https://github.com/tryopendata/openchart/commit/4f5d9e2))
* tween point radius and position on data update ([dc872d7](https://github.com/tryopendata/openchart/commit/dc872d7))
* default the legend to top, and drop it on labeled pies ([92552a2](https://github.com/tryopendata/openchart/commit/92552a2))

## [8.1.1](https://github.com/tryopendata/openchart/compare/core-v8.1.0...core-v8.1.1) (2026-08-15)


### Features

* four composed dashboard layouts and a dashboards guide ([67b4ff5](https://github.com/tryopendata/openchart/commit/67b4ff5))
* layer highlight over the category filter, add a first-class seedNode ([39885c7](https://github.com/tryopendata/openchart/commit/39885c7))
* tween beeswarm dots on data update ([0fc421e](https://github.com/tryopendata/openchart/commit/0fc421e))


### Bug Fixes

* load the gallery webfont relative to the deploy base ([c34eca7](https://github.com/tryopendata/openchart/commit/c34eca7))
* dark-mode page canvas and phone-width gallery layout ([fcf477d](https://github.com/tryopendata/openchart/commit/fcf477d))
* stage the release commit on GitHub before API tagging ([a2431f4](https://github.com/tryopendata/openchart/commit/a2431f4))
* clamp outer categorical x tick labels inside the container ([345c246](https://github.com/tryopendata/openchart/commit/345c246))
* auto-hide the watermark in cramped containers ([16301e9](https://github.com/tryopendata/openchart/commit/16301e9))
* run line/area categorical axes flush to the plot edges ([76458b5](https://github.com/tryopendata/openchart/commit/76458b5))
* correct invalid spec examples and harden release tooling ([4f5d9e2](https://github.com/tryopendata/openchart/commit/4f5d9e2))
* tween point radius and position on data update ([dc872d7](https://github.com/tryopendata/openchart/commit/dc872d7))
* default the legend to top, and drop it on labeled pies ([92552a2](https://github.com/tryopendata/openchart/commit/92552a2))
* warn when a dense chart silently falls back to SVG (#111) ([0ccdaed](https://github.com/tryopendata/openchart/commit/0ccdaed))

## [8.1.0](https://github.com/tryopendata/openchart/compare/core-v8.0.0...core-v8.1.0) (2026-08-15)


### Features

* four composed dashboard layouts and a dashboards guide ([67b4ff5](https://github.com/tryopendata/openchart/commit/67b4ff5))
* layer highlight over the category filter, add a first-class seedNode ([39885c7](https://github.com/tryopendata/openchart/commit/39885c7))
* tween beeswarm dots on data update ([0fc421e](https://github.com/tryopendata/openchart/commit/0fc421e))


### Bug Fixes

* clamp outer categorical x tick labels inside the container ([345c246](https://github.com/tryopendata/openchart/commit/345c246))
* auto-hide the watermark in cramped containers ([16301e9](https://github.com/tryopendata/openchart/commit/16301e9))
* run line/area categorical axes flush to the plot edges ([76458b5](https://github.com/tryopendata/openchart/commit/76458b5))
* correct invalid spec examples and harden release tooling ([4f5d9e2](https://github.com/tryopendata/openchart/commit/4f5d9e2))

## [8.0.0](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.26...core-v8.0.0) (2026-07-26)


### Features

* reject point-mark sizes above 50px radius ([ac89727](https://github.com/tryopendata/openchart/commit/ac89727))
* promote dense scatters to canvas automatically ([12dfe87](https://github.com/tryopendata/openchart/commit/12dfe87))
* canvas-mode exports and a screen-reader table cap ([d7ff0c1](https://github.com/tryopendata/openchart/commit/d7ff0c1))
* canvas update transitions on the shared transition clock ([a988286](https://github.com/tryopendata/openchart/commit/a988286))
* canvas entrance animation with a canvas-aware completion clock ([baed972](https://github.com/tryopendata/openchart/commit/baed972))
* canvas mark layer for high-cardinality scatter (opt-in) ([8b336e0](https://github.com/tryopendata/openchart/commit/8b336e0))
* configurable data-update transition cap via animation.update.maxMarks ([06d537f](https://github.com/tryopendata/openchart/commit/06d537f))


### Bug Fixes

* tween point radius and position on data update ([dc872d7](https://github.com/tryopendata/openchart/commit/dc872d7))
* default the legend to top, and drop it on labeled pies ([92552a2](https://github.com/tryopendata/openchart/commit/92552a2))
* warn when a dense chart silently falls back to SVG (#111) ([0ccdaed](https://github.com/tryopendata/openchart/commit/0ccdaed))
* normalize 'none'/'transparent' strokes for canvas marks ([7ea40f3](https://github.com/tryopendata/openchart/commit/7ea40f3))
* re-measure canvas pointer rects on pointerenter ([81f72df](https://github.com/tryopendata/openchart/commit/81f72df))
* gate theme-derived colors on isOpaqueColor, not the literal 'transparent' ([f5536d3](https://github.com/tryopendata/openchart/commit/f5536d3))
* composite canvas scatter points individually ([5cb5384](https://github.com/tryopendata/openchart/commit/5cb5384))
* address code review findings on the canvas mark layer ([529ebb8](https://github.com/tryopendata/openchart/commit/529ebb8))


### Refactoring

* extract shared motion + spatial index out of graph/ ([c470c14](https://github.com/tryopendata/openchart/commit/c470c14))

## [8.0.0-rc.26](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.25...core-v8.0.0-rc.26) (2026-07-25)


### Bug Fixes

* default the legend to top, and drop it on labeled pies ([92552a2](https://github.com/tryopendata/openchart/commit/92552a2))
* warn when a dense chart silently falls back to SVG (#111) ([0ccdaed](https://github.com/tryopendata/openchart/commit/0ccdaed))

## [8.0.0-rc.24](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.23...core-v8.0.0-rc.24) (2026-07-24)


### Features

* reject point-mark sizes above 50px radius ([ac89727](https://github.com/tryopendata/openchart/commit/ac89727))
* promote dense scatters to canvas automatically ([12dfe87](https://github.com/tryopendata/openchart/commit/12dfe87))
* canvas-mode exports and a screen-reader table cap ([d7ff0c1](https://github.com/tryopendata/openchart/commit/d7ff0c1))
* canvas update transitions on the shared transition clock ([a988286](https://github.com/tryopendata/openchart/commit/a988286))
* canvas entrance animation with a canvas-aware completion clock ([baed972](https://github.com/tryopendata/openchart/commit/baed972))
* canvas mark layer for high-cardinality scatter (opt-in) ([8b336e0](https://github.com/tryopendata/openchart/commit/8b336e0))
* configurable data-update transition cap via animation.update.maxMarks ([06d537f](https://github.com/tryopendata/openchart/commit/06d537f))
* scatter trendline stacking/styling and mark-level color/size constants ([84767fb](https://github.com/tryopendata/openchart/commit/84767fb))
* headless GIF export of inter-step update tween ([95a1326](https://github.com/tryopendata/openchart/commit/95a1326))
* scatter entrance timing and deepen the pull-in ([5f2e0f9](https://github.com/tryopendata/openchart/commit/5f2e0f9))


### Bug Fixes

* normalize 'none'/'transparent' strokes for canvas marks ([7ea40f3](https://github.com/tryopendata/openchart/commit/7ea40f3))
* re-measure canvas pointer rects on pointerenter ([81f72df](https://github.com/tryopendata/openchart/commit/81f72df))
* gate theme-derived colors on isOpaqueColor, not the literal 'transparent' ([f5536d3](https://github.com/tryopendata/openchart/commit/f5536d3))
* composite canvas scatter points individually ([5cb5384](https://github.com/tryopendata/openchart/commit/5cb5384))
* address code review findings on the canvas mark layer ([529ebb8](https://github.com/tryopendata/openchart/commit/529ebb8))
* dual-axis lines no longer break where layers' x-values interleave ([809e231](https://github.com/tryopendata/openchart/commit/809e231))


### Refactoring

* extract shared motion + spatial index out of graph/ ([c470c14](https://github.com/tryopendata/openchart/commit/c470c14))

## [8.0.0-rc.23](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.22...core-v8.0.0-rc.23) (2026-07-24)


### Bug Fixes

* normalize 'none'/'transparent' strokes for canvas marks ([7ea40f3](https://github.com/tryopendata/openchart/commit/7ea40f3))

## [8.0.0-rc.22](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.21...core-v8.0.0-rc.22) (2026-07-24)


### Features

* promote dense scatters to canvas automatically ([12dfe87](https://github.com/tryopendata/openchart/commit/12dfe87))
* canvas-mode exports and a screen-reader table cap ([d7ff0c1](https://github.com/tryopendata/openchart/commit/d7ff0c1))
* canvas update transitions on the shared transition clock ([a988286](https://github.com/tryopendata/openchart/commit/a988286))
* canvas entrance animation with a canvas-aware completion clock ([baed972](https://github.com/tryopendata/openchart/commit/baed972))
* canvas mark layer for high-cardinality scatter (opt-in) ([8b336e0](https://github.com/tryopendata/openchart/commit/8b336e0))
* configurable data-update transition cap via animation.update.maxMarks ([06d537f](https://github.com/tryopendata/openchart/commit/06d537f))
* scatter trendline stacking/styling and mark-level color/size constants ([84767fb](https://github.com/tryopendata/openchart/commit/84767fb))
* headless GIF export of inter-step update tween ([95a1326](https://github.com/tryopendata/openchart/commit/95a1326))
* scatter entrance timing and deepen the pull-in ([5f2e0f9](https://github.com/tryopendata/openchart/commit/5f2e0f9))


### Bug Fixes

* re-measure canvas pointer rects on pointerenter ([81f72df](https://github.com/tryopendata/openchart/commit/81f72df))
* gate theme-derived colors on isOpaqueColor, not the literal 'transparent' ([f5536d3](https://github.com/tryopendata/openchart/commit/f5536d3))
* composite canvas scatter points individually ([5cb5384](https://github.com/tryopendata/openchart/commit/5cb5384))
* address code review findings on the canvas mark layer ([529ebb8](https://github.com/tryopendata/openchart/commit/529ebb8))
* dual-axis lines no longer break where layers' x-values interleave ([809e231](https://github.com/tryopendata/openchart/commit/809e231))
* embed color profile in raster exports to fix washed-out colors ([9fed20b](https://github.com/tryopendata/openchart/commit/9fed20b))
* review fixes for entrance shift, zoom inset, and edge diff ([c44241b](https://github.com/tryopendata/openchart/commit/c44241b))


### Refactoring

* extract shared motion + spatial index out of graph/ ([c470c14](https://github.com/tryopendata/openchart/commit/c470c14))

## [8.0.0-rc.21](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.20...core-v8.0.0-rc.21) (2026-07-24)


### Features

* promote dense scatters to canvas automatically ([12dfe87](https://github.com/tryopendata/openchart/commit/12dfe87))
* canvas-mode exports and a screen-reader table cap ([d7ff0c1](https://github.com/tryopendata/openchart/commit/d7ff0c1))
* canvas update transitions on the shared transition clock ([a988286](https://github.com/tryopendata/openchart/commit/a988286))
* canvas entrance animation with a canvas-aware completion clock ([baed972](https://github.com/tryopendata/openchart/commit/baed972))
* canvas mark layer for high-cardinality scatter (opt-in) ([8b336e0](https://github.com/tryopendata/openchart/commit/8b336e0))
* configurable data-update transition cap via animation.update.maxMarks ([06d537f](https://github.com/tryopendata/openchart/commit/06d537f))
* scatter trendline stacking/styling and mark-level color/size constants ([84767fb](https://github.com/tryopendata/openchart/commit/84767fb))
* headless GIF export of inter-step update tween ([95a1326](https://github.com/tryopendata/openchart/commit/95a1326))
* scatter entrance timing and deepen the pull-in ([5f2e0f9](https://github.com/tryopendata/openchart/commit/5f2e0f9))
* host-legend API + nodeLabelPriority encoding channel ([839e1dd](https://github.com/tryopendata/openchart/commit/839e1dd))
* organic entrance pop + chrome collision fix ([2024728](https://github.com/tryopendata/openchart/commit/2024728))


### Bug Fixes

* composite canvas scatter points individually ([5cb5384](https://github.com/tryopendata/openchart/commit/5cb5384))
* address code review findings on the canvas mark layer ([529ebb8](https://github.com/tryopendata/openchart/commit/529ebb8))
* dual-axis lines no longer break where layers' x-values interleave ([809e231](https://github.com/tryopendata/openchart/commit/809e231))
* embed color profile in raster exports to fix washed-out colors ([9fed20b](https://github.com/tryopendata/openchart/commit/9fed20b))
* review fixes for entrance shift, zoom inset, and edge diff ([c44241b](https://github.com/tryopendata/openchart/commit/c44241b))


### Refactoring

* extract shared motion + spatial index out of graph/ ([c470c14](https://github.com/tryopendata/openchart/commit/c470c14))

## [8.0.0-rc.20](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.19...core-v8.0.0-rc.20) (2026-07-24)


### Features

* promote dense scatters to canvas automatically ([12dfe87](https://github.com/tryopendata/openchart/commit/12dfe87))
* canvas-mode exports and a screen-reader table cap ([d7ff0c1](https://github.com/tryopendata/openchart/commit/d7ff0c1))
* canvas update transitions on the shared transition clock ([a988286](https://github.com/tryopendata/openchart/commit/a988286))
* canvas entrance animation with a canvas-aware completion clock ([baed972](https://github.com/tryopendata/openchart/commit/baed972))
* canvas mark layer for high-cardinality scatter (opt-in) ([8b336e0](https://github.com/tryopendata/openchart/commit/8b336e0))
* configurable data-update transition cap via animation.update.maxMarks ([06d537f](https://github.com/tryopendata/openchart/commit/06d537f))


### Bug Fixes

* address code review findings on the canvas mark layer ([529ebb8](https://github.com/tryopendata/openchart/commit/529ebb8))


### Refactoring

* extract shared motion + spatial index out of graph/ ([c470c14](https://github.com/tryopendata/openchart/commit/c470c14))

## [8.0.0-rc.19](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.18...core-v8.0.0-rc.19) (2026-07-22)


### Features

* scatter trendline stacking/styling and mark-level color/size constants ([84767fb](https://github.com/tryopendata/openchart/commit/84767fb))
* headless GIF export of inter-step update tween ([95a1326](https://github.com/tryopendata/openchart/commit/95a1326))
* scatter entrance timing and deepen the pull-in ([5f2e0f9](https://github.com/tryopendata/openchart/commit/5f2e0f9))
* host-legend API + nodeLabelPriority encoding channel ([839e1dd](https://github.com/tryopendata/openchart/commit/839e1dd))
* organic entrance pop + chrome collision fix ([2024728](https://github.com/tryopendata/openchart/commit/2024728))


### Bug Fixes

* dual-axis lines no longer break where layers' x-values interleave ([809e231](https://github.com/tryopendata/openchart/commit/809e231))
* embed color profile in raster exports to fix washed-out colors ([9fed20b](https://github.com/tryopendata/openchart/commit/9fed20b))
* review fixes for entrance shift, zoom inset, and edge diff ([c44241b](https://github.com/tryopendata/openchart/commit/c44241b))
* close plan-review gaps before the RC cut ([4bd12d7](https://github.com/tryopendata/openchart/commit/4bd12d7))

## [8.0.0-rc.18](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.17...core-v8.0.0-rc.18) (2026-07-20)


### Features

* scatter entrance timing and deepen the pull-in ([5f2e0f9](https://github.com/tryopendata/openchart/commit/5f2e0f9))
* host-legend API + nodeLabelPriority encoding channel ([839e1dd](https://github.com/tryopendata/openchart/commit/839e1dd))
* organic entrance pop + chrome collision fix ([2024728](https://github.com/tryopendata/openchart/commit/2024728))
* wrappers, docs, examples for the motion + API surface (Phase 9) ([7d6dff6](https://github.com/tryopendata/openchart/commit/7d6dff6))
* physics feel — springy drag + cursor repulsion (Phase 8) ([8d017e8](https://github.com/tryopendata/openchart/commit/8d017e8))
* unified update() + data transitions (Phase 7) ([06c0932](https://github.com/tryopendata/openchart/commit/06c0932))
* entrance choreography + seeded layout (Phase 6) ([36a5684](https://github.com/tryopendata/openchart/commit/36a5684))


### Bug Fixes

* dual-axis lines no longer break where layers' x-values interleave ([809e231](https://github.com/tryopendata/openchart/commit/809e231))
* embed color profile in raster exports to fix washed-out colors ([9fed20b](https://github.com/tryopendata/openchart/commit/9fed20b))
* review fixes for entrance shift, zoom inset, and edge diff ([c44241b](https://github.com/tryopendata/openchart/commit/c44241b))
* close plan-review gaps before the RC cut ([4bd12d7](https://github.com/tryopendata/openchart/commit/4bd12d7))

## [8.0.0-rc.17](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.16...core-v8.0.0-rc.17) (2026-07-20)


### Features

* scatter entrance timing and deepen the pull-in ([5f2e0f9](https://github.com/tryopendata/openchart/commit/5f2e0f9))
* host-legend API + nodeLabelPriority encoding channel ([839e1dd](https://github.com/tryopendata/openchart/commit/839e1dd))
* organic entrance pop + chrome collision fix ([2024728](https://github.com/tryopendata/openchart/commit/2024728))
* wrappers, docs, examples for the motion + API surface (Phase 9) ([7d6dff6](https://github.com/tryopendata/openchart/commit/7d6dff6))
* physics feel — springy drag + cursor repulsion (Phase 8) ([8d017e8](https://github.com/tryopendata/openchart/commit/8d017e8))
* unified update() + data transitions (Phase 7) ([06c0932](https://github.com/tryopendata/openchart/commit/06c0932))
* entrance choreography + seeded layout (Phase 6) ([36a5684](https://github.com/tryopendata/openchart/commit/36a5684))
* focus tweening, highlight API, interactive legend, tooltip/theme fixes ([0642d78](https://github.com/tryopendata/openchart/commit/0642d78))
* animated camera flights via interpolateZoom ([cd93dc4](https://github.com/tryopendata/openchart/commit/cd93dc4))


### Bug Fixes

* embed color profile in raster exports to fix washed-out colors ([9fed20b](https://github.com/tryopendata/openchart/commit/9fed20b))
* review fixes for entrance shift, zoom inset, and edge diff ([c44241b](https://github.com/tryopendata/openchart/commit/c44241b))
* close plan-review gaps before the RC cut ([4bd12d7](https://github.com/tryopendata/openchart/commit/4bd12d7))

## [8.0.0-rc.16](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.15...core-v8.0.0-rc.16) (2026-07-20)


### Bug Fixes

* embed color profile in raster exports to fix washed-out colors ([9fed20b](https://github.com/tryopendata/openchart/commit/9fed20b))

## [8.0.0-rc.15](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.14...core-v8.0.0-rc.15) (2026-07-19)


### Features

* host-legend API + nodeLabelPriority encoding channel ([839e1dd](https://github.com/tryopendata/openchart/commit/839e1dd))
* organic entrance pop + chrome collision fix ([2024728](https://github.com/tryopendata/openchart/commit/2024728))
* wrappers, docs, examples for the motion + API surface (Phase 9) ([7d6dff6](https://github.com/tryopendata/openchart/commit/7d6dff6))
* physics feel — springy drag + cursor repulsion (Phase 8) ([8d017e8](https://github.com/tryopendata/openchart/commit/8d017e8))
* unified update() + data transitions (Phase 7) ([06c0932](https://github.com/tryopendata/openchart/commit/06c0932))
* entrance choreography + seeded layout (Phase 6) ([36a5684](https://github.com/tryopendata/openchart/commit/36a5684))
* focus tweening, highlight API, interactive legend, tooltip/theme fixes ([0642d78](https://github.com/tryopendata/openchart/commit/0642d78))
* animated camera flights via interpolateZoom ([cd93dc4](https://github.com/tryopendata/openchart/commit/cd93dc4))
* Phase 3 — vanilla motion foundations ([7915a23](https://github.com/tryopendata/openchart/commit/7915a23))
* Phase 2 — engine resolution for motion/api fields ([f93a73c](https://github.com/tryopendata/openchart/commit/f93a73c))
* Phase 1 — motion/API spec types + schema ([bf55c29](https://github.com/tryopendata/openchart/commit/bf55c29))


### Bug Fixes

* review fixes for entrance shift, zoom inset, and edge diff ([c44241b](https://github.com/tryopendata/openchart/commit/c44241b))
* close plan-review gaps before the RC cut ([4bd12d7](https://github.com/tryopendata/openchart/commit/4bd12d7))

## [8.0.0-rc.14](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.13...core-v8.0.0-rc.14) (2026-07-19)


### Features

* host-legend API + nodeLabelPriority encoding channel ([839e1dd](https://github.com/tryopendata/openchart/commit/839e1dd))
* organic entrance pop + chrome collision fix ([2024728](https://github.com/tryopendata/openchart/commit/2024728))
* wrappers, docs, examples for the motion + API surface (Phase 9) ([7d6dff6](https://github.com/tryopendata/openchart/commit/7d6dff6))
* physics feel — springy drag + cursor repulsion (Phase 8) ([8d017e8](https://github.com/tryopendata/openchart/commit/8d017e8))
* unified update() + data transitions (Phase 7) ([06c0932](https://github.com/tryopendata/openchart/commit/06c0932))
* entrance choreography + seeded layout (Phase 6) ([36a5684](https://github.com/tryopendata/openchart/commit/36a5684))
* focus tweening, highlight API, interactive legend, tooltip/theme fixes ([0642d78](https://github.com/tryopendata/openchart/commit/0642d78))
* animated camera flights via interpolateZoom ([cd93dc4](https://github.com/tryopendata/openchart/commit/cd93dc4))
* Phase 3 — vanilla motion foundations ([7915a23](https://github.com/tryopendata/openchart/commit/7915a23))
* Phase 2 — engine resolution for motion/api fields ([f93a73c](https://github.com/tryopendata/openchart/commit/f93a73c))
* Phase 1 — motion/API spec types + schema ([bf55c29](https://github.com/tryopendata/openchart/commit/bf55c29))
* add animated GIF export ([4c16eda](https://github.com/tryopendata/openchart/commit/4c16eda))


### Bug Fixes

* close plan-review gaps before the RC cut ([4bd12d7](https://github.com/tryopendata/openchart/commit/4bd12d7))

## [8.0.0-rc.13](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.12...core-v8.0.0-rc.13) (2026-07-19)


### Features

* wrappers, docs, examples for the motion + API surface (Phase 9) ([7d6dff6](https://github.com/tryopendata/openchart/commit/7d6dff6))
* physics feel — springy drag + cursor repulsion (Phase 8) ([8d017e8](https://github.com/tryopendata/openchart/commit/8d017e8))
* unified update() + data transitions (Phase 7) ([06c0932](https://github.com/tryopendata/openchart/commit/06c0932))
* entrance choreography + seeded layout (Phase 6) ([36a5684](https://github.com/tryopendata/openchart/commit/36a5684))
* focus tweening, highlight API, interactive legend, tooltip/theme fixes ([0642d78](https://github.com/tryopendata/openchart/commit/0642d78))
* animated camera flights via interpolateZoom ([cd93dc4](https://github.com/tryopendata/openchart/commit/cd93dc4))
* Phase 3 — vanilla motion foundations ([7915a23](https://github.com/tryopendata/openchart/commit/7915a23))
* Phase 2 — engine resolution for motion/api fields ([f93a73c](https://github.com/tryopendata/openchart/commit/f93a73c))
* Phase 1 — motion/API spec types + schema ([bf55c29](https://github.com/tryopendata/openchart/commit/bf55c29))
* grow layout, maxLines cap, and plot-share guardrail ([fdae7da](https://github.com/tryopendata/openchart/commit/fdae7da))
* add animated GIF export ([4c16eda](https://github.com/tryopendata/openchart/commit/4c16eda))


### Bug Fixes

* close plan-review gaps before the RC cut ([4bd12d7](https://github.com/tryopendata/openchart/commit/4bd12d7))

## [8.0.0-rc.12](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.11...core-v8.0.0-rc.12) (2026-07-18)


### Features

* grow layout, maxLines cap, and plot-share guardrail ([fdae7da](https://github.com/tryopendata/openchart/commit/fdae7da))
* add animated GIF export ([4c16eda](https://github.com/tryopendata/openchart/commit/4c16eda))
* add row and column encoding channels for directional faceting ([3a405ae](https://github.com/tryopendata/openchart/commit/3a405ae))
* 'top-left' overlay position for point legends ([757f34c](https://github.com/tryopendata/openchart/commit/757f34c))
* annotation creation gesture + spec-pointer paths (req-5, req-6) ([c54c7b1](https://github.com/tryopendata/openchart/commit/c54c7b1))
* annotation anchor data-space drag (req-4) ([1a380b3](https://github.com/tryopendata/openchart/commit/1a380b3))
* Phase A - ElementRef on payloads, editable prop, docs ([ea33a21](https://github.com/tryopendata/openchart/commit/ea33a21))
* animate point fill transitions on spec update ([4f56679](https://github.com/tryopendata/openchart/commit/4f56679))


### Bug Fixes

* encoding.color.format takes precedence over deprecated valueFormat ([98bd6d6](https://github.com/tryopendata/openchart/commit/98bd6d6))
* single owner for the y-axis gutter, ending the doubled left margin ([9ff3b26](https://github.com/tryopendata/openchart/commit/9ff3b26))
* point stagger var, projection inset, first-render camera init ([e19d4b9](https://github.com/tryopendata/openchart/commit/e19d4b9))
* address code review findings ([860a672](https://github.com/tryopendata/openchart/commit/860a672))
* points-based focus zoom produces correct zoom level ([36836bf](https://github.com/tryopendata/openchart/commit/36836bf))

## [8.0.0-rc.11](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.10...core-v8.0.0-rc.11) (2026-07-17)


### Features

* add row and column encoding channels for directional faceting ([3a405ae](https://github.com/tryopendata/openchart/commit/3a405ae))
* 'top-left' overlay position for point legends ([757f34c](https://github.com/tryopendata/openchart/commit/757f34c))
* annotation creation gesture + spec-pointer paths (req-5, req-6) ([c54c7b1](https://github.com/tryopendata/openchart/commit/c54c7b1))
* annotation anchor data-space drag (req-4) ([1a380b3](https://github.com/tryopendata/openchart/commit/1a380b3))
* Phase A - ElementRef on payloads, editable prop, docs ([ea33a21](https://github.com/tryopendata/openchart/commit/ea33a21))
* animate point fill transitions on spec update ([4f56679](https://github.com/tryopendata/openchart/commit/4f56679))


### Bug Fixes

* encoding.color.format takes precedence over deprecated valueFormat ([98bd6d6](https://github.com/tryopendata/openchart/commit/98bd6d6))
* single owner for the y-axis gutter, ending the doubled left margin ([9ff3b26](https://github.com/tryopendata/openchart/commit/9ff3b26))
* point stagger var, projection inset, first-render camera init ([e19d4b9](https://github.com/tryopendata/openchart/commit/e19d4b9))
* address code review findings ([860a672](https://github.com/tryopendata/openchart/commit/860a672))
* points-based focus zoom produces correct zoom level ([36836bf](https://github.com/tryopendata/openchart/commit/36836bf))
* categorical map color rejects scale.scheme as dead config ([8db1d7f](https://github.com/tryopendata/openchart/commit/8db1d7f))
* graph scale.scheme is dead config too; correct docs ([82d724b](https://github.com/tryopendata/openchart/commit/82d724b))
* family-accurate scale.scheme validation; harden transition test guards ([c8bf396](https://github.com/tryopendata/openchart/commit/c8bf396))

## [8.0.0-rc.10](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.9...core-v8.0.0-rc.10) (2026-07-17)


### Features

* add row and column encoding channels for directional faceting ([3a405ae](https://github.com/tryopendata/openchart/commit/3a405ae))
* 'top-left' overlay position for point legends ([757f34c](https://github.com/tryopendata/openchart/commit/757f34c))
* annotation creation gesture + spec-pointer paths (req-5, req-6) ([c54c7b1](https://github.com/tryopendata/openchart/commit/c54c7b1))
* annotation anchor data-space drag (req-4) ([1a380b3](https://github.com/tryopendata/openchart/commit/1a380b3))
* Phase A - ElementRef on payloads, editable prop, docs ([ea33a21](https://github.com/tryopendata/openchart/commit/ea33a21))
* animate point fill transitions on spec update ([4f56679](https://github.com/tryopendata/openchart/commit/4f56679))
* extend did-you-mean suggestions and scheme warnings to sankey/tilemap/barlist/graph validators ([3923cbe](https://github.com/tryopendata/openchart/commit/3923cbe))
* add points focus mode to fit the camera to point clusters ([b24f073](https://github.com/tryopendata/openchart/commit/b24f073))


### Bug Fixes

* point stagger var, projection inset, first-render camera init ([e19d4b9](https://github.com/tryopendata/openchart/commit/e19d4b9))
* address code review findings ([860a672](https://github.com/tryopendata/openchart/commit/860a672))
* points-based focus zoom produces correct zoom level ([36836bf](https://github.com/tryopendata/openchart/commit/36836bf))
* categorical map color rejects scale.scheme as dead config ([8db1d7f](https://github.com/tryopendata/openchart/commit/8db1d7f))
* graph scale.scheme is dead config too; correct docs ([82d724b](https://github.com/tryopendata/openchart/commit/82d724b))
* family-accurate scale.scheme validation; harden transition test guards ([c8bf396](https://github.com/tryopendata/openchart/commit/c8bf396))
* connectorOffset.from survives geometry moves ([2108cf4](https://github.com/tryopendata/openchart/commit/2108cf4))
* categorical legend honors legend.position and no longer overlaps the map ([4a67a20](https://github.com/tryopendata/openchart/commit/4a67a20))

## [8.0.0-rc.9](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.8...core-v8.0.0-rc.9) (2026-07-17)


### Features

* 'top-left' overlay position for point legends ([757f34c](https://github.com/tryopendata/openchart/commit/757f34c))
* annotation creation gesture + spec-pointer paths (req-5, req-6) ([c54c7b1](https://github.com/tryopendata/openchart/commit/c54c7b1))
* annotation anchor data-space drag (req-4) ([1a380b3](https://github.com/tryopendata/openchart/commit/1a380b3))
* Phase A - ElementRef on payloads, editable prop, docs ([ea33a21](https://github.com/tryopendata/openchart/commit/ea33a21))
* animate point fill transitions on spec update ([4f56679](https://github.com/tryopendata/openchart/commit/4f56679))
* extend did-you-mean suggestions and scheme warnings to sankey/tilemap/barlist/graph validators ([3923cbe](https://github.com/tryopendata/openchart/commit/3923cbe))
* add points focus mode to fit the camera to point clusters ([b24f073](https://github.com/tryopendata/openchart/commit/b24f073))


### Bug Fixes

* point stagger var, projection inset, first-render camera init ([e19d4b9](https://github.com/tryopendata/openchart/commit/e19d4b9))
* address code review findings ([860a672](https://github.com/tryopendata/openchart/commit/860a672))
* points-based focus zoom produces correct zoom level ([36836bf](https://github.com/tryopendata/openchart/commit/36836bf))
* categorical map color rejects scale.scheme as dead config ([8db1d7f](https://github.com/tryopendata/openchart/commit/8db1d7f))
* graph scale.scheme is dead config too; correct docs ([82d724b](https://github.com/tryopendata/openchart/commit/82d724b))
* family-accurate scale.scheme validation; harden transition test guards ([c8bf396](https://github.com/tryopendata/openchart/commit/c8bf396))
* connectorOffset.from survives geometry moves ([2108cf4](https://github.com/tryopendata/openchart/commit/2108cf4))
* categorical legend honors legend.position and no longer overlaps the map ([4a67a20](https://github.com/tryopendata/openchart/commit/4a67a20))
* map entrance animation flash on focus-zoomed maps ([2b983c8](https://github.com/tryopendata/openchart/commit/2b983c8))

## [8.0.0-rc.8](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.7...core-v8.0.0-rc.8) (2026-07-16)


### Features

* animate point fill transitions on spec update ([4f56679](https://github.com/tryopendata/openchart/commit/4f56679))
* extend did-you-mean suggestions and scheme warnings to sankey/tilemap/barlist/graph validators ([3923cbe](https://github.com/tryopendata/openchart/commit/3923cbe))
* add points focus mode to fit the camera to point clusters ([b24f073](https://github.com/tryopendata/openchart/commit/b24f073))
* add point/symbol layer to GeoMap ([f83a82f](https://github.com/tryopendata/openchart/commit/f83a82f))


### Bug Fixes

* points-based focus zoom produces correct zoom level ([36836bf](https://github.com/tryopendata/openchart/commit/36836bf))
* categorical map color rejects scale.scheme as dead config ([8db1d7f](https://github.com/tryopendata/openchart/commit/8db1d7f))
* graph scale.scheme is dead config too; correct docs ([82d724b](https://github.com/tryopendata/openchart/commit/82d724b))
* family-accurate scale.scheme validation; harden transition test guards ([c8bf396](https://github.com/tryopendata/openchart/commit/c8bf396))
* connectorOffset.from survives geometry moves ([2108cf4](https://github.com/tryopendata/openchart/commit/2108cf4))
* categorical legend honors legend.position and no longer overlaps the map ([4a67a20](https://github.com/tryopendata/openchart/commit/4a67a20))
* map entrance animation flash on focus-zoomed maps ([2b983c8](https://github.com/tryopendata/openchart/commit/2b983c8))
* SVG export failure and x-axis title overlap at large font sizes ([690ff18](https://github.com/tryopendata/openchart/commit/690ff18))

## [8.0.0-rc.7](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.6...core-v8.0.0-rc.7) (2026-07-16)


### Features

* extend did-you-mean suggestions and scheme warnings to sankey/tilemap/barlist/graph validators ([3923cbe](https://github.com/tryopendata/openchart/commit/3923cbe))
* add points focus mode to fit the camera to point clusters ([b24f073](https://github.com/tryopendata/openchart/commit/b24f073))
* add point/symbol layer to GeoMap ([f83a82f](https://github.com/tryopendata/openchart/commit/f83a82f))


### Bug Fixes

* points-based focus zoom produces correct zoom level ([36836bf](https://github.com/tryopendata/openchart/commit/36836bf))
* categorical map color rejects scale.scheme as dead config ([8db1d7f](https://github.com/tryopendata/openchart/commit/8db1d7f))
* graph scale.scheme is dead config too; correct docs ([82d724b](https://github.com/tryopendata/openchart/commit/82d724b))
* family-accurate scale.scheme validation; harden transition test guards ([c8bf396](https://github.com/tryopendata/openchart/commit/c8bf396))
* connectorOffset.from survives geometry moves ([2108cf4](https://github.com/tryopendata/openchart/commit/2108cf4))
* categorical legend honors legend.position and no longer overlaps the map ([4a67a20](https://github.com/tryopendata/openchart/commit/4a67a20))
* map entrance animation flash on focus-zoomed maps ([2b983c8](https://github.com/tryopendata/openchart/commit/2b983c8))
* SVG export failure and x-axis title overlap at large font sizes ([690ff18](https://github.com/tryopendata/openchart/commit/690ff18))
* allow pre-release versions in release script ([2dda73a](https://github.com/tryopendata/openchart/commit/2dda73a))

## [8.0.0-rc.6](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.5...core-v8.0.0-rc.6) (2026-07-16)


### Features

* add points focus mode to fit the camera to point clusters ([b24f073](https://github.com/tryopendata/openchart/commit/b24f073))
* add point/symbol layer to GeoMap ([f83a82f](https://github.com/tryopendata/openchart/commit/f83a82f))
* geo/choropleth map visualization (type: 'map') ([9e48aad](https://github.com/tryopendata/openchart/commit/9e48aad))


### Bug Fixes

* categorical legend honors legend.position and no longer overlaps the map ([4a67a20](https://github.com/tryopendata/openchart/commit/4a67a20))
* map entrance animation flash on focus-zoomed maps ([2b983c8](https://github.com/tryopendata/openchart/commit/2b983c8))
* SVG export failure and x-axis title overlap at large font sizes ([690ff18](https://github.com/tryopendata/openchart/commit/690ff18))
* allow pre-release versions in release script ([2dda73a](https://github.com/tryopendata/openchart/commit/2dda73a))
* v8 ([3e8bdd9](https://github.com/tryopendata/openchart/commit/3e8bdd9))
* facet gridlines, x-axis labels, panel height growth, line chart zero:false, map bulk animation, examples typecheck ([e9267ad](https://github.com/tryopendata/openchart/commit/e9267ad))
* map legend collision, entrance animation, focus dim, mercator fitting ([20a9f81](https://github.com/tryopendata/openchart/commit/20a9f81))
* address remaining code review findings for map infra ([cf15da1](https://github.com/tryopendata/openchart/commit/cf15da1))
* address code review findings for geo/choropleth ([3915d93](https://github.com/tryopendata/openchart/commit/3915d93))
* map layout, legend, animation, camera, focus, and story integration ([66dc26b](https://github.com/tryopendata/openchart/commit/66dc26b))
* map container overflow, county demo data join, tooltip channel, validation ([5e1df21](https://github.com/tryopendata/openchart/commit/5e1df21))
* address code review findings for geo/choropleth ([e102747](https://github.com/tryopendata/openchart/commit/e102747))


### Refactoring

* CSS infrastructure overhaul (cascade layers, token codegen, sourcemaps) ([227cec3](https://github.com/tryopendata/openchart/commit/227cec3))

## [8.0.0-rc.5](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.4...core-v8.0.0-rc.5) (2026-07-15)


### Features

* add points focus mode to fit the camera to point clusters ([b24f073](https://github.com/tryopendata/openchart/commit/b24f073))
* add point/symbol layer to GeoMap ([f83a82f](https://github.com/tryopendata/openchart/commit/f83a82f))
* geo/choropleth map visualization (type: 'map') ([9e48aad](https://github.com/tryopendata/openchart/commit/9e48aad))
* v8 breaking release — stack flip, theta canonical, dead channel removal ([3649bf9](https://github.com/tryopendata/openchart/commit/3649bf9))
* default compact number formatting across all chart surfaces ([81e10d3](https://github.com/tryopendata/openchart/commit/81e10d3))
* redesign callouts for editorial quality ([28e9375](https://github.com/tryopendata/openchart/commit/28e9375))
* VL-aligned spec grammar for v8 ([f20cc4c](https://github.com/tryopendata/openchart/commit/f20cc4c))
* plural legend slot and a size legend for bubble charts ([42879e6](https://github.com/tryopendata/openchart/commit/42879e6))


### Bug Fixes

* map entrance animation flash on focus-zoomed maps ([2b983c8](https://github.com/tryopendata/openchart/commit/2b983c8))
* SVG export failure and x-axis title overlap at large font sizes ([690ff18](https://github.com/tryopendata/openchart/commit/690ff18))
* allow pre-release versions in release script ([2dda73a](https://github.com/tryopendata/openchart/commit/2dda73a))
* v8 ([3e8bdd9](https://github.com/tryopendata/openchart/commit/3e8bdd9))
* facet gridlines, x-axis labels, panel height growth, line chart zero:false, map bulk animation, examples typecheck ([e9267ad](https://github.com/tryopendata/openchart/commit/e9267ad))
* map legend collision, entrance animation, focus dim, mercator fitting ([20a9f81](https://github.com/tryopendata/openchart/commit/20a9f81))
* address remaining code review findings for map infra ([cf15da1](https://github.com/tryopendata/openchart/commit/cf15da1))
* address code review findings for geo/choropleth ([3915d93](https://github.com/tryopendata/openchart/commit/3915d93))
* map layout, legend, animation, camera, focus, and story integration ([66dc26b](https://github.com/tryopendata/openchart/commit/66dc26b))
* map container overflow, county demo data join, tooltip channel, validation ([5e1df21](https://github.com/tryopendata/openchart/commit/5e1df21))
* address code review findings for geo/choropleth ([e102747](https://github.com/tryopendata/openchart/commit/e102747))
* address code review findings for number formatting ([ab7b65e](https://github.com/tryopendata/openchart/commit/ab7b65e))
* code review findings for default number formatting ([45afb80](https://github.com/tryopendata/openchart/commit/45afb80))
* right-edge annotation margin collapsed chart width ([d86c808](https://github.com/tryopendata/openchart/commit/d86c808))
* annotations ([a97494b](https://github.com/tryopendata/openchart/commit/a97494b))
* an offset means hand-placed, with or without an anchor ([ce46eba](https://github.com/tryopendata/openchart/commit/ce46eba))
* make offset an aimable control, give geometry one owner ([febb4c3](https://github.com/tryopendata/openchart/commit/febb4c3))
* make the connector gate arrow-aware, and test the edit path ([4c7ad9d](https://github.com/tryopendata/openchart/commit/4c7ad9d))
* close the gaps the review found ([c418b7a](https://github.com/tryopendata/openchart/commit/c418b7a))
* let the defaults own annotation typography and centering ([a216435](https://github.com/tryopendata/openchart/commit/a216435))
* make a bare text annotation draw its leader ([842c1dc](https://github.com/tryopendata/openchart/commit/842c1dc))
* let callouts live in the margin without demoting ([fdca221](https://github.com/tryopendata/openchart/commit/fdca221))
* thin crowded callouts at narrow widths ([e141172](https://github.com/tryopendata/openchart/commit/e141172))
* make the size legend readable at any scale ([61bf709](https://github.com/tryopendata/openchart/commit/61bf709))
* code review ([b22d89d](https://github.com/tryopendata/openchart/commit/b22d89d))
* scroll-driver capture, rotated-label truncation, graph compile ([9894585](https://github.com/tryopendata/openchart/commit/9894585))
* tween mark color and key annotations across data updates ([77d23df](https://github.com/tryopendata/openchart/commit/77d23df))
* share layered domains per channel, and centralize the footnote band ([05855bf](https://github.com/tryopendata/openchart/commit/05855bf))
* rect heatmap, mark geometry, and size/color scale correctness ([950f714](https://github.com/tryopendata/openchart/commit/950f714))


### Refactoring

* CSS infrastructure overhaul (cascade layers, token codegen, sourcemaps) ([227cec3](https://github.com/tryopendata/openchart/commit/227cec3))
* align gallery design system with OpenData ([0b7a7fa](https://github.com/tryopendata/openchart/commit/0b7a7fa))

## [8.0.0-rc.4](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.3...core-v8.0.0-rc.4) (2026-07-15)


### Bug Fixes

* map entrance animation flash on focus-zoomed maps ([2b983c8](https://github.com/tryopendata/openchart/commit/2b983c8))

## [8.0.0-rc.3](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.2...core-v8.0.0-rc.3) (2026-07-15)


### Features

* add point/symbol layer to GeoMap ([f83a82f](https://github.com/tryopendata/openchart/commit/f83a82f))
* geo/choropleth map visualization (type: 'map') ([9e48aad](https://github.com/tryopendata/openchart/commit/9e48aad))
* v8 breaking release — stack flip, theta canonical, dead channel removal ([3649bf9](https://github.com/tryopendata/openchart/commit/3649bf9))
* default compact number formatting across all chart surfaces ([81e10d3](https://github.com/tryopendata/openchart/commit/81e10d3))
* redesign callouts for editorial quality ([28e9375](https://github.com/tryopendata/openchart/commit/28e9375))
* VL-aligned spec grammar for v8 ([f20cc4c](https://github.com/tryopendata/openchart/commit/f20cc4c))
* plural legend slot and a size legend for bubble charts ([42879e6](https://github.com/tryopendata/openchart/commit/42879e6))


### Bug Fixes

* SVG export failure and x-axis title overlap at large font sizes ([690ff18](https://github.com/tryopendata/openchart/commit/690ff18))
* allow pre-release versions in release script ([2dda73a](https://github.com/tryopendata/openchart/commit/2dda73a))
* v8 ([3e8bdd9](https://github.com/tryopendata/openchart/commit/3e8bdd9))
* facet gridlines, x-axis labels, panel height growth, line chart zero:false, map bulk animation, examples typecheck ([e9267ad](https://github.com/tryopendata/openchart/commit/e9267ad))
* map legend collision, entrance animation, focus dim, mercator fitting ([20a9f81](https://github.com/tryopendata/openchart/commit/20a9f81))
* address remaining code review findings for map infra ([cf15da1](https://github.com/tryopendata/openchart/commit/cf15da1))
* address code review findings for geo/choropleth ([3915d93](https://github.com/tryopendata/openchart/commit/3915d93))
* map layout, legend, animation, camera, focus, and story integration ([66dc26b](https://github.com/tryopendata/openchart/commit/66dc26b))
* map container overflow, county demo data join, tooltip channel, validation ([5e1df21](https://github.com/tryopendata/openchart/commit/5e1df21))
* address code review findings for geo/choropleth ([e102747](https://github.com/tryopendata/openchart/commit/e102747))
* address code review findings for number formatting ([ab7b65e](https://github.com/tryopendata/openchart/commit/ab7b65e))
* code review findings for default number formatting ([45afb80](https://github.com/tryopendata/openchart/commit/45afb80))
* right-edge annotation margin collapsed chart width ([d86c808](https://github.com/tryopendata/openchart/commit/d86c808))
* annotations ([a97494b](https://github.com/tryopendata/openchart/commit/a97494b))
* an offset means hand-placed, with or without an anchor ([ce46eba](https://github.com/tryopendata/openchart/commit/ce46eba))
* make offset an aimable control, give geometry one owner ([febb4c3](https://github.com/tryopendata/openchart/commit/febb4c3))
* make the connector gate arrow-aware, and test the edit path ([4c7ad9d](https://github.com/tryopendata/openchart/commit/4c7ad9d))
* close the gaps the review found ([c418b7a](https://github.com/tryopendata/openchart/commit/c418b7a))
* let the defaults own annotation typography and centering ([a216435](https://github.com/tryopendata/openchart/commit/a216435))
* make a bare text annotation draw its leader ([842c1dc](https://github.com/tryopendata/openchart/commit/842c1dc))
* let callouts live in the margin without demoting ([fdca221](https://github.com/tryopendata/openchart/commit/fdca221))
* thin crowded callouts at narrow widths ([e141172](https://github.com/tryopendata/openchart/commit/e141172))
* make the size legend readable at any scale ([61bf709](https://github.com/tryopendata/openchart/commit/61bf709))
* code review ([b22d89d](https://github.com/tryopendata/openchart/commit/b22d89d))
* scroll-driver capture, rotated-label truncation, graph compile ([9894585](https://github.com/tryopendata/openchart/commit/9894585))
* tween mark color and key annotations across data updates ([77d23df](https://github.com/tryopendata/openchart/commit/77d23df))
* share layered domains per channel, and centralize the footnote band ([05855bf](https://github.com/tryopendata/openchart/commit/05855bf))
* rect heatmap, mark geometry, and size/color scale correctness ([950f714](https://github.com/tryopendata/openchart/commit/950f714))
* text wrapping for chrome and suppress categorical value labels (#105) ([7f3a655](https://github.com/tryopendata/openchart/commit/7f3a655))


### Refactoring

* CSS infrastructure overhaul (cascade layers, token codegen, sourcemaps) ([227cec3](https://github.com/tryopendata/openchart/commit/227cec3))
* align gallery design system with OpenData ([0b7a7fa](https://github.com/tryopendata/openchart/commit/0b7a7fa))

## [8.0.0-rc.2](https://github.com/tryopendata/openchart/compare/core-v8.0.0-rc.1...core-v8.0.0-rc.2) (2026-07-14)


### Features

* geo/choropleth map visualization (type: 'map') ([9e48aad](https://github.com/tryopendata/openchart/commit/9e48aad))
* v8 breaking release — stack flip, theta canonical, dead channel removal ([3649bf9](https://github.com/tryopendata/openchart/commit/3649bf9))
* default compact number formatting across all chart surfaces ([81e10d3](https://github.com/tryopendata/openchart/commit/81e10d3))
* redesign callouts for editorial quality ([28e9375](https://github.com/tryopendata/openchart/commit/28e9375))
* VL-aligned spec grammar for v8 ([f20cc4c](https://github.com/tryopendata/openchart/commit/f20cc4c))
* plural legend slot and a size legend for bubble charts ([42879e6](https://github.com/tryopendata/openchart/commit/42879e6))
* annotation arrow control — object-form connector with straight arrows and curve opt-out (#103) ([0c883d4](https://github.com/tryopendata/openchart/commit/0c883d4))


### Bug Fixes

* SVG export failure and x-axis title overlap at large font sizes ([690ff18](https://github.com/tryopendata/openchart/commit/690ff18))
* allow pre-release versions in release script ([2dda73a](https://github.com/tryopendata/openchart/commit/2dda73a))
* v8 ([3e8bdd9](https://github.com/tryopendata/openchart/commit/3e8bdd9))
* facet gridlines, x-axis labels, panel height growth, line chart zero:false, map bulk animation, examples typecheck ([e9267ad](https://github.com/tryopendata/openchart/commit/e9267ad))
* map legend collision, entrance animation, focus dim, mercator fitting ([20a9f81](https://github.com/tryopendata/openchart/commit/20a9f81))
* address remaining code review findings for map infra ([cf15da1](https://github.com/tryopendata/openchart/commit/cf15da1))
* address code review findings for geo/choropleth ([3915d93](https://github.com/tryopendata/openchart/commit/3915d93))
* map layout, legend, animation, camera, focus, and story integration ([66dc26b](https://github.com/tryopendata/openchart/commit/66dc26b))
* map container overflow, county demo data join, tooltip channel, validation ([5e1df21](https://github.com/tryopendata/openchart/commit/5e1df21))
* address code review findings for geo/choropleth ([e102747](https://github.com/tryopendata/openchart/commit/e102747))
* address code review findings for number formatting ([ab7b65e](https://github.com/tryopendata/openchart/commit/ab7b65e))
* code review findings for default number formatting ([45afb80](https://github.com/tryopendata/openchart/commit/45afb80))
* right-edge annotation margin collapsed chart width ([d86c808](https://github.com/tryopendata/openchart/commit/d86c808))
* annotations ([a97494b](https://github.com/tryopendata/openchart/commit/a97494b))
* an offset means hand-placed, with or without an anchor ([ce46eba](https://github.com/tryopendata/openchart/commit/ce46eba))
* make offset an aimable control, give geometry one owner ([febb4c3](https://github.com/tryopendata/openchart/commit/febb4c3))
* make the connector gate arrow-aware, and test the edit path ([4c7ad9d](https://github.com/tryopendata/openchart/commit/4c7ad9d))
* close the gaps the review found ([c418b7a](https://github.com/tryopendata/openchart/commit/c418b7a))
* let the defaults own annotation typography and centering ([a216435](https://github.com/tryopendata/openchart/commit/a216435))
* make a bare text annotation draw its leader ([842c1dc](https://github.com/tryopendata/openchart/commit/842c1dc))
* let callouts live in the margin without demoting ([fdca221](https://github.com/tryopendata/openchart/commit/fdca221))
* thin crowded callouts at narrow widths ([e141172](https://github.com/tryopendata/openchart/commit/e141172))
* make the size legend readable at any scale ([61bf709](https://github.com/tryopendata/openchart/commit/61bf709))
* code review ([b22d89d](https://github.com/tryopendata/openchart/commit/b22d89d))
* scroll-driver capture, rotated-label truncation, graph compile ([9894585](https://github.com/tryopendata/openchart/commit/9894585))
* tween mark color and key annotations across data updates ([77d23df](https://github.com/tryopendata/openchart/commit/77d23df))
* share layered domains per channel, and centralize the footnote band ([05855bf](https://github.com/tryopendata/openchart/commit/05855bf))
* rect heatmap, mark geometry, and size/color scale correctness ([950f714](https://github.com/tryopendata/openchart/commit/950f714))
* text wrapping for chrome and suppress categorical value labels (#105) ([7f3a655](https://github.com/tryopendata/openchart/commit/7f3a655))


### Refactoring

* CSS infrastructure overhaul (cascade layers, token codegen, sourcemaps) ([227cec3](https://github.com/tryopendata/openchart/commit/227cec3))
* align gallery design system with OpenData ([0b7a7fa](https://github.com/tryopendata/openchart/commit/0b7a7fa))

## [8.0.0-rc.1](https://github.com/tryopendata/openchart/compare/core-v7.11.0...core-v8.0.0-rc.1) (2026-07-14)


### Features

* geo/choropleth map visualization (type: 'map') ([9e48aad](https://github.com/tryopendata/openchart/commit/9e48aad))
* v8 breaking release — stack flip, theta canonical, dead channel removal ([3649bf9](https://github.com/tryopendata/openchart/commit/3649bf9))
* default compact number formatting across all chart surfaces ([81e10d3](https://github.com/tryopendata/openchart/commit/81e10d3))
* redesign callouts for editorial quality ([28e9375](https://github.com/tryopendata/openchart/commit/28e9375))
* VL-aligned spec grammar for v8 ([f20cc4c](https://github.com/tryopendata/openchart/commit/f20cc4c))
* plural legend slot and a size legend for bubble charts ([42879e6](https://github.com/tryopendata/openchart/commit/42879e6))
* annotation arrow control — object-form connector with straight arrows and curve opt-out (#103) ([0c883d4](https://github.com/tryopendata/openchart/commit/0c883d4))


### Bug Fixes

* allow pre-release versions in release script ([2dda73a](https://github.com/tryopendata/openchart/commit/2dda73a))
* v8 ([3e8bdd9](https://github.com/tryopendata/openchart/commit/3e8bdd9))
* facet gridlines, x-axis labels, panel height growth, line chart zero:false, map bulk animation, examples typecheck ([e9267ad](https://github.com/tryopendata/openchart/commit/e9267ad))
* map legend collision, entrance animation, focus dim, mercator fitting ([20a9f81](https://github.com/tryopendata/openchart/commit/20a9f81))
* address remaining code review findings for map infra ([cf15da1](https://github.com/tryopendata/openchart/commit/cf15da1))
* address code review findings for geo/choropleth ([3915d93](https://github.com/tryopendata/openchart/commit/3915d93))
* map layout, legend, animation, camera, focus, and story integration ([66dc26b](https://github.com/tryopendata/openchart/commit/66dc26b))
* map container overflow, county demo data join, tooltip channel, validation ([5e1df21](https://github.com/tryopendata/openchart/commit/5e1df21))
* address code review findings for geo/choropleth ([e102747](https://github.com/tryopendata/openchart/commit/e102747))
* address code review findings for number formatting ([ab7b65e](https://github.com/tryopendata/openchart/commit/ab7b65e))
* code review findings for default number formatting ([45afb80](https://github.com/tryopendata/openchart/commit/45afb80))
* right-edge annotation margin collapsed chart width ([d86c808](https://github.com/tryopendata/openchart/commit/d86c808))
* annotations ([a97494b](https://github.com/tryopendata/openchart/commit/a97494b))
* an offset means hand-placed, with or without an anchor ([ce46eba](https://github.com/tryopendata/openchart/commit/ce46eba))
* make offset an aimable control, give geometry one owner ([febb4c3](https://github.com/tryopendata/openchart/commit/febb4c3))
* make the connector gate arrow-aware, and test the edit path ([4c7ad9d](https://github.com/tryopendata/openchart/commit/4c7ad9d))
* close the gaps the review found ([c418b7a](https://github.com/tryopendata/openchart/commit/c418b7a))
* let the defaults own annotation typography and centering ([a216435](https://github.com/tryopendata/openchart/commit/a216435))
* make a bare text annotation draw its leader ([842c1dc](https://github.com/tryopendata/openchart/commit/842c1dc))
* let callouts live in the margin without demoting ([fdca221](https://github.com/tryopendata/openchart/commit/fdca221))
* thin crowded callouts at narrow widths ([e141172](https://github.com/tryopendata/openchart/commit/e141172))
* make the size legend readable at any scale ([61bf709](https://github.com/tryopendata/openchart/commit/61bf709))
* code review ([b22d89d](https://github.com/tryopendata/openchart/commit/b22d89d))
* scroll-driver capture, rotated-label truncation, graph compile ([9894585](https://github.com/tryopendata/openchart/commit/9894585))
* tween mark color and key annotations across data updates ([77d23df](https://github.com/tryopendata/openchart/commit/77d23df))
* share layered domains per channel, and centralize the footnote band ([05855bf](https://github.com/tryopendata/openchart/commit/05855bf))
* rect heatmap, mark geometry, and size/color scale correctness ([950f714](https://github.com/tryopendata/openchart/commit/950f714))
* text wrapping for chrome and suppress categorical value labels (#105) ([7f3a655](https://github.com/tryopendata/openchart/commit/7f3a655))


### Refactoring

* CSS infrastructure overhaul (cascade layers, token codegen, sourcemaps) ([227cec3](https://github.com/tryopendata/openchart/commit/227cec3))
* align gallery design system with OpenData ([0b7a7fa](https://github.com/tryopendata/openchart/commit/0b7a7fa))

## [7.11.0](https://github.com/tryopendata/openchart/compare/core-v7.10.0...core-v7.11.0) (2026-07-10)


### Features

* compact temporal tick formats — try shorter labels before dropping ticks (#101) ([894e2df](https://github.com/tryopendata/openchart/commit/894e2df))
* animated data-update transitions (#95) ([94a2873](https://github.com/tryopendata/openchart/commit/94a2873))
* add categorical color encoding support ([83f28d6](https://github.com/tryopendata/openchart/commit/83f28d6))


### Bug Fixes

* grow auto-height figures with chrome instead of squishing the plot (#102) ([26c2450](https://github.com/tryopendata/openchart/commit/26c2450))
* replace band-label span thinning with parallel-ribbon model (#99) ([7d16588](https://github.com/tryopendata/openchart/commit/7d16588))
* two mobile axis corner cases from the 7.9.1 fixes (#98) ([bffcc8e](https://github.com/tryopendata/openchart/commit/bffcc8e))
* less aggressive x-axis thinning and tighter inline y-title on mobile (#97) ([1087924](https://github.com/tryopendata/openchart/commit/1087924))
* tilemap readability on small/mobile widths (#96) ([fc95777](https://github.com/tryopendata/openchart/commit/fc95777))
* address code review findings + release v7.8.0 ([d6bcd96](https://github.com/tryopendata/openchart/commit/d6bcd96))
* address code review findings ([f4a01b7](https://github.com/tryopendata/openchart/commit/f4a01b7))

## [7.10.0](https://github.com/tryopendata/openchart/compare/core-v7.9.3...core-v7.10.0) (2026-07-10)


### Features

* compact temporal tick formats — try shorter labels before dropping ticks (#101) ([894e2df](https://github.com/tryopendata/openchart/commit/894e2df))

## [7.9.3](https://github.com/tryopendata/openchart/compare/core-v7.9.2...core-v7.9.3) (2026-07-10)


### Bug Fixes

* replace band-label span thinning with parallel-ribbon model (#99) ([7d16588](https://github.com/tryopendata/openchart/commit/7d16588))

## [7.9.2](https://github.com/tryopendata/openchart/compare/core-v7.9.1...core-v7.9.2) (2026-07-09)


### Features

* animated data-update transitions (#95) ([94a2873](https://github.com/tryopendata/openchart/commit/94a2873))
* add categorical color encoding support ([83f28d6](https://github.com/tryopendata/openchart/commit/83f28d6))
* SSR/static rendering — renderStaticSVG for server-side SVG generation ([4dd79f2](https://github.com/tryopendata/openchart/commit/4dd79f2))
* responsive auto-thinning for annotations and endpoint labels ([7ea2226](https://github.com/tryopendata/openchart/commit/7ea2226))
* theming design tokens — TokenValue, widened ThemeConfig, seriesStrategy, CSS custom props, presets (#94) ([316428c](https://github.com/tryopendata/openchart/commit/316428c))
* add encoding.facet for small-multiples / faceted charts (#93) ([fac6188](https://github.com/tryopendata/openchart/commit/fac6188))


### Bug Fixes

* two mobile axis corner cases from the 7.9.1 fixes (#98) ([bffcc8e](https://github.com/tryopendata/openchart/commit/bffcc8e))
* less aggressive x-axis thinning and tighter inline y-title on mobile (#97) ([1087924](https://github.com/tryopendata/openchart/commit/1087924))
* tilemap readability on small/mobile widths (#96) ([fc95777](https://github.com/tryopendata/openchart/commit/fc95777))
* address code review findings + release v7.8.0 ([d6bcd96](https://github.com/tryopendata/openchart/commit/d6bcd96))
* address code review findings ([f4a01b7](https://github.com/tryopendata/openchart/commit/f4a01b7))
* address code review — missing CSS rules, reentrance guard, caching ([a628717](https://github.com/tryopendata/openchart/commit/a628717))
* use CSS custom properties in static SVG style block for theme overridability ([fbca86c](https://github.com/tryopendata/openchart/commit/fbca86c))
* address code review findings for static rendering ([de6454a](https://github.com/tryopendata/openchart/commit/de6454a))

## [7.9.1](https://github.com/tryopendata/openchart/compare/core-v7.9.0...core-v7.9.1) (2026-07-09)


### Bug Fixes

* less aggressive x-axis thinning and tighter inline y-title on mobile (#97) ([1087924](https://github.com/tryopendata/openchart/commit/1087924))
* tilemap readability on small/mobile widths (#96) ([fc95777](https://github.com/tryopendata/openchart/commit/fc95777))

## [7.9.0](https://github.com/tryopendata/openchart/compare/core-v7.8.0...core-v7.9.0) (2026-07-09)


### Features

* animated data-update transitions (#95) ([94a2873](https://github.com/tryopendata/openchart/commit/94a2873))
* add categorical color encoding support ([83f28d6](https://github.com/tryopendata/openchart/commit/83f28d6))
* SSR/static rendering — renderStaticSVG for server-side SVG generation ([4dd79f2](https://github.com/tryopendata/openchart/commit/4dd79f2))
* responsive auto-thinning for annotations and endpoint labels ([7ea2226](https://github.com/tryopendata/openchart/commit/7ea2226))
* theming design tokens — TokenValue, widened ThemeConfig, seriesStrategy, CSS custom props, presets (#94) ([316428c](https://github.com/tryopendata/openchart/commit/316428c))
* add encoding.facet for small-multiples / faceted charts (#93) ([fac6188](https://github.com/tryopendata/openchart/commit/fac6188))
* add encoding.color.highlight for editorial emphasis (#92) ([69e5dc1](https://github.com/tryopendata/openchart/commit/69e5dc1))
* direct labeling gaps — redundancy rule, series cutoff, both-ends labels (#91) ([eba8b90](https://github.com/tryopendata/openchart/commit/eba8b90))


### Bug Fixes

* address code review findings + release v7.8.0 ([d6bcd96](https://github.com/tryopendata/openchart/commit/d6bcd96))
* address code review findings ([f4a01b7](https://github.com/tryopendata/openchart/commit/f4a01b7))
* address code review — missing CSS rules, reentrance guard, caching ([a628717](https://github.com/tryopendata/openchart/commit/a628717))
* use CSS custom properties in static SVG style block for theme overridability ([fbca86c](https://github.com/tryopendata/openchart/commit/fbca86c))
* address code review findings for static rendering ([de6454a](https://github.com/tryopendata/openchart/commit/de6454a))
* editorial defaults audit — tabular-nums, domain line, scatter gridlines (#90) ([769e927](https://github.com/tryopendata/openchart/commit/769e927))

## [7.7.0](https://github.com/tryopendata/openchart/compare/core-v7.6.1...core-v7.7.0) (2026-07-09)


### Features

* add categorical color encoding support ([83f28d6](https://github.com/tryopendata/openchart/commit/83f28d6))
* SSR/static rendering — renderStaticSVG for server-side SVG generation ([4dd79f2](https://github.com/tryopendata/openchart/commit/4dd79f2))
* responsive auto-thinning for annotations and endpoint labels ([7ea2226](https://github.com/tryopendata/openchart/commit/7ea2226))
* theming design tokens — TokenValue, widened ThemeConfig, seriesStrategy, CSS custom props, presets (#94) ([316428c](https://github.com/tryopendata/openchart/commit/316428c))
* add encoding.facet for small-multiples / faceted charts (#93) ([fac6188](https://github.com/tryopendata/openchart/commit/fac6188))
* add encoding.color.highlight for editorial emphasis (#92) ([69e5dc1](https://github.com/tryopendata/openchart/commit/69e5dc1))
* direct labeling gaps — redundancy rule, series cutoff, both-ends labels (#91) ([eba8b90](https://github.com/tryopendata/openchart/commit/eba8b90))


### Bug Fixes

* address code review findings ([f4a01b7](https://github.com/tryopendata/openchart/commit/f4a01b7))
* address code review — missing CSS rules, reentrance guard, caching ([a628717](https://github.com/tryopendata/openchart/commit/a628717))
* use CSS custom properties in static SVG style block for theme overridability ([fbca86c](https://github.com/tryopendata/openchart/commit/fbca86c))
* address code review findings for static rendering ([de6454a](https://github.com/tryopendata/openchart/commit/de6454a))
* editorial defaults audit — tabular-nums, domain line, scatter gridlines (#90) ([769e927](https://github.com/tryopendata/openchart/commit/769e927))

## [7.6.1](https://github.com/tryopendata/openchart/compare/core-v7.6.0...core-v7.6.1) (2026-07-04)


### Bug Fixes

* compile leaf layers in the primary layout's chart area (#89) ([117d09f](https://github.com/tryopendata/openchart/commit/117d09f))

## [7.6.0](https://github.com/tryopendata/openchart/compare/core-v7.5.0...core-v7.6.0) (2026-07-04)


### Features

* add mark.trendline opt-out for scatter regression line (#88) ([6fe79ba](https://github.com/tryopendata/openchart/commit/6fe79ba))
* honor explicit domain and range on scatter bubble size scale (#87) ([718d53d](https://github.com/tryopendata/openchart/commit/718d53d))
* theme-driven metric font sizes and refline fontSize/fontWeight overrides (#82) ([3b6b46f](https://github.com/tryopendata/openchart/commit/3b6b46f))
* axis title offset, extendToEdges, hanging baseline, legend alignment (#81) ([5b9f7d2](https://github.com/tryopendata/openchart/commit/5b9f7d2))
* area chart mark.point support and point scale paddingOuter alias (#80) ([f66e160](https://github.com/tryopendata/openchart/commit/f66e160))
* theme typography controls, axis label suffix, and vivid palette (#79) ([71f3981](https://github.com/tryopendata/openchart/commit/71f3981))


### Bug Fixes

* drop phantom legend entry from rows missing the color field (#86) ([32bcd29](https://github.com/tryopendata/openchart/commit/32bcd29))
* iOS Safari text layout, font-load recompile, and mobile label collisions (#85) ([5143eb0](https://github.com/tryopendata/openchart/commit/5143eb0))
* horizontal bars overrun y-axis labels when x-domain excludes zero (#83) ([65dc8b1](https://github.com/tryopendata/openchart/commit/65dc8b1))


### Refactoring

* prod-ready cleanup for measure-then-freeze layout (#84) ([83dc7b4](https://github.com/tryopendata/openchart/commit/83dc7b4))

## [7.5.0](https://github.com/tryopendata/openchart/compare/core-v7.4.1...core-v7.5.0) (2026-07-04)


### Features

* honor explicit domain and range on scatter bubble size scale (#87) ([718d53d](https://github.com/tryopendata/openchart/commit/718d53d))

## [7.4.1](https://github.com/tryopendata/openchart/compare/core-v7.4.0...core-v7.4.1) (2026-07-04)


### Features

* theme-driven metric font sizes and refline fontSize/fontWeight overrides (#82) ([3b6b46f](https://github.com/tryopendata/openchart/commit/3b6b46f))
* axis title offset, extendToEdges, hanging baseline, legend alignment (#81) ([5b9f7d2](https://github.com/tryopendata/openchart/commit/5b9f7d2))
* area chart mark.point support and point scale paddingOuter alias (#80) ([f66e160](https://github.com/tryopendata/openchart/commit/f66e160))
* theme typography controls, axis label suffix, and vivid palette (#79) ([71f3981](https://github.com/tryopendata/openchart/commit/71f3981))


### Bug Fixes

* drop phantom legend entry from rows missing the color field (#86) ([32bcd29](https://github.com/tryopendata/openchart/commit/32bcd29))
* iOS Safari text layout, font-load recompile, and mobile label collisions (#85) ([5143eb0](https://github.com/tryopendata/openchart/commit/5143eb0))
* horizontal bars overrun y-axis labels when x-domain excludes zero (#83) ([65dc8b1](https://github.com/tryopendata/openchart/commit/65dc8b1))
* tighten chrome-to-legend gap and y-axis title clearance (#77) ([8d81359](https://github.com/tryopendata/openchart/commit/8d81359))
* align table footer source text and brand watermark on one line ([b5ffbba](https://github.com/tryopendata/openchart/commit/b5ffbba))
* preserve explicit chrome color overrides through dark-mode adaptation ([f555c85](https://github.com/tryopendata/openchart/commit/f555c85))


### Refactoring

* prod-ready cleanup for measure-then-freeze layout (#84) ([83dc7b4](https://github.com/tryopendata/openchart/commit/83dc7b4))

## [7.4.0](https://github.com/tryopendata/openchart/compare/core-v7.3.0...core-v7.4.0) (2026-07-04)


### Bug Fixes

* iOS Safari text layout, font-load recompile, and mobile label collisions (#85) ([5143eb0](https://github.com/tryopendata/openchart/commit/5143eb0))

## [7.3.0](https://github.com/tryopendata/openchart/compare/core-v7.2.4...core-v7.3.0) (2026-07-03)


### Features

* theme-driven metric font sizes and refline fontSize/fontWeight overrides (#82) ([3b6b46f](https://github.com/tryopendata/openchart/commit/3b6b46f))
* axis title offset, extendToEdges, hanging baseline, legend alignment (#81) ([5b9f7d2](https://github.com/tryopendata/openchart/commit/5b9f7d2))
* area chart mark.point support and point scale paddingOuter alias (#80) ([f66e160](https://github.com/tryopendata/openchart/commit/f66e160))
* theme typography controls, axis label suffix, and vivid palette (#79) ([71f3981](https://github.com/tryopendata/openchart/commit/71f3981))


### Bug Fixes

* horizontal bars overrun y-axis labels when x-domain excludes zero (#83) ([65dc8b1](https://github.com/tryopendata/openchart/commit/65dc8b1))
* tighten chrome-to-legend gap and y-axis title clearance (#77) ([8d81359](https://github.com/tryopendata/openchart/commit/8d81359))
* align table footer source text and brand watermark on one line ([b5ffbba](https://github.com/tryopendata/openchart/commit/b5ffbba))
* preserve explicit chrome color overrides through dark-mode adaptation ([f555c85](https://github.com/tryopendata/openchart/commit/f555c85))
* use perceptual luminance threshold for bar label color ([e6f750d](https://github.com/tryopendata/openchart/commit/e6f750d))
* inject percentage axis format when stack is normalize ([b16f076](https://github.com/tryopendata/openchart/commit/b16f076))
* replace legend chip+bar swatches with bare mark-appropriate shapes ([e517c6c](https://github.com/tryopendata/openchart/commit/e517c6c))


### Refactoring

* prod-ready cleanup for measure-then-freeze layout (#84) ([83dc7b4](https://github.com/tryopendata/openchart/commit/83dc7b4))

## [7.2.4](https://github.com/tryopendata/openchart/compare/core-v7.2.3...core-v7.2.4) (2026-06-30)


### Features

* theme-driven metric font sizes and refline fontSize/fontWeight overrides (#82) ([3b6b46f](https://github.com/tryopendata/openchart/commit/3b6b46f))
* axis title offset, extendToEdges, hanging baseline, legend alignment (#81) ([5b9f7d2](https://github.com/tryopendata/openchart/commit/5b9f7d2))
* area chart mark.point support and point scale paddingOuter alias (#80) ([f66e160](https://github.com/tryopendata/openchart/commit/f66e160))
* theme typography controls, axis label suffix, and vivid palette (#79) ([71f3981](https://github.com/tryopendata/openchart/commit/71f3981))


### Bug Fixes

* horizontal bars overrun y-axis labels when x-domain excludes zero (#83) ([65dc8b1](https://github.com/tryopendata/openchart/commit/65dc8b1))
* tighten chrome-to-legend gap and y-axis title clearance (#77) ([8d81359](https://github.com/tryopendata/openchart/commit/8d81359))
* align table footer source text and brand watermark on one line ([b5ffbba](https://github.com/tryopendata/openchart/commit/b5ffbba))
* preserve explicit chrome color overrides through dark-mode adaptation ([f555c85](https://github.com/tryopendata/openchart/commit/f555c85))
* use perceptual luminance threshold for bar label color ([e6f750d](https://github.com/tryopendata/openchart/commit/e6f750d))
* inject percentage axis format when stack is normalize ([b16f076](https://github.com/tryopendata/openchart/commit/b16f076))
* replace legend chip+bar swatches with bare mark-appropriate shapes ([e517c6c](https://github.com/tryopendata/openchart/commit/e517c6c))
* show all x-axis labels on grouped bar charts by resolving rotation before thinning ([31ea820](https://github.com/tryopendata/openchart/commit/31ea820))

## [7.2.3](https://github.com/tryopendata/openchart/compare/core-v7.2.2...core-v7.2.3) (2026-06-26)


### Features

* theme-driven metric font sizes and refline fontSize/fontWeight overrides (#82) ([3b6b46f](https://github.com/tryopendata/openchart/commit/3b6b46f))

## [7.2.2](https://github.com/tryopendata/openchart/compare/core-v7.2.1...core-v7.2.2) (2026-06-26)


### Features

* axis title offset, extendToEdges, hanging baseline, legend alignment (#81) ([5b9f7d2](https://github.com/tryopendata/openchart/commit/5b9f7d2))

## [7.2.1](https://github.com/tryopendata/openchart/compare/core-v7.2.0...core-v7.2.1) (2026-06-25)


### Features

* area chart mark.point support and point scale paddingOuter alias (#80) ([f66e160](https://github.com/tryopendata/openchart/commit/f66e160))

## [7.2.0](https://github.com/tryopendata/openchart/compare/core-v7.1.4...core-v7.2.0) (2026-06-22)


### Features

* theme typography controls, axis label suffix, and vivid palette (#79) ([71f3981](https://github.com/tryopendata/openchart/commit/71f3981))


### Bug Fixes

* tighten chrome-to-legend gap and y-axis title clearance (#77) ([8d81359](https://github.com/tryopendata/openchart/commit/8d81359))
* align table footer source text and brand watermark on one line ([b5ffbba](https://github.com/tryopendata/openchart/commit/b5ffbba))
* preserve explicit chrome color overrides through dark-mode adaptation ([f555c85](https://github.com/tryopendata/openchart/commit/f555c85))
* use perceptual luminance threshold for bar label color ([e6f750d](https://github.com/tryopendata/openchart/commit/e6f750d))
* inject percentage axis format when stack is normalize ([b16f076](https://github.com/tryopendata/openchart/commit/b16f076))
* replace legend chip+bar swatches with bare mark-appropriate shapes ([e517c6c](https://github.com/tryopendata/openchart/commit/e517c6c))
* show all x-axis labels on grouped bar charts by resolving rotation before thinning ([31ea820](https://github.com/tryopendata/openchart/commit/31ea820))
* align brand watermark top-edge with source text using hanging baseline (#75) ([fa0186b](https://github.com/tryopendata/openchart/commit/fa0186b))
* restore bottom margin padding, fixing bottom legend viewport overflow ([97c837e](https://github.com/tryopendata/openchart/commit/97c837e))
* endpoint marker sits at line terminus, visual regression baselines updated ([0d6fdf1](https://github.com/tryopendata/openchart/commit/0d6fdf1))
* address code review findings ([ca27cd6](https://github.com/tryopendata/openchart/commit/ca27cd6))
* footer dead space, transparent background (breaking), area gradients, font smoothing ([cf5f8b8](https://github.com/tryopendata/openchart/commit/cf5f8b8))
* column labels z-order, y-axis title overlap, and x-axis tick density ([e4d0139](https://github.com/tryopendata/openchart/commit/e4d0139))
* grouped bars as default, white labels on dark bars ([ea4949f](https://github.com/tryopendata/openchart/commit/ea4949f))

## [7.1.4](https://github.com/tryopendata/openchart/compare/core-v7.1.3...core-v7.1.4) (2026-06-03)


### Bug Fixes

* tighten chrome-to-legend gap and y-axis title clearance (#77) ([8d81359](https://github.com/tryopendata/openchart/commit/8d81359))
* align table footer source text and brand watermark on one line ([b5ffbba](https://github.com/tryopendata/openchart/commit/b5ffbba))
* preserve explicit chrome color overrides through dark-mode adaptation ([f555c85](https://github.com/tryopendata/openchart/commit/f555c85))
* use perceptual luminance threshold for bar label color ([e6f750d](https://github.com/tryopendata/openchart/commit/e6f750d))
* inject percentage axis format when stack is normalize ([b16f076](https://github.com/tryopendata/openchart/commit/b16f076))
* replace legend chip+bar swatches with bare mark-appropriate shapes ([e517c6c](https://github.com/tryopendata/openchart/commit/e517c6c))
* show all x-axis labels on grouped bar charts by resolving rotation before thinning ([31ea820](https://github.com/tryopendata/openchart/commit/31ea820))
* align brand watermark top-edge with source text using hanging baseline (#75) ([fa0186b](https://github.com/tryopendata/openchart/commit/fa0186b))
* restore bottom margin padding, fixing bottom legend viewport overflow ([97c837e](https://github.com/tryopendata/openchart/commit/97c837e))
* endpoint marker sits at line terminus, visual regression baselines updated ([0d6fdf1](https://github.com/tryopendata/openchart/commit/0d6fdf1))
* address code review findings ([ca27cd6](https://github.com/tryopendata/openchart/commit/ca27cd6))
* footer dead space, transparent background (breaking), area gradients, font smoothing ([cf5f8b8](https://github.com/tryopendata/openchart/commit/cf5f8b8))
* column labels z-order, y-axis title overlap, and x-axis tick density ([e4d0139](https://github.com/tryopendata/openchart/commit/e4d0139))
* grouped bars as default, white labels on dark bars ([ea4949f](https://github.com/tryopendata/openchart/commit/ea4949f))

## [7.1.3](https://github.com/tryopendata/openchart/compare/core-v7.1.2...core-v7.1.3) (2026-05-18)


### Bug Fixes

* replace legend chip+bar swatches with bare mark-appropriate shapes ([e517c6c](https://github.com/tryopendata/openchart/commit/e517c6c))
* show all x-axis labels on grouped bar charts by resolving rotation before thinning ([31ea820](https://github.com/tryopendata/openchart/commit/31ea820))
* align brand watermark top-edge with source text using hanging baseline (#75) ([fa0186b](https://github.com/tryopendata/openchart/commit/fa0186b))
* restore bottom margin padding, fixing bottom legend viewport overflow ([97c837e](https://github.com/tryopendata/openchart/commit/97c837e))
* endpoint marker sits at line terminus, visual regression baselines updated ([0d6fdf1](https://github.com/tryopendata/openchart/commit/0d6fdf1))
* address code review findings ([ca27cd6](https://github.com/tryopendata/openchart/commit/ca27cd6))
* footer dead space, transparent background (breaking), area gradients, font smoothing ([cf5f8b8](https://github.com/tryopendata/openchart/commit/cf5f8b8))
* column labels z-order, y-axis title overlap, and x-axis tick density ([e4d0139](https://github.com/tryopendata/openchart/commit/e4d0139))
* grouped bars as default, white labels on dark bars ([ea4949f](https://github.com/tryopendata/openchart/commit/ea4949f))
* correct legend area width, sparkline dot padding, and barlist auto-height ([ee3c35f](https://github.com/tryopendata/openchart/commit/ee3c35f))
* propagate endpointLabels on LayerSpec, dedupe area+line tooltip ([c8588ef](https://github.com/tryopendata/openchart/commit/c8588ef))
* transparent background, top-only corner rounding, thinner strokes ([b6bce4c](https://github.com/tryopendata/openchart/commit/b6bce4c))


### Refactoring

* extract interaction and layer modules from mega-files ([af471c6](https://github.com/tryopendata/openchart/commit/af471c6))

## [7.1.2](https://github.com/tryopendata/openchart/compare/core-v7.1.1...core-v7.1.2) (2026-05-12)


### Bug Fixes

* align brand watermark top-edge with source text using hanging baseline (#75) ([fa0186b](https://github.com/tryopendata/openchart/commit/fa0186b))

## [7.1.1](https://github.com/tryopendata/openchart/compare/core-v7.1.0...core-v7.1.1) (2026-05-11)


### Features

* trend-aware visual defaults and endpoint dot polish ([2f0e8ee](https://github.com/tryopendata/openchart/commit/2f0e8ee))
* generic ChartSpec<TData> with discriminated mark/encoding types ([404f588](https://github.com/tryopendata/openchart/commit/404f588))


### Bug Fixes

* restore bottom margin padding, fixing bottom legend viewport overflow ([97c837e](https://github.com/tryopendata/openchart/commit/97c837e))
* endpoint marker sits at line terminus, visual regression baselines updated ([0d6fdf1](https://github.com/tryopendata/openchart/commit/0d6fdf1))
* address code review findings ([ca27cd6](https://github.com/tryopendata/openchart/commit/ca27cd6))
* footer dead space, transparent background (breaking), area gradients, font smoothing ([cf5f8b8](https://github.com/tryopendata/openchart/commit/cf5f8b8))
* column labels z-order, y-axis title overlap, and x-axis tick density ([e4d0139](https://github.com/tryopendata/openchart/commit/e4d0139))
* grouped bars as default, white labels on dark bars ([ea4949f](https://github.com/tryopendata/openchart/commit/ea4949f))
* correct legend area width, sparkline dot padding, and barlist auto-height ([ee3c35f](https://github.com/tryopendata/openchart/commit/ee3c35f))
* propagate endpointLabels on LayerSpec, dedupe area+line tooltip ([c8588ef](https://github.com/tryopendata/openchart/commit/c8588ef))
* transparent background, top-only corner rounding, thinner strokes ([b6bce4c](https://github.com/tryopendata/openchart/commit/b6bce4c))
* address code-review must-fix items ([bd26e2e](https://github.com/tryopendata/openchart/commit/bd26e2e))
* address code review findings from generic ChartSpec PR ([50eb80c](https://github.com/tryopendata/openchart/commit/50eb80c))


### Refactoring

* extract interaction and layer modules from mega-files ([af471c6](https://github.com/tryopendata/openchart/commit/af471c6))

## [7.1.0](https://github.com/tryopendata/openchart/compare/core-v7.0.4...core-v7.1.0) (2026-05-11)


### Bug Fixes

* endpoint marker sits at line terminus, visual regression baselines updated ([0d6fdf1](https://github.com/tryopendata/openchart/commit/0d6fdf1))
* address code review findings ([ca27cd6](https://github.com/tryopendata/openchart/commit/ca27cd6))
* footer dead space, transparent background (breaking), area gradients, font smoothing ([cf5f8b8](https://github.com/tryopendata/openchart/commit/cf5f8b8))
* column labels z-order, y-axis title overlap, and x-axis tick density ([e4d0139](https://github.com/tryopendata/openchart/commit/e4d0139))

## [7.0.4](https://github.com/tryopendata/openchart/compare/core-v7.0.3...core-v7.0.4) (2026-05-11)


### Features

* trend-aware visual defaults and endpoint dot polish ([2f0e8ee](https://github.com/tryopendata/openchart/commit/2f0e8ee))
* generic ChartSpec<TData> with discriminated mark/encoding types ([404f588](https://github.com/tryopendata/openchart/commit/404f588))
* match traditional legend with chip+bar swatch ([43f755e](https://github.com/tryopendata/openchart/commit/43f755e))
* redesign swatch as rounded chip with colored bar ([2125455](https://github.com/tryopendata/openchart/commit/2125455))


### Bug Fixes

* grouped bars as default, white labels on dark bars ([ea4949f](https://github.com/tryopendata/openchart/commit/ea4949f))
* correct legend area width, sparkline dot padding, and barlist auto-height ([ee3c35f](https://github.com/tryopendata/openchart/commit/ee3c35f))
* propagate endpointLabels on LayerSpec, dedupe area+line tooltip ([c8588ef](https://github.com/tryopendata/openchart/commit/c8588ef))
* transparent background, top-only corner rounding, thinner strokes ([b6bce4c](https://github.com/tryopendata/openchart/commit/b6bce4c))
* address code-review must-fix items ([bd26e2e](https://github.com/tryopendata/openchart/commit/bd26e2e))
* rebalance scale, lock colors, suppress drift ([649d78a](https://github.com/tryopendata/openchart/commit/649d78a))
* address code review findings from generic ChartSpec PR ([50eb80c](https://github.com/tryopendata/openchart/commit/50eb80c))
* cap each pass in the sweep so tail clamp propagates ([1fc2ce0](https://github.com/tryopendata/openchart/commit/1fc2ce0))


### Refactoring

* extract interaction and layer modules from mega-files ([af471c6](https://github.com/tryopendata/openchart/commit/af471c6))
* apply review + devil's-advocate fixes ([4b0e506](https://github.com/tryopendata/openchart/commit/4b0e506))

## [7.0.3](https://github.com/tryopendata/openchart/compare/core-v7.0.2...core-v7.0.3) (2026-05-08)


### Features

* trend-aware visual defaults and endpoint dot polish ([2f0e8ee](https://github.com/tryopendata/openchart/commit/2f0e8ee))
* generic ChartSpec<TData> with discriminated mark/encoding types ([404f588](https://github.com/tryopendata/openchart/commit/404f588))
* match traditional legend with chip+bar swatch ([43f755e](https://github.com/tryopendata/openchart/commit/43f755e))
* redesign swatch as rounded chip with colored bar ([2125455](https://github.com/tryopendata/openchart/commit/2125455))


### Bug Fixes

* correct legend area width, sparkline dot padding, and barlist auto-height ([ee3c35f](https://github.com/tryopendata/openchart/commit/ee3c35f))
* propagate endpointLabels on LayerSpec, dedupe area+line tooltip ([c8588ef](https://github.com/tryopendata/openchart/commit/c8588ef))
* transparent background, top-only corner rounding, thinner strokes ([b6bce4c](https://github.com/tryopendata/openchart/commit/b6bce4c))
* address code-review must-fix items ([bd26e2e](https://github.com/tryopendata/openchart/commit/bd26e2e))
* rebalance scale, lock colors, suppress drift ([649d78a](https://github.com/tryopendata/openchart/commit/649d78a))
* address code review findings from generic ChartSpec PR ([50eb80c](https://github.com/tryopendata/openchart/commit/50eb80c))
* cap each pass in the sweep so tail clamp propagates ([1fc2ce0](https://github.com/tryopendata/openchart/commit/1fc2ce0))
* align marker with line endpoint, drop leader by default ([664288d](https://github.com/tryopendata/openchart/commit/664288d))
* enable crosshair on line/area charts with point marks ([0b0afe4](https://github.com/tryopendata/openchart/commit/0b0afe4))


### Refactoring

* extract interaction and layer modules from mega-files ([af471c6](https://github.com/tryopendata/openchart/commit/af471c6))
* apply review + devil's-advocate fixes ([4b0e506](https://github.com/tryopendata/openchart/commit/4b0e506))

## [7.0.2](https://github.com/tryopendata/openchart/compare/core-v7.0.1...core-v7.0.2) (2026-05-07)


### Features

* trend-aware visual defaults and endpoint dot polish ([2f0e8ee](https://github.com/tryopendata/openchart/commit/2f0e8ee))
* generic ChartSpec<TData> with discriminated mark/encoding types ([404f588](https://github.com/tryopendata/openchart/commit/404f588))
* match traditional legend with chip+bar swatch ([43f755e](https://github.com/tryopendata/openchart/commit/43f755e))
* redesign swatch as rounded chip with colored bar ([2125455](https://github.com/tryopendata/openchart/commit/2125455))


### Bug Fixes

* correct legend area width, sparkline dot padding, and barlist auto-height ([ee3c35f](https://github.com/tryopendata/openchart/commit/ee3c35f))
* propagate endpointLabels on LayerSpec, dedupe area+line tooltip ([c8588ef](https://github.com/tryopendata/openchart/commit/c8588ef))
* transparent background, top-only corner rounding, thinner strokes ([b6bce4c](https://github.com/tryopendata/openchart/commit/b6bce4c))
* address code-review must-fix items ([bd26e2e](https://github.com/tryopendata/openchart/commit/bd26e2e))
* rebalance scale, lock colors, suppress drift ([649d78a](https://github.com/tryopendata/openchart/commit/649d78a))
* address code review findings from generic ChartSpec PR ([50eb80c](https://github.com/tryopendata/openchart/commit/50eb80c))
* cap each pass in the sweep so tail clamp propagates ([1fc2ce0](https://github.com/tryopendata/openchart/commit/1fc2ce0))
* align marker with line endpoint, drop leader by default ([664288d](https://github.com/tryopendata/openchart/commit/664288d))
* enable crosshair on line/area charts with point marks ([0b0afe4](https://github.com/tryopendata/openchart/commit/0b0afe4))
* track lines instead of uniform stacking ([62c3195](https://github.com/tryopendata/openchart/commit/62c3195))


### Refactoring

* extract interaction and layer modules from mega-files ([af471c6](https://github.com/tryopendata/openchart/commit/af471c6))
* apply review + devil's-advocate fixes ([4b0e506](https://github.com/tryopendata/openchart/commit/4b0e506))

## [7.0.1](https://github.com/tryopendata/openchart/compare/core-v7.0.0...core-v7.0.1) (2026-05-07)


### Features

* trend-aware visual defaults and endpoint dot polish ([2f0e8ee](https://github.com/tryopendata/openchart/commit/2f0e8ee))
* generic ChartSpec<TData> with discriminated mark/encoding types ([404f588](https://github.com/tryopendata/openchart/commit/404f588))
* match traditional legend with chip+bar swatch ([43f755e](https://github.com/tryopendata/openchart/commit/43f755e))
* redesign swatch as rounded chip with colored bar ([2125455](https://github.com/tryopendata/openchart/commit/2125455))
* editorial chrome + metric bar + dark-mode palette pinning ([77c9fa9](https://github.com/tryopendata/openchart/commit/77c9fa9))
* render endpoint labels, annotation dots/subtitles, refreshed swatch ([1cec902](https://github.com/tryopendata/openchart/commit/1cec902))
* endpoint labels + legend suppression truth table ([daf52a6](https://github.com/tryopendata/openchart/commit/daf52a6))
* add dot + subtitle fields to TextAnnotation ([6ccf70f](https://github.com/tryopendata/openchart/commit/6ccf70f))
* multi-series area defaults to overlap; gradient fills everywhere ([4f31e23](https://github.com/tryopendata/openchart/commit/4f31e23))


### Bug Fixes

* propagate endpointLabels on LayerSpec, dedupe area+line tooltip ([c8588ef](https://github.com/tryopendata/openchart/commit/c8588ef))
* transparent background, top-only corner rounding, thinner strokes ([b6bce4c](https://github.com/tryopendata/openchart/commit/b6bce4c))
* address code-review must-fix items ([bd26e2e](https://github.com/tryopendata/openchart/commit/bd26e2e))
* rebalance scale, lock colors, suppress drift ([649d78a](https://github.com/tryopendata/openchart/commit/649d78a))
* address code review findings from generic ChartSpec PR ([50eb80c](https://github.com/tryopendata/openchart/commit/50eb80c))
* cap each pass in the sweep so tail clamp propagates ([1fc2ce0](https://github.com/tryopendata/openchart/commit/1fc2ce0))
* align marker with line endpoint, drop leader by default ([664288d](https://github.com/tryopendata/openchart/commit/664288d))
* enable crosshair on line/area charts with point marks ([0b0afe4](https://github.com/tryopendata/openchart/commit/0b0afe4))
* track lines instead of uniform stacking ([62c3195](https://github.com/tryopendata/openchart/commit/62c3195))
* push bottom chrome below bottom legend ([414a0c7](https://github.com/tryopendata/openchart/commit/414a0c7))
* three defects found in visual QA of area redesign ([85ae03e](https://github.com/tryopendata/openchart/commit/85ae03e))


### Refactoring

* extract interaction and layer modules from mega-files ([af471c6](https://github.com/tryopendata/openchart/commit/af471c6))
* apply review + devil's-advocate fixes ([4b0e506](https://github.com/tryopendata/openchart/commit/4b0e506))

## [7.0.0](https://github.com/tryopendata/openchart/compare/core-v6.28.6...core-v7.0.0) (2026-05-06)


### Features

* trend-aware visual defaults and endpoint dot polish ([2f0e8ee](https://github.com/tryopendata/openchart/commit/2f0e8ee))
* generic ChartSpec<TData> with discriminated mark/encoding types ([404f588](https://github.com/tryopendata/openchart/commit/404f588))
* match traditional legend with chip+bar swatch ([43f755e](https://github.com/tryopendata/openchart/commit/43f755e))
* redesign swatch as rounded chip with colored bar ([2125455](https://github.com/tryopendata/openchart/commit/2125455))
* editorial chrome + metric bar + dark-mode palette pinning ([77c9fa9](https://github.com/tryopendata/openchart/commit/77c9fa9))
* render endpoint labels, annotation dots/subtitles, refreshed swatch ([1cec902](https://github.com/tryopendata/openchart/commit/1cec902))
* endpoint labels + legend suppression truth table ([daf52a6](https://github.com/tryopendata/openchart/commit/daf52a6))
* add dot + subtitle fields to TextAnnotation ([6ccf70f](https://github.com/tryopendata/openchart/commit/6ccf70f))
* multi-series area defaults to overlap; gradient fills everywhere ([4f31e23](https://github.com/tryopendata/openchart/commit/4f31e23))


### Bug Fixes

* transparent background, top-only corner rounding, thinner strokes ([b6bce4c](https://github.com/tryopendata/openchart/commit/b6bce4c))
* address code-review must-fix items ([bd26e2e](https://github.com/tryopendata/openchart/commit/bd26e2e))
* rebalance scale, lock colors, suppress drift ([649d78a](https://github.com/tryopendata/openchart/commit/649d78a))
* address code review findings from generic ChartSpec PR ([50eb80c](https://github.com/tryopendata/openchart/commit/50eb80c))
* cap each pass in the sweep so tail clamp propagates ([1fc2ce0](https://github.com/tryopendata/openchart/commit/1fc2ce0))
* align marker with line endpoint, drop leader by default ([664288d](https://github.com/tryopendata/openchart/commit/664288d))
* enable crosshair on line/area charts with point marks ([0b0afe4](https://github.com/tryopendata/openchart/commit/0b0afe4))
* track lines instead of uniform stacking ([62c3195](https://github.com/tryopendata/openchart/commit/62c3195))
* push bottom chrome below bottom legend ([414a0c7](https://github.com/tryopendata/openchart/commit/414a0c7))
* three defects found in visual QA of area redesign ([85ae03e](https://github.com/tryopendata/openchart/commit/85ae03e))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* extract interaction and layer modules from mega-files ([af471c6](https://github.com/tryopendata/openchart/commit/af471c6))
* apply review + devil's-advocate fixes ([4b0e506](https://github.com/tryopendata/openchart/commit/4b0e506))

## [6.28.6](https://github.com/tryopendata/openchart/compare/core-v6.28.5...core-v6.28.6) (2026-05-05)


### Features

* add BarList chart type and engine/mark improvements ([2fc0d23](https://github.com/tryopendata/openchart/commit/2fc0d23))
* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))


### Bug Fixes

* skip dark mode adaptation for custom palette arrays ([9edc166](https://github.com/tryopendata/openchart/commit/9edc166))
* remove incorrect dark mode stop reversal ([87cf0c5](https://github.com/tryopendata/openchart/commit/87cf0c5))
* update tilemap test expectations for tight content height ([4f20a3a](https://github.com/tryopendata/openchart/commit/4f20a3a))
* preserve heatmap luminance ordering in dark mode ([93cbfa9](https://github.com/tryopendata/openchart/commit/93cbfa9))
* honor markDef.strokeWidth in line compute ([a82f48e](https://github.com/tryopendata/openchart/commit/a82f48e))
* log scale tick filtering, range annotation extent on point scales ([d6e98ee](https://github.com/tryopendata/openchart/commit/d6e98ee))

## [6.28.5](https://github.com/tryopendata/openchart/compare/core-v6.28.4...core-v6.28.5) (2026-05-05)


### Features

* add BarList chart type and engine/mark improvements ([2fc0d23](https://github.com/tryopendata/openchart/commit/2fc0d23))
* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))
* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))


### Bug Fixes

* remove incorrect dark mode stop reversal ([87cf0c5](https://github.com/tryopendata/openchart/commit/87cf0c5))
* update tilemap test expectations for tight content height ([4f20a3a](https://github.com/tryopendata/openchart/commit/4f20a3a))
* preserve heatmap luminance ordering in dark mode ([93cbfa9](https://github.com/tryopendata/openchart/commit/93cbfa9))
* honor markDef.strokeWidth in line compute ([a82f48e](https://github.com/tryopendata/openchart/commit/a82f48e))
* log scale tick filtering, range annotation extent on point scales ([d6e98ee](https://github.com/tryopendata/openchart/commit/d6e98ee))

## [6.28.4](https://github.com/tryopendata/openchart/compare/core-v6.28.3...core-v6.28.4) (2026-05-05)


### Features

* add BarList chart type and engine/mark improvements ([2fc0d23](https://github.com/tryopendata/openchart/commit/2fc0d23))
* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))
* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))
* add US state tile grid map visualization ([1157043](https://github.com/tryopendata/openchart/commit/1157043))


### Bug Fixes

* update tilemap test expectations for tight content height ([4f20a3a](https://github.com/tryopendata/openchart/commit/4f20a3a))
* preserve heatmap luminance ordering in dark mode ([93cbfa9](https://github.com/tryopendata/openchart/commit/93cbfa9))
* honor markDef.strokeWidth in line compute ([a82f48e](https://github.com/tryopendata/openchart/commit/a82f48e))
* log scale tick filtering, range annotation extent on point scales ([d6e98ee](https://github.com/tryopendata/openchart/commit/d6e98ee))
* address code review findings ([1359887](https://github.com/tryopendata/openchart/commit/1359887))

## [6.28.3](https://github.com/tryopendata/openchart/compare/core-v6.28.2...core-v6.28.3) (2026-05-05)


### Features

* add BarList chart type and engine/mark improvements ([2fc0d23](https://github.com/tryopendata/openchart/commit/2fc0d23))
* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))
* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))
* add US state tile grid map visualization ([1157043](https://github.com/tryopendata/openchart/commit/1157043))
* add boolean shorthand for labels spec ([8eb0a87](https://github.com/tryopendata/openchart/commit/8eb0a87))


### Bug Fixes

* preserve heatmap luminance ordering in dark mode ([93cbfa9](https://github.com/tryopendata/openchart/commit/93cbfa9))
* honor markDef.strokeWidth in line compute ([a82f48e](https://github.com/tryopendata/openchart/commit/a82f48e))
* log scale tick filtering, range annotation extent on point scales ([d6e98ee](https://github.com/tryopendata/openchart/commit/d6e98ee))
* address code review findings ([1359887](https://github.com/tryopendata/openchart/commit/1359887))

## [6.28.2](https://github.com/tryopendata/openchart/compare/core-v6.28.1...core-v6.28.2) (2026-05-02)


### Features

* add BarList chart type and engine/mark improvements ([2fc0d23](https://github.com/tryopendata/openchart/commit/2fc0d23))
* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))
* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))
* add US state tile grid map visualization ([1157043](https://github.com/tryopendata/openchart/commit/1157043))
* add boolean shorthand for labels spec ([8eb0a87](https://github.com/tryopendata/openchart/commit/8eb0a87))


### Bug Fixes

* honor markDef.strokeWidth in line compute ([a82f48e](https://github.com/tryopendata/openchart/commit/a82f48e))
* log scale tick filtering, range annotation extent on point scales ([d6e98ee](https://github.com/tryopendata/openchart/commit/d6e98ee))
* address code review findings ([1359887](https://github.com/tryopendata/openchart/commit/1359887))
* restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning ([66c2be3](https://github.com/tryopendata/openchart/commit/66c2be3))

## [6.28.1](https://github.com/tryopendata/openchart/compare/core-v6.28.0...core-v6.28.1) (2026-05-02)


### Features

* add BarList chart type and engine/mark improvements ([2fc0d23](https://github.com/tryopendata/openchart/commit/2fc0d23))
* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))
* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))
* add US state tile grid map visualization ([1157043](https://github.com/tryopendata/openchart/commit/1157043))
* add boolean shorthand for labels spec ([8eb0a87](https://github.com/tryopendata/openchart/commit/8eb0a87))


### Bug Fixes

* honor markDef.strokeWidth in line compute ([a82f48e](https://github.com/tryopendata/openchart/commit/a82f48e))
* log scale tick filtering, range annotation extent on point scales ([d6e98ee](https://github.com/tryopendata/openchart/commit/d6e98ee))
* address code review findings ([1359887](https://github.com/tryopendata/openchart/commit/1359887))
* restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning ([66c2be3](https://github.com/tryopendata/openchart/commit/66c2be3))

## [6.28.0](https://github.com/tryopendata/openchart/compare/core-v6.27.2...core-v6.28.0) (2026-05-02)


### Features

* add BarList chart type and engine/mark improvements ([2fc0d23](https://github.com/tryopendata/openchart/commit/2fc0d23))
* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))
* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))
* add US state tile grid map visualization ([1157043](https://github.com/tryopendata/openchart/commit/1157043))
* add boolean shorthand for labels spec ([8eb0a87](https://github.com/tryopendata/openchart/commit/8eb0a87))
* add zIndex to ChartSpec for controlling layer render order ([1febd38](https://github.com/tryopendata/openchart/commit/1febd38))


### Bug Fixes

* honor markDef.strokeWidth in line compute ([a82f48e](https://github.com/tryopendata/openchart/commit/a82f48e))
* log scale tick filtering, range annotation extent on point scales ([d6e98ee](https://github.com/tryopendata/openchart/commit/d6e98ee))
* address code review findings ([1359887](https://github.com/tryopendata/openchart/commit/1359887))
* restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning ([66c2be3](https://github.com/tryopendata/openchart/commit/66c2be3))

## [6.27.2](https://github.com/tryopendata/openchart/compare/core-v6.27.1...core-v6.27.2) (2026-05-01)


### Features

* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))
* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))
* add US state tile grid map visualization ([1157043](https://github.com/tryopendata/openchart/commit/1157043))
* add boolean shorthand for labels spec ([8eb0a87](https://github.com/tryopendata/openchart/commit/8eb0a87))
* add zIndex to ChartSpec for controlling layer render order ([1febd38](https://github.com/tryopendata/openchart/commit/1febd38))
* centralize responsive layout metrics and fix mobile chart alignment ([265bf95](https://github.com/tryopendata/openchart/commit/265bf95))
* dual-axis combo charts with independent y-scales ([70cf379](https://github.com/tryopendata/openchart/commit/70cf379))


### Bug Fixes

* log scale tick filtering, range annotation extent on point scales ([d6e98ee](https://github.com/tryopendata/openchart/commit/d6e98ee))
* address code review findings ([1359887](https://github.com/tryopendata/openchart/commit/1359887))
* restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning ([66c2be3](https://github.com/tryopendata/openchart/commit/66c2be3))

## [6.27.1](https://github.com/tryopendata/openchart/compare/core-v6.27.0...core-v6.27.1) (2026-05-01)


### Features

* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))
* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))
* add US state tile grid map visualization ([1157043](https://github.com/tryopendata/openchart/commit/1157043))
* add boolean shorthand for labels spec ([8eb0a87](https://github.com/tryopendata/openchart/commit/8eb0a87))
* add zIndex to ChartSpec for controlling layer render order ([1febd38](https://github.com/tryopendata/openchart/commit/1febd38))
* centralize responsive layout metrics and fix mobile chart alignment ([265bf95](https://github.com/tryopendata/openchart/commit/265bf95))
* dual-axis combo charts with independent y-scales ([70cf379](https://github.com/tryopendata/openchart/commit/70cf379))


### Bug Fixes

* log scale tick filtering, range annotation extent on point scales ([d6e98ee](https://github.com/tryopendata/openchart/commit/d6e98ee))
* address code review findings ([1359887](https://github.com/tryopendata/openchart/commit/1359887))
* restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning ([66c2be3](https://github.com/tryopendata/openchart/commit/66c2be3))

## [6.27.0](https://github.com/tryopendata/openchart/compare/core-v6.26.0...core-v6.27.0) (2026-04-29)


### Features

* add display: 'sparkline' mode for inline mini-charts ([455c4cd](https://github.com/tryopendata/openchart/commit/455c4cd))
* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))
* add US state tile grid map visualization ([1157043](https://github.com/tryopendata/openchart/commit/1157043))
* add boolean shorthand for labels spec ([8eb0a87](https://github.com/tryopendata/openchart/commit/8eb0a87))
* add zIndex to ChartSpec for controlling layer render order ([1febd38](https://github.com/tryopendata/openchart/commit/1febd38))
* centralize responsive layout metrics and fix mobile chart alignment ([265bf95](https://github.com/tryopendata/openchart/commit/265bf95))
* dual-axis combo charts with independent y-scales ([70cf379](https://github.com/tryopendata/openchart/commit/70cf379))
* add halo prop to text annotations ([8269c3c](https://github.com/tryopendata/openchart/commit/8269c3c))
* area y2 bands, annotation responsiveness, bar label improvements ([e31736b](https://github.com/tryopendata/openchart/commit/e31736b))


### Bug Fixes

* address code review findings ([1359887](https://github.com/tryopendata/openchart/commit/1359887))
* restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning ([66c2be3](https://github.com/tryopendata/openchart/commit/66c2be3))

## [6.26.0](https://github.com/tryopendata/openchart/compare/core-v6.25.4...core-v6.26.0) (2026-04-29)


### Features

* polish animations, fix grid layout, and backfill CHANGELOG ([0a728b4](https://github.com/tryopendata/openchart/commit/0a728b4))
* add window transform, relative-time filter, crosshair, and compound axis labels ([4056362](https://github.com/tryopendata/openchart/commit/4056362))
* add US state tile grid map visualization ([1157043](https://github.com/tryopendata/openchart/commit/1157043))
* add boolean shorthand for labels spec ([8eb0a87](https://github.com/tryopendata/openchart/commit/8eb0a87))
* add zIndex to ChartSpec for controlling layer render order ([1febd38](https://github.com/tryopendata/openchart/commit/1febd38))
* centralize responsive layout metrics and fix mobile chart alignment ([265bf95](https://github.com/tryopendata/openchart/commit/265bf95))
* dual-axis combo charts with independent y-scales ([70cf379](https://github.com/tryopendata/openchart/commit/70cf379))
* add halo prop to text annotations ([8269c3c](https://github.com/tryopendata/openchart/commit/8269c3c))
* area y2 bands, annotation responsiveness, bar label improvements ([e31736b](https://github.com/tryopendata/openchart/commit/e31736b))
* responsive layout improvements for narrow viewports ([666792b](https://github.com/tryopendata/openchart/commit/666792b))


### Bug Fixes

* address code review findings ([1359887](https://github.com/tryopendata/openchart/commit/1359887))
* restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning ([66c2be3](https://github.com/tryopendata/openchart/commit/66c2be3))

## [6.25.4](https://github.com/tryopendata/openchart/compare/core-v6.25.3...core-v6.25.4) (2026-04-24)


### Features

* add boolean shorthand for labels spec ([8eb0a87](https://github.com/tryopendata/openchart/commit/8eb0a87))
* add zIndex to ChartSpec for controlling layer render order ([1febd38](https://github.com/tryopendata/openchart/commit/1febd38))
* centralize responsive layout metrics and fix mobile chart alignment ([265bf95](https://github.com/tryopendata/openchart/commit/265bf95))
* dual-axis combo charts with independent y-scales ([70cf379](https://github.com/tryopendata/openchart/commit/70cf379))
* add halo prop to text annotations ([8269c3c](https://github.com/tryopendata/openchart/commit/8269c3c))
* area y2 bands, annotation responsiveness, bar label improvements ([e31736b](https://github.com/tryopendata/openchart/commit/e31736b))
* responsive layout improvements for narrow viewports ([666792b](https://github.com/tryopendata/openchart/commit/666792b))


### Bug Fixes

* restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning ([66c2be3](https://github.com/tryopendata/openchart/commit/66c2be3))
* thread measureText through sankey pipeline for accurate text wrapping ([9fa3624](https://github.com/tryopendata/openchart/commit/9fa3624))
* declare builtin.ts as side-effectful to prevent tree-shaking ([848ce1d](https://github.com/tryopendata/openchart/commit/848ce1d))

## [6.25.3](https://github.com/tryopendata/openchart/compare/core-v6.25.2...core-v6.25.3) (2026-04-24)


### Features

* add zIndex to ChartSpec for controlling layer render order ([1febd38](https://github.com/tryopendata/openchart/commit/1febd38))
* centralize responsive layout metrics and fix mobile chart alignment ([265bf95](https://github.com/tryopendata/openchart/commit/265bf95))
* dual-axis combo charts with independent y-scales ([70cf379](https://github.com/tryopendata/openchart/commit/70cf379))
* add halo prop to text annotations ([8269c3c](https://github.com/tryopendata/openchart/commit/8269c3c))
* area y2 bands, annotation responsiveness, bar label improvements ([e31736b](https://github.com/tryopendata/openchart/commit/e31736b))
* responsive layout improvements for narrow viewports ([666792b](https://github.com/tryopendata/openchart/commit/666792b))


### Bug Fixes

* restore all y-axis labels on horizontal bar charts and improve x-axis band label thinning ([66c2be3](https://github.com/tryopendata/openchart/commit/66c2be3))
* thread measureText through sankey pipeline for accurate text wrapping ([9fa3624](https://github.com/tryopendata/openchart/commit/9fa3624))
* declare builtin.ts as side-effectful to prevent tree-shaking ([848ce1d](https://github.com/tryopendata/openchart/commit/848ce1d))
* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))

## [6.25.2](https://github.com/tryopendata/openchart/compare/core-v6.25.1...core-v6.25.2) (2026-04-23)


### Features

* add zIndex to ChartSpec for controlling layer render order ([1febd38](https://github.com/tryopendata/openchart/commit/1febd38))
* centralize responsive layout metrics and fix mobile chart alignment ([265bf95](https://github.com/tryopendata/openchart/commit/265bf95))
* dual-axis combo charts with independent y-scales ([70cf379](https://github.com/tryopendata/openchart/commit/70cf379))
* add halo prop to text annotations ([8269c3c](https://github.com/tryopendata/openchart/commit/8269c3c))
* area y2 bands, annotation responsiveness, bar label improvements ([e31736b](https://github.com/tryopendata/openchart/commit/e31736b))
* responsive layout improvements for narrow viewports ([666792b](https://github.com/tryopendata/openchart/commit/666792b))


### Bug Fixes

* thread measureText through sankey pipeline for accurate text wrapping ([9fa3624](https://github.com/tryopendata/openchart/commit/9fa3624))
* declare builtin.ts as side-effectful to prevent tree-shaking ([848ce1d](https://github.com/tryopendata/openchart/commit/848ce1d))
* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))

## [6.25.1](https://github.com/tryopendata/openchart/compare/core-v6.25.0...core-v6.25.1) (2026-04-23)


### Features

* centralize responsive layout metrics and fix mobile chart alignment ([265bf95](https://github.com/tryopendata/openchart/commit/265bf95))
* dual-axis combo charts with independent y-scales ([70cf379](https://github.com/tryopendata/openchart/commit/70cf379))
* add halo prop to text annotations ([8269c3c](https://github.com/tryopendata/openchart/commit/8269c3c))
* area y2 bands, annotation responsiveness, bar label improvements ([e31736b](https://github.com/tryopendata/openchart/commit/e31736b))
* responsive layout improvements for narrow viewports ([666792b](https://github.com/tryopendata/openchart/commit/666792b))


### Bug Fixes

* thread measureText through sankey pipeline for accurate text wrapping ([9fa3624](https://github.com/tryopendata/openchart/commit/9fa3624))
* declare builtin.ts as side-effectful to prevent tree-shaking ([848ce1d](https://github.com/tryopendata/openchart/commit/848ce1d))
* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))

## [6.25.0](https://github.com/tryopendata/openchart/compare/core-v6.24.2...core-v6.25.0) (2026-04-22)


### Features

* dual-axis combo charts with independent y-scales ([70cf379](https://github.com/tryopendata/openchart/commit/70cf379))
* add halo prop to text annotations ([8269c3c](https://github.com/tryopendata/openchart/commit/8269c3c))
* area y2 bands, annotation responsiveness, bar label improvements ([e31736b](https://github.com/tryopendata/openchart/commit/e31736b))
* responsive layout improvements for narrow viewports ([666792b](https://github.com/tryopendata/openchart/commit/666792b))


### Bug Fixes

* thread measureText through sankey pipeline for accurate text wrapping ([9fa3624](https://github.com/tryopendata/openchart/commit/9fa3624))
* declare builtin.ts as side-effectful to prevent tree-shaking ([848ce1d](https://github.com/tryopendata/openchart/commit/848ce1d))
* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.24.2](https://github.com/tryopendata/openchart/compare/core-v6.24.1...core-v6.24.2) (2026-04-22)


### Features

* add halo prop to text annotations ([8269c3c](https://github.com/tryopendata/openchart/commit/8269c3c))
* area y2 bands, annotation responsiveness, bar label improvements ([e31736b](https://github.com/tryopendata/openchart/commit/e31736b))
* responsive layout improvements for narrow viewports ([666792b](https://github.com/tryopendata/openchart/commit/666792b))


### Bug Fixes

* thread measureText through sankey pipeline for accurate text wrapping ([9fa3624](https://github.com/tryopendata/openchart/commit/9fa3624))
* declare builtin.ts as side-effectful to prevent tree-shaking ([848ce1d](https://github.com/tryopendata/openchart/commit/848ce1d))
* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))
* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.24.1](https://github.com/tryopendata/openchart/compare/core-v6.24.0...core-v6.24.1) (2026-04-22)


### Features

* area y2 bands, annotation responsiveness, bar label improvements ([e31736b](https://github.com/tryopendata/openchart/commit/e31736b))
* responsive layout improvements for narrow viewports ([666792b](https://github.com/tryopendata/openchart/commit/666792b))


### Bug Fixes

* thread measureText through sankey pipeline for accurate text wrapping ([9fa3624](https://github.com/tryopendata/openchart/commit/9fa3624))
* declare builtin.ts as side-effectful to prevent tree-shaking ([848ce1d](https://github.com/tryopendata/openchart/commit/848ce1d))
* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))
* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.24.0](https://github.com/tryopendata/openchart/compare/core-v6.23.1...core-v6.24.0) (2026-04-19)


### Features

* responsive layout improvements for narrow viewports ([666792b](https://github.com/tryopendata/openchart/commit/666792b))


### Bug Fixes

* thread measureText through sankey pipeline for accurate text wrapping ([9fa3624](https://github.com/tryopendata/openchart/commit/9fa3624))
* declare builtin.ts as side-effectful to prevent tree-shaking ([848ce1d](https://github.com/tryopendata/openchart/commit/848ce1d))
* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))
* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.23.1](https://github.com/tryopendata/openchart/compare/core-v6.23.0...core-v6.23.1) (2026-04-14)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))


### Bug Fixes

* declare builtin.ts as side-effectful to prevent tree-shaking ([848ce1d](https://github.com/tryopendata/openchart/commit/848ce1d))
* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))
* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.23.0](https://github.com/tryopendata/openchart/compare/core-v6.22.0...core-v6.23.0) (2026-04-14)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))


### Bug Fixes

* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))
* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.22.0](https://github.com/tryopendata/openchart/compare/core-v6.21.0...core-v6.22.0) (2026-04-14)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))


### Bug Fixes

* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))
* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.21.0](https://github.com/tryopendata/openchart/compare/core-v6.22.0...core-v6.21.0) (2026-04-14)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))


### Bug Fixes

* strip temporal axes from snapshot to fix macOS/Linux divergence ([8610b2e](https://github.com/tryopendata/openchart/commit/8610b2e))
* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))
* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.22.0](https://github.com/tryopendata/openchart/compare/core-v6.21.0...core-v6.22.0) (2026-04-14)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))


### Bug Fixes

* make compile-snapshot test platform-independent ([5497bfa](https://github.com/tryopendata/openchart/commit/5497bfa))
* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))
* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))
* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.21.0](https://github.com/tryopendata/openchart/compare/core-v6.20.0...core-v6.21.0) (2026-04-14)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))


### Bug Fixes

* fix continuous axis tick collapse using step-down re-request ([d47bdac](https://github.com/tryopendata/openchart/commit/d47bdac))
* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))
* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))
* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review must-fix items for v7-cohesion-pt2 ([20d8a46](https://github.com/tryopendata/openchart/commit/20d8a46))
* split axes.ts into ticks and thinning modules ([965ef89](https://github.com/tryopendata/openchart/commit/965ef89))
* extract renderMarks into renderers/marks.ts ([a4dc5de](https://github.com/tryopendata/openchart/commit/a4dc5de))
* extract renderAxes into renderers/axes.ts ([93ceb2b](https://github.com/tryopendata/openchart/commit/93ceb2b))
* extract renderAnnotations into renderers/annotations.ts ([6e4c2db](https://github.com/tryopendata/openchart/commit/6e4c2db))
* extract renderLegend into renderers/legend.ts ([c60be4c](https://github.com/tryopendata/openchart/commit/c60be4c))
* extract renderChrome into renderers/chrome.ts ([b81ee09](https://github.com/tryopendata/openchart/commit/b81ee09))
* extract renderBrand into renderers/brand.ts ([3b59d20](https://github.com/tryopendata/openchart/commit/3b59d20))
* extract svg-dom helpers from svg-renderer ([ab63110](https://github.com/tryopendata/openchart/commit/ab63110))
* extract pure helpers from compile.ts into compile/ subfolder ([ae62c7f](https://github.com/tryopendata/openchart/commit/ae62c7f))
* extract density filter from bar/column/dot/pie labels ([60f9a04](https://github.com/tryopendata/openchart/commit/60f9a04))
* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.20.0](https://github.com/tryopendata/openchart/compare/core-v6.19.3...core-v6.20.0) (2026-04-13)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))


### Bug Fixes

* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))
* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))
* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))
* replace release-please with manual release script, graph viewport improvements, and annotation text halos ([0aaa073](https://github.com/tryopendata/openchart/commit/0aaa073))


### BREAKING CHANGES

* **area**: Multi-series area charts now default to `overlap` mode instead of `stacked`. Existing area charts with multiple series will render as overlapping translucent fills with gradient shading. To restore the previous behavior, set `mark: { type: 'area', stack: true }` explicitly.

### Refactoring

* address code review cleanups from v7-cohesion review ([1096bd8](https://github.com/tryopendata/openchart/commit/1096bd8))
* unify gradient and clip-path ID generation via nextSvgId ([f029171](https://github.com/tryopendata/openchart/commit/f029171))
* remove vestigial 100ms resize delay, align chart and sankey mount timing ([303175a](https://github.com/tryopendata/openchart/commit/303175a))
* extract measureLegendWrap helper for legend and sankey ([ec8cf11](https://github.com/tryopendata/openchart/commit/ec8cf11))
* extract wrapText helper from vanilla renderers ([bb0c870](https://github.com/tryopendata/openchart/commit/bb0c870))
* extract formatLabelValue shared helper for bar/column/dot ([8e908cb](https://github.com/tryopendata/openchart/commit/8e908cb))

## [6.19.3](https://github.com/tryopendata/openchart/compare/core-v6.19.2...core-v6.19.3) (2026-04-11)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))


### Bug Fixes

* use vertical overlap detection for y-axis tick thinning ([a953932](https://github.com/tryopendata/openchart/commit/a953932))
* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))
* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))
* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))
* replace release-please with manual release script, graph viewport improvements, and annotation text halos ([0aaa073](https://github.com/tryopendata/openchart/commit/0aaa073))
* consolidate table stories, add gradient fills, and fix temporal scale defaults ([5a7dbf4](https://github.com/tryopendata/openchart/commit/5a7dbf4))
* scale domain, sort defaults, stacked area lines, and tooltip series fields ([e159233](https://github.com/tryopendata/openchart/commit/e159233))

## [6.19.2](https://github.com/tryopendata/openchart/compare/core-v6.19.1...core-v6.19.2) (2026-04-10)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))


### Bug Fixes

* add 5px safety buffer to chrome maxWidth to prevent title overflow on mobile ([6143e73](https://github.com/tryopendata/openchart/commit/6143e73))
* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))
* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))
* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))
* replace release-please with manual release script, graph viewport improvements, and annotation text halos ([0aaa073](https://github.com/tryopendata/openchart/commit/0aaa073))
* consolidate table stories, add gradient fills, and fix temporal scale defaults ([5a7dbf4](https://github.com/tryopendata/openchart/commit/5a7dbf4))
* scale domain, sort defaults, stacked area lines, and tooltip series fields ([e159233](https://github.com/tryopendata/openchart/commit/e159233))
* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f))

## [6.19.1](https://github.com/tryopendata/openchart/compare/core-v6.19.0...core-v6.19.1) (2026-04-10)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))


### Bug Fixes

* text width ratio, brand reserve, top legend spacing, and breakpoint annotations ([e7b98f9](https://github.com/tryopendata/openchart/commit/e7b98f9))
* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))
* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))
* replace release-please with manual release script, graph viewport improvements, and annotation text halos ([0aaa073](https://github.com/tryopendata/openchart/commit/0aaa073))
* consolidate table stories, add gradient fills, and fix temporal scale defaults ([5a7dbf4](https://github.com/tryopendata/openchart/commit/5a7dbf4))
* scale domain, sort defaults, stacked area lines, and tooltip series fields ([e159233](https://github.com/tryopendata/openchart/commit/e159233))
* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f))
* negative value bar handling ([475b088](https://github.com/tryopendata/openchart/commit/475b088))
* add ${version} to group PR title pattern ([712affc](https://github.com/tryopendata/openchart/commit/712affc))

## [6.19.0](https://github.com/tryopendata/openchart/compare/core-v6.18.0...core-v6.19.0) (2026-04-10)


### Features

* add maxWidth-based text wrapping for sankey node labels ([824c446](https://github.com/tryopendata/openchart/commit/824c446))
* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))


### Bug Fixes

* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))
* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))
* replace release-please with manual release script, graph viewport improvements, and annotation text halos ([0aaa073](https://github.com/tryopendata/openchart/commit/0aaa073))
* consolidate table stories, add gradient fills, and fix temporal scale defaults ([5a7dbf4](https://github.com/tryopendata/openchart/commit/5a7dbf4))
* scale domain, sort defaults, stacked area lines, and tooltip series fields ([e159233](https://github.com/tryopendata/openchart/commit/e159233))
* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f))
* negative value bar handling ([475b088](https://github.com/tryopendata/openchart/commit/475b088))
* add ${version} to group PR title pattern ([712affc](https://github.com/tryopendata/openchart/commit/712affc))

## [6.18.0](https://github.com/tryopendata/openchart/compare/core-v6.17.0...core-v6.18.0) (2026-04-10)


### Features

* add nodeSort prop for explicit sankey node ordering ([dc02127](https://github.com/tryopendata/openchart/commit/dc02127))
* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))
* refactor annotations and compile into focused modules ([91c6f6a](https://github.com/tryopendata/openchart/commit/91c6f6a))


### Bug Fixes

* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))
* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))
* replace release-please with manual release script, graph viewport improvements, and annotation text halos ([0aaa073](https://github.com/tryopendata/openchart/commit/0aaa073))
* consolidate table stories, add gradient fills, and fix temporal scale defaults ([5a7dbf4](https://github.com/tryopendata/openchart/commit/5a7dbf4))
* scale domain, sort defaults, stacked area lines, and tooltip series fields ([e159233](https://github.com/tryopendata/openchart/commit/e159233))
* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f))
* negative value bar handling ([475b088](https://github.com/tryopendata/openchart/commit/475b088))
* add ${version} to group PR title pattern ([712affc](https://github.com/tryopendata/openchart/commit/712affc))

## [6.17.0](https://github.com/tryopendata/openchart/compare/core-v6.16.0...core-v6.17.0) (2026-04-10)


### Features

* selective categoryColors, legend auto-suppression, tick defaults, and docs ([64595bf](https://github.com/tryopendata/openchart/commit/64595bf))
* refactor annotations and compile into focused modules ([91c6f6a](https://github.com/tryopendata/openchart/commit/91c6f6a))
* Vega-Lite spec alignment and release readiness (#64) ([586a113](https://github.com/tryopendata/openchart/commit/586a113))


### Bug Fixes

* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))
* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))
* replace release-please with manual release script, graph viewport improvements, and annotation text halos ([0aaa073](https://github.com/tryopendata/openchart/commit/0aaa073))
* consolidate table stories, add gradient fills, and fix temporal scale defaults ([5a7dbf4](https://github.com/tryopendata/openchart/commit/5a7dbf4))
* scale domain, sort defaults, stacked area lines, and tooltip series fields ([e159233](https://github.com/tryopendata/openchart/commit/e159233))
* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f))
* negative value bar handling ([475b088](https://github.com/tryopendata/openchart/commit/475b088))
* add ${version} to group PR title pattern ([712affc](https://github.com/tryopendata/openchart/commit/712affc))

## [6.16.0](https://github.com/tryopendata/openchart/compare/core-v6.15.1...core-v6.16.0) (2026-04-10)


### Features

* refactor annotations and compile into focused modules ([91c6f6a](https://github.com/tryopendata/openchart/commit/91c6f6a))
* Vega-Lite spec alignment and release readiness (#64) ([586a113](https://github.com/tryopendata/openchart/commit/586a113))
* add configurable watermark opt-out ([03519e1](https://github.com/tryopendata/openchart/commit/03519e1))


### Bug Fixes

* explicit color ranges, loose filter equality, gradient ID collisions, and dark mode category colors ([73ef048](https://github.com/tryopendata/openchart/commit/73ef048))
* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))
* replace release-please with manual release script, graph viewport improvements, and annotation text halos ([0aaa073](https://github.com/tryopendata/openchart/commit/0aaa073))
* consolidate table stories, add gradient fills, and fix temporal scale defaults ([5a7dbf4](https://github.com/tryopendata/openchart/commit/5a7dbf4))
* scale domain, sort defaults, stacked area lines, and tooltip series fields ([e159233](https://github.com/tryopendata/openchart/commit/e159233))
* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f))
* negative value bar handling ([475b088](https://github.com/tryopendata/openchart/commit/475b088))
* add ${version} to group PR title pattern ([712affc](https://github.com/tryopendata/openchart/commit/712affc))

## [6.15.1](https://github.com/tryopendata/openchart/compare/core-v6.15.0...core-v6.15.1) (2026-04-07)


### Bug Fixes

* auto-orient gradients for horizontal bars and improve validation suggestion ([14a02f9](https://github.com/tryopendata/openchart/commit/14a02f9))
* create release tags via GitHub API for verified signatures ([cee901f](https://github.com/tryopendata/openchart/commit/cee901f))

## [6.15.0](https://github.com/tryopendata/openchart/compare/core-v6.14.0...core-v6.15.0) (2026-04-07)


### Features

* refactor annotations and compile into focused modules ([91c6f6a](https://github.com/tryopendata/openchart/commit/91c6f6a))
* Vega-Lite spec alignment and release readiness (#64) ([586a113](https://github.com/tryopendata/openchart/commit/586a113))
* add configurable watermark opt-out ([03519e1](https://github.com/tryopendata/openchart/commit/03519e1))
* add gradient fill support for chart marks (#60) ([fee85b2](https://github.com/tryopendata/openchart/commit/fee85b2))
* add grouped/dodged bar and column charts via stack encoding ([860b499](https://github.com/tryopendata/openchart/commit/860b499))


### Bug Fixes

* replace release-please with manual release script, graph viewport improvements, and annotation text halos ([0aaa073](https://github.com/tryopendata/openchart/commit/0aaa073))
* consolidate table stories, add gradient fills, and fix temporal scale defaults ([5a7dbf4](https://github.com/tryopendata/openchart/commit/5a7dbf4))
* scale domain, sort defaults, stacked area lines, and tooltip series fields ([e159233](https://github.com/tryopendata/openchart/commit/e159233))
* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f))
* negative value bar handling ([475b088](https://github.com/tryopendata/openchart/commit/475b088))
* add ${version} to group PR title pattern ([712affc](https://github.com/tryopendata/openchart/commit/712affc))

## [6.14.0](https://github.com/tryopendata/openchart/compare/core-v6.13.1...core-v6.14.0) (2026-04-07)


### Features

* refactor annotations and compile into focused modules ([91c6f6a](https://github.com/tryopendata/openchart/commit/91c6f6a))
* Vega-Lite spec alignment and release readiness (#64) ([586a113](https://github.com/tryopendata/openchart/commit/586a113))
* add configurable watermark opt-out ([03519e1](https://github.com/tryopendata/openchart/commit/03519e1))
* add gradient fill support for chart marks (#60) ([fee85b2](https://github.com/tryopendata/openchart/commit/fee85b2))
* add grouped/dodged bar and column charts via stack encoding ([860b499](https://github.com/tryopendata/openchart/commit/860b499))
* sankey label positions spec ([77c1af8](https://github.com/tryopendata/openchart/commit/77c1af8))


### Bug Fixes

* consolidate table stories, add gradient fills, and fix temporal scale defaults ([5a7dbf4](https://github.com/tryopendata/openchart/commit/5a7dbf4))
* scale domain, sort defaults, stacked area lines, and tooltip series fields ([e159233](https://github.com/tryopendata/openchart/commit/e159233))
* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f))
* negative value bar handling ([475b088](https://github.com/tryopendata/openchart/commit/475b088))
* add ${version} to group PR title pattern ([712affc](https://github.com/tryopendata/openchart/commit/712affc))

## [6.13.1](https://github.com/tryopendata/openchart/compare/react-v6.13.0...react-v6.13.1) (2026-04-06)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.13.1
    * @opendata-ai/openchart-engine bumped to 6.13.1
    * @opendata-ai/openchart-vanilla bumped to 6.13.1

## [6.13.0](https://github.com/tryopendata/openchart/compare/react-v6.12.0...react-v6.13.0) (2026-04-05)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.13.0
    * @opendata-ai/openchart-engine bumped to 6.13.0
    * @opendata-ai/openchart-vanilla bumped to 6.13.0

## [6.12.0](https://github.com/tryopendata/openchart/compare/react-v6.11.0...react-v6.12.0) (2026-04-05)


### Features

* add configurable watermark opt-out ([03519e1](https://github.com/tryopendata/openchart/commit/03519e116097c8103783314898a3d5c2a49cc3ac))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.12.0
    * @opendata-ai/openchart-engine bumped to 6.12.0
    * @opendata-ai/openchart-vanilla bumped to 6.12.0

## [6.11.0](https://github.com/tryopendata/openchart/compare/react-v6.10.0...react-v6.11.0) (2026-04-02)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.11.0
    * @opendata-ai/openchart-engine bumped to 6.11.0
    * @opendata-ai/openchart-vanilla bumped to 6.11.0

## [6.10.0](https://github.com/tryopendata/openchart/compare/react-v6.9.0...react-v6.10.0) (2026-04-01)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.10.0
    * @opendata-ai/openchart-engine bumped to 6.10.0
    * @opendata-ai/openchart-vanilla bumped to 6.10.0

## [6.9.0](https://github.com/tryopendata/openchart/compare/react-v6.8.0...react-v6.9.0) (2026-04-01)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.9.0
    * @opendata-ai/openchart-engine bumped to 6.9.0
    * @opendata-ai/openchart-vanilla bumped to 6.9.0

## [6.8.0](https://github.com/tryopendata/openchart/compare/react-v6.7.1...react-v6.8.0) (2026-03-31)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.8.0
    * @opendata-ai/openchart-engine bumped to 6.8.0
    * @opendata-ai/openchart-vanilla bumped to 6.8.0

## [6.7.1](https://github.com/tryopendata/openchart/compare/react-v6.7.0...react-v6.7.1) (2026-03-30)


### Documentation

* add gentle OpenData references as a data source ([a25d8a7](https://github.com/tryopendata/openchart/commit/a25d8a76922278f166d3c00706095f0831190c99))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.7.1
    * @opendata-ai/openchart-engine bumped to 6.7.1
    * @opendata-ai/openchart-vanilla bumped to 6.7.1

## [6.7.0](https://github.com/tryopendata/openchart/compare/react-v6.6.0...react-v6.7.0) (2026-03-30)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.7.0
    * @opendata-ai/openchart-engine bumped to 6.7.0
    * @opendata-ai/openchart-vanilla bumped to 6.7.0

## [6.6.0](https://github.com/tryopendata/openchart/compare/react-v6.5.2...react-v6.6.0) (2026-03-29)


### Features

* add sankey diagram visualization type ([#52](https://github.com/tryopendata/openchart/issues/52)) ([816ce8a](https://github.com/tryopendata/openchart/commit/816ce8a55b2a1902facc1c4d1ae5d8e7261148aa))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.6.0
    * @opendata-ai/openchart-engine bumped to 6.6.0
    * @opendata-ai/openchart-vanilla bumped to 6.6.0

## [6.5.2](https://github.com/tryopendata/openchart/compare/react-v6.5.1...react-v6.5.2) (2026-03-26)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.5.2
    * @opendata-ai/openchart-engine bumped to 6.5.2
    * @opendata-ai/openchart-vanilla bumped to 6.5.2

## [6.5.1](https://github.com/tryopendata/openchart/compare/react-v6.5.0...react-v6.5.1) (2026-03-26)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.5.1
    * @opendata-ai/openchart-engine bumped to 6.5.1
    * @opendata-ai/openchart-vanilla bumped to 6.5.1

## [6.5.0](https://github.com/tryopendata/openchart/compare/react-v6.4.1...react-v6.5.0) (2026-03-26)


### Features

* add CSS entrance animations and modularize styles ([dff701a](https://github.com/tryopendata/openchart/commit/dff701a073e2ac2f3f591be606064a5e9a771fb8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.5.0
    * @opendata-ai/openchart-engine bumped to 6.5.0
    * @opendata-ai/openchart-vanilla bumped to 6.5.0

## [6.4.1](https://github.com/tryopendata/openchart/compare/react-v6.4.0...react-v6.4.1) (2026-03-26)


### Bug Fixes

* move ignoreDeprecations to package tsconfigs ([bba54e9](https://github.com/tryopendata/openchart/commit/bba54e9f32e71cce26e34e2ccc29db5cde2df611))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.4.1
    * @opendata-ai/openchart-engine bumped to 6.4.1
    * @opendata-ai/openchart-vanilla bumped to 6.4.1

## [6.4.0](https://github.com/tryopendata/openchart/compare/react-v6.3.0...react-v6.4.0) (2026-03-26)


### Features

* add rich chart editing with selection, deletion, and inline text editing ([25d44f4](https://github.com/tryopendata/openchart/commit/25d44f4f7f747eba36cb31980f294fe1bf992b86))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.4.0
    * @opendata-ai/openchart-engine bumped to 6.4.0
    * @opendata-ai/openchart-vanilla bumped to 6.4.0

## [6.3.0](https://github.com/tryopendata/openchart/compare/react-v6.2.1...react-v6.3.0) (2026-03-26)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.3.0
    * @opendata-ai/openchart-engine bumped to 6.3.0
    * @opendata-ai/openchart-vanilla bumped to 6.3.0

## [6.2.1](https://github.com/tryopendata/openchart/compare/react-v6.2.0...react-v6.2.1) (2026-03-23)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.2.1
    * @opendata-ai/openchart-engine bumped to 6.2.1
    * @opendata-ai/openchart-vanilla bumped to 6.2.1

## [6.2.0](https://github.com/tryopendata/openchart/compare/react-v6.1.5...react-v6.2.0) (2026-03-23)


### Features

* **graph:** add scale config to graph encoding channels and fix color precedence ([a52efce](https://github.com/tryopendata/openchart/commit/a52efceea6e0750ad53e42ad6084e9b75ce4e27b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.2.0
    * @opendata-ai/openchart-engine bumped to 6.2.0
    * @opendata-ai/openchart-vanilla bumped to 6.2.0

## [6.1.5](https://github.com/tryopendata/openchart/compare/react-v6.1.4...react-v6.1.5) (2026-03-23)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.5
    * @opendata-ai/openchart-engine bumped to 6.1.5
    * @opendata-ai/openchart-vanilla bumped to 6.1.5

## [6.1.4](https://github.com/tryopendata/openchart/compare/react-v6.1.3...react-v6.1.4) (2026-03-23)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.4
    * @opendata-ai/openchart-engine bumped to 6.1.4
    * @opendata-ai/openchart-vanilla bumped to 6.1.4

## [6.1.3](https://github.com/tryopendata/openchart/compare/react-v6.1.2...react-v6.1.3) (2026-03-23)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.3
    * @opendata-ai/openchart-engine bumped to 6.1.3
    * @opendata-ai/openchart-vanilla bumped to 6.1.3

## [6.1.2](https://github.com/tryopendata/openchart/compare/react-v6.1.1...react-v6.1.2) (2026-03-23)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.2
    * @opendata-ai/openchart-engine bumped to 6.1.2
    * @opendata-ai/openchart-vanilla bumped to 6.1.2

## [6.1.1](https://github.com/tryopendata/openchart/compare/react-v6.1.0...react-v6.1.1) (2026-03-22)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.1
    * @opendata-ai/openchart-engine bumped to 6.1.1
    * @opendata-ai/openchart-vanilla bumped to 6.1.1

## [6.0.0](https://github.com/tryopendata/openchart/compare/react-v5.0.0...react-v6.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export core and engine dependencies from client libs, so only single dependencies are needed for consumers ([7ae2e41](https://github.com/tryopendata/openchart/commit/7ae2e41d0e75c2c4895130846758b28d72cc17c2))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Bug Fixes

* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.0.0
    * @opendata-ai/openchart-engine bumped to 6.0.0
    * @opendata-ai/openchart-vanilla bumped to 6.0.0

## [5.0.0](https://github.com/tryopendata/openchart/compare/react-v4.0.0...react-v5.0.0) (2026-03-21)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 5.0.0
    * @opendata-ai/openchart-engine bumped to 5.0.0
    * @opendata-ai/openchart-vanilla bumped to 5.0.0

## [4.0.0](https://github.com/tryopendata/openchart/compare/react-v3.0.0...react-v4.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export core and engine dependencies from client libs, so only single dependencies are needed for consumers ([7ae2e41](https://github.com/tryopendata/openchart/commit/7ae2e41d0e75c2c4895130846758b28d72cc17c2))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Bug Fixes

* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 4.0.0
    * @opendata-ai/openchart-engine bumped to 4.0.0
    * @opendata-ai/openchart-vanilla bumped to 4.0.0

## [3.0.0](https://github.com/tryopendata/openchart/compare/react-v2.13.2...react-v3.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export core and engine dependencies from client libs, so only single dependencies are needed for consumers ([7ae2e41](https://github.com/tryopendata/openchart/commit/7ae2e41d0e75c2c4895130846758b28d72cc17c2))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Bug Fixes

* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 3.0.0
    * @opendata-ai/openchart-engine bumped to 3.0.0
    * @opendata-ai/openchart-vanilla bumped to 3.0.0

## [2.13.2](https://github.com/tryopendata/openchart/compare/react-v2.13.1...react-v2.13.2) (2026-03-21)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.13.2
    * @opendata-ai/openchart-engine bumped to 2.13.2
    * @opendata-ai/openchart-vanilla bumped to 2.13.2

## [2.13.1](https://github.com/tryopendata/openchart/compare/react-v2.13.0...react-v2.13.1) (2026-03-21)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.13.1
    * @opendata-ai/openchart-engine bumped to 2.13.1
    * @opendata-ai/openchart-vanilla bumped to 2.13.1

## [2.13.0](https://github.com/tryopendata/openchart/compare/react-v2.12.2...react-v2.13.0) (2026-03-21)


### Features

* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.13.0
    * @opendata-ai/openchart-engine bumped to 2.13.0
    * @opendata-ai/openchart-vanilla bumped to 2.13.0

## [2.12.2](https://github.com/tryopendata/openchart/compare/react-v2.12.1...react-v2.12.2) (2026-03-20)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.2
    * @opendata-ai/openchart-engine bumped to 2.12.2
    * @opendata-ai/openchart-vanilla bumped to 2.12.2

## [2.12.1](https://github.com/tryopendata/openchart/compare/react-v2.12.0...react-v2.12.1) (2026-03-18)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.1
    * @opendata-ai/openchart-engine bumped to 2.12.1
    * @opendata-ai/openchart-vanilla bumped to 2.12.1

## [2.12.0](https://github.com/tryopendata/openchart/compare/react-v2.11.0...react-v2.12.0) (2026-03-18)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.0
    * @opendata-ai/openchart-engine bumped to 2.12.0
    * @opendata-ai/openchart-vanilla bumped to 2.12.0

## [2.11.0](https://github.com/tryopendata/openchart/compare/react-v2.10.0...react-v2.11.0) (2026-03-14)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.11.0
    * @opendata-ai/openchart-engine bumped to 2.11.0
    * @opendata-ai/openchart-vanilla bumped to 2.11.0

## [2.10.0](https://github.com/tryopendata/openchart/compare/react-v2.9.1...react-v2.10.0) (2026-03-12)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.10.0
    * @opendata-ai/openchart-engine bumped to 2.10.0
    * @opendata-ai/openchart-vanilla bumped to 2.10.0

## [2.9.1](https://github.com/tryopendata/openchart/compare/react-v2.9.0...react-v2.9.1) (2026-03-12)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.9.1
    * @opendata-ai/openchart-engine bumped to 2.9.1
    * @opendata-ai/openchart-vanilla bumped to 2.9.1

## [2.9.0](https://github.com/tryopendata/openchart/compare/react-v2.8.1...react-v2.9.0) (2026-03-12)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.9.0
    * @opendata-ai/openchart-engine bumped to 2.9.0
    * @opendata-ai/openchart-vanilla bumped to 2.9.0

## [2.8.1](https://github.com/tryopendata/openchart/compare/react-v2.8.0...react-v2.8.1) (2026-03-12)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.8.1
    * @opendata-ai/openchart-engine bumped to 2.8.1
    * @opendata-ai/openchart-vanilla bumped to 2.8.1

## [2.8.0](https://github.com/tryopendata/openchart/compare/react-v2.7.0...react-v2.8.0) (2026-03-09)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.8.0
    * @opendata-ai/openchart-engine bumped to 2.8.0
    * @opendata-ai/openchart-vanilla bumped to 2.8.0

## [2.7.0](https://github.com/tryopendata/openchart/compare/react-v2.6.0...react-v2.7.0) (2026-03-09)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.7.0
    * @opendata-ai/openchart-engine bumped to 2.7.0
    * @opendata-ai/openchart-vanilla bumped to 2.7.0

## [2.6.0](https://github.com/tryopendata/openchart/compare/react-v2.5.0...react-v2.6.0) (2026-03-09)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.6.0
    * @opendata-ai/openchart-engine bumped to 2.6.0
    * @opendata-ai/openchart-vanilla bumped to 2.6.0

## [2.5.0](https://github.com/tryopendata/openchart/compare/react-v2.4.0...react-v2.5.0) (2026-03-09)


### Features

* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.5.0
    * @opendata-ai/openchart-engine bumped to 2.5.0
    * @opendata-ai/openchart-vanilla bumped to 2.5.0

## [2.4.0](https://github.com/tryopendata/openchart/compare/react-v2.3.5...react-v2.4.0) (2026-03-08)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.4.0
    * @opendata-ai/openchart-engine bumped to 2.4.0
    * @opendata-ai/openchart-vanilla bumped to 2.4.0

## [2.3.5](https://github.com/tryopendata/openchart/compare/react-v2.3.4...react-v2.3.5) (2026-03-06)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.5
    * @opendata-ai/openchart-engine bumped to 2.3.5
    * @opendata-ai/openchart-vanilla bumped to 2.3.5

## [2.3.4](https://github.com/tryopendata/openchart/compare/react-v2.3.3...react-v2.3.4) (2026-03-06)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.4
    * @opendata-ai/openchart-engine bumped to 2.3.4
    * @opendata-ai/openchart-vanilla bumped to 2.3.4

## [2.3.3](https://github.com/tryopendata/openchart/compare/react-v2.3.2...react-v2.3.3) (2026-03-06)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.3
    * @opendata-ai/openchart-engine bumped to 2.3.3
    * @opendata-ai/openchart-vanilla bumped to 2.3.3

## [2.3.2](https://github.com/tryopendata/openchart/compare/react-v2.3.1...react-v2.3.2) (2026-03-06)


* **react:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.2
    * @opendata-ai/openchart-engine bumped to 2.3.2
    * @opendata-ai/openchart-vanilla bumped to 2.3.2

## [2.3.1](https://github.com/tryopendata/openchart/compare/v2.3.0...v2.3.1) (2026-03-06)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-vanilla bumped to 2.3.1

## [2.3.0](https://github.com/tryopendata/openchart/compare/v2.2.1...v2.3.0) (2026-03-06)

### Features

* export core and engine dependencies from client libs so consumers only need a single dependency ([7ae2e41](https://github.com/tryopendata/openchart/commit/7ae2e41))

## [2.2.1](https://github.com/tryopendata/openchart/compare/v2.2.0...v2.2.1) (2026-03-06)

### Bug Fixes

* preserve user-provided colors when theme is already dark ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc))
* support transparent backgrounds in dark-mode adapter ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc))
* add tooltip and legend toggle props to Graph components ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc))
* reduce max node radius, label font sizes, and glow intensity ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc))

## [2.1.0](https://github.com/tryopendata/openchart/compare/v2.0.0...v2.1.0) (2026-03-04)

### Features

* visual QA audit fixes and documentation improvements ([5b77092](https://github.com/tryopendata/openchart/commit/5b77092))
* auto-sort line and area chart data by x-axis ([186b81f](https://github.com/tryopendata/openchart/commit/186b81f))

### Bug Fixes

* make publish workflow idempotent for re-runs ([1e5cb43](https://github.com/tryopendata/openchart/commit/1e5cb43))

## [2.0.0](https://github.com/tryopendata/openchart/compare/v1.1.0...v2.0.0) (2026-03-03)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.0.0
    * @opendata-ai/openchart-engine bumped to 1.2.0
    * @opendata-ai/openchart-vanilla bumped to 2.0.0

## [1.1.0](https://github.com/tryopendata/openchart/compare/v1.0.0...v1.1.0) (2026-03-02)


### Features

* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 1.1.0
    * @opendata-ai/openchart-engine bumped to 1.1.0
    * @opendata-ai/openchart-vanilla bumped to 1.1.0
