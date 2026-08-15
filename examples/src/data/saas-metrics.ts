/**
 * Product metrics for a fictional B2B SaaS company, used by the SaaS analytics
 * dashboard layout on the Dashboards page.
 *
 * Four related tables: 24 months of recurring revenue, six months of signups
 * split by acquisition channel, the top marketing pages by session, and the
 * largest accounts with an eight-week revenue trend for a sparkline cell.
 *
 * Every figure is invented. The shapes (compounding MRR, channel mix, a long
 * tail of pages) are representative of a real product-analytics warehouse, but
 * nothing here is a snapshot of a real company — hence 'Illustrative data' and
 * no source URL.
 */

export const saasMetrics = {
  source: 'Illustrative data',

  /** Monthly recurring revenue, USD, Jan 2024 through Dec 2025. */
  mrr: [
    { month: '2024-01', mrr: 182000 },
    { month: '2024-02', mrr: 188800 },
    { month: '2024-03', mrr: 199600 },
    { month: '2024-04', mrr: 209300 },
    { month: '2024-05', mrr: 221400 },
    { month: '2024-06', mrr: 228300 },
    { month: '2024-07', mrr: 241000 },
    { month: '2024-08', mrr: 250900 },
    { month: '2024-09', mrr: 258800 },
    { month: '2024-10', mrr: 267100 },
    { month: '2024-11', mrr: 283000 },
    { month: '2024-12', mrr: 299700 },
    { month: '2025-01', mrr: 313500 },
    { month: '2025-02', mrr: 327200 },
    { month: '2025-03', mrr: 342400 },
    { month: '2025-04', mrr: 358800 },
    { month: '2025-05', mrr: 378000 },
    { month: '2025-06', mrr: 398200 },
    { month: '2025-07', mrr: 415100 },
    { month: '2025-08', mrr: 433500 },
    { month: '2025-09', mrr: 457500 },
    { month: '2025-10', mrr: 476200 },
    { month: '2025-11', mrr: 497400 },
    { month: '2025-12', mrr: 513700 },
  ],

  /** New signups by acquisition channel, last six months. */
  signups: [
    { month: 'Jul', channel: 'Organic', signups: 620 },
    { month: 'Jul', channel: 'Paid', signups: 410 },
    { month: 'Jul', channel: 'Referral', signups: 230 },
    { month: 'Jul', channel: 'Partner', signups: 140 },
    { month: 'Aug', channel: 'Organic', signups: 665 },
    { month: 'Aug', channel: 'Paid', signups: 395 },
    { month: 'Aug', channel: 'Referral', signups: 255 },
    { month: 'Aug', channel: 'Partner', signups: 150 },
    { month: 'Sep', channel: 'Organic', signups: 712 },
    { month: 'Sep', channel: 'Paid', signups: 438 },
    { month: 'Sep', channel: 'Referral', signups: 268 },
    { month: 'Sep', channel: 'Partner', signups: 172 },
    { month: 'Oct', channel: 'Organic', signups: 744 },
    { month: 'Oct', channel: 'Paid', signups: 472 },
    { month: 'Oct', channel: 'Referral', signups: 291 },
    { month: 'Oct', channel: 'Partner', signups: 165 },
    { month: 'Nov', channel: 'Organic', signups: 803 },
    { month: 'Nov', channel: 'Paid', signups: 456 },
    { month: 'Nov', channel: 'Referral', signups: 314 },
    { month: 'Nov', channel: 'Partner', signups: 188 },
    { month: 'Dec', channel: 'Organic', signups: 851 },
    { month: 'Dec', channel: 'Paid', signups: 489 },
    { month: 'Dec', channel: 'Referral', signups: 342 },
    { month: 'Dec', channel: 'Partner', signups: 201 },
  ],

  /** Highest-traffic marketing pages by session count, last 30 days. */
  topPages: [
    { page: '/pricing', sessions: 48200 },
    { page: '/', sessions: 41600 },
    { page: '/docs/quickstart', sessions: 27400 },
    { page: '/blog/schema-migrations', sessions: 19800 },
    { page: '/integrations', sessions: 14300 },
    { page: '/changelog', sessions: 9700 },
    { page: '/security', sessions: 6100 },
  ],

  /** Largest accounts by MRR, with an eight-week revenue trend. */
  accounts: [
    {
      account: 'Northwind Trading',
      plan: 'Enterprise',
      mrr: 41200,
      delta: 6.4,
      trend: [34800, 35600, 36900, 37400, 38800, 39600, 40500, 41200],
    },
    {
      account: 'Contoso Health',
      plan: 'Enterprise',
      mrr: 33800,
      delta: 3.1,
      trend: [31200, 31900, 32100, 32600, 32900, 33200, 33500, 33800],
    },
    {
      account: 'Fabrikam Logistics',
      plan: 'Enterprise',
      mrr: 28600,
      delta: -2.4,
      trend: [30900, 30400, 30100, 29700, 29500, 29100, 28800, 28600],
    },
    {
      account: 'Tailspin Media',
      plan: 'Growth',
      mrr: 18400,
      delta: 11.8,
      trend: [13100, 14000, 14900, 15800, 16400, 17200, 17900, 18400],
    },
    {
      account: 'Proseware Labs',
      plan: 'Growth',
      mrr: 15900,
      delta: 4.7,
      trend: [13800, 14200, 14600, 14900, 15200, 15400, 15700, 15900],
    },
    {
      account: 'Wingtip Financial',
      plan: 'Growth',
      mrr: 12700,
      delta: 0.8,
      trend: [12400, 12500, 12300, 12600, 12500, 12600, 12600, 12700],
    },
    {
      account: 'Litware Robotics',
      plan: 'Team',
      mrr: 8300,
      delta: 9.2,
      trend: [6200, 6600, 6900, 7300, 7600, 7900, 8100, 8300],
    },
    {
      account: 'Adventure Works',
      plan: 'Team',
      mrr: 6100,
      delta: -5.6,
      trend: [7400, 7200, 7000, 6800, 6600, 6400, 6200, 6100],
    },
  ],
} as const;
