/**
 * Theme stories: 10 themes, each rendered across 4 chart types
 * (line, bar, donut, table) so color/font/spacing choices are
 * visible in context.
 */

import type { ChartSpec, TableSpec, ThemeConfig, VizSpec } from '@openchart/core';
import { isTableSpec } from '@openchart/core';
import type { ValidationResult } from '@openchart/engine';
import { validateSpec } from '@openchart/engine';
import { Chart, DataTable, useVizDarkMode, useVizTheme } from '@openchart/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Shared demo data
// ---------------------------------------------------------------------------

const lineSpec: ChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 10, series: 'Revenue' },
    { date: '2021-01-01', value: 25, series: 'Revenue' },
    { date: '2022-01-01', value: 40, series: 'Revenue' },
    { date: '2020-01-01', value: 30, series: 'Costs' },
    { date: '2021-01-01', value: 20, series: 'Costs' },
    { date: '2022-01-01', value: 35, series: 'Costs' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  },
  legend: { position: 'top' },
  chrome: {
    title: 'Revenue vs Costs',
    subtitle: 'Three-year trend comparison',
    source: 'Source: Internal data',
  },
};

const barSpec: ChartSpec = {
  type: 'bar',
  data: [
    { language: 'Python', popularity: 29 },
    { language: 'JavaScript', popularity: 24 },
    { language: 'TypeScript', popularity: 17 },
    { language: 'Java', popularity: 14 },
    { language: 'Go', popularity: 10 },
    { language: 'Rust', popularity: 6 },
  ],
  encoding: {
    x: { field: 'popularity', type: 'quantitative' },
    y: { field: 'language', type: 'nominal' },
    color: { field: 'popularity', type: 'quantitative' },
  },
  chrome: {
    title: 'Language Popularity',
    subtitle: '2024 developer survey results',
  },
};

const donutSpec: ChartSpec = {
  type: 'donut',
  data: [
    { segment: 'Cloud', revenue: 42 },
    { segment: 'Enterprise', revenue: 28 },
    { segment: 'Consumer', revenue: 18 },
    { segment: 'Other', revenue: 12 },
  ],
  encoding: {
    y: { field: 'revenue', type: 'quantitative', axis: { format: '$,.0f', label: 'Revenue ($B)' } },
    color: { field: 'segment', type: 'nominal' },
  },
  chrome: {
    title: 'Revenue by Segment',
    subtitle: 'Fiscal year 2024',
  },
};

const tableSpec: TableSpec = {
  type: 'table',
  data: [
    { language: 'Python', popularity: 29, growth: 3.2 },
    { language: 'JavaScript', popularity: 24, growth: -1.1 },
    { language: 'TypeScript', popularity: 17, growth: 4.5 },
    { language: 'Java', popularity: 14, growth: -0.8 },
    { language: 'Go', popularity: 10, growth: 2.1 },
    { language: 'Rust', popularity: 6, growth: 1.9 },
  ],
  columns: [
    { key: 'language', label: 'Language' },
    { key: 'popularity', label: 'Popularity %', format: '.0f', bar: {} },
    { key: 'growth', label: 'YoY Growth', format: '+.1f' },
  ],
  chrome: {
    title: 'Developer Survey',
    subtitle: 'Top languages by popularity',
  },
};

// ---------------------------------------------------------------------------
// Shared showcase layout
// ---------------------------------------------------------------------------

function Showcase({ theme }: { theme?: ThemeConfig }) {
  const bgColor = theme?.colors?.background ?? '#ffffff';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        padding: 24,
        background: bgColor,
        borderRadius: 8,
      }}
    >
      <div style={{ height: 320 }}>
        <Chart spec={lineSpec} theme={theme} />
      </div>
      <div style={{ height: 320 }}>
        <Chart spec={barSpec} theme={theme} />
      </div>
      <div style={{ height: 320 }}>
        <Chart spec={donutSpec} theme={theme} />
      </div>
      <div style={{ height: 320 }}>
        <DataTable spec={tableSpec} theme={theme} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Default (no overrides)
// ---------------------------------------------------------------------------

export const DefaultTheme = () => <Showcase />;

// ---------------------------------------------------------------------------
// 2. Warm — Earth tones, serif, cream canvas
// ---------------------------------------------------------------------------

const warmTheme: ThemeConfig = {
  colors: {
    categorical: ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653'],
    background: '#fdf6ec',
    text: '#3d2c1e',
  },
  fonts: {
    family: 'Georgia, "Times New Roman", serif',
  },
};

export const WarmTheme = () => <Showcase theme={warmTheme} />;

