/**
 * Sparklines: tiny inline charts for KPI cards, dashboards, and tight
 * editorial layouts. Same VizSpec grammar as a regular chart, just with
 * `display: 'sparkline'` to strip chrome, axes, legend, and watermark.
 *
 * One story shows all variants at realistic small sizes.
 */

import type { Story } from '@ladle/react';
import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart, useDarkMode, useVizDarkMode } from '@opendata-ai/openchart-react';

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

// Realistic-looking series. Each one uses a different mix of trend, noise, and
// step changes so the sparklines don't all look like the same stock photo.

const revenueSeries = [
  9.8, 10.1, 9.9, 10.4, 10.7, 10.5, 11.0, 10.8, 11.2, 11.6, 11.4, 11.8, 12.1, 11.9, 12.3, 12.0,
  12.4, 12.6, 12.3, 12.4,
];

const usersSeries = [
  142, 145, 151, 148, 155, 161, 158, 165, 168, 164, 172, 175, 171, 178, 174, 181, 178, 184, 180,
  184,
];

const conversionSeries = [
  4.2, 4.1, 4.3, 4.0, 3.9, 4.0, 3.8, 3.9, 3.7, 3.8, 3.6, 3.7, 3.5, 3.6, 3.5, 3.6, 3.5, 3.4, 3.5,
  3.4,
];

const aovSeries = [
  61.2, 62.8, 61.5, 63.1, 62.4, 64.0, 63.5, 64.8, 64.2, 65.5, 64.9, 66.1, 65.4, 66.7, 66.0, 66.9,
  66.3, 67.1, 66.7, 67.2,
];

const churnSeries = [
  2.8, 2.9, 2.7, 2.8, 2.6, 2.7, 2.5, 2.6, 2.4, 2.5, 2.3, 2.4, 2.3, 2.2, 2.3, 2.2, 2.1, 2.2, 2.1,
  2.1,
];

const npsSeries = [44, 46, 45, 48, 47, 49, 48, 50, 51, 49, 52, 50, 53, 51, 53, 52, 54, 52, 53, 52];

const pageViewsSeries = [
  82, 91, 78, 88, 102, 95, 87, 110, 98, 92, 115, 105, 99, 122, 108, 101, 128, 114, 106, 132,
];

