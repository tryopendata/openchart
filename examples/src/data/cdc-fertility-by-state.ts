/**
 * General fertility rate (live births per 1,000 women ages 15-44) by state in
 * 2005 and 2024, with 2024 births (51 rows: 50 states and DC).
 *
 * VERIFIED 2026-11-22 against the OpenData dataset `cdc/births-by-state` (view
 * `all`), reduced with: SELECT state, MAX(fertility_rate) FILTER (WHERE year =
 * 2005) AS fertility_2005, (2024) AS fertility_2024, MAX(births) FILTER (WHERE
 * year = 2024) AS births_2024 FROM data GROUP BY 1. The rate fell in every
 * jurisdiction; Utah went from 92.8 to 59.9. The NCHS table has no rows for
 * 2006-2013, so no series between 2005 and 2014 can be drawn from it.
 */
export const cdcFertilityByState = {
  source: 'Source: CDC NCHS, Stats of the States: General Fertility Rate',
  url: 'https://www.cdc.gov/nchs/state-stats/births/fertility-rate.html',
  data: [
    { state: 'AK', fertility_2005: 73.9, fertility_2024: 60.8, births_2024: 8943 },
    { state: 'AL', fertility_2005: 63.6, fertility_2024: 57.2, births_2024: 57934 },
    { state: 'AR', fertility_2005: 69.5, fertility_2024: 58.8, births_2024: 35395 },
    { state: 'AZ', fertility_2005: 80.6, fertility_2024: 53.2, births_2024: 78711 },
    { state: 'CA', fertility_2005: 70.5, fertility_2024: 49.8, births_2024: 402075 },
    { state: 'CO', fertility_2005: 69.6, fertility_2024: 51.6, births_2024: 64268 },
    { state: 'CT', fertility_2005: 58.8, fertility_2024: 48.9, births_2024: 34599 },
    { state: 'DC', fertility_2005: 59.8, fertility_2024: 39.8, births_2024: 7616 },
    { state: 'DE', fertility_2005: 65.3, fertility_2024: 53.7, births_2024: 10550 },
    { state: 'FL', fertility_2005: 64.3, fertility_2024: 52.2, births_2024: 224389 },
    { state: 'GA', fertility_2005: 71.4, fertility_2024: 54.7, births_2024: 126437 },
    { state: 'HI', fertility_2005: 69.2, fertility_2024: 56.6, births_2024: 14917 },
    { state: 'IA', fertility_2005: 66.9, fertility_2024: 58.8, births_2024: 36436 },
    { state: 'ID', fertility_2005: 78.9, fertility_2024: 58.6, births_2024: 23276 },
    { state: 'IL', fertility_2005: 67.0, fertility_2024: 49.7, births_2024: 125731 },
    { state: 'IN', fertility_2005: 67.0, fertility_2024: 59.1, births_2024: 80257 },
    { state: 'KS', fertility_2005: 71.3, fertility_2024: 58.3, births_2024: 33984 },
    { state: 'KY', fertility_2005: 65.0, fertility_2024: 60.3, births_2024: 52913 },
    { state: 'LA', fertility_2005: 62.0, fertility_2024: 58.2, births_2024: 53305 },
    { state: 'MA', fertility_2005: 55.9, fertility_2024: 46.8, births_2024: 68184 },
    { state: 'MD', fertility_2005: 62.0, fertility_2024: 53.3, births_2024: 65797 },
    { state: 'ME', fertility_2005: 54.3, fertility_2024: 46.3, births_2024: 11601 },
    { state: 'MI', fertility_2005: 61.9, fertility_2024: 51.5, births_2024: 99525 },
    { state: 'MN', fertility_2005: 66.3, fertility_2024: 55.2, births_2024: 62110 },
    { state: 'MO', fertility_2005: 65.9, fertility_2024: 55.9, births_2024: 67998 },
    { state: 'MS', fertility_2005: 68.7, fertility_2024: 57.3, births_2024: 33473 },
    { state: 'MT', fertility_2005: 64.0, fertility_2024: 53.3, births_2024: 11331 },
    { state: 'NC', fertility_2005: 66.6, fertility_2024: 55.8, births_2024: 122856 },
    { state: 'ND', fertility_2005: 64.8, fertility_2024: 60.4, births_2024: 9634 },
    { state: 'NE', fertility_2005: 73.1, fertility_2024: 62.9, births_2024: 24785 },
    { state: 'NH', fertility_2005: 54.1, fertility_2024: 45.9, births_2024: 11770 },
    { state: 'NJ', fertility_2005: 63.7, fertility_2024: 55.7, births_2024: 101372 },
    { state: 'NM', fertility_2005: 73.0, fertility_2024: 51.9, births_2024: 21328 },
    { state: 'NV', fertility_2005: 73.9, fertility_2024: 50.1, births_2024: 32381 },
    { state: 'NY', fertility_2005: 59.9, fertility_2024: 52.1, births_2024: 205489 },
    { state: 'OH', fertility_2005: 63.5, fertility_2024: 55.6, births_2024: 126795 },
    { state: 'OK', fertility_2005: 71.7, fertility_2024: 58.4, births_2024: 47962 },
    { state: 'OR', fertility_2005: 62.9, fertility_2024: 46.1, births_2024: 38963 },
    { state: 'PA', fertility_2005: 58.5, fertility_2024: 51.2, births_2024: 127299 },
    { state: 'RI', fertility_2005: 55.6, fertility_2024: 45.0, births_2024: 10009 },
    { state: 'SC', fertility_2005: 64.3, fertility_2024: 55.5, births_2024: 58768 },
    { state: 'SD', fertility_2005: 74.7, fertility_2024: 66.7, births_2024: 11451 },
    { state: 'TN', fertility_2005: 65.2, fertility_2024: 58.5, births_2024: 83833 },
    { state: 'TX', fertility_2005: 77.4, fertility_2024: 59.3, births_2024: 390828 },
    { state: 'UT', fertility_2005: 92.8, fertility_2024: 59.9, births_2024: 46664 },
    { state: 'VA', fertility_2005: 64.0, fertility_2024: 53.7, births_2024: 94054 },
    { state: 'VT', fertility_2005: 50.2, fertility_2024: 41.7, births_2024: 5023 },
    { state: 'WA', fertility_2005: 63.0, fertility_2024: 51.3, births_2024: 83118 },
    { state: 'WI', fertility_2005: 62.5, fertility_2024: 52.8, births_2024: 59686 },
    { state: 'WV', fertility_2005: 59.2, fertility_2024: 54.3, births_2024: 17022 },
    { state: 'WY', fertility_2005: 71.4, fertility_2024: 54.8, births_2024: 6089 },
  ],
};
