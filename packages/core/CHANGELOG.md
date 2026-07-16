# Changelog

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

## [6.13.1](https://github.com/tryopendata/openchart/compare/core-v6.13.0...core-v6.13.1) (2026-04-06)


### Bug Fixes

* several issues found in the core engine (title calculation, formatting, etc) ([7861c0f](https://github.com/tryopendata/openchart/commit/7861c0f04157f0f593c47299b7d53baf8d5ac879))

## [6.13.0](https://github.com/tryopendata/openchart/compare/core-v6.12.0...core-v6.13.0) (2026-04-05)


### Features

* Vega-Lite spec alignment and release readiness ([#64](https://github.com/tryopendata/openchart/issues/64)) ([586a113](https://github.com/tryopendata/openchart/commit/586a11313f2b58f4d00f21be70ea53bed8d57b43))

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