function toSeries(values: number[]): { date: string; value: number }[] {
  return values.map((value, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, '0')}`,
    value,
  }));
}

const revenueData = toSeries(revenueSeries);
const usersData = toSeries(usersSeries);
const conversionData = toSeries(conversionSeries);
const aovData = toSeries(aovSeries);
const churnData = toSeries(churnSeries);
const npsData = toSeries(npsSeries);
const pageViewsData = toSeries(pageViewsSeries);

// Default series color matches the OpenChart palette's first slot. Hardcoded
// here so the area gradient stops can sample it without round-tripping through
// the theme.
const SPARKLINE_COLOR = '#1b7fa3';

function makeSpec(
  mark: 'line' | 'area' | 'bar',
  data: { date: string; value: number }[],
): ChartSpec {
  // Area sparklines look much better with a fade-to-transparent gradient than a
  // flat 25% fill — gives them the dashboard polish DevExpress/Highcharts ship.
  const markDef =
    mark === 'area'
      ? {
          type: 'area' as const,
          fill: {
            gradient: 'linear' as const,
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 1,
            stops: [
              { offset: 0, color: SPARKLINE_COLOR, opacity: 0.45 },
              { offset: 1, color: SPARKLINE_COLOR, opacity: 0.02 },
            ],
          },
        }
      : mark;

  return {
    mark: markDef,
    data,
    encoding: {
      x: { field: 'date', type: mark === 'bar' ? 'ordinal' : 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    display: 'sparkline',
    animation: true,
  };
}

const kpis: Array<{
  label: string;
  value: string;
  change: string;
  up: boolean;
  data: { date: string; value: number }[];
  mark: 'line' | 'area';
}> = [
  { label: 'Revenue', value: '$12.4M', change: '+8.2%', up: true, data: revenueData, mark: 'area' },
  {
    label: 'Active users',
    value: '184k',
    change: '+12.1%',
    up: true,
    data: usersData,
    mark: 'line',
  },
  {
    label: 'Conversion',
    value: '3.4%',
    change: '-0.6%',
    up: false,
    data: conversionData,
    mark: 'line',
  },
  { label: 'AOV', value: '$67.20', change: '+2.4%', up: true, data: aovData, mark: 'area' },
  { label: 'Churn', value: '2.1%', change: '-0.3%', up: true, data: churnData, mark: 'line' },
  { label: 'NPS', value: '52', change: '+4', up: true, data: npsData, mark: 'line' },
];

function Section({
  title,
  children,
  dark,
}: {
  title: string;
  children: React.ReactNode;
  dark: boolean;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: dark ? '#94a3b8' : '#6b7280',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export const Sparklines: Story = () => {
  const contextDark = useVizDarkMode();
  const dark = useDarkMode(contextDark);

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 920,
        fontFamily: SANS,
        color: dark ? '#e5e7eb' : '#111827',
      }}
    >
      <Section title="Variants (200 x 40)" dark={dark}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Line</div>
            <div style={{ width: 200, height: 40 }}>
              <Chart spec={makeSpec('line', usersData)} darkMode={dark ? 'force' : 'off'} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Area</div>
            <div style={{ width: 200, height: 40 }}>
              <Chart spec={makeSpec('area', revenueData)} darkMode={dark ? 'force' : 'off'} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Bar</div>
            <div style={{ width: 200, height: 40 }}>
              <Chart spec={makeSpec('bar', pageViewsData)} darkMode={dark ? 'force' : 'off'} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Tight (100 x 24)" dark={dark}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 100, height: 24 }}>
            <Chart spec={makeSpec('line', usersData)} darkMode={dark ? 'force' : 'off'} />
          </div>
          <div style={{ width: 100, height: 24 }}>
            <Chart spec={makeSpec('area', revenueData)} darkMode={dark ? 'force' : 'off'} />
          </div>
          <div style={{ width: 100, height: 24 }}>
            <Chart spec={makeSpec('bar', pageViewsData)} darkMode={dark ? 'force' : 'off'} />
          </div>
        </div>
      </Section>

      <Section title="KPI cards" dark={dark}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          {kpis.map((k) => (
            <div
              key={k.label}
              style={{
                padding: 14,
                border: dark ? '1px solid #1f2937' : '1px solid #e5e7eb',
                borderRadius: 8,
                background: dark ? '#0b1220' : '#fff',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: dark ? '#94a3b8' : '#6b7280',
                  marginBottom: 4,
                }}
              >
                {k.label}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  {k.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: k.up ? '#16a34a' : '#dc2626',
                  }}
                >
                  {k.change}
                </div>
              </div>
              <div style={{ height: 32 }}>
                <Chart spec={makeSpec(k.mark, k.data)} darkMode={dark ? 'force' : 'off'} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Inline with text" dark={dark}>
        <div style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 560 }}>
          Revenue is up{' '}
          <span
            style={{
              display: 'inline-block',
              width: 60,
              height: 16,
              verticalAlign: 'middle',
              margin: '0 4px',
            }}
          >
            <Chart spec={makeSpec('line', revenueData)} darkMode={dark ? 'force' : 'off'} />
          </span>{' '}
          versus last quarter, while churn{' '}
          <span
            style={{
              display: 'inline-block',
              width: 60,
              height: 16,
              verticalAlign: 'middle',
              margin: '0 4px',
            }}
          >
            <Chart spec={makeSpec('line', churnData)} darkMode={dark ? 'force' : 'off'} />
          </span>{' '}
          continued to fall.
        </div>
      </Section>
    </div>
  );
};
