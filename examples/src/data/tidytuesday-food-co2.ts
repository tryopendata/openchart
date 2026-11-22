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
