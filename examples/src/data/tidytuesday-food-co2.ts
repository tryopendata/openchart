/**
 * CO2 emissions per kilogram of food for 11 food categories, with average consumption.
 *
 * Rows come from the OpenData dataset `tidytuesday/food-consumption-co2` (view
 * `default`), verified 2026-11-22: for each food category, total CO2 emissions divided
 * by total consumption across the 130 countries in the file (`kg_co2_per_kg_food`),
 * plus the per-person averages. The dataset metadata gives no year, no license and no
 * original source, so the citation is the TidyTuesday readme (the February 2020
 * release). The source file spells the emissions column "co2_emmission".
 */
export const tidyTuesdayFoodCo2 = {
  source:
    'Source: TidyTuesday (R for Data Science Online Learning Community), food consumption and CO2 emissions',
  url: 'https://github.com/rfordatascience/tidytuesday/blob/main/data/2020/2020-02-18/readme.md',
  data: [
    {
      food_category: 'Lamb & Goat',
      countries: 130,
      kg_co2_per_kg_food: 35.02,
      avg_kg_per_person_per_year: 2.6,
      avg_kg_co2_per_person_per_year: 91.1,
    },
    {
      food_category: 'Beef',
      countries: 130,
      kg_co2_per_kg_food: 30.86,
      avg_kg_per_person_per_year: 12.1,
      avg_kg_co2_per_person_per_year: 374.1,
    },
    {
      food_category: 'Pork',
      countries: 130,
      kg_co2_per_kg_food: 3.54,
      avg_kg_per_person_per_year: 16.1,
      avg_kg_co2_per_person_per_year: 57.1,
    },
    {
      food_category: 'Nuts inc. Peanut Butter',
      countries: 130,
      kg_co2_per_kg_food: 1.77,
      avg_kg_per_person_per_year: 4.1,
      avg_kg_co2_per_person_per_year: 7.3,
    },
    {
      food_category: 'Fish',
      countries: 130,
      kg_co2_per_kg_food: 1.6,
      avg_kg_per_person_per_year: 17.3,
      avg_kg_co2_per_person_per_year: 27.6,
    },
    {
      food_category: 'Milk - inc. cheese',
      countries: 130,
      kg_co2_per_kg_food: 1.42,
      avg_kg_per_person_per_year: 125.8,
      avg_kg_co2_per_person_per_year: 179.2,
    },
    {
      food_category: 'Rice',
      countries: 130,
      kg_co2_per_kg_food: 1.28,
      avg_kg_per_person_per_year: 29.4,
      avg_kg_co2_per_person_per_year: 37.6,
    },
    {
      food_category: 'Poultry',
      countries: 130,
      kg_co2_per_kg_food: 1.07,
      avg_kg_per_person_per_year: 21.2,
      avg_kg_co2_per_person_per_year: 22.8,
    },
    {
      food_category: 'Eggs',
      countries: 130,
      kg_co2_per_kg_food: 0.92,
      avg_kg_per_person_per_year: 8.2,
      avg_kg_co2_per_person_per_year: 7.5,
    },
    {
      food_category: 'Soybeans',
      countries: 130,
      kg_co2_per_kg_food: 0.45,
      avg_kg_per_person_per_year: 0.9,
      avg_kg_co2_per_person_per_year: 0.4,
    },
    {
      food_category: 'Wheat and Wheat Products',
      countries: 130,
      kg_co2_per_kg_food: 0.19,
      avg_kg_per_person_per_year: 71.5,
      avg_kg_co2_per_person_per_year: 13.6,
    },
  ],
};

