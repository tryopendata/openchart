/**
 * Lawful permanent residents (green cards) by country of birth, fiscal years 2014-2023:
 * six countries and the total, one row per fiscal year.
 *
 * Rows are the OpenData dataset `dhs/yearbook-lpr` (view `all`), queried on 2026-11-22 with:
 * SELECT year, MAX(lpr_count) FILTER (WHERE country='Mexico') AS mexico,
 * MAX(lpr_count) FILTER (WHERE country='India') AS india,
 * MAX(lpr_count) FILTER (WHERE country='China, People''s Republic') AS china,
 * MAX(lpr_count) FILTER (WHERE country='Cuba') AS cuba,
 * MAX(lpr_count) FILTER (WHERE country='Dominican Republic') AS dominican_republic,
 * MAX(lpr_count) FILTER (WHERE country='Philippines') AS philippines,
 * MAX(lpr_count) FILTER (WHERE country='Total') AS all_countries
 * FROM data GROUP BY 1 ORDER BY 1
 *
 * Fiscal years. Verified against the rows: the total fell from 1,031,770 in FY2019 to
 * 707,360 in FY2020 and was 1,172,910 in FY2023. Metadata lists the data as public domain.
 */
export const greenCardsByCountry = {
  source: 'Source: DHS Office of Homeland Security Statistics, Yearbook of Immigration Statistics',
  url: 'https://ohss.dhs.gov/topics/immigration/yearbook/2023',
  data: [
    {
      year: 2014,
      mexico: 134050,
      india: 77910,
      china: 76090,
      cuba: 46680,
      dominican_republic: 44580,
      philippines: 50000,
      all_countries: 1016520,
    },
    {
      year: 2015,
      mexico: 158620,
      india: 64120,
      china: 74560,
      cuba: 54400,
      dominican_republic: 50610,
      philippines: 56480,
      all_countries: 1051030,
    },
    {
      year: 2016,
      mexico: 174530,
      india: 64690,
      china: 81770,
      cuba: 66520,
      dominican_republic: 61160,
      philippines: 53290,
      all_countries: 1183510,
    },
    {
      year: 2017,
      mexico: 170580,
      india: 60390,
      china: 71570,
      cuba: 65030,
      dominican_republic: 58520,
      philippines: 49150,
      all_countries: 1127170,
    },
    {
      year: 2018,
      mexico: 161860,
      india: 59820,
      china: 65210,
      cuba: 76490,
      dominican_republic: 57410,
      philippines: 47260,
      all_countries: 1096610,
    },
    {
      year: 2019,
      mexico: 156050,
      india: 54500,
      china: 62250,
      cuba: 41640,
      dominican_republic: 49910,
      philippines: 45920,
      all_countries: 1031770,
    },
    {
      year: 2020,
      mexico: 100330,
      india: 46360,
      china: 41480,
      cuba: 16370,
      dominican_republic: 30010,
      philippines: 25490,
      all_countries: 707360,
    },
    {
      year: 2021,
      mexico: 107230,
      india: 93450,
      china: 49850,
      cuba: 23080,
      dominican_republic: 24550,
      philippines: 27510,
      all_countries: 740000,
    },
    {
      year: 2022,
      mexico: 138770,
      india: 127010,
      china: 67950,
      cuba: 36640,
      dominican_republic: 40150,
      philippines: 36000,
      all_countries: 1018350,
    },
    {
      year: 2023,
      mexico: 180530,
      india: 78070,
      china: 59260,
      cuba: 81600,
      dominican_republic: 68870,
      philippines: 49200,
      all_countries: 1172910,
    },
  ],
};
