/**
 * Cost of living vs quality of living in global cities, 2024.
 *
 * Editorial data carried over from the existing color-scatter story with its
 * original citation (Mercer surveys). Region is a categorical field with four
 * values — good for both color and shape encoding on a scatter.
 */
export const costOfLiving = {
  source: 'Source: Mercer Quality of Living & Cost of Living surveys',
  url: 'https://www.mercer.com/insights/total-rewards/talent-mobility-insights/cost-of-living/',
  data: [
    { city: 'Zurich', cost: 131, quality: 98, region: 'Europe' },
    { city: 'Vienna', cost: 79, quality: 97, region: 'Europe' },
    { city: 'Geneva', cost: 124, quality: 96, region: 'Europe' },
    { city: 'Copenhagen', cost: 89, quality: 95, region: 'Europe' },
    { city: 'Singapore', cost: 107, quality: 93, region: 'Asia' },
    { city: 'Sydney', cost: 83, quality: 92, region: 'Asia-Pacific' },
    { city: 'Montreal', cost: 64, quality: 91, region: 'Americas' },
    { city: 'Tokyo', cost: 78, quality: 90, region: 'Asia' },
    { city: 'London', cost: 101, quality: 89, region: 'Europe' },
    { city: 'Budapest', cost: 52, quality: 87, region: 'Europe' },
    { city: 'Seoul', cost: 82, quality: 86, region: 'Asia' },
    { city: 'New York', cost: 100, quality: 85, region: 'Americas' },
    { city: 'Kuala Lumpur', cost: 40, quality: 83, region: 'Asia' },
    { city: 'Warsaw', cost: 51, quality: 88, region: 'Europe' },
    { city: 'Santiago', cost: 47, quality: 79, region: 'Americas' },
    { city: 'Hong Kong', cost: 120, quality: 78, region: 'Asia' },
    { city: 'Bangkok', cost: 44, quality: 70, region: 'Asia' },
    { city: 'Buenos Aires', cost: 38, quality: 72, region: 'Americas' },
  ],
} as const;
