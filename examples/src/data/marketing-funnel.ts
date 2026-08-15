/**
 * Demand-generation metrics for a fictional B2B marketing team, used by the
 * marketing funnel dashboard layout on the Dashboards page.
 *
 * Two tables: twelve weeks of stage-to-stage conversion rates (stored as
 * fractions so a `%` format string can render them), and four quarters of
 * qualified leads split across four channels for a grouped-column tile. The
 * funnel itself reuses the shared `userJourney` sankey dataset.
 *
 * Invented figures with realistic shapes; no public source, so the module
 * carries the 'Illustrative data' marker and no URL.
 */

export const marketingFunnel = {
  source: 'Illustrative data',

  /** Weekly conversion rate by funnel stage, as a fraction of the prior stage. */
  conversionTrend: [
    { week: 'W1', stage: 'Visit → Signup', rate: 0.031 },
    { week: 'W2', stage: 'Visit → Signup', rate: 0.033 },
    { week: 'W3', stage: 'Visit → Signup', rate: 0.032 },
    { week: 'W4', stage: 'Visit → Signup', rate: 0.035 },
    { week: 'W5', stage: 'Visit → Signup', rate: 0.037 },
    { week: 'W6', stage: 'Visit → Signup', rate: 0.036 },
    { week: 'W7', stage: 'Visit → Signup', rate: 0.039 },
    { week: 'W8', stage: 'Visit → Signup', rate: 0.042 },
    { week: 'W9', stage: 'Visit → Signup', rate: 0.041 },
    { week: 'W10', stage: 'Visit → Signup', rate: 0.044 },
    { week: 'W11', stage: 'Visit → Signup', rate: 0.047 },
    { week: 'W12', stage: 'Visit → Signup', rate: 0.049 },
    { week: 'W1', stage: 'Signup → Paid', rate: 0.184 },
    { week: 'W2', stage: 'Signup → Paid', rate: 0.177 },
    { week: 'W3', stage: 'Signup → Paid', rate: 0.191 },
    { week: 'W4', stage: 'Signup → Paid', rate: 0.188 },
    { week: 'W5', stage: 'Signup → Paid', rate: 0.196 },
    { week: 'W6', stage: 'Signup → Paid', rate: 0.203 },
    { week: 'W7', stage: 'Signup → Paid', rate: 0.198 },
    { week: 'W8', stage: 'Signup → Paid', rate: 0.211 },
    { week: 'W9', stage: 'Signup → Paid', rate: 0.218 },
    { week: 'W10', stage: 'Signup → Paid', rate: 0.214 },
    { week: 'W11', stage: 'Signup → Paid', rate: 0.226 },
    { week: 'W12', stage: 'Signup → Paid', rate: 0.233 },
  ],

  /** Marketing-qualified leads by channel and quarter. */
  channelPerformance: [
    { quarter: 'Q1', channel: 'Organic search', leads: 1840 },
    { quarter: 'Q1', channel: 'Paid social', leads: 1120 },
    { quarter: 'Q1', channel: 'Events', leads: 640 },
    { quarter: 'Q1', channel: 'Partners', leads: 410 },
    { quarter: 'Q2', channel: 'Organic search', leads: 2010 },
    { quarter: 'Q2', channel: 'Paid social', leads: 1285 },
    { quarter: 'Q2', channel: 'Events', leads: 905 },
    { quarter: 'Q2', channel: 'Partners', leads: 468 },
    { quarter: 'Q3', channel: 'Organic search', leads: 2260 },
    { quarter: 'Q3', channel: 'Paid social', leads: 1190 },
    { quarter: 'Q3', channel: 'Events', leads: 520 },
    { quarter: 'Q3', channel: 'Partners', leads: 552 },
    { quarter: 'Q4', channel: 'Organic search', leads: 2540 },
    { quarter: 'Q4', channel: 'Paid social', leads: 1345 },
    { quarter: 'Q4', channel: 'Events', leads: 1180 },
    { quarter: 'Q4', channel: 'Partners', leads: 631 },
  ],
} as const;
