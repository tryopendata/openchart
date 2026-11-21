/**
 * The examples gallery's entries, in wall order, and the Visualizations
 * sections it leaves out. /examples/, each /examples/<slug>/ page, the social
 * cards and the search index all derive from this list. Every entry draws a
 * tier-1 dataset, and the list is checked against the demo registry and the
 * docs pages when this module loads, so a broken entry fails the build naming it.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { assertGalleryEntries } from "../components/gallery/entry-rules";
import { KINDS } from "../components/gallery/kind-words";
import { allDemos } from "../demos/registry";
import type { GalleryEntry, GalleryGap } from "./gallery-types";

/** Every gallery entry, in the order the wall shows them. */
export const galleryEntries: readonly GalleryEntry[] = [
  {
    slug: "unemployment-by-state",
    demo: "maps/choropleth-basic",
    kind: "maps",
    title: "Unemployment rate by state",
    description:
      "A choropleth of the latest seasonally adjusted unemployment rate in each state and DC, shaded on one sequential color scale over the state outlines.",
    docs: "/docs/maps/choropleth/",
    size: "wide",
  },
  {
    slug: "us-inflation",
    demo: "change-over-time/line-basic",
    kind: "change-over-time",
    title: "US inflation, 2019 to 2024",
    description:
      "A line of the year-over-year change in US consumer prices, quarterly from 2019 to 2024, with the 2022 peak labeled and a dashed line at 2%.",
    docs: "/docs/change-over-time/line/",
  },
  {
    slug: "electricity-mix-donut",
    demo: "gallery/electricity-donut",
    kind: "part-to-whole",
    title: "US electricity generation by source, 2023",
    description:
      "A donut of each source's share of US generation from coal, gas, nuclear, hydro, wind and solar in 2023, with gas's share printed in the center.",
    docs: "/docs/part-to-whole/pie-donut/",
    ladle: "charts--pie-and-donut#donut-center-metric",
  },
  {
    slug: "most-populous-countries",
    demo: "comparison/bar-sorted",
    kind: "comparison",
    title: "The ten most populous countries",
    description:
      "A bar chart of the ten most populous countries in 2025, sorted from largest to smallest.",
    docs: "/docs/comparison/bar/",
  },
  {
    slug: "unemployment-histogram",
    demo: "gallery/unemployment-histogram",
    kind: "distribution",
    title: "State unemployment rates in half-point bins",
    description:
      "A histogram counting the states and DC in each half-point band of the latest unemployment rate, with a dashed line at 4%.",
    docs: "/docs/distribution/histogram/",
    ladle: "charts--scatter-and-distribution#histogram",
  },
  {
    slug: "electricity-mix-heatmap",
    demo: "correlation/heatmap-basic",
    kind: "correlation",
    title: "US electricity generation by source and year",
    description:
      "A heatmap of each source's share of US generation from 2016 to 2023, one row per source and one column per year, on a sequential color scale.",
    docs: "/docs/correlation/heatmap/",
  },
  {
    slug: "global-temperature",
    demo: "the-spec/scales-temporal",
    kind: "change-over-time",
    title: "Global temperature anomaly, 1900 to 2025",
    description:
      "A line of global surface temperature against the 1951 to 1980 average, one reading per decade from 1900 and then 2025, on a time axis.",
    docs: "/docs/change-over-time/line/",
  },
  {
    slug: "life-expectancy-table",
    demo: "gallery/country-table",
    kind: "tables",
    title: "Life expectancy, income and population in twelve large economies",
    description:
      "A sortable table of twelve large economies, longest life expectancy first, with heatmap cells for life expectancy and bars for GDP per person.",
    docs: "/docs/tables/column-types/",
    ladle: "tables--tables#heatmap-cells",
  },
  {
    slug: "us-energy-flow",
    demo: "flow/sankey-basic",
    kind: "flow",
    title: "US energy flow, 2024",
    description:
      "A sankey of US energy in 2024, from primary sources through electricity generation and end-use sectors to energy services and rejected energy.",
    docs: "/docs/flow/sankey/",
    size: "wide",
  },
  {
    slug: "electricity-mix-waffle",
    demo: "gallery/electricity-waffle",
    kind: "part-to-whole",
    title: "US electricity generation by source in 100 squares, 2023",
    description:
      "A waffle of the 2023 US generation mix, one square per percent, with nuclear, wind and solar in color and the other sources dimmed.",
    docs: "/docs/part-to-whole/waffle/",
    ladle: "charts--pie-and-donut#waffle",
  },
  {
    slug: "income-and-life-expectancy",
    demo: "framing/annotations-callout",
    kind: "correlation",
    title: "Income and life expectancy in twelve large economies",
    description:
      "A scatter plot of GDP per person against life expectancy in twelve large economies, with a callout on the United States.",
    docs: "/docs/correlation/scatter/",
  },
  {
    slug: "unemployment-beeswarm",
    demo: "gallery/unemployment-beeswarm",
    kind: "distribution",
    title: "State unemployment rates, one dot per state",
    description:
      "A beeswarm of the latest unemployment rate in each state and DC, with the rates of 5% or more in orange.",
    docs: "/docs/distribution/beeswarm/",
    ladle: "charts--scatter-and-distribution#beeswarm",
  },
  {
    slug: "inflation-against-2-percent",
    demo: "gallery/inflation-reference",
    kind: "composition",
    title: "US inflation against a 2% line, 2019 to 2024",
    description:
      "A line of quarterly US inflation with a rule at 2% drawn as a second layer on the same scale.",
    docs: "/docs/composition/layers/",
    ladle: "charts--building-blocks#layered",
  },
  {
    slug: "electricity-mix-lines",
    demo: "behavior/motion-replay",
    kind: "change-over-time",
    title: "US electricity generation by source, 2016 to 2023",
    description:
      "A line for each source's share of US generation from 2016 to 2023, each named at its end, with a Replay button that draws the chart in again.",
    docs: "/docs/change-over-time/line/",
  },
  {
    slug: "population-world-map",
    demo: "maps/symbol-world",
    kind: "maps",
    title: "The ten most populous countries on a world map",
    description:
      "A symbol map of the ten most populous countries in 2025, each a circle sized by population, on an Equal Earth projection.",
    docs: "/docs/maps/symbol-map/",
  },
  {
    slug: "electricity-mix-small-multiples",
    demo: "gallery/electricity-facets",
    kind: "composition",
    title: "US electricity generation by source, one panel each",
    description:
      "Small multiples of each source's share of US generation from 2016 to 2023: six panels on one shared scale.",
    docs: "/docs/composition/facets/",
    size: "wide",
    ladle: "features--data-and-encoding#facet-shared",
  },
  {
    slug: "global-temperature-columns",
    demo: "comparison/column-diverging",
    kind: "comparison",
    title: "Global temperature above and below the 1951 to 1980 average",
    description:
      "A diverging column chart of the global temperature anomaly from 1900 to 2025, with cooler readings in blue and warmer ones in red.",
    docs: "/docs/comparison/column/",
  },
  {
    slug: "central-park-temperature-range",
    demo: "output/export-range",
    kind: "distribution",
    title: "Monthly temperature range in Central Park, 2023",
    description:
      "Error bars from each month's average daily low to its average daily high in Central Park in 2023, with SVG, PNG and CSV downloads.",
    docs: "/docs/distribution/error-bars/",
  },
  {
    slug: "electricity-mix-by-year",
    demo: "gallery/electricity-share-columns",
    kind: "part-to-whole",
    title: "US electricity generation by source and year, stacked to 100%",
    description:
      "One column per year from 2016 to 2023, stacked to 100%, with wind and solar on the baseline in color and the other sources dimmed.",
    docs: "/docs/part-to-whole/stacked-100/",
    ladle: "charts--bar-and-column#normalized-stacked",
  },
  {
    slug: "central-park-highs-and-lows",
    demo: "the-spec/transforms-fold",
    kind: "change-over-time",
    title: "Average daily highs and lows in Central Park, 2023",
    description:
      "Two lines for the monthly average daily high and low in Central Park in 2023, folded in the spec from two columns into one series.",
    docs: "/docs/change-over-time/line/",
  },
  {
    slug: "electricity-share-change",
    demo: "gallery/electricity-change-table",
    kind: "tables",
    title: "Change in each source's share of US generation, 2016 to 2023",
    description:
      "A table of each source's share of US generation in 2016 and 2023 and the change in points, largest gain first, with bars for the 2023 shares.",
    docs: "/docs/tables/column-types/",
    ladle: "tables--tables#inline-bar-cells",
  },
  {
    slug: "gdp-per-person",
    demo: "the-spec/axes-long-labels",
    kind: "comparison",
    title: "GDP per person in twelve large economies",
    description:
      "A column chart of GDP per person at purchasing power parity in twelve large economies, sorted from highest to lowest.",
    docs: "/docs/comparison/column/",
  },
  {
    slug: "solar-share",
    demo: "style/color-highlight",
    kind: "change-over-time",
    title: "Solar's share of US electricity generation, 2016 to 2023",
    description:
      "A line chart of the US generation mix with solar highlighted and the other five sources dimmed, each line named at its end.",
    docs: "/docs/change-over-time/line/",
  },
  {
    slug: "central-park-daily-swing",
    demo: "the-spec/transforms-calculate",
    kind: "comparison",
    title: "Daily temperature swing in Central Park, 2023",
    description:
      "A column chart of each month's average daily high minus its average daily low in Central Park in 2023, calculated in the spec from two fields.",
    docs: "/docs/comparison/column/",
  },
];