/**
 * Food CO2 per person in the 20 of the file's 130 countries with the highest total,
 * summed across the 11 food categories (kilograms per person per year), with the beef
 * part of that total and the kilograms of food behind it.
 *
 * Rows come from the same OpenData dataset, `tidytuesday/food-consumption-co2` (view
 * `default`), verified 2026-11-22 with
 * `SELECT country, ROUND(SUM(co2_emmission),1) AS kg_co2_per_person,
 * ROUND(SUM(CASE WHEN food_category = 'Beef' THEN co2_emmission ELSE 0 END),1) AS kg_co2_beef,
 * ROUND(SUM(consumption),1) AS kg_food_per_person FROM data GROUP BY 1 ORDER BY 2 DESC LIMIT 20`.
 * Country names are the file's own ("USA", "Hong Kong SAR. China"). Same citation and
 * caveats as above: no year, license or original source in the metadata.
 */
export const tidyTuesdayFoodCo2ByCountry = {
  source: tidyTuesdayFoodCo2.source,
  url: tidyTuesdayFoodCo2.url,
  data: [
    {
      country: 'Argentina',
      kg_co2_per_person: 2172.4,
      kg_co2_beef: 1712,
      kg_food_per_person: 429.4,
    },
    {
      country: 'Australia',
      kg_co2_per_person: 1938.7,
      kg_co2_beef: 1044.9,
      kg_food_per_person: 465.1,
    },
    {
      country: 'Albania',
      kg_co2_per_person: 1777.9,
      kg_co2_beef: 694.3,
      kg_food_per_person: 532.7,
    },
    {
      country: 'New Zealand',
      kg_co2_per_person: 1751,
      kg_co2_beef: 694,
      kg_food_per_person: 360.9,
    },
    {
      country: 'Iceland',
      kg_co2_per_person: 1731.4,
      kg_co2_beef: 412.3,
      kg_food_per_person: 472.3,
    },
    { country: 'USA', kg_co2_per_person: 1718.9, kg_co2_beef: 1118.3, kg_food_per_person: 491.2 },
    { country: 'Uruguay', kg_co2_per_person: 1634.9, kg_co2_beef: 898, kg_food_per_person: 433.6 },
    {
      country: 'Brazil',
      kg_co2_per_person: 1616.7,
      kg_co2_beef: 1211.2,
      kg_food_per_person: 355.2,
    },
    {
      country: 'Luxembourg',
      kg_co2_per_person: 1598.4,
      kg_co2_beef: 922,
      kg_food_per_person: 497.9,
    },
    {
      country: 'Kazakhstan',
      kg_co2_per_person: 1575.1,
      kg_co2_beef: 721.5,
      kg_food_per_person: 468.1,
    },
    { country: 'Sweden', kg_co2_per_person: 1527, kg_co2_beef: 758.5, kg_food_per_person: 550 },
    {
      country: 'Denmark',
      kg_co2_per_person: 1498.2,
      kg_co2_beef: 878.2,
      kg_food_per_person: 499.1,
    },
    { country: 'Greece', kg_co2_per_person: 1497.3, kg_co2_beef: 496.8, kg_food_per_person: 493.6 },
    {
      country: 'Hong Kong SAR. China',
      kg_co2_per_person: 1494.3,
      kg_co2_beef: 796.8,
      kg_food_per_person: 426,
    },
    {
      country: 'Bermuda',
      kg_co2_per_person: 1483.3,
      kg_co2_beef: 1022.9,
      kg_food_per_person: 306.6,
    },
    {
      country: 'Finland',
      kg_co2_per_person: 1464.6,
      kg_co2_beef: 593.1,
      kg_food_per_person: 639.8,
    },
    {
      country: 'Ireland',
      kg_co2_per_person: 1459.7,
      kg_co2_beef: 689.7,
      kg_food_per_person: 518.7,
    },
    { country: 'Canada', kg_co2_per_person: 1437.2, kg_co2_beef: 933.5, kg_food_per_person: 412.6 },
    {
      country: 'French Polynesia',
      kg_co2_per_person: 1424.7,
      kg_co2_beef: 953.5,
      kg_food_per_person: 346.7,
    },
    { country: 'France', kg_co2_per_person: 1420.1, kg_co2_beef: 734.7, kg_food_per_person: 479.2 },
  ],
};
