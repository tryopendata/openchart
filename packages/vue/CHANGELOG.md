# Changelog

## [6.1.1](https://github.com/tryopendata/openchart/compare/vue-v6.1.0...vue-v6.1.1) (2026-03-22)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.1.1
    * @opendata-ai/openchart-engine bumped to 6.1.1
    * @opendata-ai/openchart-vanilla bumped to 6.1.1

## [6.0.0](https://github.com/tryopendata/openchart/compare/vue-v5.0.0...vue-v6.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export core and engine dependencies from client libs, so only single dependencies are needed for consumers ([7ae2e41](https://github.com/tryopendata/openchart/commit/7ae2e41d0e75c2c4895130846758b28d72cc17c2))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 6.0.0
    * @opendata-ai/openchart-engine bumped to 6.0.0
    * @opendata-ai/openchart-vanilla bumped to 6.0.0

## [5.0.0](https://github.com/tryopendata/openchart/compare/vue-v4.0.0...vue-v5.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export core and engine dependencies from client libs, so only single dependencies are needed for consumers ([7ae2e41](https://github.com/tryopendata/openchart/commit/7ae2e41d0e75c2c4895130846758b28d72cc17c2))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 5.0.0
    * @opendata-ai/openchart-engine bumped to 5.0.0
    * @opendata-ai/openchart-vanilla bumped to 5.0.0

## [4.0.0](https://github.com/tryopendata/openchart/compare/vue-v3.0.0...vue-v4.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export core and engine dependencies from client libs, so only single dependencies are needed for consumers ([7ae2e41](https://github.com/tryopendata/openchart/commit/7ae2e41d0e75c2c4895130846758b28d72cc17c2))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 4.0.0
    * @opendata-ai/openchart-engine bumped to 4.0.0
    * @opendata-ai/openchart-vanilla bumped to 4.0.0

