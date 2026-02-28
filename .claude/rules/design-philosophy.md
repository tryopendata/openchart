---
paths:
  - "**/*"
---

# Design Philosophy

OpenChart follows an editorial data visualization philosophy inspired by the best newsroom chart tools. Every design decision should serve reader comprehension first.

## Core Principles

**Tell the story, then show the data.** Charts exist to communicate a finding, not to display raw numbers. Titles should state the takeaway in plain language ("Big Tech Roars Back") not describe the chart mechanically ("Line Chart of Index Returns"). Subtitles provide methodological context. Annotations call out the moments that matter.

**Smart defaults over manual tweaking.** Labels shouldn't overlap. Axes should pick sensible tick intervals. Colors should be accessible out of the box. The system should produce a publication-ready chart from a minimal spec. Users refine from a good starting point, not fix a broken one.

**Hierarchy through restraint.** The most important text (title) is biggest and boldest. Supporting text (subtitle, source, byline) steps down in size, weight, and contrast. Limit to 2-3 distinct text hierarchy levels. Gray for secondary information. Never shrink text to make it fit - redesign instead.

## Typography

- Sans-serif typefaces for all chart text
- Tabular (monospaced) numerals for axes, tables, and data labels so digits align
- Regular/medium weight for body text and annotations; bold only for titles and emphasis
- Minimum readable size ~10-11px for annotations, 12px for axis labels
- Sentence case, not uppercase (letter shapes aid recognition)

## Color

- Accessible by default: palettes must work for colorblind readers
- Use color to emphasize what readers should notice - highlight the signal, gray out the noise
- Avoid encoding meaning through color alone (pair with labels, patterns, or position)
- Categorical palettes should be distinguishable, not decorative

## Annotations & Labels

- Annotations are the editorial voice of the chart: use them to highlight outliers, explain context, and point out the story
- Place explanatory text close to the elements it describes
- Direct labeling on the chart (endpoint labels, inline labels) over legends when possible
- Repeat units in labels and tooltips rather than stating once in a description
- Annotations should never fight the data for visual attention - they support comprehension

## Chart Chrome

Every chart has a consistent structure:
1. **Title** - The takeaway in conversational language
2. **Subtitle** - Methodological context (units, time range, data scope)
3. **Chart area** - The visualization itself
4. **Source** - Data provenance
5. **Byline** - Attribution ("Chart: OpenChart")

## Responsiveness

Charts must work across viewport sizes. At smaller breakpoints: reduce tick density, simplify annotations to tooltips, adjust label placement. The chart should remain readable without horizontal scrolling.

## Simplicity

- Prefer direct labeling over legends
- Minimize gridlines (y-axis gridlines by convention, x-axis only when needed)
- No decorative elements that don't serve comprehension
- Whitespace is a feature, not wasted space
- If a chart needs heavy annotation to be understood, consider whether it's the right chart type
