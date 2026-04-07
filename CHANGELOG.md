# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [6.14.0] - 2026-04-07

### Features

- **engine:** refactor annotations and compile into focused modules
- **spec:** Vega-Lite spec alignment and release readiness (#64)
- **core:** add configurable watermark opt-out
- **chart:** add gradient fill support for chart marks (#60)
- **chart:** add grouped/dodged bar and column charts via stack encoding
- **sankey:** sankey label positions spec

### Bug Fixes

- consolidate table stories, add gradient fills, and fix temporal scale defaults
- scale domain, sort defaults, stacked area lines, and tooltip series fields
- several issues found in the core engine (title calculation, formatting, etc)
- negative value bar handling
- add ${version} to group PR title pattern

## [6.13.1] - 2026-04-06

### Bug Fixes

- several issues found in the core engine (title calculation, formatting, etc)

## [6.13.0] - 2026-04-05

### Features

- Vega-Lite spec alignment and release readiness (#64)

## [6.12.0] - 2026-04-05

### Features

- add configurable watermark opt-out

## [6.11.0] - 2026-04-02

### Features

- add gradient fill support for chart marks (#60)

## [6.10.0] - 2026-04-01

### Features

- add grouped/dodged bar and column charts via stack encoding

## [6.9.0] - 2026-04-01

### Features

- sankey label positions spec

## [6.8.0] - 2026-03-31

### Features

- **sankey:** add linkOpacity spec option for user control
- **sankey:** add valueFormat for tooltip and ARIA label formatting

### Bug Fixes

- address 6 editorial feedback issues
- **sankey:** address code review findings

## [6.7.1] - 2026-03-30

### Documentation

- add gentle OpenData references as a data source

## [6.7.0] - 2026-03-30

### Features

- add label prefix option and update brand watermark to tryOpenData.ai

## [6.6.0] - 2026-03-29

### Features

- add sankey diagram visualization type (#52)

### Bug Fixes

- sankey link rendering, animation, watermark, and legend layout

## [6.5.2] - 2026-03-26

### Bug Fixes

- skip annotation margin at compact breakpoints, remove caret connector, improve animation resize handling

## [6.5.1] - 2026-03-26

### Bug Fixes

- correct AnimationStagger.delay default in JSDoc (30 -> 80)

## [6.5.0] - 2026-03-26

### Features

- add CSS entrance animations and modularize styles

## [6.4.1] - 2026-03-26

### Bug Fixes

- move ignoreDeprecations to package tsconfigs

## [6.4.0] - 2026-03-26

### Features

- add rich chart editing with selection, deletion, and inline text editing

## [6.3.0] - 2026-03-26

### Features

- address all FEATURE-REQUESTS.md bugs and feature requests

## [6.2.1] - 2026-03-23

### Bug Fixes

- match temporal tick formatting to scale timezone

## [6.2.0] - 2026-03-23

### Features

- **graph:** add scale config to graph encoding channels and fix color precedence

## [6.1.5] - 2026-03-23

### Bug Fixes

- use UTC methods for temporal granularity and support custom axis/tooltip date formats

## [6.1.2] - 2026-03-23

### Bug Fixes

- improve chart margin computation for labels and annotations
- reserve bottom space for brand watermark in chrome layout
- y-axis title margin and default padding

## [6.0.0] - 2026-03-21

### Breaking Changes

- `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error, this makes it a compile error.

### Features

- add hiddenSeries filtering, graph edge hover/styles, JPG export, and simulation config
- add label format support to column charts and extract shared formatter
- add responsive overrides, legend hiding, and chrome text wrapping
- add SeriesStyle type for per-series visual overrides
- **core:** add areaChart, donutChart, and dotChart builder functions
- implement seriesStyles in line chart compute pipeline
- **layout:** prevent annotation/label/brand overlap with improved obstacle detection
- narrow createChart types, fix remount bugs, add Visualization component
- rename packages from @opendata-ai/* to @opendata-ai/openchart-*
- **responsive:** height-aware layout, chrome compression, and legend overflow
- space-aware axis tick density and rotated label support
- unified chart element editing system

### Bug Fixes

- **css:** remove height:100% from chart container to fix iOS clipping
- dark-mode theme preservation, graph visual tuning, and tooltip/legend toggle
- **graph:** support viz-dark class on wrapper element in CSS selectors
- move bun-symlink-resolver to scripts/ so it's not gitignored
- **svg:** prevent chart title clipping on iOS Safari

## [2.11.0] - 2026-03-14

### Features

- **layout:** prevent annotation/label/brand overlap with improved obstacle detection
- **axes:** text-aware tick density prevents label overlap

## [2.10.0] - 2026-03-12

### Features

- **responsive:** height-aware layout, chrome compression, and legend overflow
- **graph:** use fit-content to collapse container after canvas shrink

## [2.9.1] - 2026-03-12

### Bug Fixes

- **graph:** top-align fitBounds to eliminate dead space on mobile

## [2.9.0] - 2026-03-12

### Features

- **annotations:** interpolate positions for out-of-domain values on categorical scales

## [2.8.1] - 2026-03-12

### Bug Fixes

- **graph:** support viz-dark class on wrapper element in CSS selectors
- **graph:** apply theme colors and dark mode class to graph wrapper

## [2.8.0] - 2026-03-09

### Features

- Add responsive overrides, legend hiding, and chrome text wrapping

### Bug Fixes

- Move bun-symlink-resolver to scripts/ so it's not gitignored

## [2.7.0] - 2026-03-09

### Features

- Add label format support to column charts and extract shared formatter

## [2.6.0] - 2026-03-09

### Features

- Add format strings, label anchors, series styles, and dark mode docs

### Bug Fixes

- Resolve lint warnings in bar labels formatter

## [2.5.0] - 2026-03-09

### Features

- Add SeriesStyle type for per-series visual overrides
- Implement seriesStyles in line chart compute pipeline
- Export styles.css from all framework packages

### Bug Fixes

- Consolidate brand watermark into single tspan-based text element

## [2.4.0] - 2026-03-08

### Features

- Space-aware axis tick density and rotated label support

## [2.3.5] - 2026-03-06

### Bug Fixes

- Extract brand constants in table renderer

## [2.3.4] - 2026-03-06

### Bug Fixes

- Align canvas brand watermark opacity with SVG and table renderers

## [2.3.3] - 2026-03-06

### Bug Fixes

- Extract brand min-width constant in canvas renderer

## [2.3.2] - 2026-03-06

### Bug Fixes

- Add missing font-weight to table brand watermark

## [2.3.1] - 2026-03-06

### Bug Fixes

- Increase bottom padding on graph watermark to match right padding

## [2.3.0] - 2026-03-06

### Features

- Export core and engine dependencies from client libs so consumers only need a single dependency

## [2.2.1] - 2026-03-06

### Bug Fixes

- Preserve user-provided colors when theme is already dark
- Support transparent backgrounds in dark-mode adapter
- Add tooltip and legend toggle props to Graph components
- Reduce max node radius, label font sizes, and glow intensity

## [2.1.0] - 2026-03-04

### Features

- Visual QA audit fixes and documentation improvements
- Auto-sort line and area chart data by x-axis

### Bug Fixes

- Make publish workflow idempotent for re-runs

## [2.0.0] - 2026-03-03

### Breaking Changes

- `createChart` and `ChartInstance.update()` now accept `ChartSpec | GraphSpec` instead of `VizSpec`. Passing a `TableSpec` to `createChart` was always a runtime error - this makes it a compile error. The same narrowing applies to `<Chart>` component props and `useChart` hooks across React, Vue, and Svelte.

### Features

- Add areaChart, donutChart, and dotChart builder functions
- Narrow createChart types, fix remount bugs, add Visualization component
- Rename packages from @opendata-ai/* to @opendata-ai/openchart-*

## [1.1.0] - 2026-03-02

### Features

- CodeRabbit and npm publish
- Unified chart element editing system
- New visualize-data skill marketplace plugin

### Bug Fixes

- Replace as any with proper types in engine tests, tone down Claude hook

## [1.0.0] - 2026-02-28

### Added

- Initial release of `@opendata-ai/openchart-core`, `@opendata-ai/openchart-engine`, `@opendata-ai/openchart-vanilla`, `@opendata-ai/openchart-react`, `@opendata-ai/openchart-vue`, `@opendata-ai/openchart-svelte`
- Chart types: line, area, bar, column, scatter, dot, pie, donut
- Data tables with sort, search, pagination, heatmap, sparklines, inline bars, category colors
- Force-directed graph visualization with canvas rendering
- Declarative annotation system (reference lines, ranges, text callouts)
- Dark mode support (auto, force, off)
- Deep-mergeable theme system
- Auto-generated accessibility (alt text, ARIA labels, keyboard navigation)
- Responsive breakpoint-aware layout
- Export to SVG, PNG, CSV
