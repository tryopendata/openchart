/**
 * BarList stories.
 *
 * Demonstrates ranked horizontal bar lists with proportional fill bars,
 * color encoding, subtitle fields, dark mode, and compact layouts.
 */

import type { BarListSpec } from '@opendata-ai/openchart-core';
import { BarList } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Shared data: top programming languages by popularity index (%)
// ---------------------------------------------------------------------------

const languageData = [
  { language: 'Python', pct: 23.4, category: 'general' },
  { language: 'Java', pct: 17.1, category: 'general' },
  { language: 'JavaScript', pct: 14.9, category: 'web' },
  { language: 'C/C++', pct: 11.2, category: 'systems' },
  { language: 'C#', pct: 8.6, category: 'general' },
  { language: 'Go', pct: 5.8, category: 'systems' },
  { language: 'TypeScript', pct: 5.3, category: 'web' },
  { language: 'Rust', pct: 4.1, category: 'systems' },
  { language: 'PHP', pct: 3.7, category: 'web' },
  { language: 'Swift', pct: 2.6, category: 'mobile' },
  { language: 'Kotlin', pct: 2.1, category: 'mobile' },
  { language: 'Ruby', pct: 1.2, category: 'web' },
];

// ---------------------------------------------------------------------------
// Basic: default rendering
// ---------------------------------------------------------------------------

const basicSpec: BarListSpec = {
  type: 'barlist',
  data: languageData,
  encoding: {
    label: { field: 'language', type: 'nominal' },
    value: { field: 'pct', type: 'quantitative' },
  },
  valueFormat: '.1f',
  chrome: {
    title: 'Python leads the pack',
    subtitle: 'Programming language popularity index, % share, 2025',
    source: 'TIOBE Index',
  },
};

export const Basic = () => (
  <div className="story-chart story-h-500">
    <BarList spec={basicSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Color Encoding: categories mapped to palette colors
// ---------------------------------------------------------------------------

const colorSpec: BarListSpec = {
  ...basicSpec,
  encoding: {
    label: { field: 'language', type: 'nominal' },
    value: { field: 'pct', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Web languages dominate the top 10',
    subtitle: 'Colored by language category — general, web, systems, mobile',
    source: 'TIOBE Index',
  },
};

export const ColorEncoding = () => (
  <div className="story-chart story-h-500">
    <BarList spec={colorSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// With Subtitle Field: secondary text beside each label
// ---------------------------------------------------------------------------

const browserData = [
  { browser: 'Chrome', share: 65.4, note: 'Google' },
  { browser: 'Safari', share: 18.7, note: 'Apple' },
  { browser: 'Edge', share: 5.3, note: 'Microsoft' },
  { browser: 'Firefox', share: 3.1, note: 'Mozilla' },
  { browser: 'Samsung', share: 2.8, note: 'Samsung' },
  { browser: 'Other', share: 2.6, note: '' },
  { browser: 'Opera', share: 2.1, note: 'Opera AS' },
];

const subtitleSpec: BarListSpec = {
  type: 'barlist',
  data: browserData,
  encoding: {
    label: { field: 'browser', type: 'nominal' },
    value: { field: 'share', type: 'quantitative' },
    subtitle: { field: 'note', type: 'nominal' },
  },
  valueFormat: '.1f',
  chrome: {
    title: 'Chrome still commands two-thirds of the market',
    subtitle: 'Global browser market share, %, March 2025',
    source: 'StatCounter Global Stats',
  },
};

export const WithSubtitle = () => (
  <div className="story-chart story-h-400">
    <BarList spec={subtitleSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Custom Bar Style: taller bars with numeric corner radius
// ---------------------------------------------------------------------------

const styleSpec: BarListSpec = {
  ...basicSpec,
  barHeight: 12,
  cornerRadius: 3,
  maxItems: 6,
  chrome: {
    title: 'Top 6 languages',
    subtitle: 'Taller bars, square-ish corners',
    source: 'TIOBE Index',
  },
};

export const CustomBarStyle = () => (
  <div className="story-chart story-h-320">
    <BarList spec={styleSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Dark Mode
// ---------------------------------------------------------------------------

const darkSpec: BarListSpec = {
  ...basicSpec,
  darkMode: 'force',
  chrome: {
    title: 'Python leads the pack',
    subtitle: 'Programming language popularity index, % share, 2025',
    source: 'TIOBE Index',
  },
};

export const DarkMode = () => (
  <div className="story-chart story-h-500" style={{ background: '#1a1a1a' }}>
    <BarList spec={darkSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Compact: narrow width, fewer items
// ---------------------------------------------------------------------------

const compactSpec: BarListSpec = {
  ...basicSpec,
  maxItems: 5,
  chrome: {
    title: 'Top languages',
    subtitle: 'Popularity %, 2025',
  },
};

export const Compact = () => (
  <div className="story-chart story-h-300" style={{ maxWidth: '380px' }}>
    <BarList spec={compactSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Large Dataset: 12 rows to show auto-cap behavior
// ---------------------------------------------------------------------------

const techStackData = [
  { tool: 'React', stars: 228 },
  { tool: 'Vue', stars: 207 },
  { tool: 'Angular', stars: 96 },
  { tool: 'Next.js', stars: 130 },
  { tool: 'Svelte', stars: 81 },
  { tool: 'Nuxt', stars: 56 },
  { tool: 'Remix', stars: 30 },
  { tool: 'SvelteKit', stars: 19 },
  { tool: 'Solid', stars: 32 },
  { tool: 'Qwik', stars: 21 },
  { tool: 'Astro', stars: 48 },
  { tool: 'Ember', stars: 22 },
];

const largeSpec: BarListSpec = {
  type: 'barlist',
  data: techStackData,
  encoding: {
    label: { field: 'tool', type: 'nominal' },
    value: { field: 'stars', type: 'quantitative' },
  },
  valueFormat: '.0f',
  chrome: {
    title: 'React dominates frontend GitHub stars',
    subtitle: 'GitHub stars in thousands, major frontend frameworks',
    source: 'GitHub',
  },
};

export const LargeDataset = () => (
  <div className="story-chart story-h-480">
    <BarList spec={largeSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// No Chrome: data-only, no title or source
// ---------------------------------------------------------------------------

const noWatermarkSpec: BarListSpec = {
  type: 'barlist',
  data: browserData,
  encoding: {
    label: { field: 'browser', type: 'nominal' },
    value: { field: 'share', type: 'quantitative' },
  },
  valueFormat: '.1f',
  watermark: false,
};

export const NoChrome = () => (
  <div className="story-chart story-h-320">
    <BarList spec={noWatermarkSpec} />
  </div>
);
