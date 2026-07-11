# Ranking and change

Recipes for the FT Visual Vocabulary "ranking" family: slope charts, bump charts, and range (dumbbell/arrow) charts. All three answer the same editorial question, "who moved, and by how much?", with different emphasis.

Slope and bump are not separate chart types. They are `mark: "line"` plus a handful of public spec fields, documented here as copy-paste recipes. Range is its own mark (`mark: "range"`). Every spec on this page is pinned pixel-for-pixel by the visual regression suite, so they render exactly as shipped.

All specs work with any framework. Swap the import to match yours:

```tsx
// React
import { Chart } from "@opendata-ai/openchart-react";
<Chart spec={spec} />

// Vue
import { Chart } from "@opendata-ai/openchart-vue";
<Chart :spec="spec" />

// Svelte
import { Chart } from "@opendata-ai/openchart-svelte";
<Chart {spec} />

// Vanilla JS
import { createChart } from "@opendata-ai/openchart-vanilla";
createChart(container, spec);
```

---

## Slope

Two points in time, one line per series. The strongest form for "before vs after": every crossing line is a rank change, every steep line is a big move. Values live on the labels, so the y axis and gridlines go away entirely.

```ts
const spec = {
  mark: 'line',
  data: [
    { year: '2019', brand: 'Samsung', share: 0.216 },
    { year: '2024', brand: 'Samsung', share: 0.19 },
    { year: '2019', brand: 'Huawei', share: 0.176 },
    { year: '2024', brand: 'Huawei', share: 0.043 },
    { year: '2019', brand: 'Apple', share: 0.139 },
    { year: '2024', brand: 'Apple', share: 0.187 },
    { year: '2019', brand: 'Xiaomi', share: 0.092 },
    { year: '2024', brand: 'Xiaomi', share: 0.136 },
    { year: '2019', brand: 'Oppo', share: 0.083 },
    { year: '2024', brand: 'Oppo', share: 0.087 },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'share',
      type: 'quantitative',
      axis: false,
      scale: { zero: false },
    },
    color: { field: 'brand', type: 'nominal' },
  },
  endpointLabels: {
    ends: 'both',
    content: 'label value',
    format: '.0%',
  },
  legend: { show: false },
  chrome: {
    title: 'Apple and Xiaomi Split What Huawei Lost',
    subtitle: 'Share of global smartphone shipments, 2019 vs 2024',
    source: 'Source: IDC Worldwide Quarterly Mobile Phone Tracker',
  },
};
```

What each field does:

- `endpointLabels.ends: 'both'` puts a label column at both edges (plain endpoint labels are trailing-edge only).
- `endpointLabels.content: 'label value'` joins the series name and its formatted value on one line ("Samsung 22%"). The classic FT look, name plus value on the left and value alone on the right, is `content: { leading: 'label value', trailing: 'value' }`.
- `axis: false` on y removes the axis and its gridlines. The labels carry the values, so an axis would be redundant ink.
- `scale: { zero: false }` lets the two rails span the data range instead of anchoring at zero, which is what makes the slopes readable.
- `legend: { show: false }` because the labels already identify every series.

Because the spec sets `endpointLabels` explicitly, the label columns survive the compact (under 400px) breakpoint, where auto endpoint labels would normally hand off to a legend. A slope without its labels is unreadable, so explicit opt-in wins.

