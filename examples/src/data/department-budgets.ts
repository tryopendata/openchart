/**
 * Departmental budget allocations, FY 2025 ($M).
 *
 * Illustrative data: plausible department names, long enough to exercise the
 * axis-label rotation ladder without being contrived. (They were previously
 * padded out to 35+ characters — "Research and Advanced Development" — which no
 * real chart carries, and which masked the fact that rotated labels overflowed
 * their reserved band instead of truncating.) No real-world source, so it is
 * labeled 'Illustrative data' with no citation (per the dataset-pool rules in
 * plans/ladle-gallery/00-overview.md).
 */
export const departmentBudgets = {
  source: 'Illustrative data',
  data: [
    { department: 'Research & Development', budget: 42 },
    { department: 'Marketing', budget: 31 },
    { department: 'Human Resources', budget: 28 },
    { department: 'IT Infrastructure', budget: 24 },
    { department: 'Customer Success', budget: 19 },
    { department: 'Legal & Compliance', budget: 15 },
    { department: 'Supply Chain', budget: 12 },
  ],
} as const;
