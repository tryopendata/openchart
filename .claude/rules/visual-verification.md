---
paths:
  - "examples/**"
  - "packages/vanilla/**"
---

# Visual Verification for Charts

When making changes that affect chart rendering (annotations, axes, labels, layout, marks), use the `playwright-cli` skill to visually verify the result.

Key context for verification:

- Use `?mode=preview` to remove the Ladle sidebar - it compresses charts significantly
- Never declare visual changes "look good" from a thumbnail. Zoom into the problem area
- After screenshotting, check specifics: does text overlap lines? Do labels collide? Are connectors crossing data?

When positioning text annotations:

- Calculate approximate text width: `characters * fontSize * 0.55` pixels
- Account for endpoint labels at the right edge of line charts (~60-80px past last data point)
- If a text annotation is too long, use multi-line (`\n`) or shorter copy rather than hunting for magic coordinates
- The `background` property on text annotations masks chart lines behind text
