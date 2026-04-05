# Changelog

## [7.0.0](https://github.com/tryopendata/openchart/compare/core-v6.12.0...core-v7.0.0) (2026-04-05)


### ⚠ BREAKING CHANGES

* Removed deprecated axis properties 'label' (use 'title') and 'tickAngle' (use 'labelAngle') from AxisConfig.

### Features

* Vega-Lite spec alignment and release readiness ([#64](https://github.com/tryopendata/openchart/issues/64)) ([aefcb1f](https://github.com/tryopendata/openchart/commit/aefcb1f53ab4cfc47f5a8c35368c10f9b005d02c))

## [6.12.0](https://github.com/tryopendata/openchart/compare/core-v6.11.0...core-v6.12.0) (2026-04-05)


### Features

* add configurable watermark opt-out ([03519e1](https://github.com/tryopendata/openchart/commit/03519e116097c8103783314898a3d5c2a49cc3ac))

## [6.11.0](https://github.com/tryopendata/openchart/compare/core-v6.10.0...core-v6.11.0) (2026-04-02)


### Features

* add gradient fill support for chart marks ([#60](https://github.com/tryopendata/openchart/issues/60)) ([fee85b2](https://github.com/tryopendata/openchart/commit/fee85b2ce756e07188a3d4461a224dc395cff0f8))

## [6.10.0](https://github.com/tryopendata/openchart/compare/core-v6.9.0...core-v6.10.0) (2026-04-01)


### Features

* add grouped/dodged bar and column charts via stack encoding ([860b499](https://github.com/tryopendata/openchart/commit/860b499fbd85484fe781238bbd29cfe0f76d7e7c))

## [6.9.0](https://github.com/tryopendata/openchart/compare/core-v6.8.0...core-v6.9.0) (2026-04-01)


### Features

* sankey label positions spec ([77c1af8](https://github.com/tryopendata/openchart/commit/77c1af86ed50db6a8a9a27b7280fd89ea8973937))

## [6.8.0](https://github.com/tryopendata/openchart/compare/core-v6.7.1...core-v6.8.0) (2026-03-31)


### Features

* **sankey:** add linkOpacity spec option for user control ([6732603](https://github.com/tryopendata/openchart/commit/673260311be8269101e53012b5652dd4ed4e1b2e))
* **sankey:** add valueFormat for tooltip and ARIA label formatting ([e90da0f](https://github.com/tryopendata/openchart/commit/e90da0f3fd637cf71eb52b730d37b67afb272c3c))


### Bug Fixes

* address 6 editorial feedback issues ([96b14f2](https://github.com/tryopendata/openchart/commit/96b14f2dd67dd1af63c6fd93cdeb08383b4fa602))
* **sankey:** address code review findings ([33e4774](https://github.com/tryopendata/openchart/commit/33e4774328abd2daa5d5e925f9d52c91025a48fa))

## [6.7.1](https://github.com/tryopendata/openchart/compare/core-v6.7.0...core-v6.7.1) (2026-03-30)


### Documentation

* add gentle OpenData references as a data source ([a25d8a7](https://github.com/tryopendata/openchart/commit/a25d8a76922278f166d3c00706095f0831190c99))

## [6.7.0](https://github.com/tryopendata/openchart/compare/core-v6.6.0...core-v6.7.0) (2026-03-30)


### Features

* add label prefix option and update brand watermark to tryOpenData.ai ([91e5d47](https://github.com/tryopendata/openchart/commit/91e5d4757e2d22a6ee4dabb54774e7061ce7c6c3))

## [6.6.0](https://github.com/tryopendata/openchart/compare/core-v6.5.2...core-v6.6.0) (2026-03-29)


### Features

* add sankey diagram visualization type ([#52](https://github.com/tryopendata/openchart/issues/52)) ([816ce8a](https://github.com/tryopendata/openchart/commit/816ce8a55b2a1902facc1c4d1ae5d8e7261148aa))


### Bug Fixes

* sankey link rendering, animation, watermark, and legend layout ([b60b2b5](https://github.com/tryopendata/openchart/commit/b60b2b575cab7a4095013dc987a9bf45047a6d8e))

## [6.5.2](https://github.com/tryopendata/openchart/compare/core-v6.5.1...core-v6.5.2) (2026-03-26)


### Bug Fixes

* skip annotation margin at compact breakpoints, remove caret connector, improve animation resize handling ([632e541](https://github.com/tryopendata/openchart/commit/632e541d7d681c0737c955256001ec0100aa10e5))

## [6.5.1](https://github.com/tryopendata/openchart/compare/core-v6.5.0...core-v6.5.1) (2026-03-26)


### Bug Fixes

* correct AnimationStagger.delay default in JSDoc (30 -&gt; 80) ([9a11aed](https://github.com/tryopendata/openchart/commit/9a11aed9dbac314ae3e926f2ba6f1eb1cf17269c))

## [6.5.0](https://github.com/tryopendata/openchart/compare/core-v6.4.1...core-v6.5.0) (2026-03-26)


### Features

* add CSS entrance animations and modularize styles ([dff701a](https://github.com/tryopendata/openchart/commit/dff701a073e2ac2f3f591be606064a5e9a771fb8))

## [6.4.1](https://github.com/tryopendata/openchart/compare/core-v6.4.0...core-v6.4.1) (2026-03-26)


### Bug Fixes

* move ignoreDeprecations to package tsconfigs ([bba54e9](https://github.com/tryopendata/openchart/commit/bba54e9f32e71cce26e34e2ccc29db5cde2df611))

## [6.4.0](https://github.com/tryopendata/openchart/compare/core-v6.3.0...core-v6.4.0) (2026-03-26)


### Features

* add rich chart editing with selection, deletion, and inline text editing ([25d44f4](https://github.com/tryopendata/openchart/commit/25d44f4f7f747eba36cb31980f294fe1bf992b86))

## [6.3.0](https://github.com/tryopendata/openchart/compare/core-v6.2.1...core-v6.3.0) (2026-03-26)


### Features

* address all FEATURE-REQUESTS.md bugs and feature requests ([771358b](https://github.com/tryopendata/openchart/commit/771358b8ea76d2842a8124ce220f24c3a39455e7))

## [6.2.1](https://github.com/tryopendata/openchart/compare/core-v6.2.0...core-v6.2.1) (2026-03-23)


### Bug Fixes

* match temporal tick formatting to scale timezone ([13bc19e](https://github.com/tryopendata/openchart/commit/13bc19ebd1c4cf741634119c102b1d2804291885))

## [6.2.0](https://github.com/tryopendata/openchart/compare/core-v6.1.5...core-v6.2.0) (2026-03-23)


### Features

* **graph:** add scale config to graph encoding channels and fix color precedence ([a52efce](https://github.com/tryopendata/openchart/commit/a52efceea6e0750ad53e42ad6084e9b75ce4e27b))

## [6.1.5](https://github.com/tryopendata/openchart/compare/core-v6.1.4...core-v6.1.5) (2026-03-23)


### Bug Fixes

* use UTC methods for temporal granularity and support custom axis/tooltip date formats ([18dfc8e](https://github.com/tryopendata/openchart/commit/18dfc8ec76bb1e45a93bc89fe89bee71fb633420))

## [6.1.4](https://github.com/tryopendata/openchart/compare/core-v6.1.3...core-v6.1.4) (2026-03-23)


* **core:** Synchronize openchart versions

## [6.1.3](https://github.com/tryopendata/openchart/compare/core-v6.1.2...core-v6.1.3) (2026-03-23)


* **core:** Synchronize openchart versions

## [6.1.2](https://github.com/tryopendata/openchart/compare/core-v6.1.1...core-v6.1.2) (2026-03-23)


### Bug Fixes

* improve chart margin computation for labels and annotations ([58cdea8](https://github.com/tryopendata/openchart/commit/58cdea859507750017301c41a22b44492cc32722))
* reserve bottom space for brand watermark in chrome layout ([ca72868](https://github.com/tryopendata/openchart/commit/ca7286808edace47c020a07e4bbd1cac6f221e55))
* y-axis title margin and default padding ([96d0385](https://github.com/tryopendata/openchart/commit/96d03851612c685762a50dd5cc2f6bf7d412845f))

## [6.1.1](https://github.com/tryopendata/openchart/compare/core-v6.1.0...core-v6.1.1) (2026-03-22)


* **core:** Synchronize openchart versions

## [6.0.0](https://github.com/tryopendata/openchart/compare/core-v5.0.0...core-v6.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* add label format support to column charts and extract shared formatter ([16305b1](https://github.com/tryopendata/openchart/commit/16305b1e878fd4d9861aa932f17bc745f1f19beb))
* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))
* add SeriesStyle type for per-series visual overrides ([67ac80e](https://github.com/tryopendata/openchart/commit/67ac80ec002e0786ae8ed8607e583389aed4323c))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* **core:** add areaChart, donutChart, and dotChart builder functions ([921ab13](https://github.com/tryopendata/openchart/commit/921ab13ed8fd3cd313b37dfc0a092f682398b00a))
* implement seriesStyles in line chart compute pipeline ([54feb7c](https://github.com/tryopendata/openchart/commit/54feb7c266a90885bf218df6275449c17920f229))
* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))
* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Bug Fixes

* **css:** remove height:100% from chart container to fix iOS clipping ([86f0f32](https://github.com/tryopendata/openchart/commit/86f0f32b9df84ad7f9989f0c34f8ffc074e4bf9d))
* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))
* **graph:** support viz-dark class on wrapper element in CSS selectors ([9fff114](https://github.com/tryopendata/openchart/commit/9fff1146ab24c24ff34baa980107c4dc3218056d))
* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))
* **svg:** prevent chart title clipping on iOS Safari ([dee6431](https://github.com/tryopendata/openchart/commit/dee643182491ba1570bb50429fe48b33404ae08b))

## [5.0.0](https://github.com/tryopendata/openchart/compare/core-v4.0.0...core-v5.0.0) (2026-03-21)


* **core:** Synchronize openchart versions

## [4.0.0](https://github.com/tryopendata/openchart/compare/core-v3.0.0...core-v4.0.0) (2026-03-21)


* **core:** Synchronize openchart versions

## [3.0.0](https://github.com/tryopendata/openchart/compare/core-v2.13.2...core-v3.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* add label format support to column charts and extract shared formatter ([16305b1](https://github.com/tryopendata/openchart/commit/16305b1e878fd4d9861aa932f17bc745f1f19beb))
* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))
* add SeriesStyle type for per-series visual overrides ([67ac80e](https://github.com/tryopendata/openchart/commit/67ac80ec002e0786ae8ed8607e583389aed4323c))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* **core:** add areaChart, donutChart, and dotChart builder functions ([921ab13](https://github.com/tryopendata/openchart/commit/921ab13ed8fd3cd313b37dfc0a092f682398b00a))
* implement seriesStyles in line chart compute pipeline ([54feb7c](https://github.com/tryopendata/openchart/commit/54feb7c266a90885bf218df6275449c17920f229))
* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))
* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Bug Fixes

* **css:** remove height:100% from chart container to fix iOS clipping ([86f0f32](https://github.com/tryopendata/openchart/commit/86f0f32b9df84ad7f9989f0c34f8ffc074e4bf9d))
* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))
* **graph:** support viz-dark class on wrapper element in CSS selectors ([9fff114](https://github.com/tryopendata/openchart/commit/9fff1146ab24c24ff34baa980107c4dc3218056d))
* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))
* **svg:** prevent chart title clipping on iOS Safari ([dee6431](https://github.com/tryopendata/openchart/commit/dee643182491ba1570bb50429fe48b33404ae08b))

## [2.13.2](https://github.com/tryopendata/openchart/compare/core-v2.13.1...core-v2.13.2) (2026-03-21)


### Bug Fixes

* **css:** remove height:100% from chart container to fix iOS clipping ([86f0f32](https://github.com/tryopendata/openchart/commit/86f0f32b9df84ad7f9989f0c34f8ffc074e4bf9d))

## [2.13.1](https://github.com/tryopendata/openchart/compare/core-v2.13.0...core-v2.13.1) (2026-03-21)


### Bug Fixes

* **svg:** prevent chart title clipping on iOS Safari ([dee6431](https://github.com/tryopendata/openchart/commit/dee643182491ba1570bb50429fe48b33404ae08b))

## [2.13.0](https://github.com/tryopendata/openchart/compare/core-v2.12.2...core-v2.13.0) (2026-03-21)


* **core:** Synchronize openchart versions

## [2.12.2](https://github.com/tryopendata/openchart/compare/core-v2.12.1...core-v2.12.2) (2026-03-20)


* **core:** Synchronize openchart versions

## [2.12.1](https://github.com/tryopendata/openchart/compare/core-v2.12.0...core-v2.12.1) (2026-03-18)


* **core:** Synchronize openchart versions

## [2.12.0](https://github.com/tryopendata/openchart/compare/core-v2.11.0...core-v2.12.0) (2026-03-18)


* **core:** Synchronize openchart versions

## [2.11.0](https://github.com/tryopendata/openchart/compare/core-v2.10.0...core-v2.11.0) (2026-03-14)


### Features

* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))

## [2.10.0](https://github.com/tryopendata/openchart/compare/core-v2.9.1...core-v2.10.0) (2026-03-12)


### Features

* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))

## [2.9.1](https://github.com/tryopendata/openchart/compare/core-v2.9.0...core-v2.9.1) (2026-03-12)


* **core:** Synchronize openchart versions

## [2.9.0](https://github.com/tryopendata/openchart/compare/core-v2.8.1...core-v2.9.0) (2026-03-12)


* **core:** Synchronize openchart versions

## [2.8.1](https://github.com/tryopendata/openchart/compare/core-v2.8.0...core-v2.8.1) (2026-03-12)


### Bug Fixes

* **graph:** support viz-dark class on wrapper element in CSS selectors ([9fff114](https://github.com/tryopendata/openchart/commit/9fff1146ab24c24ff34baa980107c4dc3218056d))

## [2.8.0](https://github.com/tryopendata/openchart/compare/core-v2.7.0...core-v2.8.0) (2026-03-09)


### Features

* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))


### Bug Fixes

* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))

## [2.7.0](https://github.com/tryopendata/openchart/compare/core-v2.6.0...core-v2.7.0) (2026-03-09)


### Features

* add label format support to column charts and extract shared formatter ([16305b1](https://github.com/tryopendata/openchart/commit/16305b1e878fd4d9861aa932f17bc745f1f19beb))

## [2.6.0](https://github.com/tryopendata/openchart/compare/core-v2.5.0...core-v2.6.0) (2026-03-09)


* **core:** Synchronize openchart versions

## [2.5.0](https://github.com/tryopendata/openchart/compare/core-v2.4.0...core-v2.5.0) (2026-03-09)


### Features

* add SeriesStyle type for per-series visual overrides ([67ac80e](https://github.com/tryopendata/openchart/commit/67ac80ec002e0786ae8ed8607e583389aed4323c))
* implement seriesStyles in line chart compute pipeline ([54feb7c](https://github.com/tryopendata/openchart/commit/54feb7c266a90885bf218df6275449c17920f229))

## [2.4.0](https://github.com/tryopendata/openchart/compare/core-v2.3.5...core-v2.4.0) (2026-03-08)


### Features

* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))

## [2.3.5](https://github.com/tryopendata/openchart/compare/core-v2.3.4...core-v2.3.5) (2026-03-06)


* **core:** Synchronize openchart versions

## [2.3.4](https://github.com/tryopendata/openchart/compare/core-v2.3.3...core-v2.3.4) (2026-03-06)


* **core:** Synchronize openchart versions

## [2.3.3](https://github.com/tryopendata/openchart/compare/core-v2.3.2...core-v2.3.3) (2026-03-06)


* **core:** Synchronize openchart versions

## [2.3.2](https://github.com/tryopendata/openchart/compare/core-v2.3.1...core-v2.3.2) (2026-03-06)


* **core:** Synchronize openchart versions

## [2.3.1](https://github.com/tryopendata/openchart/compare/v2.3.0...v2.3.1) (2026-03-06)

### Bug Fixes

* increase bottom padding on graph watermark to match right padding ([904bb3c](https://github.com/tryopendata/openchart/commit/904bb3c))

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

* **core:** add areaChart, donutChart, and dotChart builder functions ([921ab13](https://github.com/tryopendata/openchart/commit/921ab13ed8fd3cd313b37dfc0a092f682398b00a))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))

## [1.1.0](https://github.com/tryopendata/openchart/compare/v1.0.0...v1.1.0) (2026-03-02)


### Features

* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))
