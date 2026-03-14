# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
