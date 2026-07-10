---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/tests/**"
  - "**/__tests__/**"
---

# Testing Rules

When writing tests, load the ce:writing-tests skill for general patterns.

## Flaky Tests

When fixing flaky tests, load the ce:fixing-flaky-tests skill.

| Symptom | Likely Cause |
|---------|--------------|
| Passes alone, fails in suite | Shared state between tests |
| Random timing failures | Race condition or missing await |
| DOM assertion fails intermittently | Missing waitFor or async render |

## Layout Geometry Tests

Collision and fitting logic (label rotation, thinning, tick density) is
font-size- and width-dependent. Tests for it must sweep both dimensions:

- Font: `axisTick: 11` (default) AND `axisTick: 14` (the deployed blog theme)
- Width: ~330 (blog mobile), ~360 (small phone), ~680 (desktop-ish)

Why: the 7.9.x dropped-label bug passed every default-theme test across three
patch releases; it only reproduced with `theme: { fonts: { sizes: { axisTick: 14 } } }`
at phone widths. The `mobile-regression--one-wide-x-label-large-ticks` story
mirrors that production config.
