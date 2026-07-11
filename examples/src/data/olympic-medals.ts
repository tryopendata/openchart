/**
 * Paris 2024 Summer Olympic medal counts by country and medal type.
 *
 * Editorial data carried over from the existing story files with its original
 * citation (International Olympic Committee). Used for grouped-bar demos.
 */
export const olympicMedals = {
  source: 'Source: International Olympic Committee',
  url: 'https://olympics.com/en/paris-2024/medals',
  data: [
    { country: 'USA', medals: 40, type: 'Gold' },
    { country: 'USA', medals: 44, type: 'Silver' },
    { country: 'USA', medals: 42, type: 'Bronze' },
    { country: 'China', medals: 40, type: 'Gold' },
    { country: 'China', medals: 27, type: 'Silver' },
    { country: 'China', medals: 24, type: 'Bronze' },
    { country: 'Great Britain', medals: 14, type: 'Gold' },
    { country: 'Great Britain', medals: 22, type: 'Silver' },
    { country: 'Great Britain', medals: 29, type: 'Bronze' },
    { country: 'Japan', medals: 20, type: 'Gold' },
    { country: 'Japan', medals: 12, type: 'Silver' },
    { country: 'Japan', medals: 13, type: 'Bronze' },
  ],
} as const;
