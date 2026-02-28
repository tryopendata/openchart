---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "**/__tests__/**"
---

# Frontend Testing

Extends the universal testing rules with vitest and testing-library patterns.

## Commands

```bash
bun run test                    # Run all tests
vitest run --watch              # Watch mode
vitest run packages/react       # Single package
vitest run -t "pattern"         # Run matching tests
```

## DOM Environment

Tests use happy-dom for DOM simulation. No need for jsdom.

## Async Waiting

```typescript
await waitFor(() => expect(element).toBeVisible())
// NOT: await sleep(500)
```

## Component Testing (React package)

```typescript
import { render, screen } from '@testing-library/react'

test('renders chart', () => {
  render(<Chart spec={spec} />)
  expect(screen.getByRole('figure')).toBeInTheDocument()
})
```
