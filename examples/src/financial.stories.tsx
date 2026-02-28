/**
 * Financial visualizations: editorial-quality charts for market data.
 *
 * Five visualizations demonstrating publication-grade financial data viz:
 * stock price area, index performance comparison, sector returns,
 * risk-return scatter, and earnings season table.
 */

import type { Story } from '@ladle/react';
import type { ChartSpec, TableSpec } from '@openchart/core';
import { Chart, DataTable, useDarkMode, useVizDarkMode } from '@openchart/react';

// ---------------------------------------------------------------------------
// Shell: reads dark mode from VizThemeProvider context (set by Ladle toggle)
// ---------------------------------------------------------------------------

function FinancialShell({
  children,
  width,
  height,
  maxWidth,
}: {
  children: (dark: boolean) => React.ReactNode;
  width?: number;
  height?: number;
  maxWidth?: number;
}) {
  const contextDarkMode = useVizDarkMode();
  const dark = useDarkMode(contextDarkMode);

  return (
    <div
      style={{
        width,
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
// Viz 1: Stock Price Area Chart
// ---------------------------------------------------------------------------

const stockData = [
  { date: '2023-01-01', price: 130.21 },
  { date: '2023-02-01', price: 147.41 },
  { date: '2023-03-01', price: 125.07 },
  { date: '2023-04-01', price: 169.68 },
  { date: '2023-05-01', price: 177.25 },
  { date: '2023-06-01', price: 193.97 },
  { date: '2023-07-01', price: 196.45 },
  { date: '2023-08-01', price: 187.87 },
  { date: '2023-09-01', price: 171.21 },
  { date: '2023-10-01', price: 170.77 },
  { date: '2023-11-01', price: 189.95 },
  { date: '2023-12-01', price: 192.53 },
  { date: '2024-01-01', price: 185.85 },
  { date: '2024-02-01', price: 188.28 },
  { date: '2024-03-01', price: 171.48 },
  { date: '2024-04-01', price: 170.33 },
  { date: '2024-05-01', price: 192.35 },
  { date: '2024-06-01', price: 210.62 },
  { date: '2024-07-01', price: 222.08 },
  { date: '2024-08-01', price: 226.84 },
  { date: '2024-09-01', price: 226.21 },
  { date: '2024-10-01', price: 225.91 },
  { date: '2024-11-01', price: 237.33 },
  { date: '2024-12-01', price: 242.84 },
];

function stockPriceSpec(dark: boolean): ChartSpec {
  return {
    type: 'area',
    data: stockData,
    encoding: {
      x: { field: 'date', type: 'temporal' },
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
        x1: '2023-02-15',
        x2: '2023-04-01',
        label: 'SVB collapse triggers 12% selloff',
        fill: dark ? '#fca5a5' : '#dc2626',
        opacity: dark ? 0.15 : 0.08,
      },
      {
        type: 'refline',
        y: 181,
        label: '2-yr avg: $181',
        style: 'dashed',
        stroke: dark ? '#64748b' : '#94a3b8',
        strokeWidth: 1,
      },
      {
        type: 'text',
        x: '2024-12-01',
        y: 243,
        text: 'Record close: $243',
        fontSize: 11,
        anchor: 'left',
        offset: { dx: -100, dy: -12 },
      },
    ],
    labels: { density: 'none' },
    chrome: {
      title: 'Apple Shares Hit Record After AI-Fuelled Rally',
      subtitle: 'AAPL monthly closing price, January 2023 to December 2024',
      source: 'Source: Nasdaq historical data',
      byline: 'Chart: OpenChart',
    },
  };
}

export const StockPrice: Story = () => (
  <FinancialShell width={700} height={450}>
    {(dark) => <Chart spec={stockPriceSpec(dark)} />}
  </FinancialShell>
);

// ---------------------------------------------------------------------------
// Viz 2: Index Performance Comparison (Multi-series Line)
// ---------------------------------------------------------------------------

const benchmarkData = [
  // S&P 500
  { date: '2022-01-01', totalReturn: 0, index: 'S&P 500' },
  { date: '2022-04-01', totalReturn: -5.3, index: 'S&P 500' },
  { date: '2022-07-01', totalReturn: -13.1, index: 'S&P 500' },
  { date: '2022-10-01', totalReturn: -17.7, index: 'S&P 500' },
  { date: '2023-01-01', totalReturn: -12.5, index: 'S&P 500' },
  { date: '2023-04-01', totalReturn: -5.8, index: 'S&P 500' },
  { date: '2023-07-01', totalReturn: 2.4, index: 'S&P 500' },
  { date: '2023-10-01', totalReturn: 0.1, index: 'S&P 500' },
  { date: '2024-01-01', totalReturn: 6.8, index: 'S&P 500' },
  { date: '2024-04-01', totalReturn: 15.3, index: 'S&P 500' },
  { date: '2024-07-01', totalReturn: 22.1, index: 'S&P 500' },
  { date: '2024-10-01', totalReturn: 28.7, index: 'S&P 500' },
  // NASDAQ
  { date: '2022-01-01', totalReturn: 0, index: 'NASDAQ' },
  { date: '2022-04-01', totalReturn: -9.1, index: 'NASDAQ' },
  { date: '2022-07-01', totalReturn: -22.4, index: 'NASDAQ' },
  { date: '2022-10-01', totalReturn: -29.5, index: 'NASDAQ' },
  { date: '2023-01-01', totalReturn: -18.2, index: 'NASDAQ' },
  { date: '2023-04-01', totalReturn: -8.5, index: 'NASDAQ' },
  { date: '2023-07-01', totalReturn: 7.8, index: 'NASDAQ' },
  { date: '2023-10-01', totalReturn: 3.2, index: 'NASDAQ' },
  { date: '2024-01-01', totalReturn: 15.4, index: 'NASDAQ' },
  { date: '2024-04-01', totalReturn: 28.6, index: 'NASDAQ' },
  { date: '2024-07-01', totalReturn: 36.2, index: 'NASDAQ' },
  { date: '2024-10-01', totalReturn: 43.5, index: 'NASDAQ' },
  // Dow Jones
  { date: '2022-01-01', totalReturn: 0, index: 'Dow Jones' },
  { date: '2022-04-01', totalReturn: -4.1, index: 'Dow Jones' },
  { date: '2022-07-01', totalReturn: -9.5, index: 'Dow Jones' },
  { date: '2022-10-01', totalReturn: -13.2, index: 'Dow Jones' },
  { date: '2023-01-01', totalReturn: -8.4, index: 'Dow Jones' },
  { date: '2023-04-01', totalReturn: -2.1, index: 'Dow Jones' },
  { date: '2023-07-01', totalReturn: 4.2, index: 'Dow Jones' },
  { date: '2023-10-01', totalReturn: 2.8, index: 'Dow Jones' },
  { date: '2024-01-01', totalReturn: 8.1, index: 'Dow Jones' },
  { date: '2024-04-01', totalReturn: 12.6, index: 'Dow Jones' },
  { date: '2024-07-01', totalReturn: 16.8, index: 'Dow Jones' },
  { date: '2024-10-01', totalReturn: 21.3, index: 'Dow Jones' },
  // Russell 2000
  { date: '2022-01-01', totalReturn: 0, index: 'Russell 2000' },
  { date: '2022-04-01', totalReturn: -7.8, index: 'Russell 2000' },
  { date: '2022-07-01', totalReturn: -17.2, index: 'Russell 2000' },
  { date: '2022-10-01', totalReturn: -21.5, index: 'Russell 2000' },
  { date: '2023-01-01', totalReturn: -16.8, index: 'Russell 2000' },
  { date: '2023-04-01', totalReturn: -11.3, index: 'Russell 2000' },
  { date: '2023-07-01', totalReturn: -2.1, index: 'Russell 2000' },
  { date: '2023-10-01', totalReturn: -5.4, index: 'Russell 2000' },
  { date: '2024-01-01', totalReturn: 1.2, index: 'Russell 2000' },
  { date: '2024-04-01', totalReturn: 6.8, index: 'Russell 2000' },
  { date: '2024-07-01', totalReturn: 10.3, index: 'Russell 2000' },
  { date: '2024-10-01', totalReturn: 14.1, index: 'Russell 2000' },
];

function benchmarkSpec(dark: boolean): ChartSpec {
  return {
    type: 'line',
    data: benchmarkData,
    encoding: {
      x: { field: 'date', type: 'temporal', axis: { tickCount: 6 } },
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
        x2: '2022-12-01',
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
        x: '2024-04-01',
        y: 37,
        text: 'NASDAQ opens 26pp gap\nover small caps',
        fontSize: 10,
        connector: false,
        background: dark ? '#1e293b' : '#ffffff',
      },
    ],
    labels: { density: 'endpoints', format: '+.1f' },
    legend: { position: 'bottom-right' },
    chrome: {
      title: 'Big Tech Roars Back While Small Caps Stall',
      subtitle: 'Cumulative total return by index, rebased to January 1, 2022',
      source: 'Source: S&P Dow Jones Indices, Nasdaq',
      byline: 'Chart: OpenChart',
    },
  };
}

export const BenchmarkComparison: Story = () => (
  <FinancialShell width={750} height={450}>
    {(dark) => <Chart spec={benchmarkSpec(dark)} />}
  </FinancialShell>
);

// ---------------------------------------------------------------------------
// Viz 3: Sector Performance Horizontal Bar
// ---------------------------------------------------------------------------

const sectorData = [
  { sector: 'Information Technology', performance: 35.7 },
  { sector: 'Communication Services', performance: 31.2 },
  { sector: 'Consumer Discretionary', performance: 18.4 },
  { sector: 'Financials', performance: 14.8 },
  { sector: 'Industrials', performance: 11.3 },
  { sector: 'Health Care', performance: 6.2 },
  { sector: 'Materials', performance: 3.1 },
  { sector: 'Consumer Staples', performance: -1.4 },
  { sector: 'Real Estate', performance: -3.8 },
  { sector: 'Utilities', performance: -5.2 },
  { sector: 'Energy', performance: -7.6 },
];

function sectorSpec(dark: boolean): ChartSpec {
  return {
    type: 'bar',
    data: sectorData,
    encoding: {
      x: {
        field: 'performance',
        type: 'quantitative',
        axis: { label: 'Year-to-Date Return (%)', format: '+.1f' },
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
        x: 12.5,
        label: 'S&P 500 avg: +12.5%',
        style: 'dashed',
        stroke: dark ? '#94a3b8' : '#64748b',
        strokeWidth: 1,
      },
      {
        type: 'text',
        x: 35.7,
        y: 'Information Technology',
        text: 'AI boom drives tech premium',
        fontSize: 11,
        anchor: 'top',
        offset: { dx: -180, dy: -68 },
        connector: 'curve',
        stroke: dark ? '#94a3b8' : '#475569',
      },
    ],
    labels: { density: 'all', format: '+.1f' },
    chrome: {
      title: 'Tech Leads by a Mile, Energy Sinks on Oversupply',
      subtitle: 'S&P 500 sector total returns, year-to-date 2024',
      source: 'Source: S&P Dow Jones Indices',
      footer: 'Note: Returns include dividends reinvested',
      byline: 'Chart: OpenChart',
    },
  };
}

export const SectorReturns: Story = () => (
  <FinancialShell width={700} height={420}>
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
    type: 'scatter',
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
        x2: 10,
        y1: 7,
        y2: 15,
        label: 'Sweet spot: low risk, high return',
        fill: dark ? '#4ade80' : '#15803d',
        opacity: dark ? 0.1 : 0.06,
      },
      {
        type: 'text',
        x: 40,
        y: 24,
        text: 'Bitcoin: highest return, highest risk',
        fontSize: 10,
        anchor: 'auto',
        connector: false,
      },
      {
        type: 'text',
        x: 0.8,
        y: 1.4,
        text: 'T-Bills: stability at a cost',
        fontSize: 10,
        anchor: 'right',
        offset: { dx: 12, dy: -12 },
      },
      {
        type: 'text',
        x: 15.2,
        y: 12.4,
        text: 'US Large Cap',
        fontSize: 10,
        anchor: 'bottom',
        offset: { dy: -14 },
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
  <FinancialShell width={750} height={520}>
    {(dark) => <Chart spec={riskReturnSpec(dark)} />}
  </FinancialShell>
);

// ---------------------------------------------------------------------------
// Viz 5: Earnings Season Table — "The Scorecard"
// ---------------------------------------------------------------------------

const earningsData = [
  {
    ticker: 'NVDA',
    company: 'NVIDIA',
    epsEstimate: 4.64,
    epsActual: 5.66,
    surprise: 22.0,
    result: 'Beat',
    revenue: 22.1,
    epsTrend: [3.71, 4.02, 4.38, 5.66],
  },
  {
    ticker: 'AAPL',
    company: 'Apple',
    epsEstimate: 2.1,
    epsActual: 2.18,
    surprise: 3.8,
    result: 'Beat',
    revenue: 119.6,
    epsTrend: [1.52, 1.46, 1.64, 2.18],
  },
  {
    ticker: 'MSFT',
    company: 'Microsoft',
    epsEstimate: 2.78,
    epsActual: 2.93,
    surprise: 5.4,
    result: 'Beat',
    revenue: 62.0,
    epsTrend: [2.45, 2.69, 2.99, 2.93],
  },
  {
    ticker: 'GOOGL',
    company: 'Alphabet',
    epsEstimate: 1.72,
    epsActual: 1.89,
    surprise: 9.9,
    result: 'Beat',
    revenue: 86.3,
    epsTrend: [1.17, 1.44, 1.55, 1.89],
  },
  {
    ticker: 'AMZN',
    company: 'Amazon',
    epsEstimate: 0.8,
    epsActual: 1.0,
    surprise: 25.0,
    result: 'Beat',
    revenue: 170.0,
    epsTrend: [0.31, 0.65, 0.94, 1.0],
  },
  {
    ticker: 'META',
    company: 'Meta Platforms',
    epsEstimate: 4.96,
    epsActual: 5.33,
    surprise: 7.5,
    result: 'Beat',
    revenue: 40.1,
    epsTrend: [3.39, 4.39, 4.71, 5.33],
  },
  {
    ticker: 'TSLA',
    company: 'Tesla',
    epsEstimate: 0.74,
    epsActual: 0.71,
    surprise: -4.1,
    result: 'Miss',
    revenue: 25.2,
    epsTrend: [0.85, 0.78, 0.66, 0.71],
  },
  {
    ticker: 'JPM',
    company: 'JPMorgan Chase',
    epsEstimate: 3.32,
    epsActual: 3.97,
    surprise: 19.6,
    result: 'Beat',
    revenue: 39.9,
    epsTrend: [3.04, 3.44, 3.12, 3.97],
  },
  {
    ticker: 'BAC',
    company: 'Bank of America',
    epsEstimate: 0.68,
    epsActual: 0.7,
    surprise: 2.9,
    result: 'Beat',
    revenue: 23.5,
    epsTrend: [0.64, 0.72, 0.73, 0.7],
  },
  {
    ticker: 'JNJ',
    company: 'Johnson & Johnson',
    epsEstimate: 2.28,
    epsActual: 2.29,
    surprise: 0.4,
    result: 'Inline',
    revenue: 21.4,
    epsTrend: [2.68, 2.35, 2.33, 2.29],
  },
  {
    ticker: 'PFE',
    company: 'Pfizer',
    epsEstimate: 0.48,
    epsActual: 0.38,
    surprise: -20.8,
    result: 'Miss',
    revenue: 14.2,
    epsTrend: [1.23, 0.67, 0.41, 0.38],
  },
  {
    ticker: 'UNH',
    company: 'UnitedHealth',
    epsEstimate: 6.14,
    epsActual: 6.16,
    surprise: 0.3,
    result: 'Inline',
    revenue: 94.4,
    epsTrend: [5.96, 5.82, 6.56, 6.16],
  },
  {
    ticker: 'HD',
    company: 'Home Depot',
    epsEstimate: 3.03,
    epsActual: 3.13,
    surprise: 3.3,
    result: 'Beat',
    revenue: 34.8,
    epsTrend: [3.82, 4.65, 3.81, 3.13],
  },
  {
    ticker: 'CRM',
    company: 'Salesforce',
    epsEstimate: 2.27,
    epsActual: 2.44,
    surprise: 7.5,
    result: 'Beat',
    revenue: 9.3,
    epsTrend: [1.68, 2.12, 2.11, 2.44],
  },
  {
    ticker: 'NFLX',
    company: 'Netflix',
    epsEstimate: 4.2,
    epsActual: 4.27,
    surprise: 1.7,
    result: 'Beat',
    revenue: 8.8,
    epsTrend: [2.88, 3.29, 3.73, 4.27],
  },
  {
    ticker: 'DIS',
    company: 'Walt Disney',
    epsEstimate: 1.1,
    epsActual: 1.06,
    surprise: -3.6,
    result: 'Miss',
    revenue: 23.5,
    epsTrend: [0.93, 1.03, 0.82, 1.06],
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
    title: 'NVIDIA Crushes Estimates as Pfizer Stumbles',
    subtitle: 'Q4 2024 earnings results: EPS estimates vs actuals for S&P 500 companies',
    source: 'Source: Company filings, analyst consensus via FactSet',
    byline: 'Table: OpenChart',
  },
  search: true,
  pagination: { pageSize: 10 },
  compact: true,
};

export const EarningsSeason: Story = () => (
  <FinancialShell maxWidth={920}>
    {(dark) => <DataTable spec={earningsSpec} />}
  </FinancialShell>
);
