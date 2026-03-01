/**
 * Theme stories: 10 themes, each rendered across 4 chart types
 * (line, bar, donut, table) so color/font/spacing choices are
 * visible in context.
 */

import type { ChartSpec, TableSpec, ThemeConfig, VizSpec } from '@openchart/core';
import { isTableSpec } from '@openchart/core';
import type { ValidationResult } from '@openchart/engine';
import { validateSpec } from '@openchart/engine';
import { Chart, DataTable } from '@openchart/react';
import React, { useCallback, useRef, useState } from 'react';

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

const columnSpec: ChartSpec = {
  type: 'column',
  data: [
    { quarter: 'Q1', revenue: 42 },
    { quarter: 'Q2', revenue: 58 },
    { quarter: 'Q3', revenue: 35 },
    { quarter: 'Q4', revenue: 71 },
  ],
  encoding: {
    x: { field: 'quarter', type: 'nominal' },
    y: { field: 'revenue', type: 'quantitative', axis: { format: '$,.0f' } },
  },
  chrome: {
    title: 'Quarterly Revenue',
    subtitle: 'Fiscal year 2024',
  },
};

const scatterSpec: ChartSpec = {
  type: 'scatter',
  data: [
    { height: 170, weight: 65, group: 'A' },
    { height: 175, weight: 72, group: 'B' },
    { height: 160, weight: 55, group: 'A' },
    { height: 182, weight: 80, group: 'B' },
    { height: 168, weight: 62, group: 'A' },
    { height: 178, weight: 75, group: 'B' },
  ],
  encoding: {
    x: { field: 'height', type: 'quantitative', axis: { label: 'Height (cm)' } },
    y: { field: 'weight', type: 'quantitative', axis: { label: 'Weight (kg)' } },
    color: { field: 'group', type: 'nominal' },
  },
  chrome: {
    title: 'Height vs Weight',
    subtitle: 'Sample measurements by group',
  },
};

const dotSpec: ChartSpec = {
  type: 'dot',
  data: [
    { category: 'Engineering', value: 42 },
    { category: 'Design', value: 28 },
    { category: 'Marketing', value: 35 },
    { category: 'Sales', value: 51 },
    { category: 'Support', value: 19 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Team Sizes',
    subtitle: 'Headcount by department',
  },
};

const areaSpec: ChartSpec = {
  type: 'area',
  data: [
    { date: '2020-01-01', value: 10, series: 'Mobile' },
    { date: '2021-01-01', value: 25, series: 'Mobile' },
    { date: '2022-01-01', value: 45, series: 'Mobile' },
    { date: '2020-01-01', value: 30, series: 'Desktop' },
    { date: '2021-01-01', value: 28, series: 'Desktop' },
    { date: '2022-01-01', value: 22, series: 'Desktop' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  },
  chrome: {
    title: 'Traffic by Platform',
    subtitle: 'Sessions over time (millions)',
  },
};

const presets: Record<string, VizSpec> = {
  Line: lineSpec,
  Bar: barSpec,
  Column: columnSpec,
  Donut: donutSpec,
  Scatter: scatterSpec,
  Dot: dotSpec,
  Area: areaSpec,
  Table: tableSpec,
};

const defaultCustomTheme: ThemeConfig = {
  colors: {
    categorical: ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'],
    background: '#ffffff',
    text: '#1e293b',
    gridline: '#e2e8f0',
    axis: '#94a3b8',
  },
  fonts: {
    family: 'system-ui, -apple-system, sans-serif',
  },
};

function specWithTheme(spec: VizSpec, theme: ThemeConfig): VizSpec {
  return { ...spec, theme } as VizSpec;
}

const defaultJson = JSON.stringify(specWithTheme(lineSpec, defaultCustomTheme), null, 2);

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
            fontFamily: 'monospace',
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

export const CustomTheme = () => {
  const [jsonText, setJsonText] = useState(defaultJson);
  const [validSpec, setValidSpec] = useState<VizSpec>(specWithTheme(lineSpec, defaultCustomTheme));
  const [error, setError] = useState<string | null>(null);
  const [specVersion, setSpecVersion] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          if (err.suggestion) msg += ` — ${err.suggestion}`;
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
      const preset = presets[name];
      if (!preset) return;

      // Preserve the current theme when switching presets
      let currentTheme = defaultCustomTheme;
      try {
        const parsed = JSON.parse(jsonText);
        if (parsed && typeof parsed === 'object' && parsed.theme) {
          currentTheme = parsed.theme;
        }
      } catch {
        // If current JSON is invalid, fall back to default theme
      }

      const withTheme = specWithTheme(preset, currentTheme);
      const text = JSON.stringify(withTheme, null, 2);
      setJsonText(text);
      setError(null);
      setValidSpec(withTheme);
      setSpecVersion((v) => v + 1);
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
        const text = `${jsonText.substring(0, start)}  ${jsonText.substring(end)}`;
        setJsonText(text);
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        });
      }
    },
    [jsonText],
  );

  return (
    <div style={{ display: 'flex', gap: 16, padding: 24, minHeight: '80vh' }}>
      {/* Editor panel */}
      <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Preset buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.keys(presets).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => loadPreset(name)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                background: '#f8fafc',
                color: '#475569',
                cursor: 'pointer',
                lineHeight: 1,
                transition: 'background 0.1s, border-color 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eef2ff';
                e.currentTarget.style.borderColor = '#c7d2fe';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={jsonText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          style={{
            flex: 1,
            fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
            fontSize: 12,
            lineHeight: 1.5,
            padding: 16,
            border: `1px solid ${error ? '#fca5a5' : '#e2e8f0'}`,
            borderRadius: 8,
            resize: 'none',
            outline: 'none',
            background: '#fafafa',
            color: '#1e293b',
            tabSize: 2,
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            overflowX: 'auto',
          }}
        />

        {/* Status bar */}
        {error ? (
          <div
            style={{
              padding: '8px 12px',
              fontSize: 11,
              lineHeight: 1.5,
              fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              whiteSpace: 'pre-wrap',
              maxHeight: 120,
              overflow: 'auto',
            }}
          >
            {error}
          </div>
        ) : (
          <div
            style={{
              padding: '6px 12px',
              fontSize: 11,
              color: '#16a34a',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Valid spec
          </div>
        )}
      </div>

      {/* Preview panel */}
      <div style={{ flex: '1 1 58%', minHeight: 400 }}>
        <ChartErrorBoundary resetKey={specVersion}>
          {isTableSpec(validSpec) ? (
            <DataTable spec={validSpec} />
          ) : (
            <Chart spec={validSpec as ChartSpec} />
          )}
        </ChartErrorBoundary>
      </div>
    </div>
  );
};
