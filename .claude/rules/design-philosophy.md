---
paths:
  - "**/*"
---

# Design Philosophy

Every design decision should serve reader comprehension first.

## Core Principles

**Tell the story, then show the data.** Charts exist to communicate a finding, not to display raw numbers. Titles should state the takeaway in plain language ("Big Tech Roars Back") not describe the chart mechanically ("Line Chart of Index Returns"). Subtitles provide methodological context. Annotations call out the moments that matter.

**Smart defaults over manual tweaking.** Labels shouldn't overlap. Axes should pick sensible tick intervals. Colors should be accessible out of the box. The system should produce a publication-ready chart from a minimal spec. Users refine from a good starting point, not fix a broken one.

**Hierarchy through restraint.** The most important text (title) is biggest and boldest. Supporting text (subtitle, source, byline) steps down in size, weight, and contrast. Limit to 2-3 distinct text hierarchy levels. Gray for secondary information. Never shrink text to make it fit, redesign instead.

## Simplicity

- Prefer direct labeling over legends
- Minimize gridlines (y-axis gridlines by convention, x-axis only when needed)
- No decorative elements that don't serve comprehension
- Whitespace is a feature, not wasted space
- If a chart needs heavy annotation to be understood, consider whether it's the right chart type

## Detailed Guidance

For chart selection reasoning, color strategy, editorial writing, typography hierarchy, and design review checklists, load `Skill(openchart:visualize-data)` and consult its design philosophy references.
