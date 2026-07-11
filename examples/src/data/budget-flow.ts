/**
 * Company budget allocation: revenue streams flowing to departments.
 *
 * Two-column sankey (revenue source -> department, $M). Illustrative figures for
 * a fictional company; there is no public source to cite, so it carries the
 * 'Illustrative data' marker rather than a fabricated internal-report citation.
 */
export const budgetFlow = {
  source: 'Illustrative data',
  data: [
    { source: 'Product Sales', target: 'Engineering', value: 18.4 },
    { source: 'Product Sales', target: 'Marketing', value: 8.2 },
    { source: 'Product Sales', target: 'Operations', value: 6.5 },
    { source: 'Product Sales', target: 'Sales', value: 5.1 },
    { source: 'Services', target: 'Engineering', value: 7.6 },
    { source: 'Services', target: 'Operations', value: 9.3 },
    { source: 'Services', target: 'Sales', value: 3.8 },
    { source: 'Licensing', target: 'Engineering', value: 4.2 },
    { source: 'Licensing', target: 'R&D', value: 12.1 },
    { source: 'Licensing', target: 'Admin', value: 2.4 },
    { source: 'Other Revenue', target: 'Marketing', value: 3.5 },
    { source: 'Other Revenue', target: 'R&D', value: 2.8 },
    { source: 'Other Revenue', target: 'Admin', value: 4.1 },
  ],
} as const;
