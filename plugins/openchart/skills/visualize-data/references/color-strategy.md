# Color Strategy

Color is a narrative tool, not decoration. The right color strategy directs attention to the story.

## Three Strategies

| Strategy | Use when | How |
| --- | --- | --- |
| **Highlight + gray** | One series or data point matters most | Key element in brand/accent color, everything else gray. This is the editorial default. |
| **Sequential** | Magnitude or intensity matters | Single hue from light (low value, near background) to saturated (high value). For heatmaps, choropleths. |
| **Categorical** | Must distinguish 2-5 groups equally | Different hues with equal visual weight. No hue implies "more" or "less." |

## Highlight + Gray is the Default

Most editorial charts use this approach because it forces a story. When one element is colored and the rest are gray, the reader's eye goes directly to the signal. If everything is colored, nothing stands out.

Use categorical palettes only when the story genuinely requires distinguishing multiple groups equally. If one group is the protagonist, highlight it and gray the rest.

## How Many Colors

| Count | Guidance |
| --- | --- |
| 1 (+ gray) | Ideal for most editorial charts. Forces focus. |
| 2-3 | Good for direct comparison between specific groups |
| 4-5 | Maximum for categorical. Beyond this, hues become hard to distinguish. |
| 6+ | Regroup into "Other", use highlight+gray, or switch to small multiples |

## Color Ramps

**Sequential**: light to dark within a single hue. Light values sit near the background (low data values), dark values carry visual weight (high data values). Good for: heatmaps, choropleths, single-variable intensity.

**Diverging**: two complementary hues meeting at a meaningful midpoint (often zero, or a target value). The midpoint should be semantically meaningful, not just the mathematical center. Good for: positive/negative change, above/below target, deviation from average.

## Accessibility

Color vision deficiency affects ~8% of men and ~0.5% of women (predominantly red-green).

| Rule | Why |
| --- | --- |
| Never encode meaning through hue alone | Pair color with labels, patterns, or position |
| Avoid red-green as the only differentiator | Use blue-orange or other colorblind-safe pairs |
| Test against deuteranopia simulation | Catches the most common deficiency |
| Ensure sufficient contrast ratios | WCAG AA minimum: 4.5:1 for text, 3:1 for large text/graphics |
| Provide text labels on data points | Labels work regardless of color perception |

## Semantic Conventions

These associations are culturally common in Western contexts but not universal:

| Color | Convention | Caveat |
| --- | --- | --- |
| Red | Loss, decline, danger, negative change | In Chinese and some Asian cultures, red signals prosperity |
| Green | Growth, positive change, success | Don't rely on red-green contrast alone |
| Blue | Neutral, primary, trustworthy | Safe default when no semantic meaning needed |
| Gray | Context, background, de-emphasized | The workhorse of editorial charts |

Always provide context beyond color. A red bar with a "-12%" label communicates decline through both channels.

## Dark Mode

When supporting dark mode:
- Lighten desaturated colors so they remain visible against dark backgrounds
- Maintain WCAG contrast ratios (recalculate against dark background)
- Sequential ramps may need inversion (dark-to-light instead of light-to-dark)
- Gray context elements need higher lightness to remain visible
- Test the full palette in both modes before shipping
