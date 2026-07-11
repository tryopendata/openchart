/**
 * Departmental budget allocations, FY 2025 ($M).
 *
 * Illustrative data: fabricated department names chosen to be long enough to
 * exercise the axis-label rotation/truncation ladder. No real-world source, so
 * it is labeled 'Illustrative data' with no citation (per the dataset-pool
 * rules in plans/ladle-gallery/00-overview.md).
 */
export const departmentBudgets = {
  source: 'Illustrative data',
  data: [
    { department: 'Research and Advanced Development', budget: 42 },
    { department: 'Marketing and Brand Communications', budget: 31 },
    { department: 'Human Resources and Talent Acquisition', budget: 28 },
    { department: 'Information Technology Infrastructure', budget: 24 },
    { department: 'Customer Success and Engagement', budget: 19 },
    { department: 'Legal and Regulatory Compliance', budget: 15 },
    { department: 'Supply Chain and Logistics Operations', budget: 12 },
  ],
} as const;
