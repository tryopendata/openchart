# Changelog

## [2.3.3](https://github.com/tryopendata/openchart/compare/svelte-v2.3.2...svelte-v2.3.3) (2026-03-06)


* **svelte:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.3
    * @opendata-ai/openchart-engine bumped to 2.3.3
    * @opendata-ai/openchart-vanilla bumped to 2.3.3

## [2.3.2](https://github.com/tryopendata/openchart/compare/svelte-v2.3.1...svelte-v2.3.2) (2026-03-06)


* **svelte:** Synchronize openchart versions


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
