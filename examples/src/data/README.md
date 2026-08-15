# Shared dataset pool

Every dataset used anywhere in the gallery lives here and is reused across
pages. One module per dataset, one import site (`./index.ts`). The pool is
capped at 20-30 datasets total; add or swap rather than growing without bound.

## Module shape

```ts
export const gdpGrowth = {
  source: 'Source: World Bank, World Development Indicators (2024)', // or 'Illustrative data'
  url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG',    // omit when illustrative
  data: [/* rows */],
};
```

- `source` is the string a chart passes to `chrome.source`, which always
  renders the citation.
- `url` is optional and present only for cited real-world data.
- `data` is a static snapshot. No runtime fetching, ever.

## Rules (from `plans/ladle-gallery/00-overview.md`)

1. **Verify each dataset once before citing it.** The OpenData MCP tools
   (`search_datasets`, `query_sql`) are the preferred verification path where
   coverage exists. Verify once, then cite; don't re-verify on every use.
2. **`'Illustrative data'` fallback.** Anything not verifiable gets
   `source: 'Illustrative data'` and no `url`.
3. **Never fabricate a citation.** A fabricated citation is worse than no
   citation on a product whose brand is data credibility. When in doubt, mark
   it illustrative.
4. **No runtime fetching.** Static snapshots only.

## What's verified vs. carried-over

- `population.ts` and `temperature-anomaly.ts` were checked against the
  OpenData MCP datasets `un/population-prospects` and `nasa/gistemp`
  respectively (ordering, magnitudes, and trend confirmed). Notes are in each
  module's header comment.
- The remaining modules carry editorial data extracted from the pre-existing
  story files, each with the original compiled citation it already shipped
  with (WHO, IOC, S&P Global, BLS, IEA, TIOBE, OWID/BP, BEA). These were not
  independently re-derived from an MCP dataset; the original citation is
  retained rather than re-attributed, and none were fabricated here.
- `department-budgets.ts` is `'Illustrative data'` (fabricated long names to
  exercise the axis-label rotation ladder).

## Current pool

| Module | Export | Source |
|---|---|---|
| `population.ts` | `populationByCountry` | UN Population Division, WPP 2024 (MCP-verified) |
| `temperature-anomaly.ts` | `temperatureAnomaly` | NASA GISS GISTEMP (MCP-verified) |
| `energy-mix.ts` | `energyMix` | Our World in Data / BP Statistical Review |
| `household-spending.ts` | `householdSpending` | BLS Consumer Expenditure Survey |
| `gdp-growth.ts` | `usGdpGrowth` | Bureau of Economic Analysis |
| `olympic-medals.ts` | `olympicMedals` | International Olympic Committee |
| `sp500-sectors.ts` | `sp500SectorReturns` | S&P Global |
| `renewable-capacity.ts` | `renewableCapacityAdditions` | International Energy Agency |
| `programming-languages.ts` | `programmingLanguages` | TIOBE Index |
| `us-payrolls.ts` | `usPayrolls` | Bureau of Labor Statistics |
| `department-budgets.ts` | `departmentBudgets` | Illustrative data |
| `saas-metrics.ts` | `saasMetrics` | Illustrative data |
| `ops-monitoring.ts` | `opsMonitoring` | Illustrative data |
| `marketing-funnel.ts` | `marketingFunnel` | Illustrative data |

This table lists notable modules, not the full pool — the barrel in `index.ts`
has grown well past the 20-30 cap stated above, which is due for a pruning
pass.
