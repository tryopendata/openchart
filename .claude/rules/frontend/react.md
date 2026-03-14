---
paths:
  - "packages/react/**/*.tsx"
  - "packages/react/**/*.ts"
  - "examples/**/*.tsx"
---

# React Patterns

## Component Structure

- Function components with hooks only
- Keep components focused on one responsibility
- Extract custom hooks for reusable logic
- Props interfaces exported alongside components

## This Library's React API

The react package wraps vanilla renderers. Key components:

- `<Chart spec={spec} />` - renders a chart from a VizSpec
- `<DataTable spec={spec} />` - renders a data table from a TableSpec
- `<Graph spec={spec} />` - renders a network graph from a GraphSpec
- `<VizThemeProvider theme={theme}>` - provides theme context to descendants

## Testing Components

Use @testing-library/react with happy-dom:

```typescript
import { render, screen } from '@testing-library/react'
import { Chart } from '@opendata-ai/openchart-react'

test('renders chart', () => {
  render(<Chart spec={spec} />)
  expect(screen.getByRole('figure')).toBeInTheDocument()
})
```
