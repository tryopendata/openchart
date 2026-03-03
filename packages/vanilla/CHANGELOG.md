# Changelog

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
