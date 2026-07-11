/**
 * Global renewable energy capacity additions by source, 2019-2023 (GW).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (International Energy Agency). Used for grouped-column demos where
 * solar pulls away from wind and hydro.
 */
export const renewableCapacityAdditions = {
  source: 'Source: International Energy Agency',
  url: 'https://www.iea.org/reports/renewables-2023',
  data: [
    { year: '2019', capacity: 98, type: 'Solar' },
    { year: '2019', capacity: 58, type: 'Wind' },
    { year: '2019', capacity: 12, type: 'Hydro' },
    { year: '2020', capacity: 127, type: 'Solar' },
    { year: '2020', capacity: 90, type: 'Wind' },
    { year: '2020', capacity: 20, type: 'Hydro' },
    { year: '2021', capacity: 167, type: 'Solar' },
    { year: '2021', capacity: 93, type: 'Wind' },
    { year: '2021', capacity: 15, type: 'Hydro' },
    { year: '2022', capacity: 222, type: 'Solar' },
    { year: '2022', capacity: 75, type: 'Wind' },
    { year: '2022', capacity: 22, type: 'Hydro' },
    { year: '2023', capacity: 346, type: 'Solar' },
    { year: '2023', capacity: 107, type: 'Wind' },
    { year: '2023', capacity: 24, type: 'Hydro' },
  ],
} as const;
