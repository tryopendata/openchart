/**
 * US nonfarm payroll additions by month, 2024 (thousands of jobs).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (Bureau of Labor Statistics). Used for the simple-column demo; the
 * October dip reflects hurricane and strike disruptions.
 */
export const usPayrolls = {
  source: 'Source: Bureau of Labor Statistics',
  url: 'https://www.bls.gov/ces/',
  data: [
    { month: 'Jan', jobs: 353 },
    { month: 'Feb', jobs: 275 },
    { month: 'Mar', jobs: 303 },
    { month: 'Apr', jobs: 175 },
    { month: 'May', jobs: 272 },
    { month: 'Jun', jobs: 206 },
    { month: 'Jul', jobs: 114 },
    { month: 'Aug', jobs: 142 },
    { month: 'Sep', jobs: 254 },
    { month: 'Oct', jobs: 12 },
    { month: 'Nov', jobs: 227 },
    { month: 'Dec', jobs: 256 },
  ],
} as const;
