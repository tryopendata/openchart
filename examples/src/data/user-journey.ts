/**
 * Product conversion funnel: 10K monthly visitors through to paying users.
 *
 * Multi-stage sankey (landing -> signup -> onboarding -> active -> outcome).
 * Illustrative product-analytics figures for a fictional cohort; no public
 * source, so it carries the 'Illustrative data' marker.
 */
export const userJourney = {
  source: 'Illustrative data',
  data: [
    // Stage 1 -> Stage 2
    { source: 'Landing Page', target: 'Sign Up', value: 3200 },
    { source: 'Landing Page', target: 'Bounce', value: 6800 },
    // Stage 2 -> Stage 3
    { source: 'Sign Up', target: 'Onboarding', value: 2400 },
    { source: 'Sign Up', target: 'Drop Off', value: 800 },
    // Stage 3 -> Stage 4
    { source: 'Onboarding', target: 'Active User', value: 1800 },
    { source: 'Onboarding', target: 'Churned', value: 600 },
    // Stage 4 -> Outcome
    { source: 'Active User', target: 'Premium', value: 720 },
    { source: 'Active User', target: 'Free Tier', value: 1080 },
  ],
} as const;
