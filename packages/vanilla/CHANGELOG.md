# Changelog

## [6.1.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.13.1...vanilla-v6.1.0) (2026-04-06)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

* **main:** release openchart 6.1.0 ([c0659f4](https://github.com/tryopendata/openchart/commit/c0659f4d244b09cb2c3fa0f0bdd8d30e3e29e90c))


### Features

* add configurable watermark opt-out ([03519e1](https://github.com/tryopendata/openchart/commit/03519e116097c8103783314898a3d5c2a49cc3ac))
* add CSS entrance animations and modularize styles ([dff701a](https://github.com/tryopendata/openchart/commit/dff701a073e2ac2f3f591be606064a5e9a771fb8))
* add format strings, label anchors, series styles, and dark mode docs ([f4af8d6](https://github.com/tryopendata/openchart/commit/f4af8d6e53c7525193e7e35e29006f33e403cbef))
* add gradient fill support for chart marks ([#60](https://github.com/tryopendata/openchart/issues/60)) ([fee85b2](https://github.com/tryopendata/openchart/commit/fee85b2ce756e07188a3d4461a224dc395cff0f8))
* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* add label prefix option and update brand watermark to tryOpenData.ai ([91e5d47](https://github.com/tryopendata/openchart/commit/91e5d4757e2d22a6ee4dabb54774e7061ce7c6c3))
* add LayerSpec compilation for multi-layer chart composition (Chunk 8) ([87b51c3](https://github.com/tryopendata/openchart/commit/87b51c3e31a2defbf71296724540e6904f7feae2))
* add mark interpolation, conditional points, and voronoi tooltip overlay (Chunks 2-3) ([c31129a](https://github.com/tryopendata/openchart/commit/c31129ae7de2cfa9b713c940aad7d6e82048bc71))
* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))
* add rich chart editing with selection, deletion, and inline text editing ([25d44f4](https://github.com/tryopendata/openchart/commit/25d44f4f7f747eba36cb31980f294fe1bf992b86))
* add sankey diagram visualization type ([#52](https://github.com/tryopendata/openchart/issues/52)) ([816ce8a](https://github.com/tryopendata/openchart/commit/816ce8a55b2a1902facc1c4d1ae5d8e7261148aa))
* align spec with Vega-Lite conventions (Chunk 1 - core type system) ([0e40caa](https://github.com/tryopendata/openchart/commit/0e40caaca2fdc9940c99d50d2a821e99e7afe55e))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))
* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))
* **sankey:** dim unconnected nodes on hover for focus ([f8f6e71](https://github.com/tryopendata/openchart/commit/f8f6e718c776768589765b361621fa3551ee4629))
* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))
* Vega-Lite spec alignment and inline style cleanup ([f3ed3e0](https://github.com/tryopendata/openchart/commit/f3ed3e0353d3e0656ad14af65ddc2e822d5a905d))
* visual QA audit fixes and documentation improvements ([5b77092](https://github.com/tryopendata/openchart/commit/5b77092d4f8bcf91b736e5ec1f391af4a762528e))


### Bug Fixes

* add missing font-weight to table brand watermark ([f651ec7](https://github.com/tryopendata/openchart/commit/f651ec78cc2b8774059c955464a87138e139d7e1))
* address 6 editorial feedback issues ([96b14f2](https://github.com/tryopendata/openchart/commit/96b14f2dd67dd1af63c6fd93cdeb08383b4fa602))
* align canvas brand watermark opacity with SVG and table renderers ([0aaa19b](https://github.com/tryopendata/openchart/commit/0aaa19b269bdf109e8d05bdcaa6d74aac981c9b8))
* bottom-align mixed-size brand watermark tspans and update sankey brand ([a1af756](https://github.com/tryopendata/openchart/commit/a1af7565f4f5ad6e9d33fd52298d1e45fddbd638))
* consolidate brand watermark into single tspan-based text element ([91fbca7](https://github.com/tryopendata/openchart/commit/91fbca78ff050a793e308c355117dbd236b525d5))
* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))
* extract brand constants in table renderer ([1a504ad](https://github.com/tryopendata/openchart/commit/1a504ad7cbde1f559d6046c70dadb403ba499391))
* extract brand min-width constant in canvas renderer ([34b0c57](https://github.com/tryopendata/openchart/commit/34b0c578b1fe9129f03f8347c8b0c2cfdd8e9ce2))
* **graph:** apply theme colors and dark mode class to graph wrapper ([eac120b](https://github.com/tryopendata/openchart/commit/eac120bd3432c66c292927aeff7c8ac73a805c3a))
* **graph:** support viz-dark class on wrapper element in CSS selectors ([9fff114](https://github.com/tryopendata/openchart/commit/9fff1146ab24c24ff34baa980107c4dc3218056d))
* **graph:** top-align fitBounds to eliminate dead space on mobile ([d879597](https://github.com/tryopendata/openchart/commit/d879597d5659811d7347d0926edf8b4ff75cba3a))
* **graph:** use fit-content to collapse container after canvas shrink ([1d477fd](https://github.com/tryopendata/openchart/commit/1d477fd35c30410e090494be79e37b616425ebda))
* guard against NaN in connector endpoint drag handles ([3d5b724](https://github.com/tryopendata/openchart/commit/3d5b72433a8e620f497cdc87a083d14f0c7542df))
* increase bottom padding on graph watermark to match right padding ([904bb3c](https://github.com/tryopendata/openchart/commit/904bb3c55b01918f70cfc4bd8808f65247c7a8b6))
* inline SR-only styles and center range annotation labels ([46064fe](https://github.com/tryopendata/openchart/commit/46064fed4f3a3b617c11809a18ce7c3d4e5a3346))
* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))
* move ignoreDeprecations to package tsconfigs ([bba54e9](https://github.com/tryopendata/openchart/commit/bba54e9f32e71cce26e34e2ccc29db5cde2df611))
* only fit viewport once on first tick instead of every tick during settling ([806e9eb](https://github.com/tryopendata/openchart/commit/806e9eb3dfec212e01a3bd4af36ac828babde87f))
* prevent bundlers from resolving .ts worker fallback URL ([db9c397](https://github.com/tryopendata/openchart/commit/db9c3971e7bd6a3a876e41452975a44ebdc6755e))
* prevent sankey label clipping and excess bottom padding ([5f1c748](https://github.com/tryopendata/openchart/commit/5f1c7483b0d6e0453b2926ccd107e68f34f8f1fc))
* reserve bottom space for brand watermark in chrome layout ([ca72868](https://github.com/tryopendata/openchart/commit/ca7286808edace47c020a07e4bbd1cac6f221e55))
* resolve graph worker loading failures and improve simulation UX ([de1a8e2](https://github.com/tryopendata/openchart/commit/de1a8e2a341af223df45b11b268b4d75dd706d6d))
* sankey link rendering, animation, watermark, and legend layout ([b60b2b5](https://github.com/tryopendata/openchart/commit/b60b2b575cab7a4095013dc987a9bf45047a6d8e))
* **sankey:** address code review findings ([33e4774](https://github.com/tryopendata/openchart/commit/33e4774328abd2daa5d5e925f9d52c91025a48fa))
* **sankey:** address devil's advocate review findings ([265823e](https://github.com/tryopendata/openchart/commit/265823e5e7a65b23c86e1438463da0165e5ad515))
* **sankey:** sanitize gradient IDs to fix broken url() references ([8e58b22](https://github.com/tryopendata/openchart/commit/8e58b220834c026dffd6460d7bdc076f04118364))
* set SVG overflow:visible to prevent WebKit text clipping ([d1ef3e4](https://github.com/tryopendata/openchart/commit/d1ef3e4fbc633b0c3f8b6493f962ccb8997a686e))
* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f04157f0f593c47299b7d53baf8d5ac879))
* skip annotation margin at compact breakpoints, remove caret connector, improve animation resize handling ([632e541](https://github.com/tryopendata/openchart/commit/632e541d7d681c0737c955256001ec0100aa10e5))
* skip connector handles with NaN coordinates ([9f3d753](https://github.com/tryopendata/openchart/commit/9f3d753565187ff9a612f8d47ab8247607345bb9))
* **svg:** prevent chart title clipping on iOS Safari ([dee6431](https://github.com/tryopendata/openchart/commit/dee643182491ba1570bb50429fe48b33404ae08b))
* **svg:** replace dominant-baseline:hanging with dy offset for WebKit ([dc05dda](https://github.com/tryopendata/openchart/commit/dc05dda351ca4c58c36e4c64e57ae9597cf531e0))
* **vanilla:** handle carriage returns in CSV export escaping ([137fde7](https://github.com/tryopendata/openchart/commit/137fde70752c10b928c422ede97152ccf41e505b))


### Documentation

* add gentle OpenData references as a data source ([a25d8a7](https://github.com/tryopendata/openchart/commit/a25d8a76922278f166d3c00706095f0831190c99))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.0
    * @opendata-ai/openchart-engine bumped to 6.1.0

## [6.13.1](https://github.com/tryopendata/openchart/compare/vanilla-v6.13.0...vanilla-v6.13.1) (2026-04-06)


### Bug Fixes

* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f04157f0f593c47299b7d53baf8d5ac879))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.13.1
    * @opendata-ai/openchart-engine bumped to 6.13.1

## [6.13.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.12.0...vanilla-v6.13.0) (2026-04-05)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.13.0
    * @opendata-ai/openchart-engine bumped to 6.13.0

## [6.12.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.11.0...vanilla-v6.12.0) (2026-04-05)


### Features

* add configurable watermark opt-out ([03519e1](https://github.com/tryopendata/openchart/commit/03519e116097c8103783314898a3d5c2a49cc3ac))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.12.0
    * @opendata-ai/openchart-engine bumped to 6.12.0

## [6.11.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.10.0...vanilla-v6.11.0) (2026-04-02)


### Features

* add gradient fill support for chart marks ([#60](https://github.com/tryopendata/openchart/issues/60)) ([fee85b2](https://github.com/tryopendata/openchart/commit/fee85b2ce756e07188a3d4461a224dc395cff0f8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.11.0
    * @opendata-ai/openchart-engine bumped to 6.11.0

## [6.10.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.9.0...vanilla-v6.10.0) (2026-04-01)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.10.0
    * @opendata-ai/openchart-engine bumped to 6.10.0

## [6.9.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.8.0...vanilla-v6.9.0) (2026-04-01)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.9.0
    * @opendata-ai/openchart-engine bumped to 6.9.0

## [6.8.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.7.1...vanilla-v6.8.0) (2026-03-31)


### Features

* **sankey:** dim unconnected nodes on hover for focus ([f8f6e71](https://github.com/tryopendata/openchart/commit/f8f6e718c776768589765b361621fa3551ee4629))


### Bug Fixes

* address 6 editorial feedback issues ([96b14f2](https://github.com/tryopendata/openchart/commit/96b14f2dd67dd1af63c6fd93cdeb08383b4fa602))
* prevent sankey label clipping and excess bottom padding ([5f1c748](https://github.com/tryopendata/openchart/commit/5f1c7483b0d6e0453b2926ccd107e68f34f8f1fc))
* **sankey:** address code review findings ([33e4774](https://github.com/tryopendata/openchart/commit/33e4774328abd2daa5d5e925f9d52c91025a48fa))
* **sankey:** address devil's advocate review findings ([265823e](https://github.com/tryopendata/openchart/commit/265823e5e7a65b23c86e1438463da0165e5ad515))
* **sankey:** sanitize gradient IDs to fix broken url() references ([8e58b22](https://github.com/tryopendata/openchart/commit/8e58b220834c026dffd6460d7bdc076f04118364))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.8.0
    * @opendata-ai/openchart-engine bumped to 6.8.0

## [6.7.1](https://github.com/tryopendata/openchart/compare/vanilla-v6.7.0...vanilla-v6.7.1) (2026-03-30)


### Bug Fixes

* bottom-align mixed-size brand watermark tspans and update sankey brand ([a1af756](https://github.com/tryopendata/openchart/commit/a1af7565f4f5ad6e9d33fd52298d1e45fddbd638))


### Documentation

* add gentle OpenData references as a data source ([a25d8a7](https://github.com/tryopendata/openchart/commit/a25d8a76922278f166d3c00706095f0831190c99))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.7.1
    * @opendata-ai/openchart-engine bumped to 6.7.1

## [6.7.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.6.0...vanilla-v6.7.0) (2026-03-30)


### Features

* add label prefix option and update brand watermark to tryOpenData.ai ([91e5d47](https://github.com/tryopendata/openchart/commit/91e5d4757e2d22a6ee4dabb54774e7061ce7c6c3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.7.0
    * @opendata-ai/openchart-engine bumped to 6.7.0

## [6.6.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.5.2...vanilla-v6.6.0) (2026-03-29)


### Features

* add sankey diagram visualization type ([#52](https://github.com/tryopendata/openchart/issues/52)) ([816ce8a](https://github.com/tryopendata/openchart/commit/816ce8a55b2a1902facc1c4d1ae5d8e7261148aa))


### Bug Fixes

* sankey link rendering, animation, watermark, and legend layout ([b60b2b5](https://github.com/tryopendata/openchart/commit/b60b2b575cab7a4095013dc987a9bf45047a6d8e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.6.0
    * @opendata-ai/openchart-engine bumped to 6.6.0

## [6.5.2](https://github.com/tryopendata/openchart/compare/vanilla-v6.5.1...vanilla-v6.5.2) (2026-03-26)


### Bug Fixes

* skip annotation margin at compact breakpoints, remove caret connector, improve animation resize handling ([632e541](https://github.com/tryopendata/openchart/commit/632e541d7d681c0737c955256001ec0100aa10e5))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.5.2
    * @opendata-ai/openchart-engine bumped to 6.5.2

## [6.5.1](https://github.com/tryopendata/openchart/compare/vanilla-v6.5.0...vanilla-v6.5.1) (2026-03-26)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.5.1
    * @opendata-ai/openchart-engine bumped to 6.5.1

## [6.5.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.4.1...vanilla-v6.5.0) (2026-03-26)


### Features

* add CSS entrance animations and modularize styles ([dff701a](https://github.com/tryopendata/openchart/commit/dff701a073e2ac2f3f591be606064a5e9a771fb8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.5.0
    * @opendata-ai/openchart-engine bumped to 6.5.0

## [6.4.1](https://github.com/tryopendata/openchart/compare/vanilla-v6.4.0...vanilla-v6.4.1) (2026-03-26)


### Bug Fixes

* move ignoreDeprecations to package tsconfigs ([bba54e9](https://github.com/tryopendata/openchart/commit/bba54e9f32e71cce26e34e2ccc29db5cde2df611))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.4.1
    * @opendata-ai/openchart-engine bumped to 6.4.1

## [6.4.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.3.0...vanilla-v6.4.0) (2026-03-26)


### Features

* add rich chart editing with selection, deletion, and inline text editing ([25d44f4](https://github.com/tryopendata/openchart/commit/25d44f4f7f747eba36cb31980f294fe1bf992b86))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.4.0
    * @opendata-ai/openchart-engine bumped to 6.4.0

## [6.3.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.2.1...vanilla-v6.3.0) (2026-03-26)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.3.0
    * @opendata-ai/openchart-engine bumped to 6.3.0

## [6.2.1](https://github.com/tryopendata/openchart/compare/vanilla-v6.2.0...vanilla-v6.2.1) (2026-03-23)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.2.1
    * @opendata-ai/openchart-engine bumped to 6.2.1

## [6.2.0](https://github.com/tryopendata/openchart/compare/vanilla-v6.1.5...vanilla-v6.2.0) (2026-03-23)


### Bug Fixes

* only fit viewport once on first tick instead of every tick during settling ([806e9eb](https://github.com/tryopendata/openchart/commit/806e9eb3dfec212e01a3bd4af36ac828babde87f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.2.0
    * @opendata-ai/openchart-engine bumped to 6.2.0

## [6.1.5](https://github.com/tryopendata/openchart/compare/vanilla-v6.1.4...vanilla-v6.1.5) (2026-03-23)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.5
    * @opendata-ai/openchart-engine bumped to 6.1.5

## [6.1.4](https://github.com/tryopendata/openchart/compare/vanilla-v6.1.3...vanilla-v6.1.4) (2026-03-23)


### Bug Fixes

* prevent bundlers from resolving .ts worker fallback URL ([db9c397](https://github.com/tryopendata/openchart/commit/db9c3971e7bd6a3a876e41452975a44ebdc6755e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.4
    * @opendata-ai/openchart-engine bumped to 6.1.4

## [6.1.3](https://github.com/tryopendata/openchart/compare/vanilla-v6.1.2...vanilla-v6.1.3) (2026-03-23)


### Bug Fixes

* resolve graph worker loading failures and improve simulation UX ([de1a8e2](https://github.com/tryopendata/openchart/commit/de1a8e2a341af223df45b11b268b4d75dd706d6d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.3
    * @opendata-ai/openchart-engine bumped to 6.1.3

## [6.1.2](https://github.com/tryopendata/openchart/compare/vanilla-v6.1.1...vanilla-v6.1.2) (2026-03-23)


### Bug Fixes

* reserve bottom space for brand watermark in chrome layout ([ca72868](https://github.com/tryopendata/openchart/commit/ca7286808edace47c020a07e4bbd1cac6f221e55))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.2
    * @opendata-ai/openchart-engine bumped to 6.1.2

## [6.1.1](https://github.com/tryopendata/openchart/compare/vanilla-v6.1.0...vanilla-v6.1.1) (2026-03-22)


### Bug Fixes

* **vanilla:** handle carriage returns in CSV export escaping ([137fde7](https://github.com/tryopendata/openchart/commit/137fde70752c10b928c422ede97152ccf41e505b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.1
    * @opendata-ai/openchart-engine bumped to 6.1.1

## [6.0.0](https://github.com/tryopendata/openchart/compare/vanilla-v5.0.0...vanilla-v6.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* add format strings, label anchors, series styles, and dark mode docs ([f4af8d6](https://github.com/tryopendata/openchart/commit/f4af8d6e53c7525193e7e35e29006f33e403cbef))
* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))
* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))
* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))
* visual QA audit fixes and documentation improvements ([5b77092](https://github.com/tryopendata/openchart/commit/5b77092d4f8bcf91b736e5ec1f391af4a762528e))


### Bug Fixes

* add missing font-weight to table brand watermark ([f651ec7](https://github.com/tryopendata/openchart/commit/f651ec78cc2b8774059c955464a87138e139d7e1))
* align canvas brand watermark opacity with SVG and table renderers ([0aaa19b](https://github.com/tryopendata/openchart/commit/0aaa19b269bdf109e8d05bdcaa6d74aac981c9b8))
* consolidate brand watermark into single tspan-based text element ([91fbca7](https://github.com/tryopendata/openchart/commit/91fbca78ff050a793e308c355117dbd236b525d5))
* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))
* extract brand constants in table renderer ([1a504ad](https://github.com/tryopendata/openchart/commit/1a504ad7cbde1f559d6046c70dadb403ba499391))
* extract brand min-width constant in canvas renderer ([34b0c57](https://github.com/tryopendata/openchart/commit/34b0c578b1fe9129f03f8347c8b0c2cfdd8e9ce2))
* **graph:** apply theme colors and dark mode class to graph wrapper ([eac120b](https://github.com/tryopendata/openchart/commit/eac120bd3432c66c292927aeff7c8ac73a805c3a))
* **graph:** support viz-dark class on wrapper element in CSS selectors ([9fff114](https://github.com/tryopendata/openchart/commit/9fff1146ab24c24ff34baa980107c4dc3218056d))
* **graph:** top-align fitBounds to eliminate dead space on mobile ([d879597](https://github.com/tryopendata/openchart/commit/d879597d5659811d7347d0926edf8b4ff75cba3a))
* **graph:** use fit-content to collapse container after canvas shrink ([1d477fd](https://github.com/tryopendata/openchart/commit/1d477fd35c30410e090494be79e37b616425ebda))
* increase bottom padding on graph watermark to match right padding ([904bb3c](https://github.com/tryopendata/openchart/commit/904bb3c55b01918f70cfc4bd8808f65247c7a8b6))
* inline SR-only styles and center range annotation labels ([46064fe](https://github.com/tryopendata/openchart/commit/46064fed4f3a3b617c11809a18ce7c3d4e5a3346))
* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))
* **svg:** prevent chart title clipping on iOS Safari ([dee6431](https://github.com/tryopendata/openchart/commit/dee643182491ba1570bb50429fe48b33404ae08b))
* **svg:** replace dominant-baseline:hanging with dy offset for WebKit ([dc05dda](https://github.com/tryopendata/openchart/commit/dc05dda351ca4c58c36e4c64e57ae9597cf531e0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.0.0
    * @opendata-ai/openchart-engine bumped to 6.0.0

## [5.0.0](https://github.com/tryopendata/openchart/compare/vanilla-v4.0.0...vanilla-v5.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* add format strings, label anchors, series styles, and dark mode docs ([f4af8d6](https://github.com/tryopendata/openchart/commit/f4af8d6e53c7525193e7e35e29006f33e403cbef))
* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))
* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))
* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))
* visual QA audit fixes and documentation improvements ([5b77092](https://github.com/tryopendata/openchart/commit/5b77092d4f8bcf91b736e5ec1f391af4a762528e))


### Bug Fixes

* add missing font-weight to table brand watermark ([f651ec7](https://github.com/tryopendata/openchart/commit/f651ec78cc2b8774059c955464a87138e139d7e1))
* align canvas brand watermark opacity with SVG and table renderers ([0aaa19b](https://github.com/tryopendata/openchart/commit/0aaa19b269bdf109e8d05bdcaa6d74aac981c9b8))
* consolidate brand watermark into single tspan-based text element ([91fbca7](https://github.com/tryopendata/openchart/commit/91fbca78ff050a793e308c355117dbd236b525d5))
* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))
* extract brand constants in table renderer ([1a504ad](https://github.com/tryopendata/openchart/commit/1a504ad7cbde1f559d6046c70dadb403ba499391))
* extract brand min-width constant in canvas renderer ([34b0c57](https://github.com/tryopendata/openchart/commit/34b0c578b1fe9129f03f8347c8b0c2cfdd8e9ce2))
* **graph:** apply theme colors and dark mode class to graph wrapper ([eac120b](https://github.com/tryopendata/openchart/commit/eac120bd3432c66c292927aeff7c8ac73a805c3a))
* **graph:** support viz-dark class on wrapper element in CSS selectors ([9fff114](https://github.com/tryopendata/openchart/commit/9fff1146ab24c24ff34baa980107c4dc3218056d))
* **graph:** top-align fitBounds to eliminate dead space on mobile ([d879597](https://github.com/tryopendata/openchart/commit/d879597d5659811d7347d0926edf8b4ff75cba3a))
* **graph:** use fit-content to collapse container after canvas shrink ([1d477fd](https://github.com/tryopendata/openchart/commit/1d477fd35c30410e090494be79e37b616425ebda))
* increase bottom padding on graph watermark to match right padding ([904bb3c](https://github.com/tryopendata/openchart/commit/904bb3c55b01918f70cfc4bd8808f65247c7a8b6))
* inline SR-only styles and center range annotation labels ([46064fe](https://github.com/tryopendata/openchart/commit/46064fed4f3a3b617c11809a18ce7c3d4e5a3346))
* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))
* **svg:** prevent chart title clipping on iOS Safari ([dee6431](https://github.com/tryopendata/openchart/commit/dee643182491ba1570bb50429fe48b33404ae08b))
* **svg:** replace dominant-baseline:hanging with dy offset for WebKit ([dc05dda](https://github.com/tryopendata/openchart/commit/dc05dda351ca4c58c36e4c64e57ae9597cf531e0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 5.0.0
    * @opendata-ai/openchart-engine bumped to 5.0.0

## [4.0.0](https://github.com/tryopendata/openchart/compare/vanilla-v3.0.0...vanilla-v4.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* add format strings, label anchors, series styles, and dark mode docs ([f4af8d6](https://github.com/tryopendata/openchart/commit/f4af8d6e53c7525193e7e35e29006f33e403cbef))
* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))
* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))
* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))
* visual QA audit fixes and documentation improvements ([5b77092](https://github.com/tryopendata/openchart/commit/5b77092d4f8bcf91b736e5ec1f391af4a762528e))


### Bug Fixes

* add missing font-weight to table brand watermark ([f651ec7](https://github.com/tryopendata/openchart/commit/f651ec78cc2b8774059c955464a87138e139d7e1))
* align canvas brand watermark opacity with SVG and table renderers ([0aaa19b](https://github.com/tryopendata/openchart/commit/0aaa19b269bdf109e8d05bdcaa6d74aac981c9b8))
* consolidate brand watermark into single tspan-based text element ([91fbca7](https://github.com/tryopendata/openchart/commit/91fbca78ff050a793e308c355117dbd236b525d5))
* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))
* extract brand constants in table renderer ([1a504ad](https://github.com/tryopendata/openchart/commit/1a504ad7cbde1f559d6046c70dadb403ba499391))
* extract brand min-width constant in canvas renderer ([34b0c57](https://github.com/tryopendata/openchart/commit/34b0c578b1fe9129f03f8347c8b0c2cfdd8e9ce2))
* **graph:** apply theme colors and dark mode class to graph wrapper ([eac120b](https://github.com/tryopendata/openchart/commit/eac120bd3432c66c292927aeff7c8ac73a805c3a))
* **graph:** support viz-dark class on wrapper element in CSS selectors ([9fff114](https://github.com/tryopendata/openchart/commit/9fff1146ab24c24ff34baa980107c4dc3218056d))
* **graph:** top-align fitBounds to eliminate dead space on mobile ([d879597](https://github.com/tryopendata/openchart/commit/d879597d5659811d7347d0926edf8b4ff75cba3a))
* **graph:** use fit-content to collapse container after canvas shrink ([1d477fd](https://github.com/tryopendata/openchart/commit/1d477fd35c30410e090494be79e37b616425ebda))
* increase bottom padding on graph watermark to match right padding ([904bb3c](https://github.com/tryopendata/openchart/commit/904bb3c55b01918f70cfc4bd8808f65247c7a8b6))
* inline SR-only styles and center range annotation labels ([46064fe](https://github.com/tryopendata/openchart/commit/46064fed4f3a3b617c11809a18ce7c3d4e5a3346))
* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))
* **svg:** prevent chart title clipping on iOS Safari ([dee6431](https://github.com/tryopendata/openchart/commit/dee643182491ba1570bb50429fe48b33404ae08b))
* **svg:** replace dominant-baseline:hanging with dy offset for WebKit ([dc05dda](https://github.com/tryopendata/openchart/commit/dc05dda351ca4c58c36e4c64e57ae9597cf531e0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 4.0.0
    * @opendata-ai/openchart-engine bumped to 4.0.0

## [3.0.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.13.2...vanilla-v3.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* add format strings, label anchors, series styles, and dark mode docs ([f4af8d6](https://github.com/tryopendata/openchart/commit/f4af8d6e53c7525193e7e35e29006f33e403cbef))
* add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config ([52cd15e](https://github.com/tryopendata/openchart/commit/52cd15e292b11ced6a8e0f680e78cb4a5cd22fd6))
* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))
* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))
* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))
* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))
* visual QA audit fixes and documentation improvements ([5b77092](https://github.com/tryopendata/openchart/commit/5b77092d4f8bcf91b736e5ec1f391af4a762528e))


### Bug Fixes

* add missing font-weight to table brand watermark ([f651ec7](https://github.com/tryopendata/openchart/commit/f651ec78cc2b8774059c955464a87138e139d7e1))
* align canvas brand watermark opacity with SVG and table renderers ([0aaa19b](https://github.com/tryopendata/openchart/commit/0aaa19b269bdf109e8d05bdcaa6d74aac981c9b8))
* consolidate brand watermark into single tspan-based text element ([91fbca7](https://github.com/tryopendata/openchart/commit/91fbca78ff050a793e308c355117dbd236b525d5))
* dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle ([6a746cc](https://github.com/tryopendata/openchart/commit/6a746cc1c984a55ea2c0887f0790b20d96e9e5f7))
* extract brand constants in table renderer ([1a504ad](https://github.com/tryopendata/openchart/commit/1a504ad7cbde1f559d6046c70dadb403ba499391))
* extract brand min-width constant in canvas renderer ([34b0c57](https://github.com/tryopendata/openchart/commit/34b0c578b1fe9129f03f8347c8b0c2cfdd8e9ce2))
* **graph:** apply theme colors and dark mode class to graph wrapper ([eac120b](https://github.com/tryopendata/openchart/commit/eac120bd3432c66c292927aeff7c8ac73a805c3a))
* **graph:** support viz-dark class on wrapper element in CSS selectors ([9fff114](https://github.com/tryopendata/openchart/commit/9fff1146ab24c24ff34baa980107c4dc3218056d))
* **graph:** top-align fitBounds to eliminate dead space on mobile ([d879597](https://github.com/tryopendata/openchart/commit/d879597d5659811d7347d0926edf8b4ff75cba3a))
* **graph:** use fit-content to collapse container after canvas shrink ([1d477fd](https://github.com/tryopendata/openchart/commit/1d477fd35c30410e090494be79e37b616425ebda))
* increase bottom padding on graph watermark to match right padding ([904bb3c](https://github.com/tryopendata/openchart/commit/904bb3c55b01918f70cfc4bd8808f65247c7a8b6))
* inline SR-only styles and center range annotation labels ([46064fe](https://github.com/tryopendata/openchart/commit/46064fed4f3a3b617c11809a18ce7c3d4e5a3346))
* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))
* **svg:** prevent chart title clipping on iOS Safari ([dee6431](https://github.com/tryopendata/openchart/commit/dee643182491ba1570bb50429fe48b33404ae08b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 3.0.0
    * @opendata-ai/openchart-engine bumped to 3.0.0

## [2.13.2](https://github.com/tryopendata/openchart/compare/vanilla-v2.13.1...vanilla-v2.13.2) (2026-03-21)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.13.2
    * @opendata-ai/openchart-engine bumped to 2.13.2

## [2.13.1](https://github.com/tryopendata/openchart/compare/vanilla-v2.13.0...vanilla-v2.13.1) (2026-03-21)


### Bug Fixes

* **svg:** prevent chart title clipping on iOS Safari ([dee6431](https://github.com/tryopendata/openchart/commit/dee643182491ba1570bb50429fe48b33404ae08b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.13.1
    * @opendata-ai/openchart-engine bumped to 2.13.1

## [2.13.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.12.2...vanilla-v2.13.0) (2026-03-21)


### Features

* **export:** embed fonts and fix dimension/background bugs ([65556cc](https://github.com/tryopendata/openchart/commit/65556ccabdcd04911fea4ab705eb9f0018d34e53))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.13.0
    * @opendata-ai/openchart-engine bumped to 2.13.0

## [2.12.2](https://github.com/tryopendata/openchart/compare/vanilla-v2.12.1...vanilla-v2.12.2) (2026-03-20)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.2
    * @opendata-ai/openchart-engine bumped to 2.12.2

## [2.12.1](https://github.com/tryopendata/openchart/compare/vanilla-v2.12.0...vanilla-v2.12.1) (2026-03-18)


### Bug Fixes

* inline SR-only styles and center range annotation labels ([46064fe](https://github.com/tryopendata/openchart/commit/46064fed4f3a3b617c11809a18ce7c3d4e5a3346))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.1
    * @opendata-ai/openchart-engine bumped to 2.12.1

## [2.12.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.11.0...vanilla-v2.12.0) (2026-03-18)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.0
    * @opendata-ai/openchart-engine bumped to 2.12.0

## [2.11.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.10.0...vanilla-v2.11.0) (2026-03-14)


### Features

* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.11.0
    * @opendata-ai/openchart-engine bumped to 2.11.0

## [2.10.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.9.1...vanilla-v2.10.0) (2026-03-12)


### Features

* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))


### Bug Fixes

* **graph:** use fit-content to collapse container after canvas shrink ([1d477fd](https://github.com/tryopendata/openchart/commit/1d477fd35c30410e090494be79e37b616425ebda))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.10.0
    * @opendata-ai/openchart-engine bumped to 2.10.0

## [2.9.1](https://github.com/tryopendata/openchart/compare/vanilla-v2.9.0...vanilla-v2.9.1) (2026-03-12)


### Bug Fixes

* **graph:** top-align fitBounds to eliminate dead space on mobile ([d879597](https://github.com/tryopendata/openchart/commit/d879597d5659811d7347d0926edf8b4ff75cba3a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.9.1
    * @opendata-ai/openchart-engine bumped to 2.9.1

## [2.9.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.8.1...vanilla-v2.9.0) (2026-03-12)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.9.0
    * @opendata-ai/openchart-engine bumped to 2.9.0

## [2.8.1](https://github.com/tryopendata/openchart/compare/vanilla-v2.8.0...vanilla-v2.8.1) (2026-03-12)


### Bug Fixes

* **graph:** apply theme colors and dark mode class to graph wrapper ([eac120b](https://github.com/tryopendata/openchart/commit/eac120bd3432c66c292927aeff7c8ac73a805c3a))
* **graph:** support viz-dark class on wrapper element in CSS selectors ([9fff114](https://github.com/tryopendata/openchart/commit/9fff1146ab24c24ff34baa980107c4dc3218056d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.8.1
    * @opendata-ai/openchart-engine bumped to 2.8.1

## [2.8.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.7.0...vanilla-v2.8.0) (2026-03-09)


### Features

* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))


### Bug Fixes

* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.8.0
    * @opendata-ai/openchart-engine bumped to 2.8.0

## [2.7.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.6.0...vanilla-v2.7.0) (2026-03-09)


* **vanilla:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.7.0
    * @opendata-ai/openchart-engine bumped to 2.7.0

## [2.6.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.5.0...vanilla-v2.6.0) (2026-03-09)


### Features

* add format strings, label anchors, series styles, and dark mode docs ([f4af8d6](https://github.com/tryopendata/openchart/commit/f4af8d6e53c7525193e7e35e29006f33e403cbef))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.6.0
    * @opendata-ai/openchart-engine bumped to 2.6.0

## [2.5.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.4.0...vanilla-v2.5.0) (2026-03-09)


### Features

* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))


### Bug Fixes

* consolidate brand watermark into single tspan-based text element ([91fbca7](https://github.com/tryopendata/openchart/commit/91fbca78ff050a793e308c355117dbd236b525d5))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.5.0
    * @opendata-ai/openchart-engine bumped to 2.5.0

## [2.4.0](https://github.com/tryopendata/openchart/compare/vanilla-v2.3.5...vanilla-v2.4.0) (2026-03-08)


### Features

* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.4.0
    * @opendata-ai/openchart-engine bumped to 2.4.0

## [2.3.5](https://github.com/tryopendata/openchart/compare/vanilla-v2.3.4...vanilla-v2.3.5) (2026-03-06)


### Bug Fixes

* extract brand constants in table renderer ([1a504ad](https://github.com/tryopendata/openchart/commit/1a504ad7cbde1f559d6046c70dadb403ba499391))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.5
    * @opendata-ai/openchart-engine bumped to 2.3.5

## [2.3.4](https://github.com/tryopendata/openchart/compare/vanilla-v2.3.3...vanilla-v2.3.4) (2026-03-06)


### Bug Fixes

* align canvas brand watermark opacity with SVG and table renderers ([0aaa19b](https://github.com/tryopendata/openchart/commit/0aaa19b269bdf109e8d05bdcaa6d74aac981c9b8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.4
    * @opendata-ai/openchart-engine bumped to 2.3.4

## [2.3.3](https://github.com/tryopendata/openchart/compare/vanilla-v2.3.2...vanilla-v2.3.3) (2026-03-06)


### Bug Fixes

* extract brand min-width constant in canvas renderer ([34b0c57](https://github.com/tryopendata/openchart/commit/34b0c578b1fe9129f03f8347c8b0c2cfdd8e9ce2))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.3
    * @opendata-ai/openchart-engine bumped to 2.3.3

## [2.3.2](https://github.com/tryopendata/openchart/compare/vanilla-v2.3.1...vanilla-v2.3.2) (2026-03-06)


### Bug Fixes

* add missing font-weight to table brand watermark ([f651ec7](https://github.com/tryopendata/openchart/commit/f651ec78cc2b8774059c955464a87138e139d7e1))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.2
    * @opendata-ai/openchart-engine bumped to 2.3.2

## [2.3.1](https://github.com/tryopendata/openchart/compare/v2.3.0...v2.3.1) (2026-03-06)


### Bug Fixes

* increase bottom padding on graph watermark to match right padding ([904bb3c](https://github.com/tryopendata/openchart/commit/904bb3c55b01918f70cfc4bd8808f65247c7a8b6))

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

## [1.1.0](https://github.com/tryopendata/openchart/compare/v1.0.0...v1.1.0) (2026-03-02)


### Features

* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 1.1.0
    * @opendata-ai/openchart-engine bumped to 1.1.0
