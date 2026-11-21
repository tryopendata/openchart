---
title: "Transforms"
description: "The filter, bin, calculate, timeUnit, aggregate, joinaggregate, fold, window and density transforms."
section: spec
order: 7
---

# Transforms

`transform` reshapes rows inside the spec before they are drawn: filter them, bin values, aggregate groups, fold a wide table into a long one or compute running totals. Use it when the rows you have aren't the rows the chart needs.

See it: [Transforms](https://openchart.steamfield.io/docs/the-spec/transforms/), [Histogram](https://openchart.steamfield.io/docs/distribution/histogram/) and [Density](https://openchart.steamfield.io/docs/distribution/density/).

## Transforms

`transform` is an ordered array run against the data before scales and layout. Each entry produces a new array that feeds the next. Source: `engine/src/transforms/`.

| Transform | Shape | What it does |
| --------- | ----- | ------------ |
| `filter` | `{ filter: Predicate }` | Keeps rows matching a predicate (field/op/value, or a relative time reference). |
| `bin` | `{ bin: true \| BinParams, field, as }` | Buckets a quantitative field. `BinParams` is `{ maxbins, step, nice, extent }`. `as` takes a string for the bin start, or `[start, end]` for both edges. |
| `calculate` | `{ calculate: { op, field, field2? \| value? }, as }` | Arithmetic between two fields or a field and a constant. |
| `timeUnit` | `{ timeUnit, field, as }` | Truncates a temporal field to a unit (year, month, week, day...). |
| `aggregate` | `{ aggregate: [{ op, field, as }], groupby }` | Collapses each group to one row. Ops: `count`, `sum`, `mean`, `median`, `min`, `max`, `variance`, `stdev`, `distinct`, `q1`, `q3`. |
| `joinaggregate` | `{ joinaggregate: [{ op, field, as }], groupby }` | Same ops, but keeps every row and writes the group's summary onto each. This is what expresses "this row's share of its group's total". |
| `fold` | `{ fold: [fields], as }` | Wide to long: one row per (row, field) pair. |
| `window` | `{ window: [{ op, field, as }], groupby, sort, frame }` | Running/ordered computations over a moving frame. |
| `density` | `{ density, groupby?, bandwidth?, extent?, cumulative?, counts?, steps?, as? }` | Gaussian kernel density estimate. Replaces the rows with one row per evaluation point per group, defaulting to fields `value` and `density`. Groups share one extent so the curves are comparable. |

A histogram is a bin plus a count aggregate, which is what `mark: 'histogram'` desugars to:

```ts
transform: [
  { bin: { maxbins: 24 }, field: "amount", as: ["bin_amount", "bin_amount_end"] },
  { aggregate: [{ op: "count", field: "amount", as: "__count" }], groupby: ["bin_amount", "bin_amount_end"] },
];
```

Carrying both bin edges matters: the end edge goes to `x2`, which is what puts the bars on a continuous axis instead of one equal-width slot per bin.
