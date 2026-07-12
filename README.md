# @opendata-ai/openchart

[![CI](https://github.com/tryopendata/openchart/actions/workflows/ci.yml/badge.svg)](https://github.com/tryopendata/openchart/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@opendata-ai/openchart-core)](https://www.npmjs.com/package/@opendata-ai/openchart-core)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

Publication-quality data graphics from a JSON spec. You describe what the chart should communicate, and the engine handles scales, label placement, accessibility, and responsive layout. The result reads like a polished infographic, not a developer's debug output.

The spec is a plain JSON object that both humans and LLMs can author. The headless engine means the same spec renders in React, Vue, Svelte, or vanilla JS without code changes.

<img alt="OpenChart example charts" src="https://github.com/user-attachments/assets/a08a9237-8fe0-45ff-8203-898848a142ab" />

### [Interactive Examples](https://tryopendata.github.io/openchart/)

## Quick start

```bash
npm install @opendata-ai/openchart-react
```

```tsx
import { Chart } from "@opendata-ai/openchart-react";

const spec = {
  type: "bar",
  data: [
    { language: "Python", popularity: 29 },
    { language: "JavaScript", popularity: 24 },
    { language: "TypeScript", popularity: 17 },
    { language: "Java", popularity: 14 },
    { language: "Go", popularity: 10 },
  ],
  encoding: {
    x: { field: "popularity", type: "quantitative" },
    y: { field: "language", type: "nominal" },
  },
  chrome: {
    title: "Python leads developer mindshare",
    subtitle: "2024 developer survey results",
    source: "Source: Stack Overflow",
  },
};

function App() {
  return (
    <div style={{ width: 600, height: 400 }}>
      <Chart spec={spec} />
    </div>
  );
}
```

That's the whole interface. `encoding` maps data fields to visual channels. `chrome` adds editorial framing. The engine figures out the rest.

The fixed-height wrapper is optional. Without one, the chart sizes itself: a 400px budget for the visualization (axes + plot), and titles, legends, and other chrome grow the figure on top of that. Give the wrapper an explicit height when you need the chart to fit a fixed slot.

## Features

| Category    | What you get                                                                        |
| ----------- | ----------------------------------------------------------------------------------- |
| Charts      | Line, area, bar, column, scatter, dot, pie, donut                                   |
| Tables      | Sort, search, pagination, heatmap cells, sparklines, inline bars, category colors   |
| Graphs      | Force-directed networks, canvas rendering, node interaction, search, zoom           |
| Chrome      | Title, subtitle, source, byline, footer                                             |
| Annotations | Reference lines, highlighted ranges, text callouts                                  |
| Themes      | Deep-mergeable config for colors, fonts, spacing. Dark mode: auto, force, or off    |
| A11y        | Auto-generated alt text, ARIA labels, keyboard navigation, screen reader tables     |
| Responsive  | Breakpoint-aware layout with adaptive label density, legend position, and placement |
| Export      | SVG, PNG, CSV                                                                       |

Tables are a first-class visualization type with heatmaps, sparklines, inline bars, and more.

<img alt="OpenChart data table" src="https://github.com/user-attachments/assets/392db37a-1ee1-4659-8b51-4fab0890e7a9" />

![OpenChart graph and charts](https://github.com/user-attachments/assets/3f20cfab-76fe-4a44-8d8d-2fe624e6b3de)

## Installation

| Use case                     | Install                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| React                        | `npm install @opendata-ai/openchart-react`                      |
| Vue 3                        | `npm install @opendata-ai/openchart-vue`                        |
| Svelte 5                     | `npm install @opendata-ai/openchart-svelte`                     |
| Vanilla JS / any framework   | `npm install @opendata-ai/openchart-vanilla`                    |
| Types only / custom renderer | `npm install @opendata-ai/openchart-core @opendata-ai/openchart-engine` |

Each package re-exports the types you need, so you typically only install one.

## Documentation

| Doc | What's in it |
| --- | ------------ |
| [Getting started](docs/getting-started.md) | Hands-on tutorial from first chart to custom themes, tables, and graphs |
| [Spec reference](docs/spec-reference.md) | Field-by-field type reference for ChartSpec, TableSpec, and GraphSpec |
| [Integration guide](docs/integration-guide.md) | Events, controlled tables, export, responsive behavior, vanilla JS lifecycle |
| [Accessibility](docs/accessibility.md) | What's automatic, what's opt-in (alt text, pattern fills, contrast warnings), WCAG mapping |
| [Agent patterns](docs/agent-patterns.md) | Visualization patterns and cookbook for LLM-generated charts |
| [Architecture](docs/architecture.md) | Compilation pipeline, package boundaries, design decisions |
| [Migrating to v8](docs/migrating-v8.md) | Breaking changes, before/after specs, and jq codemod recipes for the v8 upgrade |
| [Contributing](CONTRIBUTING.md) | Setup, running tests, adding chart types, PR guidelines |

## Packages

```
@opendata-ai/openchart-core       Types, theme, colors, a11y, locale (no DOM)
@opendata-ai/openchart-engine     Headless compiler: spec in, layout out (no DOM)
@opendata-ai/openchart-vanilla    DOM rendering: SVG charts, HTML tables, canvas graphs
@opendata-ai/openchart-react      React wrappers with lifecycle management
@opendata-ai/openchart-vue        Vue 3 wrappers with lifecycle management
@opendata-ai/openchart-svelte     Svelte 5 wrappers with lifecycle management
```

Dependency direction: `core <- engine <- vanilla <- react / vue / svelte`. No lateral imports.

## Claude Code skill

If you use [Claude Code](https://docs.anthropic.com/en/docs/claude-code), the OpenChart skill gives Claude knowledge of the spec grammar, encoding rules, and design best practices so it can generate publication-quality specs from your data.

```shell
/plugin marketplace add tryopendata/skills
/plugin install openchart@openchart
/openchart
```

Or reference it in your Claude Code rules and prompts: `Skill(openchart:openchart)`

## Part of the OpenData ecosystem

OpenChart is the visualization layer for [OpenData](https://tryopendata.ai), an open source platform for discovering, exploring, and visualizing public datasets. If you're looking for data to chart, that's a good place to start.

## License

Apache 2.0