## [3.0.0](https://github.com/tryopendata/openchart/compare/vue-v2.13.2...vue-v3.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* export core and engine dependencies from client libs, so only single dependencies are needed for consumers ([7ae2e41](https://github.com/tryopendata/openchart/commit/7ae2e41d0e75c2c4895130846758b28d72cc17c2))
* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))
* narrow createChart types, fix remount bugs, add Visualization component ([d7e0c3f](https://github.com/tryopendata/openchart/commit/d7e0c3f52041686206afb18542f18ca6318ed1a3))
* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 3.0.0
    * @opendata-ai/openchart-engine bumped to 3.0.0
    * @opendata-ai/openchart-vanilla bumped to 3.0.0

## [2.13.2](https://github.com/tryopendata/openchart/compare/vue-v2.13.1...vue-v2.13.2) (2026-03-21)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.13.2
    * @opendata-ai/openchart-engine bumped to 2.13.2
    * @opendata-ai/openchart-vanilla bumped to 2.13.2

## [2.13.1](https://github.com/tryopendata/openchart/compare/vue-v2.13.0...vue-v2.13.1) (2026-03-21)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.13.1
    * @opendata-ai/openchart-engine bumped to 2.13.1
    * @opendata-ai/openchart-vanilla bumped to 2.13.1

## [2.13.0](https://github.com/tryopendata/openchart/compare/vue-v2.12.2...vue-v2.13.0) (2026-03-21)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.13.0
    * @opendata-ai/openchart-engine bumped to 2.13.0
    * @opendata-ai/openchart-vanilla bumped to 2.13.0

## [2.12.2](https://github.com/tryopendata/openchart/compare/vue-v2.12.1...vue-v2.12.2) (2026-03-20)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.2
    * @opendata-ai/openchart-engine bumped to 2.12.2
    * @opendata-ai/openchart-vanilla bumped to 2.12.2

## [2.12.1](https://github.com/tryopendata/openchart/compare/vue-v2.12.0...vue-v2.12.1) (2026-03-18)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.1
    * @opendata-ai/openchart-engine bumped to 2.12.1
    * @opendata-ai/openchart-vanilla bumped to 2.12.1

## [2.12.0](https://github.com/tryopendata/openchart/compare/vue-v2.11.0...vue-v2.12.0) (2026-03-18)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.0
    * @opendata-ai/openchart-engine bumped to 2.12.0
    * @opendata-ai/openchart-vanilla bumped to 2.12.0

## [2.11.0](https://github.com/tryopendata/openchart/compare/vue-v2.10.0...vue-v2.11.0) (2026-03-14)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.11.0
    * @opendata-ai/openchart-engine bumped to 2.11.0
    * @opendata-ai/openchart-vanilla bumped to 2.11.0

## [2.10.0](https://github.com/tryopendata/openchart/compare/vue-v2.9.1...vue-v2.10.0) (2026-03-12)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.10.0
    * @opendata-ai/openchart-engine bumped to 2.10.0
    * @opendata-ai/openchart-vanilla bumped to 2.10.0

## [2.9.1](https://github.com/tryopendata/openchart/compare/vue-v2.9.0...vue-v2.9.1) (2026-03-12)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.9.1
    * @opendata-ai/openchart-engine bumped to 2.9.1
    * @opendata-ai/openchart-vanilla bumped to 2.9.1

## [2.9.0](https://github.com/tryopendata/openchart/compare/vue-v2.8.1...vue-v2.9.0) (2026-03-12)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.9.0
    * @opendata-ai/openchart-engine bumped to 2.9.0
    * @opendata-ai/openchart-vanilla bumped to 2.9.0

## [2.8.1](https://github.com/tryopendata/openchart/compare/vue-v2.8.0...vue-v2.8.1) (2026-03-12)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.8.1
    * @opendata-ai/openchart-engine bumped to 2.8.1
    * @opendata-ai/openchart-vanilla bumped to 2.8.1

## [2.8.0](https://github.com/tryopendata/openchart/compare/vue-v2.7.0...vue-v2.8.0) (2026-03-09)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.8.0
    * @opendata-ai/openchart-engine bumped to 2.8.0
    * @opendata-ai/openchart-vanilla bumped to 2.8.0

## [2.7.0](https://github.com/tryopendata/openchart/compare/vue-v2.6.0...vue-v2.7.0) (2026-03-09)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.7.0
    * @opendata-ai/openchart-engine bumped to 2.7.0
    * @opendata-ai/openchart-vanilla bumped to 2.7.0

## [2.6.0](https://github.com/tryopendata/openchart/compare/vue-v2.5.0...vue-v2.6.0) (2026-03-09)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.6.0
    * @opendata-ai/openchart-engine bumped to 2.6.0
    * @opendata-ai/openchart-vanilla bumped to 2.6.0

## [2.5.0](https://github.com/tryopendata/openchart/compare/vue-v2.4.0...vue-v2.5.0) (2026-03-09)


### Features

* export styles.css from all framework packages ([358f8e3](https://github.com/tryopendata/openchart/commit/358f8e32fdddd60a3917200111a8d1b1fe717ca8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.5.0
    * @opendata-ai/openchart-engine bumped to 2.5.0
    * @opendata-ai/openchart-vanilla bumped to 2.5.0

## [2.4.0](https://github.com/tryopendata/openchart/compare/vue-v2.3.5...vue-v2.4.0) (2026-03-08)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.4.0
    * @opendata-ai/openchart-engine bumped to 2.4.0
    * @opendata-ai/openchart-vanilla bumped to 2.4.0

## [2.3.5](https://github.com/tryopendata/openchart/compare/vue-v2.3.4...vue-v2.3.5) (2026-03-06)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.5
    * @opendata-ai/openchart-engine bumped to 2.3.5
    * @opendata-ai/openchart-vanilla bumped to 2.3.5

## [2.3.4](https://github.com/tryopendata/openchart/compare/vue-v2.3.3...vue-v2.3.4) (2026-03-06)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.4
    * @opendata-ai/openchart-engine bumped to 2.3.4
    * @opendata-ai/openchart-vanilla bumped to 2.3.4

## [2.3.3](https://github.com/tryopendata/openchart/compare/vue-v2.3.2...vue-v2.3.3) (2026-03-06)


* **vue:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.3
    * @opendata-ai/openchart-engine bumped to 2.3.3
    * @opendata-ai/openchart-vanilla bumped to 2.3.3

## [2.3.2](https://github.com/tryopendata/openchart/compare/vue-v2.3.1...vue-v2.3.2) (2026-03-06)


* **vue:** Synchronize openchart versions


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
