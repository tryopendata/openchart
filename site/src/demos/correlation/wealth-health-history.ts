/**
 * The Gapminder rows the playback demos share: 62 countries, every other year
 * from 1960 to 2022, from the World Bank series in examples/src/data. Every
 * other year and population in millions keep a page's embedded data under the
 * site's 500 KB page budget; playback interpolates between the periods, so the
 * motion stays smooth. Rows missing any of the three values are left out, so a
 * country enters the run when it first reports.
 */
import { wealthHealthHistory } from "@datasets/wealth-health-history";
import { sourceOf } from "../source";

/** One country and year: GDP per capita in current US dollars, life expectancy, population in millions. */
export type WealthHealthRow = {
  country: string;
  region: string;
  year: number;
  gdp: number;
  life: number;
  pop: number;
};

/** Every even year with all three values, per country. */
export const wealthHealthRows: WealthHealthRow[] = wealthHealthHistory.data.flatMap(
  ({ country, region, year, gdp, life, pop }) =>
    year % 2 !== 0 || gdp === null || life === null || pop === null
      ? []
      : [{ country, region, year, gdp, life, pop: Math.round(pop / 1e5) / 10 }],
);

/** The World Bank citation as a figure source. */
export const wealthHealthSource = sourceOf(wealthHealthHistory);
