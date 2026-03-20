# Changelog

## [2.12.2](https://github.com/tryopendata/openchart/compare/engine-v2.12.1...engine-v2.12.2) (2026-03-20)


### Bug Fixes

* **axes:** decouple gridlines from tick label thinning ([9a79786](https://github.com/tryopendata/openchart/commit/9a79786dfd4d900182cbcc4a09b91e890ec995c3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.2

## [2.12.1](https://github.com/tryopendata/openchart/compare/engine-v2.12.0...engine-v2.12.1) (2026-03-18)


### Bug Fixes

* inline SR-only styles and center range annotation labels ([46064fe](https://github.com/tryopendata/openchart/commit/46064fed4f3a3b617c11809a18ce7c3d4e5a3346))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.1

## [2.12.0](https://github.com/tryopendata/openchart/compare/engine-v2.11.0...engine-v2.12.0) (2026-03-18)


### Features

* **tooltips:** use detail encoding as tooltip title ([3f0db09](https://github.com/tryopendata/openchart/commit/3f0db09b3e8c4a607561b47abf47f65e47e25608))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.12.0

## [2.11.0](https://github.com/tryopendata/openchart/compare/engine-v2.10.0...engine-v2.11.0) (2026-03-14)


### Features

* **axes:** text-aware tick density prevents label overlap ([bc9f461](https://github.com/tryopendata/openchart/commit/bc9f46135c12ccf318738a291fcc02d28b670611))
* **layout:** prevent annotation/label/brand overlap with improved obstacle detection ([74650ae](https://github.com/tryopendata/openchart/commit/74650aeef1bb386f90f5f1c0c81a9255ed3b21e2))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.11.0

## [2.10.0](https://github.com/tryopendata/openchart/compare/engine-v2.9.1...engine-v2.10.0) (2026-03-12)


### Features

* **responsive:** height-aware layout, chrome compression, and legend overflow ([41362f5](https://github.com/tryopendata/openchart/commit/41362f5dc08077a9e2661415e370c58972be089b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.10.0

## [2.9.1](https://github.com/tryopendata/openchart/compare/engine-v2.9.0...engine-v2.9.1) (2026-03-12)


* **engine:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.9.1

## [2.9.0](https://github.com/tryopendata/openchart/compare/engine-v2.8.1...engine-v2.9.0) (2026-03-12)


### Features

* **annotations:** interpolate positions for out-of-domain values on categorical scales ([0898bfd](https://github.com/tryopendata/openchart/commit/0898bfd249cdae270b4c82556bb6aa6be506f84b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.9.0

## [2.8.1](https://github.com/tryopendata/openchart/compare/engine-v2.8.0...engine-v2.8.1) (2026-03-12)


* **engine:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.8.1

## [2.8.0](https://github.com/tryopendata/openchart/compare/engine-v2.7.0...engine-v2.8.0) (2026-03-09)


### Features

* add responsive overrides, legend hiding, and chrome text wrapping ([2eb0236](https://github.com/tryopendata/openchart/commit/2eb02366bfbd51b15341708c912da8897adbc98a))


### Bug Fixes

* move bun-symlink-resolver to scripts/ so it's not gitignored ([c2cee52](https://github.com/tryopendata/openchart/commit/c2cee5275480ef36e11ea81aa195068875f375e5))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.8.0

## [2.7.0](https://github.com/tryopendata/openchart/compare/engine-v2.6.0...engine-v2.7.0) (2026-03-09)


### Features

* add label format support to column charts and extract shared formatter ([16305b1](https://github.com/tryopendata/openchart/commit/16305b1e878fd4d9861aa932f17bc745f1f19beb))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.7.0

## [2.6.0](https://github.com/tryopendata/openchart/compare/engine-v2.5.0...engine-v2.6.0) (2026-03-09)


### Features

* add format strings, label anchors, series styles, and dark mode docs ([f4af8d6](https://github.com/tryopendata/openchart/commit/f4af8d6e53c7525193e7e35e29006f33e403cbef))


### Bug Fixes

* resolve lint warnings in bar labels formatter ([ce0bb7f](https://github.com/tryopendata/openchart/commit/ce0bb7fbc7cb0267b83ec0fd48aaa71309a7141c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.6.0

## [2.5.0](https://github.com/tryopendata/openchart/compare/engine-v2.4.0...engine-v2.5.0) (2026-03-09)


### Features

* add SeriesStyle type for per-series visual overrides ([67ac80e](https://github.com/tryopendata/openchart/commit/67ac80ec002e0786ae8ed8607e583389aed4323c))
* implement seriesStyles in line chart compute pipeline ([54feb7c](https://github.com/tryopendata/openchart/commit/54feb7c266a90885bf218df6275449c17920f229))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.5.0

## [2.4.0](https://github.com/tryopendata/openchart/compare/engine-v2.3.5...engine-v2.4.0) (2026-03-08)


### Features

* space-aware axis tick density and rotated label support ([5a39a02](https://github.com/tryopendata/openchart/commit/5a39a02fa684736bf73ffaacde0032400d7c7796))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.4.0

## [2.3.5](https://github.com/tryopendata/openchart/compare/engine-v2.3.4...engine-v2.3.5) (2026-03-06)


* **engine:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.5

## [2.3.4](https://github.com/tryopendata/openchart/compare/engine-v2.3.3...engine-v2.3.4) (2026-03-06)


* **engine:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.4

## [2.3.3](https://github.com/tryopendata/openchart/compare/engine-v2.3.2...engine-v2.3.3) (2026-03-06)


* **engine:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.3

## [2.3.2](https://github.com/tryopendata/openchart/compare/engine-v2.3.1...engine-v2.3.2) (2026-03-06)


* **engine:** Synchronize openchart versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.3.2

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


### Features

* rename packages from @opendata-ai/* to @opendata-ai/openchart-* ([26f3e48](https://github.com/tryopendata/openchart/commit/26f3e484c58d43ee51b8dbd909f93765c14c8360))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 2.0.0

## [1.1.0](https://github.com/tryopendata/openchart/compare/v1.0.0...v1.1.0) (2026-03-02)


### Features

* coderbbit and npm publish ([b857251](https://github.com/tryopendata/openchart/commit/b85725110f3ef05d94707b4f92e91811bd7acb20))
* new visualize-data skill marketplace plugin ([dde291a](https://github.com/tryopendata/openchart/commit/dde291a66813e4c6071f5662373ab3f5ca8250ea))
* unified chart element editing system ([9fd5521](https://github.com/tryopendata/openchart/commit/9fd5521f809c6932a4060b7b47b43001a0111dfc))


### Bug Fixes

* replace as any with proper types in engine tests, tone down Claude hook ([705c274](https://github.com/tryopendata/openchart/commit/705c274080c9c25efceab006e885418ad1cb1bd1))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @opendata-ai/openchart-core bumped to 1.1.0
