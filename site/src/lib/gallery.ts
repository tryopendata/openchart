/**
 * The examples gallery's entries, in wall order, and the Visualizations
 * sections it leaves out. /examples/, each /examples/<slug>/ page, the social
 * cards and the search index all derive from this list. Every entry draws a
 * tier-1 dataset and has a shape on the wall (components/gallery/tile-size.ts).
 * Plain data, so the build test and the browser tests can read it:
 * components/gallery/wall.ts checks it against the demos and docs, and packs it
 * onto the wall with no holes, when the gallery pages build.
 */
import type { WallEntry } from "../components/gallery/tile-size";
import type { GalleryGap } from "./gallery-types";

/** Every gallery entry, in the order the wall shows them. */
export const galleryEntries: readonly WallEntry[] = [
  {
    slug: "us-energy-flow",
    demo: "flow/sankey-basic",
    kind: "flow",
    shape: "lead",
    size: "wide",
    title: "US energy flow, 2024",
    description:
      "Two-thirds of the energy the US used in 2024 ended as rejected energy. Each link's width is its flow in quadrillion BTU, set by encoding.value.",
    docs: "/docs/flow/sankey/",
  },
  {
    slug: "unemployment-above-5-percent",
    demo: "gallery/unemployment-choropleth",
    kind: "maps",
    shape: "feature",
    keepKey: true,
    title: "States with unemployment above 5%",
    description:
      "Four of the seven states above 5% are in the West. Each state takes one of two colors, joined to the US atlas through encoding.key.",
    docs: "/docs/maps/choropleth/",
    size: "wide",
    ladle: "maps--maps#us-state-unemployment",
  },
  {
    slug: "inflation-against-2-percent",
    demo: "gallery/inflation-reference",
    kind: "composition",
    title: "US inflation against a 2% line, 2019 to 2024",
    description:
      "Inflation stayed above 2% from mid-2021 through 2024. The 2% line is a second entry in the spec's layer array, drawn on the same scale.",
    docs: "/docs/composition/layers/",
    ladle: "charts--building-blocks#layered",
  },
  {
    slug: "most-populous-countries",
    demo: "comparison/bar-sorted",
    kind: "comparison",
    title: "The 10 most populous countries, 2025",
    description:
      "India and China each have about four times the US population. One setting, sort on the y channel, orders the bars by value.",
    docs: "/docs/comparison/bar/",
  },
  {
    slug: "us-energy-by-source",
    demo: "gallery/energy-sources-donut",
    kind: "part-to-whole",
    shape: "square",
    keepKey: true,
    title: "US energy use by source, 2024",
    description:
      "Petroleum and natural gas supplied nearly three-quarters of US energy in 2024. The donut is an arc mark with innerRadius and a centerLabel.",
    docs: "/docs/part-to-whole/pie-donut/",
    ladle: "charts--pie-and-donut#donut-center-metric",
  },
  {
    slug: "electricity-mix-waffle",
    demo: "gallery/electricity-waffle",
    kind: "part-to-whole",
    shape: "square",
    keepKey: true,
    title: "US generation from six sources in 100 squares, 2023",
    description:
      "Nuclear generated more than wind and solar together. Each square is one percent, and color.highlight picks out the three sources compared.",
    docs: "/docs/part-to-whole/waffle/",
    ladle: "charts--pie-and-donut#waffle",
  },
  {
    slug: "life-expectancy-table",
    demo: "gallery/country-table",
    kind: "tables",
    shape: "square",
    title: "Life expectancy, GDP per person and population in 12 large economies",
    description:
      "Japan has the longest life expectancy of the 12. Heatmap cells shade life expectancy and bar cells draw GDP per person in one table.",
    docs: "/docs/tables/column-types/",
    ladle: "tables--tables#heatmap-cells",
  },
  {
    slug: "unemployment-beeswarm",
    demo: "gallery/unemployment-beeswarm",
    kind: "distribution",
    shape: "wide",
    keepKey: true,
    title: "State unemployment rates, one dot per state",
    description:
      "Seven states and DC had unemployment of 5% or more. The beeswarm mark gives each state its own dot, colored by a two-value band.",
    docs: "/docs/distribution/beeswarm/",
    ladle: "charts--scatter-and-distribution#beeswarm",
  },
  {
    slug: "unemployment-histogram",
    demo: "gallery/unemployment-histogram",
    kind: "distribution",
    title: "State unemployment rates in half-point bins",
    description:
      "Unemployment was under 4% in 22 states. The histogram mark counts the rates itself, and x.bin sets the half-point bins.",
    docs: "/docs/distribution/histogram/",
    ladle: "charts--scatter-and-distribution#histogram",
  },
  {
    slug: "electricity-mix-heatmap",
    demo: "correlation/heatmap-basic",
    kind: "correlation",
    title: "Share of generation from six sources by year, 2016 to 2023",
    description:
      "Gas rose as coal's share of generation from six sources halved. A rect mark puts year on x, source on y and share on a sequential color scale.",
    docs: "/docs/correlation/heatmap/",
  },
  {
    slug: "global-temperature",
    demo: "the-spec/scales-temporal",
    kind: "change-over-time",
    title: "Global temperature anomaly, 1900 to 2025",
    description:
      "Global temperature rose 1.16°C from 1970 to 2025. A temporal x axis spaces the readings by date, so the last five-year step is half as wide.",
    docs: "/docs/change-over-time/line/",
  },
  {
    slug: "gdp-and-life-expectancy",
    demo: "framing/annotations-callout",
    kind: "correlation",
    title: "GDP per person and life expectancy in 12 large economies",
    description:
      "The US has the highest GDP per person of the 12, but six of them live longer. A text annotation with a curved connector calls out one point.",
    docs: "/docs/correlation/scatter/",
  },
  {
    slug: "electricity-mix-small-multiples",
    demo: "gallery/electricity-facets",
    kind: "composition",
    shape: "feature",
    title: "Share of generation from six sources, one panel each, 2016 to 2023",
    description:
      "Of six sources, only gas, wind and solar gained share. One encoding.facet channel splits the line into six panels on a shared y scale.",
    docs: "/docs/composition/facets/",
    size: "wide",
    ladle: "features--data-and-encoding#facet-shared",
  },
  {
    slug: "central-park-highs-and-lows",
    demo: "the-spec/transforms-fold",
    kind: "change-over-time",
    keepKey: true,
    title: "Average daily highs and lows in Central Park, 2023",
    description:
      "Central Park's daily highs and lows both peaked in July 2023. A fold transform turns the high and low columns into one series for the color channel.",
    docs: "/docs/change-over-time/line/",
  },
  {
    slug: "central-park-daily-swing",
    demo: "the-spec/transforms-calculate",
    kind: "comparison",
    title: "Daily temperature swing in Central Park, 2023",
    description:
      "The gap between Central Park's daily high and low was widest in May 2023. A calculate transform derives the gap from the high and low fields.",
    docs: "/docs/comparison/column/",
  },
  {
    slug: "gdp-per-person",
    demo: "the-spec/axes-long-labels",
    kind: "comparison",
    title: "GDP per person in 12 large economies",
    description:
      "GDP per person in the US is almost eight times India's. Sorting the x channel by -y orders the columns from highest to lowest.",
    docs: "/docs/comparison/column/",
  },
  {
    slug: "global-temperature-columns",
    demo: "comparison/column-diverging",
    kind: "comparison",
    shape: "wide",
    keepKey: true,
    title: "Global temperature above and below the 1951 to 1980 average",
    description:
      "Every reading since 1970 is above the 1951 to 1980 average. A two-value color scale sets the cooler readings in blue and the warmer ones in red.",
    docs: "/docs/comparison/column/",
  },
  {
    slug: "electricity-share-change",
    demo: "gallery/electricity-change-table",
    kind: "tables",
    shape: "square",
    title: "Change in each source's share of generation from six sources, 2016 to 2023",
    description:
      "Gas gained the most share, 8.7 points, while coal lost 15. A bar column draws the 2023 shares beside the signed change.",
    docs: "/docs/tables/column-types/",
    ladle: "tables--tables#inline-bar-cells",
  },
  {
    slug: "electricity-mix-by-year",
    demo: "gallery/electricity-share-columns",
    kind: "part-to-whole",
    shape: "square",
    keepKey: true,
    title: "Share of generation from six sources by year, stacked to 100%",
    description:
      "Wind and solar's share more than doubled from 2016 to 2023. stack: normalize turns the shares into 100% columns, and highlight dims the other four.",
    docs: "/docs/part-to-whole/stacked-100/",
    ladle: "charts--bar-and-column#normalized-stacked",
  },
  {
    slug: "energy-services-by-sector",
    demo: "gallery/energy-services-by-sector",
    kind: "part-to-whole",
    shape: "square",
    keepKey: true,
    title: "Energy services and rejected energy by sector, 2024",
    description:
      "Transportation turned a fifth of its energy into energy services, the least of four sectors. Bars stacked with stack: normalize show each split.",
    docs: "/docs/part-to-whole/stacked-100/",
  },
  {
    slug: "inflation-by-quarter",
    demo: "gallery/inflation-columns",
    kind: "change-over-time",
    shape: "wide",
    keepKey: true,
    title: "US inflation by quarter, 2019 to 2024",
    description:
      "Inflation fell in seven of the nine quarters after its 2022 peak. A two-value color scale marks each quarter that came in below the one before.",
    docs: "/docs/comparison/column/",
  },
  {
    slug: "unemployment-tile-map",
    demo: "gallery/unemployment-tiles",
    kind: "maps",
    title: "State unemployment rates on a tile grid",
    description:
      "Five states had unemployment below 3%. Every state and DC is one equal tile with its rate printed, so small states read as clearly as large ones.",
    docs: "/docs/maps/tile-map/",
    ladle: "sankey---tile-maps--sankey-and-tile-maps#quantitative",
  },
  {
    slug: "population-world-map",
    demo: "maps/symbol-world",
    kind: "maps",
    title: "The 10 most populous countries on a world map, 2025",
    description:
      "India and China each have more than 1.4 billion people. Circles sized by population sit on the Equal Earth projection set in geo.projection.",
    docs: "/docs/maps/symbol-map/",
  },
  {
    slug: "central-park-temperature-range",
    demo: "output/export-range",
    kind: "distribution",
    shape: "wide",
    title: "Monthly temperature range in Central Park, 2023",
    description:
      "New York's average daily high peaked at 30.2°C in July 2023. Error bars span y to y2 for each month, and the figure offers SVG, PNG and CSV downloads.",
    docs: "/docs/distribution/error-bars/",
  },
];

/**
 * Visualizations sections with no gallery entry, each with the reason. Every
 * section has one. Two docs pages have no entry: network graphs (in Flow and
 * networks) and calendars (in Change over time), since no tier-1 dataset holds
 * a network or a daily series.
 */
export const GALLERY_GAPS: readonly GalleryGap[] = [];