// ---------------------------------------------------------------------------
// 3. Monospace — Developer / code aesthetic, indigo spectrum
// ---------------------------------------------------------------------------

const monospaceTheme: ThemeConfig = {
  colors: {
    categorical: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'],
    background: '#f8f9ff',
    text: '#1e1b4b',
    gridline: '#c7d2fe',
  },
  fonts: {
    family: '"JetBrains Mono", "Fira Code", monospace',
  },
};

export const MonospaceTheme = () => <Showcase theme={monospaceTheme} />;

// ---------------------------------------------------------------------------
// 4. Midnight — Dark premium editorial (FT / Bloomberg mood)
//    Helvetica Neue gives it that tight, Swiss-precision feeling.
// ---------------------------------------------------------------------------

const midnightTheme: ThemeConfig = {
  colors: {
    categorical: [
      '#38bdf8', // sky blue
      '#f472b6', // rose pink
      '#34d399', // emerald
      '#fbbf24', // amber
      '#a78bfa', // violet
      '#fb923c', // tangerine
    ],
    background: '#0f172a',
    text: '#e2e8f0',
    gridline: '#1e293b',
    axis: '#64748b',
  },
  fonts: {
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
};

export const MidnightTheme = () => <Showcase theme={midnightTheme} />;

// ---------------------------------------------------------------------------
// 5. Ink — Newspaper editorial. Restrained palette, one bold accent.
//    Charter serif for that broadsheet feeling.
// ---------------------------------------------------------------------------

const inkTheme: ThemeConfig = {
  colors: {
    categorical: [
      '#c0392b', // editorial red (the signature)
      '#2c3e50', // dark slate
      '#7f8c8d', // warm gray
      '#27ae60', // green accent
      '#d4880f', // mustard
      '#6c3483', // plum
    ],
    background: '#faf9f6',
    text: '#111111',
    gridline: '#d5d2cb',
    axis: '#555555',
  },
  fonts: {
    family: 'Charter, Georgia, "Times New Roman", serif',
  },
};

export const InkTheme = () => <Showcase theme={inkTheme} />;

// ---------------------------------------------------------------------------
// 6. Ocean — Cool, calming, scientific.
//    Optima gives it a calligraphic, organic quality.
// ---------------------------------------------------------------------------

const oceanTheme: ThemeConfig = {
  colors: {
    categorical: [
      '#0077b6', // deep ocean
      '#e76f51', // coral
      '#00b4d8', // bright cyan
      '#f4a261', // sand gold
      '#2a9d8f', // sea green
      '#264653', // deep teal
    ],
    background: '#f0f7fa',
    text: '#0c2d3f',
    gridline: '#d1e6ee',
    axis: '#5a8a9f',
  },
  fonts: {
    family: 'Optima, Candara, "Noto Sans", "Trebuchet MS", sans-serif',
  },
};

export const OceanTheme = () => <Showcase theme={oceanTheme} />;

// ---------------------------------------------------------------------------
// 7. Botanical — Nature illustration. Parchment canvas, muted pigments.
//    Palatino serif for that pressed-flower journal feel.
// ---------------------------------------------------------------------------

const botanicalTheme: ThemeConfig = {
  colors: {
    categorical: [
      '#5f7c43', // olive
      '#bc4749', // berry
      '#386641', // forest
      '#c68b59', // warm ochre
      '#7b2d8e', // thistle purple
      '#457b9d', // slate blue
    ],
    background: '#f7f5ef',
    text: '#2b331e',
    gridline: '#ddd9cb',
    axis: '#7a7560',
  },
  fonts: {
    family: 'Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif',
  },
};

export const BotanicalTheme = () => <Showcase theme={botanicalTheme} />;

// ---------------------------------------------------------------------------
// 8. Neon — Electric cyberpunk dashboard. Near-black canvas,
//    high-saturation accents. Monospace for the tech-terminal vibe.
// ---------------------------------------------------------------------------

const neonTheme: ThemeConfig = {
  colors: {
    categorical: [
      '#00f5d4', // electric mint
      '#f15bb5', // hot pink
      '#fee440', // electric yellow
      '#00bbf9', // electric blue
      '#9b5de5', // electric purple
      '#ff6b6b', // electric coral
    ],
    background: '#0a0a12',
    text: '#e8e8f0',
    gridline: '#1a1a2e',
    axis: '#555566',
  },
  fonts: {
    family: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
  },
};

export const NeonTheme = () => <Showcase theme={neonTheme} />;

// ---------------------------------------------------------------------------
// 9. Pastel — Soft, approachable, gentle. Dusty muted tones.
//    Futura's geometric roundness amplifies the friendly mood.
// ---------------------------------------------------------------------------

const pastelTheme: ThemeConfig = {
  colors: {
    categorical: [
      '#6c8ebf', // dusty blue
      '#c97c7c', // dusty rose
      '#7ab68c', // sage
      '#c9a050', // warm gold
      '#9b7bc0', // lavender
      '#cc8963', // peach
    ],
    background: '#fefcfa',
    text: '#3a3535',
    gridline: '#ece6e0',
    axis: '#998f88',
  },
  fonts: {
    family: '"Avenir Next", Avenir, Montserrat, "Gill Sans", sans-serif',
  },
};

export const PastelTheme = () => <Showcase theme={pastelTheme} />;

// ---------------------------------------------------------------------------
// 10. Copper — Industrial luxury dark. Warm metallics against walnut.
//     Didot's high-contrast strokes match the premium mood.
// ---------------------------------------------------------------------------

const copperTheme: ThemeConfig = {
  colors: {
    categorical: [
      '#d4956a', // copper
      '#8bb174', // verdigris
      '#d4b453', // brass
      '#7e9bb5', // steel blue
      '#c47979', // rust rose
      '#b8a99a', // pewter
    ],
    background: '#1c1917',
    text: '#e7e0d8',
    gridline: '#302a24',
    axis: '#7a7068',
  },
  fonts: {
    family: 'Didot, "Bodoni MT", "Playfair Display", Georgia, serif',
  },
};

export const CopperTheme = () => <Showcase theme={copperTheme} />;

// ---------------------------------------------------------------------------
// 11. Gen Z — Y2K revival meets digital native. Saturated dopamine
//     palette, slight irony. Rounded geometric sans for that app-native,
//     screenshot-friendly energy.
// ---------------------------------------------------------------------------

const genZTheme: ThemeConfig = {
  colors: {
    categorical: [
      '#ff6b00', // Fanta orange
      '#a855f7', // TikTok purple
      '#22d3ee', // cyan screen
      '#facc15', // caution yellow
      '#f43f5e', // hot take pink
      '#84cc16', // lime notification
    ],
    background: '#fffbeb',
    text: '#1c1917',
    gridline: '#fde68a',
    axis: '#92400e',
  },
  fonts: {
    family: '"DM Sans", "Nunito", "Poppins", system-ui, sans-serif',
  },
  borderRadius: 12,
};

export const GenZTheme = () => <Showcase theme={genZTheme} />;

// ---------------------------------------------------------------------------
// 12. Custom — Interactive spec editor with live preview
// ---------------------------------------------------------------------------

// ---- Fonts ----------------------------------------------------------------

function useEditorFonts() {
  useEffect(() => {
    const id = 'custom-theme-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }, []);
}

// ---- Color helpers --------------------------------------------------------

function editorHexToRgba(hex: string, alpha: number): string {
  const cl = hex.replace('#', '');
  const r = Number.parseInt(cl.slice(0, 2), 16);
  const g = Number.parseInt(cl.slice(2, 4), 16);
  const b = Number.parseInt(cl.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function editorIsColorDark(hex: string): boolean {
  const cl = hex.replace('#', '');
  const r = Number.parseInt(cl.slice(0, 2), 16);
  const g = Number.parseInt(cl.slice(2, 4), 16);
  const b = Number.parseInt(cl.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

// ---- Theme-aware color tokens ---------------------------------------------

function useEditorColors() {
  const theme = useVizTheme();
  const darkMode = useVizDarkMode();

  const bg = theme?.colors?.background ?? (darkMode === 'force' ? '#1a1a2e' : '#ffffff');
  const isDark = editorIsColorDark(bg);
  const text = theme?.colors?.text ?? (isDark ? '#e2e8f0' : '#0f172a');
  const gridline = theme?.colors?.gridline;
  const accent = theme?.colors?.categorical?.[0] ?? (isDark ? '#818cf8' : '#4f46e5');

  return {
    isDark,
    bg,
    text,
    accent,
    surface: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
    surfaceElevated: bg,
    border: gridline
      ? editorHexToRgba(gridline, isDark ? 0.6 : 0.5)
      : isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(0,0,0,0.09)',
    borderAccent: editorHexToRgba(accent, 0.4),
    textSecondary: editorHexToRgba(text, isDark ? 0.65 : 0.6),
    textMuted: editorHexToRgba(text, isDark ? 0.35 : 0.35),
    shadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
    codeBg: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
    codeBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    badgeBg: editorHexToRgba(accent, isDark ? 0.15 : 0.1),
    badgeText: accent,
    btnBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
    btnBgHover: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
    btnBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    syntaxString: isDark ? '#a5d6a7' : '#16a34a',
    syntaxNumber: isDark ? '#ffcc80' : '#d97706',
    syntaxKeyword: isDark ? '#80deea' : '#0891b2',
  };
}

type EditorColors = ReturnType<typeof useEditorColors>;

// ---- JSON syntax highlighting ---------------------------------------------

function highlightJson(json: string, c: EditorColors): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex =
    /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(\btrue\b|\bfalse\b|\bnull\b)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={i++} style={{ color: c.textMuted }}>
          {json.slice(lastIndex, match.index)}
        </span>,
      );
    }

    if (match[1] !== undefined) {
      if (match[2] !== undefined) {
        nodes.push(
          <span key={i++} style={{ color: c.accent }}>
            {match[1]}
          </span>,
        );
        nodes.push(
          <span key={i++} style={{ color: c.textMuted }}>
            {match[2]}
          </span>,
        );
      } else {
        nodes.push(
          <span key={i++} style={{ color: c.syntaxString }}>
            {match[1]}
          </span>,
        );
      }
    } else if (match[3] !== undefined) {
      nodes.push(
        <span key={i++} style={{ color: c.syntaxNumber }}>
          {match[3]}
        </span>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <span key={i++} style={{ color: c.syntaxKeyword }}>
          {match[4]}
        </span>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < json.length) {
    nodes.push(
      <span key={i++} style={{ color: c.textMuted }}>
        {json.slice(lastIndex)}
      </span>,
    );
  }

  return nodes;
}

// ---- Error boundary -------------------------------------------------------

class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey: number },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prevProps: { resetKey: number }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            color: '#dc2626',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Render error</div>
          <div>{this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---- Real-world data ------------------------------------------------------

// Bureau of Labor Statistics: US monthly unemployment rate (seasonally adjusted)
// Monthly for 2020, quarterly for 2021-2024
const unemploymentData = [
  { date: '2020-01-01', rate: 3.5 },
  { date: '2020-02-01', rate: 3.5 },
  { date: '2020-03-01', rate: 4.4 },
  { date: '2020-04-01', rate: 14.7 },
  { date: '2020-05-01', rate: 13.3 },
  { date: '2020-06-01', rate: 11.1 },
  { date: '2020-07-01', rate: 10.2 },
  { date: '2020-08-01', rate: 8.4 },
  { date: '2020-09-01', rate: 7.8 },
  { date: '2020-10-01', rate: 6.9 },
  { date: '2020-11-01', rate: 6.7 },
  { date: '2020-12-01', rate: 6.7 },
  { date: '2021-03-01', rate: 6.0 },
  { date: '2021-06-01', rate: 5.9 },
  { date: '2021-09-01', rate: 4.8 },
  { date: '2021-12-01', rate: 3.9 },
  { date: '2022-03-01', rate: 3.6 },
  { date: '2022-06-01', rate: 3.6 },
  { date: '2022-09-01', rate: 3.5 },
  { date: '2022-12-01', rate: 3.5 },
  { date: '2023-03-01', rate: 3.5 },
  { date: '2023-06-01', rate: 3.6 },
  { date: '2023-09-01', rate: 3.8 },
  { date: '2023-12-01', rate: 3.7 },
  { date: '2024-03-01', rate: 3.8 },
  { date: '2024-06-01', rate: 4.0 },
  { date: '2024-09-01', rate: 4.2 },
  { date: '2024-12-01', rate: 4.1 },
];

// Default spec with all ChartSpec options demonstrated
const defaultEditorSpec: ChartSpec = {
  type: 'line',
  data: unemploymentData,
  encoding: {
    x: {
      field: 'date',
      type: 'temporal',
      axis: { label: 'Date' },
    },
    y: {
      field: 'rate',
      type: 'quantitative',
      axis: { label: 'Unemployment Rate (%)', format: '.1f' },
      scale: { zero: true },
    },
  },
  chrome: {
    title: "The Job Market's V-Shaped Recovery",
    subtitle: 'US monthly unemployment rate, seasonally adjusted, 2020\u20132024',
    source: 'Source: Bureau of Labor Statistics',
    byline: 'Chart: OpenChart',
  },
  annotations: [
    {
      type: 'range',
      x1: '2020-03-01',
      x2: '2020-06-01',
      label: 'COVID lockdowns',
      fill: '#dc2626',
      opacity: 0.08,
    },
    {
      type: 'refline',
      y: 3.5,
      label: 'Pre-pandemic: 3.5%',
      style: 'dashed',
      stroke: '#94a3b8',
      strokeWidth: 1,
      labelOffset: { dy: -8 },
    },
    {
      type: 'text',
      x: '2020-04-01',
      y: 14.7,
      text: 'Peak: 14.7%',
      fontSize: 11,
      anchor: 'right',
      connector: true,
      offset: { dx: 100, dy: -2 },
    },
  ],
  labels: { density: 'none' },
  legend: { position: 'top' },
  responsive: true,
  theme: {
    colors: {
      categorical: ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'],
      sequential: { blue: ['#eff6ff', '#3b82f6', '#1e3a5f'] },
      diverging: { 'red-blue': ['#dc2626', '#f5f5f5', '#2563eb'] },
      background: '#ffffff',
      text: '#1e293b',
      gridline: '#e2e8f0',
      axis: '#94a3b8',
    },
    fonts: {
      family: 'system-ui, -apple-system, sans-serif',
      mono: "'JetBrains Mono', monospace",
    },
    spacing: { padding: 20, chromeGap: 6 },
    borderRadius: 4,
  },
  darkMode: 'off',
};

// IMF World Economic Outlook, Oct 2024: nominal GDP (USD trillions)
const gdpBarSpec: ChartSpec = {
  type: 'bar',
  data: [
    { country: 'United States', gdp: 28.78 },
    { country: 'China', gdp: 18.53 },
    { country: 'Germany', gdp: 4.59 },
    { country: 'Japan', gdp: 4.19 },
    { country: 'India', gdp: 3.94 },
    { country: 'United Kingdom', gdp: 3.5 },
    { country: 'France', gdp: 3.13 },
    { country: 'Italy', gdp: 2.33 },
    { country: 'Brazil', gdp: 2.33 },
    { country: 'Canada', gdp: 2.24 },
  ],
  encoding: {
    x: {
      field: 'gdp',
      type: 'quantitative',
      axis: { label: 'GDP (USD trillions)', format: '$,.1f' },
    },
    y: { field: 'country', type: 'nominal' },
    color: { field: 'gdp', type: 'quantitative' },
  },
  chrome: {
    title: "The World's Largest Economies",
    subtitle: 'Nominal GDP in trillions of US dollars, 2024 estimates',
    source: 'Source: IMF World Economic Outlook, October 2024',
  },
};

// BLS: US monthly nonfarm payroll gains (thousands), 2024
const columnSpec: ChartSpec = {
  type: 'column',
  data: [
    { month: 'Jan', jobs: 256 },
    { month: 'Feb', jobs: 270 },
    { month: 'Mar', jobs: 315 },
    { month: 'Apr', jobs: 108 },
    { month: 'May', jobs: 216 },
    { month: 'Jun', jobs: 179 },
    { month: 'Jul', jobs: 118 },
    { month: 'Aug', jobs: 159 },
    { month: 'Sep', jobs: 254 },
    { month: 'Oct', jobs: 12 },
    { month: 'Nov', jobs: 227 },
    { month: 'Dec', jobs: 256 },
  ],
  encoding: {
    x: { field: 'month', type: 'ordinal' },
    y: { field: 'jobs', type: 'quantitative', axis: { label: 'Jobs added (thousands)' } },
  },
  chrome: {
    title: 'A Bumpy Year for Hiring',
    subtitle: 'Monthly nonfarm payroll gains (thousands), 2024',
    source: 'Source: Bureau of Labor Statistics',
  },
};

// IDC Worldwide Quarterly Mobile Phone Tracker, Q3 2024
const _smartphoneDonutSpec: ChartSpec = {
  type: 'donut',
  data: [
    { vendor: 'Samsung', share: 18.4 },
    { vendor: 'Apple', share: 17.7 },
    { vendor: 'Xiaomi', share: 14.3 },
    { vendor: 'OPPO', share: 8.8 },
    { vendor: 'vivo', share: 7.7 },
    { vendor: 'Others', share: 33.1 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative', axis: { format: '.1f', label: 'Market share (%)' } },
    color: { field: 'vendor', type: 'nominal' },
  },
  chrome: {
    title: 'Samsung Leads a Fragmented Market',
    subtitle: 'Global smartphone shipment share, Q3 2024',
    source: 'Source: IDC Quarterly Mobile Phone Tracker',
  },
};

// World Bank: life expectancy vs GDP per capita (select countries, 2022)
const _scatterSpec: ChartSpec = {
  type: 'scatter',
  data: [
    { country: 'Norway', gdpPerCapita: 82832, lifeExpectancy: 83.3 },
    { country: 'United States', gdpPerCapita: 76330, lifeExpectancy: 77.5 },
    { country: 'Germany', gdpPerCapita: 48718, lifeExpectancy: 80.6 },
    { country: 'Japan', gdpPerCapita: 33815, lifeExpectancy: 84.8 },
    { country: 'South Korea', gdpPerCapita: 32423, lifeExpectancy: 83.7 },
    { country: 'Chile', gdpPerCapita: 16265, lifeExpectancy: 78.9 },
    { country: 'China', gdpPerCapita: 12720, lifeExpectancy: 78.6 },
    { country: 'Brazil', gdpPerCapita: 8917, lifeExpectancy: 72.8 },
    { country: 'India', gdpPerCapita: 2389, lifeExpectancy: 67.2 },
    { country: 'Nigeria', gdpPerCapita: 1621, lifeExpectancy: 52.7 },
    { country: 'Ethiopia', gdpPerCapita: 1027, lifeExpectancy: 61.8 },
  ],
  encoding: {
    x: {
      field: 'gdpPerCapita',
      type: 'quantitative',
      axis: { label: 'GDP per capita (USD)', format: '$,.0f' },
      scale: { type: 'log' },
    },
    y: {
      field: 'lifeExpectancy',
      type: 'quantitative',
      axis: { label: 'Life expectancy (years)', format: '.0f' },
    },
    color: { field: 'country', type: 'nominal' },
  },
  labels: { density: 'all' },
  chrome: {
    title: 'Wealth and Health of Nations',
    subtitle: 'Life expectancy vs GDP per capita (PPP), select countries, 2022',
    source: 'Source: World Bank Open Data',
  },
};

// US Census Bureau: 2023 population estimates for largest cities
const _dotSpec: ChartSpec = {
  type: 'dot',
  data: [
    { city: 'New York', population: 8258035 },
    { city: 'Los Angeles', population: 3820914 },
    { city: 'Chicago', population: 2664452 },
    { city: 'Houston', population: 2314157 },
    { city: 'Phoenix', population: 1650070 },
    { city: 'Philadelphia', population: 1550542 },
    { city: 'San Antonio', population: 1495295 },
    { city: 'San Diego', population: 1388320 },
    { city: 'Dallas', population: 1302868 },
    { city: 'Austin', population: 979882 },
  ],
  encoding: {
    x: { field: 'population', type: 'quantitative', axis: { label: 'Population', format: ',.0f' } },
    y: { field: 'city', type: 'nominal' },
  },
  chrome: {
    title: "America's Largest Cities",
    subtitle: '2023 population estimates for the 10 most populous US cities',
    source: 'Source: US Census Bureau',
  },
};

// EIA: US electricity generation by source (billion kWh), 2020-2024
const _areaSpec: ChartSpec = {
  type: 'area',
  data: [
    { year: '2020-01-01', source: 'Natural Gas', generation: 1617 },
    { year: '2021-01-01', source: 'Natural Gas', generation: 1575 },
    { year: '2022-01-01', source: 'Natural Gas', generation: 1689 },
    { year: '2023-01-01', source: 'Natural Gas', generation: 1748 },
    { year: '2024-01-01', source: 'Natural Gas', generation: 1802 },
    { year: '2020-01-01', source: 'Renewables', generation: 834 },
    { year: '2021-01-01', source: 'Renewables', generation: 886 },
    { year: '2022-01-01', source: 'Renewables', generation: 913 },
    { year: '2023-01-01', source: 'Renewables', generation: 976 },
    { year: '2024-01-01', source: 'Renewables', generation: 1038 },
    { year: '2020-01-01', source: 'Coal', generation: 774 },
    { year: '2021-01-01', source: 'Coal', generation: 899 },
    { year: '2022-01-01', source: 'Coal', generation: 826 },
    { year: '2023-01-01', source: 'Coal', generation: 665 },
    { year: '2024-01-01', source: 'Coal', generation: 594 },
    { year: '2020-01-01', source: 'Nuclear', generation: 790 },
    { year: '2021-01-01', source: 'Nuclear', generation: 778 },
    { year: '2022-01-01', source: 'Nuclear', generation: 772 },
    { year: '2023-01-01', source: 'Nuclear', generation: 775 },
    { year: '2024-01-01', source: 'Nuclear', generation: 780 },
  ],
  encoding: {
    x: { field: 'year', type: 'temporal' },
    y: {
      field: 'generation',
      type: 'quantitative',
      axis: { label: 'Generation (billion kWh)' },
    },
    color: { field: 'source', type: 'nominal' },
  },
  chrome: {
    title: 'The Changing US Power Grid',
    subtitle: 'Electricity generation by source, billion kilowatt-hours, 2020\u20132024',
    source: 'Source: US Energy Information Administration',
  },
};

// IMF WEO: economic indicators for major economies, 2024 estimates
const economyTableSpec: TableSpec = {
  type: 'table',
  data: [
    { country: 'United States', gdp: 28781, population: 340, gdpPerCapita: 84651, growth: 2.8 },
    { country: 'China', gdp: 18533, population: 1425, gdpPerCapita: 13005, growth: 4.8 },
    { country: 'Germany', gdp: 4592, population: 84, gdpPerCapita: 54667, growth: 0.0 },
    { country: 'Japan', gdp: 4186, population: 124, gdpPerCapita: 33758, growth: 0.3 },
    { country: 'India', gdp: 3937, population: 1442, gdpPerCapita: 2731, growth: 7.0 },
    { country: 'United Kingdom', gdp: 3495, population: 68, gdpPerCapita: 51397, growth: 1.1 },
    { country: 'France', gdp: 3131, population: 68, gdpPerCapita: 46044, growth: 1.1 },
    { country: 'Brazil', gdp: 2331, population: 217, gdpPerCapita: 10742, growth: 3.0 },
  ],
  columns: [
    { key: 'country', label: 'Country' },
    { key: 'gdp', label: 'GDP ($B)', format: '$,.0f', bar: {} },
    { key: 'population', label: 'Pop (M)', format: ',.0f' },
    { key: 'gdpPerCapita', label: 'GDP/Capita', format: '$,.0f' },
    { key: 'growth', label: 'Growth %', format: '+.1f' },
  ],
  chrome: {
    title: "The World's Major Economies at a Glance",
    subtitle: '2024 estimates: GDP, population, and growth rates',
    source: 'Source: IMF World Economic Outlook, October 2024',
  },
};

function specWithTheme(spec: VizSpec, theme: ThemeConfig): VizSpec {
  return { ...spec, theme } as VizSpec;
}

const editorPresets: Record<string, VizSpec> = {
  Line: defaultEditorSpec,
  Bar: gdpBarSpec,
  Column: columnSpec,
  Donut: _smartphoneDonutSpec,
  Scatter: _scatterSpec,
  Dot: _dotSpec,
  Area: _areaSpec,
  Table: economyTableSpec,
};

const defaultJson = JSON.stringify(defaultEditorSpec, null, 2);

// ---- Main component -------------------------------------------------------

function SpecEditor() {
  const c = useEditorColors();
  useEditorFonts();

  const [jsonText, setJsonText] = useState(defaultJson);
  const [validSpec, setValidSpec] = useState<VizSpec>(defaultEditorSpec);
  const [error, setError] = useState<string | null>(null);
  const [specVersion, setSpecVersion] = useState(0);
  const [activePreset, setActivePreset] = useState('Line');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const processJson = useCallback((text: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setError(`JSON parse error: ${(e as Error).message}`);
      return;
    }

    const result: ValidationResult = validateSpec(parsed);
    if (!result.valid) {
      const msgs = result.errors
        .map((err) => {
          let msg = err.message;
          if (err.path) msg = `[${err.path}] ${msg}`;
          if (err.suggestion) msg += `\n  \u2192 ${err.suggestion}`;
          return msg;
        })
        .join('\n');
      setError(msgs);
      return;
    }

    setError(null);
    setValidSpec(result.normalized!);
    setSpecVersion((v) => v + 1);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setJsonText(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => processJson(text), 200);
    },
    [processJson],
  );

  const loadPreset = useCallback(
    (name: string) => {
      const preset = editorPresets[name];
      if (!preset) return;

      let currentTheme = defaultEditorSpec.theme;
      try {
        const parsed = JSON.parse(jsonText);
        if (parsed?.theme && typeof parsed.theme === 'object') {
          currentTheme = parsed.theme;
        }
      } catch {
        // keep default theme if current JSON is invalid
      }

      const withTheme = specWithTheme(preset, currentTheme!);
      const text = JSON.stringify(withTheme, null, 2);
      setJsonText(text);
      setError(null);
      setValidSpec(withTheme);
      setSpecVersion((v) => v + 1);
      setActivePreset(name);
    },
    [jsonText],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const updated = `${jsonText.substring(0, start)}  ${jsonText.substring(end)}`;
        setJsonText(updated);
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        });
      }
    },
    [jsonText],
  );

  const handleScroll = useCallback(() => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const mono = "'IBM Plex Mono', 'SF Mono', ui-monospace, monospace";
  const display = "'Bricolage Grotesque', system-ui, sans-serif";

  // Shared style for textarea and pre overlay (must be identical for alignment)
  const codeStyle: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 12,
    lineHeight: '18px',
    padding: 16,
    margin: 0,
    border: 'none',
    whiteSpace: 'pre',
    tabSize: 2,
    letterSpacing: 'normal',
    wordBreak: 'normal',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '40px 32px 64px',
        fontFamily: display,
        color: c.text,
        transition: 'color 0.25s ease',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 100,
            background: c.badgeBg,
            color: c.badgeText,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            marginBottom: 12,
            fontFamily: mono,
          }}
        >
          Spec Editor
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: c.text,
            lineHeight: 1.2,
          }}
        >
          Custom Theme
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: c.textSecondary,
            lineHeight: 1.5,
            maxWidth: 600,
          }}
        >
          Edit the full VizSpec JSON to customize chart type, data, encoding, annotations, and
          theme. Changes are validated and rendered in real time. Use the presets to switch chart
          types while preserving your theme.
        </p>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderRadius: 10,
          background: c.surface,
          border: `1px solid ${c.border}`,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: c.textMuted,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            fontFamily: mono,
            marginRight: 4,
          }}
        >
          Presets
        </span>
        {Object.keys(editorPresets).map((name) => {
          const isActive = name === activePreset;
          return (
            <button
              key={name}
              type="button"
              onClick={() => loadPreset(name)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                fontFamily: display,
                border: `1px solid ${isActive ? c.borderAccent : c.btnBorder}`,
                borderRadius: 6,
                background: isActive ? c.badgeBg : c.btnBg,
                color: isActive ? c.accent : c.textSecondary,
                cursor: 'pointer',
                lineHeight: 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = c.btnBgHover;
                  e.currentTarget.style.borderColor = c.borderAccent;
                  e.currentTarget.style.color = c.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = c.btnBg;
                  e.currentTarget.style.borderColor = c.btnBorder;
                  e.currentTarget.style.color = c.textSecondary;
                }
              }}
            >
              {name}
            </button>
          );
        })}

        {/* Status indicator */}
        <span
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: mono,
            fontSize: 11,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: error ? '#dc2626' : '#22c55e',
              display: 'inline-block',
              transition: 'background 0.2s',
            }}
          />
          <span style={{ color: error ? '#dc2626' : c.textMuted }}>
            {error ? 'Error' : 'Valid'}
          </span>
        </span>
      </div>

      {/* Chart card */}
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${c.border}`,
          background: c.surfaceElevated,
          boxShadow: c.shadow,
          overflow: 'hidden',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}
      >
        <div style={{ height: 440 }}>
          <ChartErrorBoundary resetKey={specVersion}>
            {isTableSpec(validSpec) ? (
              <DataTable spec={validSpec} theme={validSpec.theme} darkMode={validSpec.darkMode} />
            ) : (
              <Chart
                spec={validSpec as ChartSpec}
                theme={(validSpec as ChartSpec).theme}
                darkMode={(validSpec as ChartSpec).darkMode ?? 'off'}
              />
            )}
          </ChartErrorBoundary>
        </div>
      </div>

      {/* Editor panel */}
      <div
        style={{
          marginTop: 20,
          borderRadius: 10,
          border: `1px solid ${c.border}`,
          background: c.codeBg,
          overflow: 'hidden',
          transition: 'background 0.25s ease, border-color 0.25s ease',
        }}
      >
        {/* Editor header */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: `1px solid ${c.codeBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: c.textSecondary,
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              fontFamily: mono,
            }}
          >
            Spec JSON
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: c.textMuted, fontFamily: mono }}>
            {jsonText.split('\n').length} lines
          </span>
        </div>

        {/* Syntax-highlighted editor */}
        <div style={{ position: 'relative', height: 420, overflow: 'hidden' }}>
          <pre
            ref={preRef}
            aria-hidden="true"
            style={{
              ...codeStyle,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
              background: 'transparent',
              width: '100%',
              height: '100%',
            }}
          >
            <code>{highlightJson(jsonText, c)}</code>
          </pre>
          <textarea
            ref={textareaRef}
            value={jsonText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            style={{
              ...codeStyle,
              position: 'relative',
              width: '100%',
              height: '100%',
              color: 'transparent',
              caretColor: c.text,
              background: 'transparent',
              outline: 'none',
              resize: 'none',
              overflow: 'auto',
            }}
          />
        </div>

        {/* Error details */}
        {error && (
          <div
            style={{
              padding: '10px 16px',
              borderTop: `1px solid ${c.codeBorder}`,
              fontFamily: mono,
              fontSize: 11,
              lineHeight: 1.6,
              color: '#dc2626',
              whiteSpace: 'pre-wrap',
              maxHeight: 140,
              overflow: 'auto',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export const CustomTheme = () => <SpecEditor />;
