/**
 * Quarterly revenue by business segment for a single large technology company,
 * 2022-Q1 to 2024-Q4 ($B). Three crossing series (Services, Devices, Cloud)
 * with a legible narrative — Cloud climbing steadily past the Devices floor
 * while Devices spikes each holiday quarter — which gives the Edit Mode page
 * natural spots for a range band, a target reference line, and two callouts.
 *
 * Figures are illustrative (shaped to resemble published segment mixes but not
 * traced to a single filing), so no source citation is claimed.
 */
export const segmentRevenue = {
  source: 'Illustrative data',
  data: [
    { quarter: '2022-Q1', revenue: 19.82, segment: 'Services' },
    { quarter: '2022-Q1', revenue: 51.03, segment: 'Devices' },
    { quarter: '2022-Q1', revenue: 12.48, segment: 'Cloud' },
    { quarter: '2022-Q2', revenue: 19.6, segment: 'Services' },
    { quarter: '2022-Q2', revenue: 48.96, segment: 'Devices' },
    { quarter: '2022-Q2', revenue: 13.12, segment: 'Cloud' },
    { quarter: '2022-Q3', revenue: 19.19, segment: 'Services' },
    { quarter: '2022-Q3', revenue: 50.23, segment: 'Devices' },
    { quarter: '2022-Q3', revenue: 13.98, segment: 'Cloud' },
    { quarter: '2022-Q4', revenue: 20.77, segment: 'Services' },
    { quarter: '2022-Q4', revenue: 65.78, segment: 'Devices' },
    { quarter: '2022-Q4', revenue: 14.85, segment: 'Cloud' },
    { quarter: '2023-Q1', revenue: 20.91, segment: 'Services' },
    { quarter: '2023-Q1', revenue: 51.33, segment: 'Devices' },
    { quarter: '2023-Q1', revenue: 15.65, segment: 'Cloud' },
    { quarter: '2023-Q2', revenue: 21.21, segment: 'Services' },
    { quarter: '2023-Q2', revenue: 48.48, segment: 'Devices' },
    { quarter: '2023-Q2', revenue: 16.43, segment: 'Cloud' },
    { quarter: '2023-Q3', revenue: 22.31, segment: 'Services' },
    { quarter: '2023-Q3', revenue: 49.32, segment: 'Devices' },
    { quarter: '2023-Q3', revenue: 17.52, segment: 'Cloud' },
    { quarter: '2023-Q4', revenue: 23.12, segment: 'Services' },
    { quarter: '2023-Q4', revenue: 67.44, segment: 'Devices' },
    { quarter: '2023-Q4', revenue: 18.66, segment: 'Cloud' },
    { quarter: '2024-Q1', revenue: 23.87, segment: 'Services' },
    { quarter: '2024-Q1', revenue: 53.67, segment: 'Devices' },
    { quarter: '2024-Q1', revenue: 19.94, segment: 'Cloud' },
    { quarter: '2024-Q2', revenue: 24.21, segment: 'Services' },
    { quarter: '2024-Q2', revenue: 52.89, segment: 'Devices' },
    { quarter: '2024-Q2', revenue: 21.3, segment: 'Cloud' },
    { quarter: '2024-Q3', revenue: 25.03, segment: 'Services' },
    { quarter: '2024-Q3', revenue: 54.11, segment: 'Devices' },
    { quarter: '2024-Q3', revenue: 22.17, segment: 'Cloud' },
    { quarter: '2024-Q4', revenue: 26.34, segment: 'Services' },
    { quarter: '2024-Q4', revenue: 71.42, segment: 'Devices' },
    { quarter: '2024-Q4', revenue: 23.85, segment: 'Cloud' },
  ],
} as const;