**Live examples**: [Slope](https://tryopendata.github.io/openchart/?story=testing--fixtures--slope-market-share) | [Slope at 320px](https://tryopendata.github.io/openchart/?story=testing--fixtures--slope-market-share-compact)

---

## Bump

Rank over time. The y axis is the finishing position, reversed so 1st sits at the top, with ordinal tick labels ("1st, 2nd, 3rd"). Point markers anchor each step; monotone interpolation keeps the lines readable through crossings. Ties are fine: two series with the same rank share the same row.

```ts
const spec = {
  mark: { type: 'line', interpolate: 'monotone', point: true },
  data: [
    { season: '2019', team: 'Mercedes', position: 1 },
    { season: '2020', team: 'Mercedes', position: 1 },
    { season: '2021', team: 'Mercedes', position: 1 },
    { season: '2022', team: 'Mercedes', position: 3 },
    { season: '2023', team: 'Mercedes', position: 2 },
    { season: '2024', team: 'Mercedes', position: 4 },
    { season: '2019', team: 'Red Bull', position: 3 },
    { season: '2020', team: 'Red Bull', position: 2 },
    { season: '2021', team: 'Red Bull', position: 2 },
    { season: '2022', team: 'Red Bull', position: 1 },
    { season: '2023', team: 'Red Bull', position: 1 },
    { season: '2024', team: 'Red Bull', position: 3 },
    { season: '2019', team: 'Ferrari', position: 2 },
    { season: '2020', team: 'Ferrari', position: 6 },
    { season: '2021', team: 'Ferrari', position: 3 },
    { season: '2022', team: 'Ferrari', position: 2 },
    { season: '2023', team: 'Ferrari', position: 3 },
    { season: '2024', team: 'Ferrari', position: 2 },
    { season: '2019', team: 'McLaren', position: 4 },
    { season: '2020', team: 'McLaren', position: 3 },
    { season: '2021', team: 'McLaren', position: 4 },
    { season: '2022', team: 'McLaren', position: 5 },
    { season: '2023', team: 'McLaren', position: 4 },
    { season: '2024', team: 'McLaren', position: 1 },
    { season: '2019', team: 'Alpine', position: 5 },
    { season: '2020', team: 'Alpine', position: 5 },
    { season: '2021', team: 'Alpine', position: 5 },
    { season: '2022', team: 'Alpine', position: 4 },
    { season: '2023', team: 'Alpine', position: 6 },
    { season: '2024', team: 'Alpine', position: 6 },
  ],
  encoding: {
    x: { field: 'season', type: 'ordinal' },
    y: {
      field: 'position',
      type: 'quantitative',
      scale: { reverse: true, zero: false },
      axis: { values: [1, 2, 3, 4, 5, 6], format: 'ordinal' },
    },
    color: { field: 'team', type: 'nominal' },
  },
  endpointLabels: {
    ends: 'both',
    content: 'label',
    showMarker: false,
  },
  legend: { show: false },
  chrome: {
    title: 'McLaren Went From Midfield to Champions',
    subtitle: 'Formula 1 constructors championship, final position by season',
    source: 'Source: FIA official standings',
  },
};
```

What each field does:

- `scale: { reverse: true }` flips the y range so rank 1 renders at the top. `zero: false` keeps rank 0 off the axis.
- `axis: { values: [1, 2, 3, 4, 5, 6], format: 'ordinal' }` pins one tick per rank and formats them as ordinals. `format: 'ordinal'` is an OpenChart extension to the d3-format strings; it works anywhere a format string does.
- `interpolate: 'monotone'` curves the lines through rank changes without overshooting; `point: true` marks every step.
- `endpointLabels.content: 'label'` puts the name alone at both ends (the rank is already on the axis). `showMarker: false` skips the open-circle end markers, which would double up with the step points.

If your data has raw scores instead of precomputed ranks, derive the rank with the window transform first:

```ts
transform: [
  {
    window: [{ op: 'rank', field: 'points', as: 'position' }],
    sort: [{ field: 'points', order: 'descending' }],
    groupby: ['season'],
  },
],
```

**Live example**: [Bump](https://tryopendata.github.io/openchart/?story=testing--fixtures--bump-constructors)

---

## Range (dumbbell)

When the story is the size of the change per category rather than trajectories over time, use `mark: "range"`: one row per category, a dot at the start and end values. Set `mark: { type: 'range', style: 'arrow' }` for an arrowhead at the end value, or `style: 'bar'` for a plain floating bar.

```ts
const spec = {
  mark: 'range',
  data: [
    { country: 'Japan', y2000: 81.1, y2023: 84.7 },
    { country: 'South Korea', y2000: 76.0, y2023: 84.3 },
    { country: 'USA', y2000: 76.7, y2023: 79.3 },
    { country: 'China', y2000: 71.6, y2023: 78.6 },
    { country: 'Brazil', y2000: 70.1, y2023: 75.8 },
    { country: 'Russia', y2000: 65.5, y2023: 73.0 },
    { country: 'India', y2000: 62.7, y2023: 72.0 },
    { country: 'Nigeria', y2000: 46.5, y2023: 54.6 },
  ],
  encoding: {
    y: {
      field: 'country',
      type: 'nominal',
      sort: { field: 'y2023', order: 'ascending' },
    },
    x: {
      field: 'y2000',
      type: 'quantitative',
      title: '2000',
      axis: { title: 'Life expectancy at birth (years)' },
    },
    x2: { field: 'y2023', title: '2023' },
  },
  chrome: {
    title: 'Everyone Is Living Longer, but the Gaps Persist',
    subtitle: 'Life expectancy at birth, 2000 (gray) vs. 2023 (accent), selected countries',
    source: 'Source: UN World Population Prospects 2024',
  },
};
```

**Live examples**: [Dumbbell](https://tryopendata.github.io/openchart/?story=testing--fixtures--range-dumbbell) | [Arrow](https://tryopendata.github.io/openchart/?story=testing--fixtures--range-arrow) | [Range bar](https://tryopendata.github.io/openchart/?story=testing--fixtures--range-bar)

---

## Picking within the family

| You want to show | Use |
|------------------|-----|
| Before vs after for many series, values matter | Slope |
| Rank trajectories across several periods | Bump |
| Size of change per category, one period pair | Range (dumbbell or arrow) |
| Continuous values over many periods | Plain [multi-series line](chart-types.md#line) |

---

## Related docs

- [Chart types](chart-types.md) for the full gallery of supported forms
- [Spec reference](spec-reference.md) for field-by-field type details, including `endpointLabels` and scale options
- [Visualization patterns](agent-patterns.md) for more data storytelling recipes
