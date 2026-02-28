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
