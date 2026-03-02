# OpenChart Plugin for Claude Code

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that teaches Claude how to generate publication-quality [OpenChart](https://github.com/tryopendata/openchart) specs. Covers chart types, encoding rules, annotation patterns, theming, color strategy, typography, and editorial design review.

## Install

```shell
# Add the marketplace
/plugin marketplace add tryopendata/openchart

# Install the plugin
/plugin install openchart@openchart
```

## Use

Invoke the skill as a slash command:

```shell
/visualize-data
```

Or reference it in your Claude Code rules and prompts:

```
Skill(openchart:visualize-data)
```

## What's included

The `visualize-data` skill provides Claude with:

- **Chart selection** decision tree and perceptual ranking guidance
- **Spec grammar** for all chart types: line, area, bar, column, scatter, dot, pie, donut
- **Table specs** with heatmaps, sparklines, inline bars, search, pagination
- **Graph specs** for network/relationship data with force-directed layout
- **Encoding rules** for mapping data fields to visual channels (x, y, color, size, detail)
- **Annotation system** for text callouts, reference lines, and highlighted ranges
- **Theme configuration** for colors, fonts, spacing, and dark mode
- **Design philosophy** references covering color strategy, editorial writing, typography, and a 14-point design review checklist

## License

MIT
