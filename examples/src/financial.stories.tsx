/**
 * Financial visualizations: editorial-quality charts for market data.
 *
 * Five visualizations demonstrating publication-grade financial data viz:
 * stock price area, index performance comparison, sector returns,
 * risk-return scatter, and earnings season table.
 */

import type { Story } from '@ladle/react';
import type { ChartSpec, TableSpec } from '@opendata-ai/openchart-core';
import { Chart, DataTable, useDarkMode, useVizDarkMode } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Shell: reads dark mode from VizThemeProvider context (set by Ladle toggle)
// ---------------------------------------------------------------------------

function FinancialShell({
  children,
  height,
  maxWidth,
  className,
}: {
  children: (dark: boolean) => React.ReactNode;
  height?: number;
  maxWidth?: number;
  className?: string;
}) {
  const contextDarkMode = useVizDarkMode();
  const dark = useDarkMode(contextDarkMode);

  return (
    <div
      className={className}
      style={{
        height,
        maxWidth,
        padding: 24,
        borderRadius: 4,
      }}
    >
      {children(dark)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Viz 1: NVIDIA Stock Price Area Chart — The AI Boom Story
// ---------------------------------------------------------------------------

const stockData = [
  { date: '2023-01-01', price: 19.52 },
  { date: '2023-02-01', price: 23.19 },
  { date: '2023-03-01', price: 27.75 },
  { date: '2023-04-01', price: 27.73 },
  { date: '2023-05-01', price: 37.8 },
  { date: '2023-06-01', price: 42.27 },
  { date: '2023-07-01', price: 46.7 },
  { date: '2023-08-01', price: 49.32 },
  { date: '2023-09-01', price: 43.47 },
  { date: '2023-10-01', price: 40.75 },
  { date: '2023-11-01', price: 46.74 },
  { date: '2023-12-01', price: 49.49 },
  { date: '2024-01-01', price: 61.49 },
  { date: '2024-02-01', price: 79.07 },
  { date: '2024-03-01', price: 90.31 },
  { date: '2024-04-01', price: 86.36 },
  { date: '2024-05-01', price: 109.58 },
  { date: '2024-06-01', price: 123.49 },
  { date: '2024-07-01', price: 116.97 },
  { date: '2024-08-01', price: 119.32 },
  { date: '2024-09-01', price: 121.4 },
  { date: '2024-10-01', price: 132.72 },
  { date: '2024-11-01', price: 138.2 },
  { date: '2024-12-01', price: 134.25 },
  { date: '2025-01-01', price: 120.04 },
  { date: '2025-02-01', price: 124.89 },
  { date: '2025-03-01', price: 108.36 },
  { date: '2025-04-01', price: 108.9 },
  { date: '2025-05-01', price: 135.11 },
  { date: '2025-06-01', price: 157.97 },
  { date: '2025-07-01', price: 177.85 },
  { date: '2025-08-01', price: 174.16 },
  { date: '2025-09-01', price: 186.57 },
  { date: '2025-10-01', price: 202.48 },
  { date: '2025-11-01', price: 176.99 },
  { date: '2025-12-01', price: 186.5 },
];

function stockPriceSpec(dark: boolean): ChartSpec {
  return {
    mark: 'area',
    data: stockData,
    encoding: {
      x: { field: 'date', type: 'temporal', axis: { tickCount: 4 } },
      y: {
        field: 'price',
        type: 'quantitative',
        axis: { label: 'Share Price', format: '$,.0f' },
        scale: { zero: false },
      },
    },
    annotations: [
      {
        type: 'range',
        x1: '2023-04-15',
        x2: '2023-06-15',
        label: 'ChatGPT mania lifts AI names',
        fill: dark ? '#86efac' : '#15803d',
        opacity: dark ? 0.15 : 0.08,
      },
      {
        type: 'refline',
        y: 105,
        label: '3-yr avg: $105',
        style: 'dashed',
        stroke: dark ? '#64748b' : '#94a3b8',
        strokeWidth: 1,
      },
      {
        type: 'text',
        x: '2025-10-01',
        y: 202,
        text: 'All-time high: $202',
        fontSize: 11,
        anchor: 'left',
        offset: { dx: -110, dy: -12 },
      },
    ],
    labels: { density: 'none' },
    chrome: {
      title: 'NVIDIA Rides the AI Wave to a 10x Rally',
      subtitle: 'NVDA monthly closing price (split-adjusted), January 2023 to December 2025',
      source: 'Source: Nasdaq historical data',
      byline: 'Chart: OpenChart',
    },
  };
}

export const StockPrice: Story = () => (
  <FinancialShell className="story-chart" height={450}>
    {(dark) => <Chart spec={stockPriceSpec(dark)} />}
  </FinancialShell>
);

// ---------------------------------------------------------------------------
// Viz 2: Index Performance Comparison (Multi-series Line)
// ---------------------------------------------------------------------------

// Cumulative total return rebased to Jan 1 2022 = 0%.
// Computed from annual returns:
//   S&P 500:  2022 -18.1%, 2023 +26.3%, 2024 +25.0%, 2025 +17.9%
//   NASDAQ:   2022 -33.1%, 2023 +43.4%, 2024 +28.6%, 2025 +20.4%
//   Dow:      2022 -7.0%,  2023 +16.0%, 2024 +14.8%, 2025 +14.9%
//   Russell:  2022 -20.5%, 2023 +16.8%, 2024 +10.0%, 2025 +12.1%

const benchmarkData = [
  // S&P 500
  { date: '2022-01-01', totalReturn: 0, index: 'S&P 500' },
  { date: '2022-04-01', totalReturn: -5.3, index: 'S&P 500' },
  { date: '2022-07-01', totalReturn: -13.1, index: 'S&P 500' },
  { date: '2022-10-01', totalReturn: -17.7, index: 'S&P 500' },
  { date: '2023-01-01', totalReturn: -18.1, index: 'S&P 500' },
  { date: '2023-04-01', totalReturn: -8.2, index: 'S&P 500' },
  { date: '2023-07-01', totalReturn: 1.5, index: 'S&P 500' },
  { date: '2023-10-01', totalReturn: -0.8, index: 'S&P 500' },
  { date: '2024-01-01', totalReturn: 3.4, index: 'S&P 500' },
  { date: '2024-04-01', totalReturn: 12.8, index: 'S&P 500' },
  { date: '2024-07-01', totalReturn: 20.6, index: 'S&P 500' },
  { date: '2024-10-01', totalReturn: 29.2, index: 'S&P 500' },
  { date: '2025-01-01', totalReturn: 29.3, index: 'S&P 500' },
  { date: '2025-04-01', totalReturn: 33.5, index: 'S&P 500' },
  { date: '2025-07-01', totalReturn: 39.8, index: 'S&P 500' },
  { date: '2025-10-01', totalReturn: 46.2, index: 'S&P 500' },
  // NASDAQ
  { date: '2022-01-01', totalReturn: 0, index: 'NASDAQ' },
  { date: '2022-04-01', totalReturn: -9.1, index: 'NASDAQ' },
  { date: '2022-07-01', totalReturn: -22.4, index: 'NASDAQ' },
  { date: '2022-10-01', totalReturn: -29.5, index: 'NASDAQ' },
  { date: '2023-01-01', totalReturn: -33.1, index: 'NASDAQ' },
  { date: '2023-04-01', totalReturn: -15.8, index: 'NASDAQ' },
  { date: '2023-07-01', totalReturn: 2.5, index: 'NASDAQ' },
  { date: '2023-10-01', totalReturn: -3.6, index: 'NASDAQ' },
  { date: '2024-01-01', totalReturn: -4.1, index: 'NASDAQ' },
  { date: '2024-04-01', totalReturn: 12.4, index: 'NASDAQ' },
  { date: '2024-07-01', totalReturn: 24.8, index: 'NASDAQ' },
  { date: '2024-10-01', totalReturn: 36.9, index: 'NASDAQ' },
  { date: '2025-01-01', totalReturn: 39.1, index: 'NASDAQ' },
  { date: '2025-04-01', totalReturn: 48.2, index: 'NASDAQ' },
  { date: '2025-07-01', totalReturn: 56.8, index: 'NASDAQ' },
  { date: '2025-10-01', totalReturn: 64.7, index: 'NASDAQ' },
  // Dow Jones
  { date: '2022-01-01', totalReturn: 0, index: 'Dow Jones' },
  { date: '2022-04-01', totalReturn: -4.1, index: 'Dow Jones' },
  { date: '2022-07-01', totalReturn: -9.5, index: 'Dow Jones' },
  { date: '2022-10-01', totalReturn: -13.2, index: 'Dow Jones' },
  { date: '2023-01-01', totalReturn: -7.0, index: 'Dow Jones' },
  { date: '2023-04-01', totalReturn: -1.8, index: 'Dow Jones' },
  { date: '2023-07-01', totalReturn: 4.5, index: 'Dow Jones' },
  { date: '2023-10-01', totalReturn: 2.2, index: 'Dow Jones' },
  { date: '2024-01-01', totalReturn: 7.9, index: 'Dow Jones' },
  { date: '2024-04-01', totalReturn: 12.1, index: 'Dow Jones' },
  { date: '2024-07-01', totalReturn: 17.4, index: 'Dow Jones' },
  { date: '2024-10-01', totalReturn: 24.0, index: 'Dow Jones' },
  { date: '2025-01-01', totalReturn: 25.8, index: 'Dow Jones' },
  { date: '2025-04-01', totalReturn: 30.4, index: 'Dow Jones' },
  { date: '2025-07-01', totalReturn: 36.1, index: 'Dow Jones' },
  { date: '2025-10-01', totalReturn: 42.5, index: 'Dow Jones' },
  // Russell 2000
  { date: '2022-01-01', totalReturn: 0, index: 'Russell 2000' },
  { date: '2022-04-01', totalReturn: -7.8, index: 'Russell 2000' },
  { date: '2022-07-01', totalReturn: -17.2, index: 'Russell 2000' },
  { date: '2022-10-01', totalReturn: -21.5, index: 'Russell 2000' },
  { date: '2023-01-01', totalReturn: -20.5, index: 'Russell 2000' },
  { date: '2023-04-01', totalReturn: -13.2, index: 'Russell 2000' },
  { date: '2023-07-01', totalReturn: -4.5, index: 'Russell 2000' },
  { date: '2023-10-01', totalReturn: -8.1, index: 'Russell 2000' },
  { date: '2024-01-01', totalReturn: -7.1, index: 'Russell 2000' },
  { date: '2024-04-01', totalReturn: -1.8, index: 'Russell 2000' },
  { date: '2024-07-01', totalReturn: 3.5, index: 'Russell 2000' },
  { date: '2024-10-01', totalReturn: 8.2, index: 'Russell 2000' },
  { date: '2025-01-01', totalReturn: 8.4, index: 'Russell 2000' },
  { date: '2025-04-01', totalReturn: 12.8, index: 'Russell 2000' },
  { date: '2025-07-01', totalReturn: 17.5, index: 'Russell 2000' },
  { date: '2025-10-01', totalReturn: 21.5, index: 'Russell 2000' },
];

function benchmarkSpec(dark: boolean): ChartSpec {
  return {
    mark: 'line',
    data: benchmarkData,
    encoding: {
      x: { field: 'date', type: 'temporal', axis: { tickCount: 8 } },
      y: {
        field: 'totalReturn',
        type: 'quantitative',
        axis: { label: 'Cumulative Return (%)', format: '+.0f', grid: true },
      },
      color: { field: 'index', type: 'nominal' },
    },
    annotations: [
      {
        type: 'range',
        x1: '2022-01-01',
        x2: '2023-01-01',
        label: 'Fed rate hikes hammer growth stocks',
        fill: dark ? '#fca5a5' : '#dc2626',
        opacity: dark ? 0.12 : 0.06,
      },
      {
        type: 'refline',
        y: 0,
        label: 'Breakeven',
        style: 'solid',
        stroke: dark ? '#94a3b8' : '#64748b',
        strokeWidth: 1,
      },
      {
        type: 'text',
        x: '2025-01-01',
        y: 52,
        text: 'NASDAQ opens 43pp gap\nover small caps',
        fontSize: 10,
        connector: false,
        background: dark ? '#1e293b' : '#ffffff',
      },
    ],
    labels: { density: 'endpoints', format: '+.1f' },
    legend: { position: 'bottom-right' },
    seriesStyles: {
      'Russell 2000': { lineStyle: 'dashed', opacity: 0.7 },
    },
    chrome: {
      title: 'Big Tech Roars Back While Small Caps Stall',
      subtitle: 'Cumulative total return by index, rebased to January 1, 2022',
      source: 'Source: S&P Dow Jones Indices, Nasdaq',
      byline: 'Chart: OpenChart',
    },
  };
}

export const BenchmarkComparison: Story = () => (
  <FinancialShell className="story-chart" height={450}>
    {(dark) => <Chart spec={benchmarkSpec(dark)} />}
  </FinancialShell>
);

// ---------------------------------------------------------------------------
// Viz 3: Sector Performance Horizontal Bar — Full Year 2025
// ---------------------------------------------------------------------------

const sectorData = [
  { sector: 'Communication Services', performance: 33.7 },
  { sector: 'Information Technology', performance: 24.0 },
  { sector: 'Industrials', performance: 19.4 },
  { sector: 'Utilities', performance: 16.0 },
  { sector: 'Financials', performance: 15.0 },
  { sector: 'Health Care', performance: 14.6 },
  { sector: 'Energy', performance: 8.3 },
  { sector: 'Consumer Discretionary', performance: 6.0 },
  { sector: 'Consumer Staples', performance: 3.9 },
  { sector: 'Real Estate', performance: 3.2 },
  { sector: 'Materials', performance: -10.5 },
];

function sectorSpec(dark: boolean): ChartSpec {
  return {
    mark: 'bar',
    data: sectorData,
    encoding: {
      x: {
        field: 'performance',
        type: 'quantitative',
        axis: { label: 'Full-Year Return (%)', format: '+.1f' },
      },
      y: { field: 'sector', type: 'nominal' },
    },
    annotations: [
      {
        type: 'refline',
        x: 0,
        style: 'solid',
        stroke: dark ? '#94a3b8' : '#334155',
        strokeWidth: 1.5,
      },
      {
        type: 'refline',
        x: 18.0,
        label: 'S&P 500 avg: +18.0%',
        style: 'dashed',
        stroke: dark ? '#94a3b8' : '#64748b',
        strokeWidth: 1,
      },
      {
        type: 'text',
        x: 33.7,
        y: 'Communication Services',
        text: 'Meta + Google drive Comm Services',
        fontSize: 11,
        anchor: 'top',
        offset: { dx: -180, dy: -68 },
        connector: 'curve',
        stroke: dark ? '#94a3b8' : '#475569',
      },
    ],
    labels: { density: 'all', format: '+.1f' },
    chrome: {
      title: 'Comms & Tech Lead as Materials Sink',
      subtitle: 'S&P 500 sector total returns, full year 2025',
      source: 'Source: S&P Dow Jones Indices',
      footer: 'Note: Returns include dividends reinvested',
      byline: 'Chart: OpenChart',
    },
  };
}

export const SectorReturns: Story = () => (
  <FinancialShell className="story-chart" height={420}>
    {(dark) => <Chart spec={sectorSpec(dark)} />}
  </FinancialShell>
);

// ---------------------------------------------------------------------------
// Viz 4: Risk vs Return Scatter — "The Frontier"
// ---------------------------------------------------------------------------

const riskReturnData = [
  {
    name: 'US Large Cap',
    volatility: 15.2,
    annualReturn: 12.4,
    assetClass: 'Equity',
    allocation: 35,
  },
  {
    name: 'US Small Cap',
    volatility: 19.8,
    annualReturn: 10.1,
    assetClass: 'Equity',
    allocation: 10,
  },
  {
    name: "Int'l Developed",
    volatility: 14.6,
    annualReturn: 7.3,
    assetClass: 'Equity',
    allocation: 12,
  },
  {
    name: 'Emerging Markets',
    volatility: 18.4,
    annualReturn: 5.8,
    assetClass: 'Equity',
    allocation: 6,
  },
  {
    name: 'US Agg Bond',
    volatility: 5.8,
    annualReturn: 2.9,
    assetClass: 'Fixed Income',
    allocation: 18,
  },
  {
    name: 'High Yield',
    volatility: 9.2,
    annualReturn: 5.6,
    assetClass: 'Fixed Income',
    allocation: 5,
  },
  {
    name: 'Treasury Bills',
    volatility: 0.8,
    annualReturn: 1.4,
    assetClass: 'Fixed Income',
    allocation: 3,
  },
  { name: 'REITs', volatility: 18.9, annualReturn: 8.7, assetClass: 'Alternative', allocation: 5 },
  { name: 'Gold', volatility: 15.1, annualReturn: 4.2, assetClass: 'Alternative', allocation: 3 },
  {
    name: 'Commodities',
    volatility: 16.8,
    annualReturn: 1.8,
    assetClass: 'Alternative',
    allocation: 2,
  },
  {
    name: 'Private Equity',
    volatility: 22.1,
    annualReturn: 14.2,
    assetClass: 'Alternative',
    allocation: 0,
  },
  {
    name: 'Bitcoin',
    volatility: 62.5,
    annualReturn: 28.3,
    assetClass: 'Alternative',
    allocation: 0,
  },
];

function riskReturnSpec(dark: boolean): ChartSpec {
  return {
    mark: 'point',
    data: riskReturnData,
    encoding: {
      x: {
        field: 'volatility',
        type: 'quantitative',
        axis: { label: 'Annualized Volatility (%)', format: '.0f' },
      },
      y: {
        field: 'annualReturn',
        type: 'quantitative',
        axis: { label: 'Annualized Return (%)', format: '+.1f' },
      },
      color: { field: 'assetClass', type: 'nominal' },
      size: { field: 'allocation', type: 'quantitative' },
    },
    annotations: [
      {
        type: 'range',
        x1: 0,
        x2: 8,
        y1: 8,
        y2: 16,
        label: 'Sweet spot: low risk, high return',
        fill: dark ? '#4ade80' : '#15803d',
        opacity: dark ? 0.1 : 0.06,
      },
      {
        type: 'text',
        x: 40,
        y: 24,
        text: 'Bitcoin: highest return,\nhighest risk',
        fontSize: 10,
        anchor: 'auto',
        offset: { dx: -10, dy: -10 },
        connector: false,
      },
      {
        type: 'text',
        x: 0.8,
        y: 1.4,
        text: 'T-Bills: stability\nat a cost',
        fontSize: 10,
        anchor: 'right',
        offset: { dx: 65, dy: -40 },
      },
      {
        type: 'text',
        x: 15.2,
        y: 12.4,
        text: 'US Large Cap',
        fontSize: 10,
        anchor: 'top',
        offset: { dx: 0, dy: -28 },
      },
      {
        type: 'refline',
        y: 8.5,
        label: '10-yr equity avg: +8.5%',
        style: 'dashed',
        stroke: dark ? '#64748b' : '#94a3b8',
        strokeWidth: 1,
      },
    ],
    labels: { density: 'none' },
    chrome: {
      title: 'The Price of Returns: Every Asset Class Has a Risk Bill',
      subtitle:
        '10-year annualized return vs volatility, bubble size shows typical allocation weight',
      source: 'Source: Morningstar, Bloomberg aggregate data',
      byline: 'Chart: OpenChart',
    },
  };
}

export const RiskReturn: Story = () => (
  <FinancialShell className="story-chart" height={520}>
    {(dark) => <Chart spec={riskReturnSpec(dark)} />}
  </FinancialShell>
);

// ---------------------------------------------------------------------------
// Viz 5: Earnings Season Table — Q4 2024 Scorecard
// ---------------------------------------------------------------------------

const earningsData = [
  {
    ticker: 'NVDA',
    company: 'NVIDIA',
    epsEstimate: 0.85,
    epsActual: 0.89,
    surprise: 4.7,
    result: 'Beat',
    revenue: 39.3,
    epsTrend: [0.57, 0.68, 0.81, 0.89],
  },
  {
    ticker: 'AAPL',
    company: 'Apple',
    epsEstimate: 2.35,
    epsActual: 2.4,
    surprise: 2.1,
    result: 'Beat',
    revenue: 124.3,
    epsTrend: [1.53, 1.4, 1.64, 2.4],
  },
  {
    ticker: 'MSFT',
    company: 'Microsoft',
    epsEstimate: 3.11,
    epsActual: 3.23,
    surprise: 3.9,
    result: 'Beat',
    revenue: 69.6,
    epsTrend: [2.93, 2.95, 3.3, 3.23],
  },
  {
    ticker: 'GOOGL',
    company: 'Alphabet',
    epsEstimate: 2.13,
    epsActual: 2.15,
    surprise: 0.9,
    result: 'Inline',
    revenue: 96.5,
    epsTrend: [1.44, 1.89, 2.12, 2.15],
  },
  {
    ticker: 'AMZN',
    company: 'Amazon',
    epsEstimate: 1.49,
    epsActual: 1.86,
    surprise: 24.8,
    result: 'Beat',
    revenue: 187.8,
    epsTrend: [0.98, 1.26, 1.43, 1.86],
  },
  {
    ticker: 'META',
    company: 'Meta Platforms',
    epsEstimate: 6.77,
    epsActual: 8.02,
    surprise: 18.5,
    result: 'Beat',
    revenue: 48.4,
    epsTrend: [4.71, 5.16, 6.03, 8.02],
  },
  {
    ticker: 'TSLA',
    company: 'Tesla',
    epsEstimate: 0.76,
    epsActual: 0.73,
    surprise: -3.9,
    result: 'Miss',
    revenue: 25.7,
    epsTrend: [0.45, 0.52, 0.72, 0.73],
  },
  {
    ticker: 'JPM',
    company: 'JPMorgan Chase',
    epsEstimate: 4.11,
    epsActual: 4.81,
    surprise: 17.0,
    result: 'Beat',
    revenue: 43.7,
    epsTrend: [3.04, 4.4, 4.37, 4.81],
  },
  {
    ticker: 'BAC',
    company: 'Bank of America',
    epsEstimate: 0.77,
    epsActual: 0.82,
    surprise: 6.5,
    result: 'Beat',
    revenue: 25.3,
    epsTrend: [0.64, 0.83, 0.81, 0.82],
  },
  {
    ticker: 'JNJ',
    company: 'Johnson & Johnson',
    epsEstimate: 2.21,
    epsActual: 2.42,
    surprise: 9.5,
    result: 'Beat',
    revenue: 22.5,
    epsTrend: [2.35, 2.82, 2.42, 2.42],
  },
  {
    ticker: 'PFE',
    company: 'Pfizer',
    epsEstimate: 0.48,
    epsActual: 0.63,
    surprise: 31.3,
    result: 'Beat',
    revenue: 17.8,
    epsTrend: [0.82, 0.6, 0.78, 0.63],
  },
  {
    ticker: 'UNH',
    company: 'UnitedHealth',
    epsEstimate: 6.72,
    epsActual: 6.81,
    surprise: 1.3,
    result: 'Beat',
    revenue: 102.3,
    epsTrend: [6.91, 6.8, 7.15, 6.81],
  },
  {
    ticker: 'HD',
    company: 'Home Depot',
    epsEstimate: 3.03,
    epsActual: 3.13,
    surprise: 3.3,
    result: 'Beat',
    revenue: 39.7,
    epsTrend: [3.82, 4.65, 3.81, 3.13],
  },
  {
    ticker: 'CRM',
    company: 'Salesforce',
    epsEstimate: 2.61,
    epsActual: 2.78,
    surprise: 6.5,
    result: 'Beat',
    revenue: 10.0,
    epsTrend: [2.11, 2.56, 2.72, 2.78],
  },
  {
    ticker: 'NFLX',
    company: 'Netflix',
    epsEstimate: 4.2,
    epsActual: 4.27,
    surprise: 1.7,
    result: 'Beat',
    revenue: 10.2,
    epsTrend: [2.88, 4.88, 5.4, 4.27],
  },
  {
    ticker: 'DIS',
    company: 'Walt Disney',
    epsEstimate: 1.45,
    epsActual: 1.76,
    surprise: 21.4,
    result: 'Beat',
    revenue: 24.7,
    epsTrend: [0.93, 1.03, 1.14, 1.76],
  },
];

const earningsSpec: TableSpec = {
  type: 'table',
  data: earningsData,
  columns: [
    { key: 'ticker', label: 'Ticker', sortable: true, width: '70px' },
    { key: 'company', label: 'Company', sortable: true },
    { key: 'epsEstimate', label: 'EPS Est.', format: '$,.2f', sortable: true, align: 'right' },
    { key: 'epsActual', label: 'EPS Actual', format: '$,.2f', sortable: true, align: 'right' },
    {
      key: 'surprise',
      label: 'Surprise %',
      format: '+.1f',
      sortable: true,
      align: 'right',
      heatmap: {
        palette: ['#dc2626', '#fca5a5', '#f5f5f5', '#86efac', '#15803d'],
        domain: [-25, 25],
      },
    },
    {
      key: 'result',
      label: 'Result',
      sortable: true,
      categoryColors: { Beat: '#15803d', Miss: '#dc2626', Inline: '#64748b' },
    },
    { key: 'revenue', label: 'Rev ($B)', format: '$,.1f', sortable: true, align: 'right' },
    { key: 'epsTrend', label: 'EPS Trend', sparkline: { type: 'column' } },
  ],
  chrome: {
    title: 'Amazon and Meta Crush Estimates, Tesla Stumbles',
    subtitle: 'Q4 2024 earnings results: EPS estimates vs actuals for major S&P 500 companies',
    source: 'Source: Company filings, analyst consensus via FactSet',
    byline: 'Table: OpenChart',
  },
  search: true,
  pagination: { pageSize: 10 },
  compact: true,
};

export const EarningsSeason: Story = () => (
  <FinancialShell maxWidth={920}>{(_dark) => <DataTable spec={earningsSpec} />}</FinancialShell>
);