/**
 * Visualizations sections with no gallery entry, each with the reason. Every
 * section has one. Two docs pages have no entry: network graphs (in Flow and
 * networks) and calendars (in Change over time), since no tier-1 dataset holds
 * a network or a daily series.
 */
export const GALLERY_GAPS: readonly GalleryGap[] = [];

/**
 * The served path of every site docs page: src/content/docs/<section>/<slug>.mdx
 * is /docs/<section>/<slug>/. Read from disk, since astro:content is only for
 * src/lib/collection.ts; builds and tests both run from site/.
 */
function siteDocsPaths(): Set<string> {
  const root = join("src", "content", "docs");
  return new Set(
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => `/docs/${file.replaceAll("\\", "/").replace(/\.mdx$/, "")}/`),
  );
}

/**
 * Checks entries against the real demo registry, docs pages and sections.
 *
 * @throws {GalleryEntryError} Naming the first entry that breaks a rule.
 */
export function checkGalleryEntries(entries: readonly GalleryEntry[]): void {
  const demoIds = new Set(allDemos().map((demo) => demo.id));
  const docsPaths = siteDocsPaths();
  assertGalleryEntries(entries, {
    hasDemo: (id) => demoIds.has(id),
    hasDocsPage: (path) => docsPaths.has(path),
    kinds: KINDS,
  });
}

checkGalleryEntries(galleryEntries);
