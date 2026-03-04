---
paths:
  - "examples/**"
  - "packages/vanilla/**"
---

# Visual Verification for Charts

When making changes that affect chart rendering (annotations, axes, labels, layout, marks), use the `playwright-cli` skill to visually verify the result.

## Screenshot Protocol

1. Navigate to the story URL with `?mode=preview` (removes Ladle sidebar that compresses charts)
2. Wait for render (`sleep 2` before screenshot)
3. Take screenshot and **scan every zone systematically** - never glance and say "looks good"

## Zone-by-Zone Scan

After every screenshot, check these zones in order:

1. **Chrome zone** (top): Is the title/subtitle truncated or overlapping chart content?
2. **Y-axis** (left): Are category labels clipped or overlapping each other?
3. **X-axis** (bottom): Are tick labels too dense, touching, or overlapping?
4. **Plot area** (center): Are annotations, data labels, or connectors overlapping each other or data marks?
5. **Legend**: Is it colliding with endpoint labels, axis ticks, or data?
6. **Edges** (all four sides): Is any content clipped at the container boundary?

**If you find any defect, fix it before reporting "looks good."**

For the full defect catalog with specific fix patterns, load `Skill(openchart:visualize-data)` and read [references/visual-qa.md](references/visual-qa.md).

## When Positioning Text Annotations

- Calculate approximate text width: `characters * fontSize * 0.55` pixels
- Account for endpoint labels at the right edge of line charts (~60-80px past last data point)
- If a text annotation is too long, use multi-line (`\n`) or shorter copy rather than hunting for magic coordinates
- The `background` property on text annotations masks chart lines behind text
- Check connector direction: the connector should not cross through the text box or point away from the data

## Compact Variants

When a story has both full-size and compact variants, verify both. Compact variants (< 400px wide) commonly fail with:
- Clipped titles (need shorter chrome text in a separate `compactSpec`)
- Overcrowded axis ticks (need explicit `tickCount` override)
- Label collisions (need `labels: { density: "none" }`)
