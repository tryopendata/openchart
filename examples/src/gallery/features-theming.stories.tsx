/**
 * Features / Theming — presets, named themes, custom ThemeConfig, dark adaptation.
 *
 * Everything a host app needs to make OpenChart match its own house style: the
 * three built-in presets, the 11 named ThemeConfigs the toolbar picker applies
 * globally, a custom theme built from parts, and the dark-mode story
 * (`darkMode: 'auto' | 'force' | 'off'` + `adaptTheme()`).
 *
 * Global-toggle contract: every demo on this page inherits `darkMode` from the
 * page's VizThemeProvider (set by the toolbar's light/dark toggle) EXCEPT the
 * one sanctioned side-by-side comparison in "Dark-mode adaptation", which pins
 * two chart instances to force-dark and force-light. That force is scoped to
 * those two Charts via their own VizThemeProvider wrappers so it never leaks
 * into sibling demos.
 */

import type { ChartSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import { editorial, essay, wire } from '@opendata-ai/openchart-core';
import { Chart, VizThemeProvider } from '@opendata-ai/openchart-react';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { themeNames, themes } from '../../.ladle/themes';
import { Demo, GalleryPage, Section } from '../components';
import { programmingLanguages, usInflation } from '../data';

// ---------------------------------------------------------------------------
// Layout styles — inline so this page adds no shared CSS. The --oc-* tokens
// resolve because these nodes live under the GalleryPage [data-oc-mode] root
// (which also crosses into the width-addon iframe; constraint C3).
// ---------------------------------------------------------------------------

const grid = (min: string): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${min}, 1fr))`,
  gap: 'var(--oc-space-5)',
});

const cellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--oc-space-3)',
  margin: 0,
  border: '1px solid var(--oc-border)',
  borderRadius: 'var(--oc-radius-card)',
  background: 'var(--oc-surface)',
  overflow: 'hidden',
};

const capStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: 'var(--oc-space-4) var(--oc-space-4) 0',
};

const nameStyle: CSSProperties = {
  fontFamily: 'var(--oc-font-mono)',
  fontSize: 'var(--oc-type-caption)',
  fontWeight: 600,
  color: 'var(--oc-text-strong)',
};

const noteStyle: CSSProperties = {
  fontSize: 'var(--oc-type-caption)',
  lineHeight: 1.45,
  color: 'var(--oc-text-muted)',
};

const vizStyle: CSSProperties = { padding: '0 var(--oc-space-4) var(--oc-space-4)' };

const tagStyle: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--oc-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

// ---------------------------------------------------------------------------
// Shared demo specs — one line and one bar, reused across every theme so the
// only thing that changes card-to-card is the ThemeConfig.
// ---------------------------------------------------------------------------

const lineSpec: ChartSpec = {
  mark: 'line',
  data: [...usInflation.data],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: {
      field: 'rate',
      type: 'quantitative',
      axis: { title: 'Inflation (% YoY)', format: '.1f' },
      scale: { zero: true },
    },
  },
  annotations: [
    {
      type: 'text',
      x: '2022-07-01',
      y: 8.5,
      text: 'Peak: 8.5%',
      anchor: 'left',
      connector: true,
      offset: { dx: 40, dy: -6 },
    },
  ],
  labels: { density: 'none' },
  chrome: {
    title: 'Inflation Cooled Through 2024',
    subtitle: 'US CPI inflation rate, year-over-year (%), quarterly',
    source: usInflation.source,
    byline: 'Chart: OpenChart',
  },
};

const barSpec: ChartSpec = {
  mark: 'bar',
  data: programmingLanguages.data.slice(0, 8).map((d) => ({ ...d })),
  encoding: {
    x: { field: 'pct', type: 'quantitative', axis: { title: 'Share (%)', format: '.0f' } },
    y: { field: 'language', type: 'nominal' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Python Leads the Index',
    subtitle: 'Programming-language popularity, % share, 2025',
    source: programmingLanguages.source,
  },
};

// Compact single-metric spec for the dense named-theme grid.
const compactBarSpec: ChartSpec = {
  mark: 'bar',
  data: programmingLanguages.data.slice(0, 6).map((d) => ({ ...d })),
  encoding: {
    x: { field: 'pct', type: 'quantitative', axis: { title: 'Share (%)', format: '.0f' } },
    y: { field: 'language', type: 'nominal' },
    color: { field: 'language', type: 'nominal' },
  },
  legend: { show: false },
  chrome: {
    title: 'Language Popularity',
    subtitle: '% share, 2025',
  },
};

// ---------------------------------------------------------------------------
// Presets (editorial / essay / wire)
// ---------------------------------------------------------------------------

const PRESETS: { name: string; theme: ThemeConfig; note: string }[] = [
  {
    name: 'editorial',
    theme: editorial,
    note: 'The default look. Clean sans, restrained neutrals.',
  },
  { name: 'essay', theme: essay, note: 'Serif display titles, warm canvas, generous spacing.' },
  { name: 'wire', theme: wire, note: 'Dense, monospace, tight chrome — a dashboard/agency feel.' },
];

function PresetGrid() {
  return (
    <div style={grid('300px')}>
      {PRESETS.map((p) => (
        <figure key={p.name} style={cellStyle}>
          <figcaption style={capStyle}>
            <span style={nameStyle}>{p.name}</span>
            <span style={noteStyle}>{p.note}</span>
          </figcaption>
          {/* Explicit `theme` overrides the picker's theme; darkMode is left to
              inherit from the page provider so the global toggle still applies. */}
          <div style={vizStyle}>
            <div className="story-chart" style={{ height: 300 }}>
              <Chart spec={lineSpec} theme={p.theme} />
            </div>
          </div>
        </figure>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JSON copy panel — mirrors the Demo spec panel's UX, but the copyable payload
// is a ThemeConfig object (the point of the named-theme gallery).
// ---------------------------------------------------------------------------

function Chevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function JsonPanel({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(value, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard may be blocked; no-op */
    }
  };

  return (
    <div className="oc-spec">
      <div className="oc-spec-summary">
        <button
          type="button"
          className="oc-spec-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Chevron />
          {open ? `Hide ${label}` : `View ${label}`}
        </button>
        <button type="button" className="oc-spec-copy" onClick={copy}>
          {copied ? 'Copied' : `Copy ${label}`}
        </button>
      </div>
      {open ? (
        <pre className="oc-spec-code">
          <code>{json}</code>
        </pre>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Named-theme gallery — the 11 toolbar themes as a card grid.
// ---------------------------------------------------------------------------

function NamedThemeGrid() {
  return (
    <div style={grid('320px')}>
      {themeNames.map((name) => {
        const theme = themes[name];
        return (
          <div key={name} style={cellStyle}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 'var(--oc-space-2)',
                padding: 'var(--oc-space-4) var(--oc-space-4) 0',
              }}
            >
              <span style={nameStyle}>{name}</span>
              {name === 'Default' ? <span style={tagStyle}>library defaults</span> : null}
            </div>
            <div style={vizStyle}>
              {/* theme overrides the picker; darkMode inherits from the page
                  provider so these follow the global light/dark toggle. */}
              <div className="story-chart" style={{ height: 260 }}>
                <Chart spec={compactBarSpec} theme={theme} />
              </div>
            </div>
            <JsonPanel label="ThemeConfig" value={theme ?? {}} />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom theme walkthrough — one ThemeConfig assembled from parts.
// ---------------------------------------------------------------------------

const customTheme: ThemeConfig = {
  colors: {
    categorical: ['#0d9488', '#f97316', '#6366f1', '#e11d48', '#65a30d'],
    background: { light: '#fbfaf8', dark: '#141210' },
    text: { light: '#1c1917', dark: '#e7e5e4' },
    gridline: { light: 'rgba(0,0,0,0.07)', dark: 'rgba(255,255,255,0.07)' },
    axis: { light: '#78716c', dark: '#a8a29e' },
  },
  fonts: {
    family: '"Space Grotesk", "Inter", system-ui, sans-serif',
    sizes: { title: 22, subtitle: 14 },
    weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  spacing: { padding: 20, chromeGap: 6 },
  borderRadius: 8,
};

// ---------------------------------------------------------------------------
// Dark-mode adaptation — the SANCTIONED side-by-side `force` comparison.
// Each side is wrapped in its own VizThemeProvider so `darkMode: 'force'` /
// `'off'` is scoped to that Chart and never leaks into sibling demos.
// ---------------------------------------------------------------------------

const darkModeSpec: ChartSpec = {
  ...lineSpec,
  // A single-hex background (no light/dark pair) so adaptTheme() has to do the
  // surface swap + palette lightness search when forced dark — the whole point.
  theme: {
    colors: {
      categorical: ['#2563eb', '#f59e0b', '#10b981'],
      background: '#ffffff',
      text: '#0f172a',
      gridline: '#e2e8f0',
      axis: '#94a3b8',
    },
  },
  chrome: {
    title: 'One Spec, Both Modes',
    subtitle: 'Identical spec; only the forced darkMode differs',
    source: usInflation.source,
  },
};

function DarkAdaptation() {
  return (
    <div style={grid('320px')}>
      <figure style={cellStyle}>
        <figcaption style={capStyle}>
          <span style={nameStyle}>darkMode: 'off'</span>
          <span style={noteStyle}>
            The theme renders exactly as authored — light surface, original palette.
          </span>
        </figcaption>
        {/* Scoped force: this provider pins ONLY these two children. */}
        <VizThemeProvider theme={undefined} darkMode="off">
          <div style={vizStyle}>
            <div className="story-chart" style={{ height: 320 }}>
              <Chart spec={darkModeSpec} />
            </div>
          </div>
        </VizThemeProvider>
      </figure>
      <figure style={cellStyle}>
        <figcaption style={capStyle}>
          <span style={nameStyle}>darkMode: 'force'</span>
          <span style={noteStyle}>
            adaptTheme() swaps the surface and lightens the palette for a dark canvas.
          </span>
        </figcaption>
        <VizThemeProvider theme={undefined} darkMode="force">
          <div style={vizStyle}>
            <div className="story-chart" style={{ height: 320 }}>
              <Chart spec={darkModeSpec} />
            </div>
          </div>
        </VizThemeProvider>
      </figure>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FT-like and Economist-like recreations — proof of range.
// ---------------------------------------------------------------------------

const ftLikeTheme: ThemeConfig = {
  colors: {
    background: { light: '#fff1e5', dark: '#1a1311' },
    text: { light: '#33302e', dark: '#f2dfce' },
    categorical: ['#0d7680', '#0f5499', '#cc0000', '#593d1b', '#96bf48'],
    gridline: { light: 'rgba(0,0,0,0.1)', dark: 'rgba(255,255,255,0.08)' },
    axis: { light: '#66605c', dark: '#9e9792' },
  },
  fonts: {
    family: 'Georgia, "Times New Roman", serif',
    sizes: { title: 22, subtitle: 15, body: 14, small: 12 },
    weights: { normal: 400, medium: 500, semibold: 700, bold: 700 },
  },
  spacing: { padding: 16, chromeGap: 4, chromeToChart: 8 },
  chrome: {
    title: { fontWeight: 700, lineHeight: 1.2 },
    subtitle: { fontWeight: 400, lineHeight: 1.4 },
  },
  borderRadius: 0,
};

const economistLikeTheme: ThemeConfig = {
  colors: {
    background: { light: '#ffffff', dark: '#1a1a1a' },
    text: { light: '#1a1a1a', dark: '#e5e5e5' },
    categorical: ['#e3120b', '#006ba6', '#00847e', '#595959', '#c33d1c', '#3e7a34'],
    gridline: { light: 'rgba(0,0,0,0.1)', dark: 'rgba(255,255,255,0.08)' },
    axis: { light: '#595959', dark: '#a6a6a6' },
  },
  fonts: {
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    sizes: { title: 20, subtitle: 14, body: 13, small: 11 },
    weights: { normal: 400, medium: 500, semibold: 700, bold: 700 },
  },
  spacing: { padding: 16, chromeGap: 4, chromeToChart: 6 },
  chrome: {
    title: { fontWeight: 700, lineHeight: 1.15 },
    subtitle: { fontWeight: 400, lineHeight: 1.4 },
    eyebrow: { color: '#e3120b', fontWeight: 700 },
  },
  borderRadius: 0,
  seriesStrategy: 'accent-neutral',
};

function RecreationGrid() {
  return (
    <div style={grid('320px')}>
      <figure style={cellStyle}>
        <figcaption style={capStyle}>
          <span style={nameStyle}>FT-like</span>
          <span style={noteStyle}>Salmon canvas, serif, restrained palette.</span>
        </figcaption>
        <div style={vizStyle}>
          <div className="story-chart" style={{ height: 320 }}>
            <Chart spec={lineSpec} theme={ftLikeTheme} />
          </div>
        </div>
        <JsonPanel label="ThemeConfig" value={ftLikeTheme} />
      </figure>
      <figure style={cellStyle}>
        <figcaption style={capStyle}>
          <span style={nameStyle}>Economist-like</span>
          <span style={noteStyle}>Red eyebrow, condensed sans, bold titles.</span>
        </figcaption>
        <div style={vizStyle}>
          <div className="story-chart" style={{ height: 320 }}>
            <Chart spec={barSpec} theme={economistLikeTheme} />
          </div>
        </div>
        <JsonPanel label="ThemeConfig" value={economistLikeTheme} />
      </figure>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default { title: 'Features' };

export const Theming = () => (
  <GalleryPage
    title="Theming"
    lede="A theme is a ThemeConfig object deep-merged onto the defaults — colors, fonts, spacing, and border radius. Pass one to any chart, or set it globally so every chart in an app shares a house style. The toolbar picker (top-left) applies any of the named themes below to every page live; the light/dark toggle drives dark-mode adaptation."
  >
    <Section
      id="presets"
      title="Built-in presets"
      lede="Three ready-made looks ship in the core package: editorial (the default), essay, and wire. Import and pass them directly — the same chart, three personalities."
    >
      <Demo
        id="presets"
        title="editorial · essay · wire"
        description="One spec rendered in each built-in preset. Import { editorial, essay, wire } from the core package and pass as the theme."
        specForPanel={{ ...lineSpec, theme: essay }}
        maxWidth={1040}
      >
        <PresetGrid />
      </Demo>
    </Section>

    <Section
      id="named-themes"
      title="Theme gallery"
      lede="The eleven named themes the toolbar picker cycles through. Each is a plain ThemeConfig — expand any card to copy the exact object. Pick one in the toolbar to apply it to every page at once."
    >
      <Demo
        id="named-themes"
        title="The eleven named themes"
        description="Each card renders the same chart under a different named ThemeConfig, with the copyable theme object beneath it."
        maxWidth={1040}
      >
        <NamedThemeGrid />
      </Demo>
    </Section>

    <Section
      id="custom"
      title="Custom theme"
      lede="Build a ThemeConfig from parts: a categorical palette, a font family with size and weight overrides, spacing, and a border radius. Only the deltas you set are applied; everything else falls back to the defaults."
    >
      <Demo
        id="custom"
        title="A ThemeConfig assembled from parts"
        description="Colors (with light/dark pairs), fonts, spacing, and borderRadius composed into one theme, rendered live. Copy the spec to see the full object."
        spec={{ ...barSpec, theme: customTheme }}
        height={460}
      />
    </Section>

    <Section
      id="dark-mode"
      title="Dark-mode adaptation"
      lede="darkMode takes 'auto' (follow the OS / container), 'force' (always dark), or 'off' (never). When a theme has no explicit dark colors, adaptTheme() swaps the surface and runs a lightness search over the palette so accents stay legible on a dark canvas. The two charts below pin the same spec to force-off and force-dark so the adaptation is visible side by side — the only place this page forces a mode."
    >
      <Demo
        id="dark-mode"
        title="Same spec, forced light vs. forced dark"
        description="A single-surface theme (no dark pair) rendered at darkMode 'off' and 'force'. This comparison is scoped to these two charts; every other demo on the page follows the toolbar's light/dark toggle."
        specForPanel={darkModeSpec}
        maxWidth={1040}
      >
        <DarkAdaptation />
      </Demo>
    </Section>

    <Section
      id="recreations"
      title="House-style recreations"
      lede="Two familiar publication styles rebuilt with nothing but a ThemeConfig — proof of the system's range."
    >
      <Demo
        id="recreations"
        title="FT-like and Economist-like"
        description="Financial Times and Economist house styles approximated through color, font, spacing, and chrome overrides. Copy either ThemeConfig to start from it."
        maxWidth={1040}
      >
        <RecreationGrid />
      </Demo>
    </Section>
  </GalleryPage>
);
