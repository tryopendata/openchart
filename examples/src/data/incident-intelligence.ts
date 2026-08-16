/**
 * Product telemetry for a fictional AI on-call agent — the kind of tool that
 * watches error feeds, dedupes related alerts, root-causes incidents with an
 * LLM agent, and opens fix PRs before a human picks up the page. Used by the
 * incident-intelligence dashboard layout on the Dashboards page.
 *
 * Five tables:
 * - `errorFeed`: ~8 hours of application errors in 5-minute buckets. A deploy
 *   at 14:05 triples the baseline until the agent's fix merges at 14:40, so
 *   the hero chart has a deploy-correlated spike to annotate. A feature-flag
 *   ramp 35 minutes earlier sits inside the window as a red herring the agent
 *   ruled out.
 * - `investigationOutcomes`: where the last 7 days of investigations ended
 *   up. Every bucket stays comfortably above the pie compiler's 3% "Other"
 *   threshold so the pinned outcome colors hold.
 * - `timeToRootCause`: weekly median minutes from alert to root cause, agent
 *   vs. the on-call engineer baseline it is replacing.
 * - `errorSignatures`: the top deduped error signatures by event count.
 * - `agentActivity`: the most recent investigations, one row per incident.
 *
 * All values are invented (seeded walks frozen to static arrays) — hence
 * 'Illustrative data' and no source URL.
 */

type ErrorPoint = { time: string; errors: number };

/** 5-minute buckets from 08:00 to 15:55 UTC on a single day. */
const BUCKETS: string[] = (() => {
  const out: string[] = [];
  for (let i = 0; i < 96; i++) {
    const d = new Date(Date.UTC(2026, 2, 12, 8, 0, 0) + i * 300_000);
    out.push(d.toISOString().slice(0, 16));
  }
  return out;
})();

/**
 * Baseline ~40 errors per bucket with mild noise; the 14:05 deploy (bucket 73)
 * spikes to ~185 and decays after the agent's fix merges at 14:40 (bucket 80).
 */
const ERROR_COUNTS: number[] = [
  38, 42, 40, 37, 44, 41, 39, 45, 43, 40, 38, 42, 46, 41, 39, 37, 43, 45, 42, 40, 38, 41, 44, 39,
  42, 46, 43, 40, 37, 41, 45, 42, 39, 43, 40, 38, 44, 41, 46, 42, 39, 40, 43, 45, 41, 38, 42, 44,
  40, 39, 46, 43, 41, 37, 42, 45, 40, 43, 38, 41, 44, 42, 39, 46, 40, 43, 41, 38, 45, 42, 44, 40,
  47, 112, 158, 176, 185, 179, 171, 166, 142, 96, 71, 58, 52, 47, 45, 43, 41, 44, 42, 40, 43, 39,
  42, 41,
];

export const incidentIntelligence = {
  source: 'Illustrative data',

  /** Application errors per 5-minute bucket. */
  errorFeed: BUCKETS.map((time, i): ErrorPoint => ({ time, errors: ERROR_COUNTS[i] })),

  /** Timestamps the hero chart annotates, all inside the seeded window. */
  markers: {
    /** Checkout feature flag ramped 25% → 50%; the agent ruled it out. */
    flagRamp: BUCKETS[66], // 13:30
    /** The deploy that shipped the regression. */
    deploy: BUCKETS[73], // 14:05
    /** The agent's revert PR merged; errors decay from here. */
    fixMerged: BUCKETS[80], // 14:40
    /** Peak bucket, for the takeaway annotation. */
    peak: BUCKETS[76], // 14:20
  },

  /** Where the last 7 days of investigations ended up. */
  investigationOutcomes: [
    // Keep every bucket well above the pie compiler's 3% "Other" threshold so
    // the pinned outcome colors stay intact while the live simulation shifts
    // counts around.
    { outcome: 'Auto-fixed', investigations: 34 },
    { outcome: 'Root-caused', investigations: 22 },
    { outcome: 'Escalated', investigations: 9 },
    { outcome: 'Deduped as noise', investigations: 27 },
  ],

  /** Weekly median minutes from alert to root cause. The agent's line falls
   *  as it learns the stack; the on-call baseline holds steady. */
  timeToRootCause: [
    { week: 'W1', minutes: 34, resolver: 'Agent' },
    { week: 'W2', minutes: 28, resolver: 'Agent' },
    { week: 'W3', minutes: 21, resolver: 'Agent' },
    { week: 'W4', minutes: 17, resolver: 'Agent' },
    { week: 'W5', minutes: 12, resolver: 'Agent' },
    { week: 'W6', minutes: 9, resolver: 'Agent' },
    { week: 'W7', minutes: 7, resolver: 'Agent' },
    { week: 'W8', minutes: 6, resolver: 'Agent' },
    { week: 'W9', minutes: 5, resolver: 'Agent' },
    { week: 'W10', minutes: 4, resolver: 'Agent' },
    { week: 'W1', minutes: 52, resolver: 'On-call engineer' },
    { week: 'W2', minutes: 47, resolver: 'On-call engineer' },
    { week: 'W3', minutes: 55, resolver: 'On-call engineer' },
    { week: 'W4', minutes: 49, resolver: 'On-call engineer' },
    { week: 'W5', minutes: 51, resolver: 'On-call engineer' },
    { week: 'W6', minutes: 46, resolver: 'On-call engineer' },
    { week: 'W7', minutes: 53, resolver: 'On-call engineer' },
    { week: 'W8', minutes: 48, resolver: 'On-call engineer' },
    { week: 'W9', minutes: 50, resolver: 'On-call engineer' },
    { week: 'W10', minutes: 47, resolver: 'On-call engineer' },
  ],

  /** Top deduped error signatures over the last 24 hours. Kept terse so they
   *  read whole in a third-width bar-list tile instead of ellipsizing. */
  errorSignatures: [
    { signature: 'cart.items undefined', events: 4210 },
    { signature: 'PaymentGateway 504', events: 2380 },
    { signature: 'orders.write deadlock', events: 1140 },
    { signature: 'search RateLimit', events: 860 },
    { signature: 'SessionStore NPE', events: 540 },
    { signature: 'inventory ECONNRESET', events: 390 },
  ],

  /** Most recent investigations, newest first. */
  agentActivity: [
    {
      issue: 'Checkout errors after deploy 8412',
      service: 'checkout',
      outcome: 'Fix PR merged',
      confidence: 0.96,
      minutes: 4.2,
      usersAffected: 3120,
    },
    {
      issue: 'Payment gateway 504 burst',
      service: 'payments',
      outcome: 'Root-caused',
      confidence: 0.91,
      minutes: 6.8,
      usersAffected: 1840,
    },
    {
      issue: 'Search latency alert storm',
      service: 'search',
      outcome: 'Deduped (12 alerts)',
      confidence: 0.88,
      minutes: 1.1,
      usersAffected: 0,
    },
    {
      issue: 'Orders DB deadlock recurrence',
      service: 'orders',
      outcome: 'Escalated',
      confidence: 0.64,
      minutes: 9.5,
      usersAffected: 460,
    },
    {
      issue: 'Session store NPE on logout',
      service: 'identity',
      outcome: 'Fix PR open',
      confidence: 0.93,
      minutes: 5.4,
      usersAffected: 210,
    },
  ],
};
