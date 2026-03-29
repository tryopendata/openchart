/**
 * Sankey diagram stories.
 *
 * Demonstrates energy flows, budget allocations, user journeys,
 * custom color encoding, dark mode, animation, and compact layout.
 * All data reflects realistic magnitudes for editorial quality.
 */

import type { SankeySpec } from '@opendata-ai/openchart-core';
import { Sankey } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Energy Flow: 3-column US energy source -> intermediate -> end use
// ---------------------------------------------------------------------------

const energyFlowSpec: SankeySpec = {
  type: 'sankey',
  data: [
    // Sources -> Intermediate
    { source: 'Coal', target: 'Electricity', value: 46.5 },
    { source: 'Natural Gas', target: 'Electricity', value: 38.2 },
    { source: 'Natural Gas', target: 'Heating', value: 25.8 },
    { source: 'Nuclear', target: 'Electricity', value: 19.7 },
    { source: 'Solar', target: 'Electricity', value: 10.3 },
    { source: 'Wind', target: 'Electricity', value: 14.1 },
    { source: 'Petroleum', target: 'Transport', value: 55.4 },
    { source: 'Petroleum', target: 'Industry', value: 12.3 },
    // Intermediate -> End use
    { source: 'Electricity', target: 'Residential', value: 38.5 },
    { source: 'Electricity', target: 'Commercial', value: 35.8 },
    { source: 'Electricity', target: 'Industry', value: 34.5 },
    { source: 'Heating', target: 'Residential', value: 15.2 },
    { source: 'Heating', target: 'Commercial', value: 10.6 },
    { source: 'Transport', target: 'Passenger', value: 32.1 },
    { source: 'Transport', target: 'Freight', value: 23.3 },
  ],
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'US Energy Flow',
    subtitle: 'From primary sources to end-use sectors, quadrillion BTU',
    source: 'U.S. Energy Information Administration',
  },
  animation: true,
};

export const EnergyFlow = () => (
  <div className="story-chart story-h-420">
    <Sankey spec={energyFlowSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Budget Allocation: Revenue streams -> department spending (2-column)
// ---------------------------------------------------------------------------

const budgetSpec: SankeySpec = {
  type: 'sankey',
  data: [
    // Revenue sources -> Departments
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
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'Where the Money Goes',
    subtitle: 'FY 2024 revenue allocation by department, $M',
    source: 'Internal finance report',
  },
  animation: true,
};

export const BudgetAllocation = () => (
  <div className="story-chart story-h-420">
    <Sankey spec={budgetSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// User Journey: Website funnel across 4 stages
// ---------------------------------------------------------------------------

const userJourneySpec: SankeySpec = {
  type: 'sankey',
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
  encoding: {
    source: { field: 'source', type: 'nominal' },
    target: { field: 'target', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'The Conversion Funnel: 10K Visitors to 720 Paying Users',
    subtitle: 'User journey from landing page through conversion, monthly cohort',
    source: 'Product analytics, March 2025',
  },
  animation: true,
};

export const UserJourney = () => (
  <div className="story-chart story-h-420">
    <Sankey spec={userJourneySpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Custom Colors: encoding.color applied to energy flow
// ---------------------------------------------------------------------------

const customColorSpec: SankeySpec = {
  ...energyFlowSpec,
  encoding: {
    ...energyFlowSpec.encoding,
    color: { field: 'source', type: 'nominal' },
  },
  chrome: {
    title: 'Energy Flow by Source Color',
    subtitle: 'Same data as Energy Flow, with color encoding on the source field',
    source: 'U.S. Energy Information Administration',
  },
};

export const CustomColors = () => (
  <div className="story-chart story-h-420">
    <Sankey spec={customColorSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Dark Mode: forced dark variant
// ---------------------------------------------------------------------------

const darkModeSpec: SankeySpec = {
  ...energyFlowSpec,
  darkMode: 'force',
  chrome: {
    title: 'Energy Flow (Dark)',
    subtitle: 'Dark mode variant of the energy flow diagram',
    source: 'U.S. Energy Information Administration',
  },
};

export const DarkMode = () => (
  <div className="story-chart story-h-420">
    <Sankey spec={darkModeSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Animated: custom entrance animation duration
// ---------------------------------------------------------------------------

const animatedSpec: SankeySpec = {
  ...energyFlowSpec,
  animation: true,
  chrome: {
    title: 'Animated Energy Flow',
    subtitle: 'Entrance animation with staggered fade-in',
    source: 'U.S. Energy Information Administration',
  },
};

export const Animated = () => (
  <div className="story-chart story-h-420">
    <Sankey spec={animatedSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Compact: narrow width variant for responsive testing
// ---------------------------------------------------------------------------

const compactSpec: SankeySpec = {
  ...energyFlowSpec,
  chrome: {
    title: 'Energy Flow',
    subtitle: 'Compact layout at 360px',
  },
};

export const Compact = () => (
  <div className="story-chart story-h-420" style={{ maxWidth: '360px' }}>
    <Sankey spec={compactSpec} />
  </div>
);
