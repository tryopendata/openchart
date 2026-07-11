/**
 * A single year's monthly average temperature cycle (°C).
 *
 * Illustrative data: a smooth seasonal curve chosen so the difference between
 * curve interpolation modes (linear, step, monotone, natural) is legible at a
 * glance. Not tied to a specific city or year.
 */
export const monthlyTemperature = {
  source: 'Illustrative data',
  data: [
    { month: 'Jan', temp: 2.1 },
    { month: 'Feb', temp: 3.5 },
    { month: 'Mar', temp: 7.8 },
    { month: 'Apr', temp: 12.4 },
    { month: 'May', temp: 17.2 },
    { month: 'Jun', temp: 21.0 },
    { month: 'Jul', temp: 23.5 },
    { month: 'Aug', temp: 22.8 },
    { month: 'Sep', temp: 18.6 },
    { month: 'Oct', temp: 12.9 },
    { month: 'Nov', temp: 7.1 },
    { month: 'Dec', temp: 3.2 },
  ],
} as const;
