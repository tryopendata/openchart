---
paths:
  - "**/*"
---

# Verification

Before claiming work is complete, load the ce:verification-before-completion skill.

Always verify:
- Tests pass (`bun run test`)
- Linting passes (`bun run lint`)
- Types check (`bun run typecheck`)
- Build succeeds (`bun run build`)
