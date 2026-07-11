/**
 * Revenue and cost of revenue for large US technology companies, FY2024 ($B).
 *
 * Illustrative: revenue figures track reported fiscal-year totals, and the cost
 * of revenue is a representative split chosen so the derived profit margin
 * ranks the companies in a legible order. It is not lifted line-by-line from a
 * single 10-K, so it carries the illustrative label rather than a filing
 * citation. Used to demonstrate the `calculate` transform deriving a profit
 * margin field from two raw columns.
 */
export const profitMargins = {
  source: 'Illustrative data',
  data: [
    { company: 'NVIDIA', revenue: 130, cost: 52 },
    { company: 'Microsoft', revenue: 245, cost: 135 },
    { company: 'Meta', revenue: 165, cost: 105 },
    { company: 'Apple', revenue: 391, cost: 223 },
    { company: 'Alphabet', revenue: 350, cost: 245 },
    { company: 'Amazon', revenue: 638, cost: 590 },
  ],
} as const;
