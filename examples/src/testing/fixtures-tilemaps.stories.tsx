/**
 * Testing / Fixtures Tilemaps — pinned e2e stories for the phase-5 tilemap
 * anatomy: 2px tile radius, no tile stroke, the effective-color luminance flip
 * on label ink, and the squared legend bar with a "No data" swatch.
 *
 * Inline data keeps the fixtures frozen. Do not restyle: pixel contract.
 */

import type { TileMapSpec } from '@opendata-ai/openchart-core';
import { TileMap } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures Tilemaps' };

// ---------------------------------------------------------------------------
// Frozen data — statewide unemployment rate, seasonally adjusted (%).
// ---------------------------------------------------------------------------

const unemployment: Record<string, number> = {
  AL: 2.7,
  AK: 4.8,
  AZ: 4.7,
  AR: 4.2,
  CA: 5.3,
  CO: 3.8,
  CT: 4.8,
  DE: 5.4,
  DC: 5.7,
  FL: 4.4,
  GA: 3.5,
  HI: 2.4,
  ID: 3.6,
  IL: 5.1,
  IN: 3.6,
  IA: 3.3,
  KS: 3.8,
  KY: 4.2,
  LA: 4.4,
  ME: 3.3,
  MD: 4.3,
  MA: 4.7,
  MI: 5.1,
  MN: 4.9,
  MS: 3.8,
  MO: 4.2,
  MT: 3.6,
  NE: 3.1,
  NV: 5.1,
  NH: 3.0,
  NJ: 4.9,
  NM: 4.8,
  NY: 4.4,
  NC: 3.7,
  ND: 2.8,
  OH: 4.0,
  OK: 3.9,
  OR: 5.2,
  PA: 4.2,
  RI: 4.9,
  SC: 4.2,
  SD: 2.3,
  TN: 3.3,
  TX: 4.3,
  UT: 3.8,
  VT: 2.6,
  VA: 3.8,
  WA: 5.1,
  WV: 4.5,
  WI: 4.0,
  WY: 3.8,
};

// Broadest non-medical vaccine exemption each state allows.
const exemptions: Record<string, string> = {
  AL: 'religious',
  AK: 'religious',
  AZ: 'philosophical',
  AR: 'philosophical',
  CA: 'medical_only',
  CO: 'philosophical',
  CT: 'medical_only',
  DE: 'religious',
  DC: 'religious',
  FL: 'religious',
  GA: 'religious',
  HI: 'religious',
  ID: 'philosophical',
  IL: 'religious',
  IN: 'religious',
  IA: 'religious',
  KS: 'religious',
  KY: 'religious',
  LA: 'philosophical',
  ME: 'medical_only',
  MD: 'religious',
  MA: 'religious',
  MI: 'philosophical',
  MN: 'philosophical',
  MS: 'medical_only',
  MO: 'religious',
  MT: 'religious',
  NE: 'religious',
  NV: 'religious',
  NH: 'religious',
  NJ: 'religious',
  NM: 'religious',
  NY: 'medical_only',
  NC: 'religious',
  ND: 'philosophical',
  OH: 'philosophical',
  OK: 'philosophical',
  OR: 'philosophical',
  PA: 'philosophical',
  RI: 'religious',
  SC: 'religious',
  SD: 'religious',
  TN: 'religious',
  TX: 'philosophical',
  UT: 'philosophical',
  VT: 'religious',
  VA: 'religious',
  WA: 'philosophical',
  WV: 'medical_only',
  WI: 'philosophical',
  WY: 'religious',
};

// ---------------------------------------------------------------------------
// Quantitative — sequential ramp with value labels under each state code, and
// the squared legend bar.
// ---------------------------------------------------------------------------

const quantitativeSpec: TileMapSpec = {
  type: 'tilemap',
  data: unemployment,
  palette: 'blue',
  valueFormat: '.1f',
  chrome: {
    title: 'The Job Market Is Tightest Across the Plains',
    subtitle: 'State unemployment rate, seasonally adjusted, %',
    source: 'Source: Bureau of Labor Statistics, Local Area Unemployment Statistics',
    byline: 'Chart: OpenChart',
  },
  animation: false,
};

export const Quantitative = () => (
  <div className="tfix-chart tfix-h-500">
    <TileMap spec={quantitativeSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// CategoricalDark — one color per category, dark mode.
// ---------------------------------------------------------------------------

const categoricalDarkSpec: TileMapSpec = {
  type: 'tilemap',
  data: exemptions,
  colors: {
    medical_only: '#ee4a73',
    religious: '#e07d00',
    philosophical: '#06b6d4',
  },
  chrome: {
    title: 'Most States Allow a Non-Medical Vaccine Exemption',
    subtitle: 'Broadest exemption type each state permits',
    source: 'Source: National Conference of State Legislatures',
    byline: 'Chart: OpenChart',
  },
  animation: false,
};

// The Ladle host page is light and the tilemap paints no full-bleed background
// of its own, so the fixture container carries the dark surface.
export const CategoricalDark = () => (
  <div className="tfix-chart tfix-h-500 oc-dark" style={{ background: 'var(--oc-bg)' }}>
    <TileMap spec={categoricalDarkSpec} darkMode="force" />
  </div>
);
