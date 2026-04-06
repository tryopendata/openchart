/**
 * Line and area chart stories.
 *
 * Demonstrates single line, multi-series, area, stacked area,
 * and responsive behavior using the Chart component.
 * All data reflects real-world sources for editorial quality.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Single line: US Inflation Rate (CPI Year-over-Year), 2019-2024
// ---------------------------------------------------------------------------

const singleLineSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [
    // 2019 (quarterly samples)
    { date: '2019-01-01', rate: 1.6 },
    { date: '2019-04-01', rate: 2.0 },
    { date: '2019-07-01', rate: 1.8 },
    { date: '2019-10-01', rate: 1.8 },
    // 2020
    { date: '2020-01-01', rate: 2.5 },
    { date: '2020-04-01', rate: 0.3 },
    { date: '2020-07-01', rate: 1.0 },
    { date: '2020-10-01', rate: 1.2 },
    // 2021
    { date: '2021-01-01', rate: 1.4 },
    { date: '2021-04-01', rate: 4.2 },
    { date: '2021-07-01', rate: 5.4 },
    { date: '2021-10-01', rate: 6.2 },
    // 2022
    { date: '2022-01-01', rate: 7.5 },
    { date: '2022-04-01', rate: 8.3 },
    { date: '2022-07-01', rate: 8.5 },
    { date: '2022-10-01', rate: 7.7 },
    // 2023
    { date: '2023-01-01', rate: 6.4 },
    { date: '2023-04-01', rate: 4.9 },
    { date: '2023-07-01', rate: 3.2 },
    { date: '2023-10-01', rate: 3.2 },
    // 2024
    { date: '2024-01-01', rate: 3.1 },
    { date: '2024-04-01', rate: 3.4 },
    { date: '2024-07-01', rate: 2.9 },
    { date: '2024-10-01', rate: 2.6 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 6 } },
    y: {
      field: 'rate',
      type: 'quantitative',
      axis: { title: 'CPI (year-over-year %)', format: '.1f', grid: true },
    },
  },
  annotations: [
    {
      type: 'text',
      x: '2022-07-01',
      y: 8.5,
      text: 'Peak: 8.5%',
      anchor: 'top',
      offset: { dx: 0, dy: -20 },
      connector: true,
    },
    {
      type: 'text',
      x: '2020-04-01',
      y: 0.3,
      text: 'Pandemic\ndeflationary dip',
      anchor: 'top',
      offset: { dx: 60, dy: -80 },
      connector: true,
      background: '#ffffff',
    },
    {
      type: 'refline',
      y: 2,
      label: 'Fed 2% target',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
    {
      type: 'range',
      x1: '2021-04-01',
      x2: '2023-01-01',
      label: 'Above 4%',
      fill: '#dc2626',
      opacity: 0.06,
    },
  ],
  labels: { density: 'endpoints', format: '.1f' },
  chrome: {
    title: "Inflation's Wild Ride: From 1% to 9% and Back",
    subtitle: 'US Consumer Price Index, year-over-year % change, quarterly 2019-2024',
    source: 'Source: Bureau of Labor Statistics',
    byline: 'Chart: OpenChart',
  },
};

export const SingleLine = () => (
  <div className="story-chart story-h-420">
    <Chart spec={singleLineSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Multi-series: GDP Growth Comparison (US, China, Germany), 2019-2024
// ---------------------------------------------------------------------------

const multiSeriesSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [
    // United States (annual GDP growth %)
    { date: '2019-01-01', gdp: 2.5, country: 'United States' },
    { date: '2020-01-01', gdp: -2.2, country: 'United States' },
    { date: '2021-01-01', gdp: 6.1, country: 'United States' },
    { date: '2022-01-01', gdp: 2.5, country: 'United States' },
    { date: '2023-01-01', gdp: 2.9, country: 'United States' },
    { date: '2024-01-01', gdp: 2.8, country: 'United States' },
    // China
    { date: '2019-01-01', gdp: 6.0, country: 'China' },
    { date: '2020-01-01', gdp: 2.2, country: 'China' },
    { date: '2021-01-01', gdp: 8.4, country: 'China' },
    { date: '2022-01-01', gdp: 3.0, country: 'China' },
    { date: '2023-01-01', gdp: 5.2, country: 'China' },
    { date: '2024-01-01', gdp: 4.9, country: 'China' },
    // Germany
    { date: '2019-01-01', gdp: 1.1, country: 'Germany' },
    { date: '2020-01-01', gdp: -3.8, country: 'Germany' },
    { date: '2021-01-01', gdp: 3.2, country: 'Germany' },
    { date: '2022-01-01', gdp: 1.4, country: 'Germany' },
    { date: '2023-01-01', gdp: -0.3, country: 'Germany' },
    { date: '2024-01-01', gdp: 0.1, country: 'Germany' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 6 } },
    y: {
      field: 'gdp',
      type: 'quantitative',
      axis: { title: 'GDP Growth (%)', format: '+.1f', grid: true },
    },
    color: { field: 'country', type: 'nominal' },
  },
  annotations: [
    {
      type: 'refline',
      y: 0,
      label: 'Zero growth',
      style: 'solid',
      stroke: '#64748b',
      strokeWidth: 1,
    },
    {
      type: 'text',
      x: '2020-01-01',
      y: -3.8,
      text: 'COVID crash',
      anchor: 'bottom',
      offset: { dx: 0, dy: 28 },
      connector: true,
    },
    {
      type: 'range',
      x1: '2019-09-01',
      x2: '2020-06-01',
      label: 'Pandemic',
      fill: '#dc2626',
      opacity: 0.07,
    },
  ],
  labels: { density: 'endpoints', format: '.1f' },
  seriesStyles: {
    Germany: { lineStyle: 'dotted', strokeWidth: 1.5, opacity: 0.65 },
  },
  chrome: {
    title: 'The Great Divergence: Three Economies, Three Recoveries',
    subtitle: 'Annual real GDP growth rate, 2019-2024',
    source: 'Source: World Bank, IMF',
    byline: 'Chart: OpenChart',
  },
};

export const MultiSeries = () => (
  <div className="story-chart story-h-440">
    <Chart spec={multiSeriesSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Five series: Big Tech Annual Revenue, 2019-2024
// ---------------------------------------------------------------------------

const fiveSeriesSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [
    // Amazon (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 60, company: 'Amazon' },
    { year: '2019-04-01', revenue: 63, company: 'Amazon' },
    { year: '2019-07-01', revenue: 70, company: 'Amazon' },
    { year: '2019-10-01', revenue: 87, company: 'Amazon' },
    { year: '2020-01-01', revenue: 75, company: 'Amazon' },
    { year: '2020-04-01', revenue: 89, company: 'Amazon' },
    { year: '2020-07-01', revenue: 96, company: 'Amazon' },
    { year: '2020-10-01', revenue: 126, company: 'Amazon' },
    { year: '2021-01-01', revenue: 109, company: 'Amazon' },
    { year: '2021-04-01', revenue: 113, company: 'Amazon' },
    { year: '2021-07-01', revenue: 111, company: 'Amazon' },
    { year: '2021-10-01', revenue: 137, company: 'Amazon' },
    { year: '2022-01-01', revenue: 116, company: 'Amazon' },
    { year: '2022-04-01', revenue: 121, company: 'Amazon' },
    { year: '2022-07-01', revenue: 127, company: 'Amazon' },
    { year: '2022-10-01', revenue: 150, company: 'Amazon' },
    { year: '2023-01-01', revenue: 127, company: 'Amazon' },
    { year: '2023-04-01', revenue: 134, company: 'Amazon' },
    { year: '2023-07-01', revenue: 143, company: 'Amazon' },
    { year: '2023-10-01', revenue: 170, company: 'Amazon' },
    { year: '2024-01-01', revenue: 143, company: 'Amazon' },
    { year: '2024-04-01', revenue: 148, company: 'Amazon' },
    { year: '2024-07-01', revenue: 159, company: 'Amazon' },
    { year: '2024-10-01', revenue: 188, company: 'Amazon' },
    // Apple (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 58, company: 'Apple' },
    { year: '2019-04-01', revenue: 54, company: 'Apple' },
    { year: '2019-07-01', revenue: 64, company: 'Apple' },
    { year: '2019-10-01', revenue: 92, company: 'Apple' },
    { year: '2020-01-01', revenue: 59, company: 'Apple' },
    { year: '2020-04-01', revenue: 60, company: 'Apple' },
    { year: '2020-07-01', revenue: 65, company: 'Apple' },
    { year: '2020-10-01', revenue: 112, company: 'Apple' },
    { year: '2021-01-01', revenue: 90, company: 'Apple' },
    { year: '2021-04-01', revenue: 81, company: 'Apple' },
    { year: '2021-07-01', revenue: 83, company: 'Apple' },
    { year: '2021-10-01', revenue: 124, company: 'Apple' },
    { year: '2022-01-01', revenue: 97, company: 'Apple' },
    { year: '2022-04-01', revenue: 83, company: 'Apple' },
    { year: '2022-07-01', revenue: 90, company: 'Apple' },
    { year: '2022-10-01', revenue: 117, company: 'Apple' },
    { year: '2023-01-01', revenue: 95, company: 'Apple' },
    { year: '2023-04-01', revenue: 82, company: 'Apple' },
    { year: '2023-07-01', revenue: 90, company: 'Apple' },
    { year: '2023-10-01', revenue: 120, company: 'Apple' },
    { year: '2024-01-01', revenue: 91, company: 'Apple' },
    { year: '2024-04-01', revenue: 86, company: 'Apple' },
    { year: '2024-07-01', revenue: 95, company: 'Apple' },
    { year: '2024-10-01', revenue: 124, company: 'Apple' },
    // Alphabet/Google (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 36, company: 'Alphabet' },
    { year: '2019-04-01', revenue: 39, company: 'Alphabet' },
    { year: '2019-07-01', revenue: 40, company: 'Alphabet' },
    { year: '2019-10-01', revenue: 46, company: 'Alphabet' },
    { year: '2020-01-01', revenue: 41, company: 'Alphabet' },
    { year: '2020-04-01', revenue: 38, company: 'Alphabet' },
    { year: '2020-07-01', revenue: 46, company: 'Alphabet' },
    { year: '2020-10-01', revenue: 57, company: 'Alphabet' },
    { year: '2021-01-01', revenue: 55, company: 'Alphabet' },
    { year: '2021-04-01', revenue: 62, company: 'Alphabet' },
    { year: '2021-07-01', revenue: 65, company: 'Alphabet' },
    { year: '2021-10-01', revenue: 75, company: 'Alphabet' },
    { year: '2022-01-01', revenue: 68, company: 'Alphabet' },
    { year: '2022-04-01', revenue: 70, company: 'Alphabet' },
    { year: '2022-07-01', revenue: 69, company: 'Alphabet' },
    { year: '2022-10-01', revenue: 76, company: 'Alphabet' },
    { year: '2023-01-01', revenue: 70, company: 'Alphabet' },
    { year: '2023-04-01', revenue: 75, company: 'Alphabet' },
    { year: '2023-07-01', revenue: 77, company: 'Alphabet' },
    { year: '2023-10-01', revenue: 86, company: 'Alphabet' },
    { year: '2024-01-01', revenue: 81, company: 'Alphabet' },
    { year: '2024-04-01', revenue: 85, company: 'Alphabet' },
    { year: '2024-07-01', revenue: 88, company: 'Alphabet' },
    { year: '2024-10-01', revenue: 96, company: 'Alphabet' },
    // Microsoft (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 31, company: 'Microsoft' },
    { year: '2019-04-01', revenue: 34, company: 'Microsoft' },
    { year: '2019-07-01', revenue: 33, company: 'Microsoft' },
    { year: '2019-10-01', revenue: 37, company: 'Microsoft' },
    { year: '2020-01-01', revenue: 35, company: 'Microsoft' },
    { year: '2020-04-01', revenue: 38, company: 'Microsoft' },
    { year: '2020-07-01', revenue: 37, company: 'Microsoft' },
    { year: '2020-10-01', revenue: 43, company: 'Microsoft' },
    { year: '2021-01-01', revenue: 42, company: 'Microsoft' },
    { year: '2021-04-01', revenue: 46, company: 'Microsoft' },
    { year: '2021-07-01', revenue: 45, company: 'Microsoft' },
    { year: '2021-10-01', revenue: 52, company: 'Microsoft' },
    { year: '2022-01-01', revenue: 49, company: 'Microsoft' },
    { year: '2022-04-01', revenue: 52, company: 'Microsoft' },
    { year: '2022-07-01', revenue: 50, company: 'Microsoft' },
    { year: '2022-10-01', revenue: 53, company: 'Microsoft' },
    { year: '2023-01-01', revenue: 53, company: 'Microsoft' },
    { year: '2023-04-01', revenue: 56, company: 'Microsoft' },
    { year: '2023-07-01', revenue: 57, company: 'Microsoft' },
    { year: '2023-10-01', revenue: 62, company: 'Microsoft' },
    { year: '2024-01-01', revenue: 62, company: 'Microsoft' },
    { year: '2024-04-01', revenue: 65, company: 'Microsoft' },
    { year: '2024-07-01', revenue: 65, company: 'Microsoft' },
    { year: '2024-10-01', revenue: 70, company: 'Microsoft' },
    // Meta (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 15, company: 'Meta' },
    { year: '2019-04-01', revenue: 17, company: 'Meta' },
    { year: '2019-07-01', revenue: 18, company: 'Meta' },
    { year: '2019-10-01', revenue: 21, company: 'Meta' },
    { year: '2020-01-01', revenue: 18, company: 'Meta' },
    { year: '2020-04-01', revenue: 19, company: 'Meta' },
    { year: '2020-07-01', revenue: 21, company: 'Meta' },
    { year: '2020-10-01', revenue: 28, company: 'Meta' },
    { year: '2021-01-01', revenue: 26, company: 'Meta' },
    { year: '2021-04-01', revenue: 29, company: 'Meta' },
    { year: '2021-07-01', revenue: 29, company: 'Meta' },
    { year: '2021-10-01', revenue: 34, company: 'Meta' },
    { year: '2022-01-01', revenue: 28, company: 'Meta' },
    { year: '2022-04-01', revenue: 29, company: 'Meta' },
    { year: '2022-07-01', revenue: 28, company: 'Meta' },
    { year: '2022-10-01', revenue: 32, company: 'Meta' },
    { year: '2023-01-01', revenue: 29, company: 'Meta' },
    { year: '2023-04-01', revenue: 32, company: 'Meta' },
    { year: '2023-07-01', revenue: 34, company: 'Meta' },
    { year: '2023-10-01', revenue: 40, company: 'Meta' },
    { year: '2024-01-01', revenue: 36, company: 'Meta' },
    { year: '2024-04-01', revenue: 39, company: 'Meta' },
    { year: '2024-07-01', revenue: 41, company: 'Meta' },
    { year: '2024-10-01', revenue: 48, company: 'Meta' },
  ],
  encoding: {
    x: {
      field: 'year',
      type: 'temporal',
      axis: { tickCount: 6 },
      scale: { domain: ['2019-01-01', '2024-10-01'] },
    },
    y: {
      field: 'revenue',
      type: 'quantitative',
      axis: { title: 'Revenue ($B)', format: ',.0f', grid: true },
    },
    color: { field: 'company', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: '2020-10-01',
      y: 126,
      text: 'Pandemic\ne-commerce boom',
      anchor: 'left',
      offset: { dx: -90, dy: -30 },
      connector: true,
    },
  ],
  legend: { position: 'top' },
  labels: { density: 'endpoints', format: ',.0f' },
  chrome: {
    title: 'Big Tech Roars Past $2 Trillion in Combined Revenue',
    subtitle: 'Quarterly revenue in billions USD, 2019-2024',
    source: 'Source: Company filings (SEC 10-K)',
    byline: 'Chart: OpenChart',
  },
};

export const FiveSeries = () => (
  <div className="story-chart story-h-460">
    <Chart spec={fiveSeriesSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Area chart: Cumulative Global EV Sales, 2015-2024
// ---------------------------------------------------------------------------

const singleAreaSpec: ChartSpec = {
  animation: true,
  mark: 'area',
  data: [
    { year: '2015-01-01', sales: 1.3 },
    { year: '2016-01-01', sales: 2.1 },
    { year: '2017-01-01', sales: 3.2 },
    { year: '2018-01-01', sales: 5.4 },
    { year: '2019-01-01', sales: 7.5 },
    { year: '2020-01-01', sales: 10.5 },
    { year: '2021-01-01', sales: 17.1 },
    { year: '2022-01-01', sales: 27.0 },
    { year: '2023-01-01', sales: 41.0 },
    { year: '2024-01-01', sales: 58.0 },
  ],
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { tickCount: 5 } },
    y: {
      field: 'sales',
      type: 'quantitative',
      axis: { title: 'Cumulative EV Fleet (millions)', format: ',.0f', grid: true },
    },
  },
  annotations: [
    {
      type: 'text',
      x: '2024-01-01',
      y: 58,
      text: '58M EVs\non the road',
      anchor: 'left',
      offset: { dx: -80, dy: -20 },
      connector: true,
    },
    {
      type: 'text',
      x: '2020-01-01',
      y: 10.5,
      text: '10M milestone',
      anchor: 'top',
      offset: { dx: 0, dy: -22 },
      connector: true,
    },
  ],
  labels: { density: 'endpoints', format: ',.1f' },
  chrome: {
    title: 'The Electric Surge: From Niche to 58 Million on the Road',
    subtitle: 'Cumulative global electric car fleet, 2015-2024 (BEV + PHEV)',
    source: 'Source: IEA Global EV Outlook 2025',
    byline: 'Chart: OpenChart',
  },
};

export const AreaChart = () => (
  <div className="story-chart story-h-420">
    <Chart spec={singleAreaSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Stacked area: Global Electricity Generation by Source, 2000-2023
// ---------------------------------------------------------------------------

const stackedAreaSpec: ChartSpec = {
  animation: true,
  mark: 'area',
  data: [
    // Coal (TWh) - rose sharply with China's boom, dipped 2015-16, rebounded
    { year: '2000-01-01', generation: 5988, source: 'Coal' },
    { year: '2001-01-01', generation: 6073, source: 'Coal' },
    { year: '2002-01-01', generation: 6412, source: 'Coal' },
    { year: '2003-01-01', generation: 6841, source: 'Coal' },
    { year: '2004-01-01', generation: 7230, source: 'Coal' },
    { year: '2005-01-01', generation: 7580, source: 'Coal' },
    { year: '2006-01-01', generation: 8050, source: 'Coal' },
    { year: '2007-01-01', generation: 8420, source: 'Coal' },
    { year: '2008-01-01', generation: 8263, source: 'Coal' },
    { year: '2009-01-01', generation: 7930, source: 'Coal' },
    { year: '2010-01-01', generation: 8660, source: 'Coal' },
    { year: '2011-01-01', generation: 9100, source: 'Coal' },
    { year: '2012-01-01', generation: 9170, source: 'Coal' },
    { year: '2013-01-01', generation: 9400, source: 'Coal' },
    { year: '2014-01-01', generation: 9430, source: 'Coal' },
    { year: '2015-01-01', generation: 9230, source: 'Coal' },
    { year: '2016-01-01', generation: 9180, source: 'Coal' },
    { year: '2017-01-01', generation: 9520, source: 'Coal' },
    { year: '2018-01-01', generation: 9870, source: 'Coal' },
    { year: '2019-01-01', generation: 9620, source: 'Coal' },
    { year: '2020-01-01', generation: 9230, source: 'Coal' },
    { year: '2021-01-01', generation: 10244, source: 'Coal' },
    { year: '2022-01-01', generation: 10190, source: 'Coal' },
    { year: '2023-01-01', generation: 10434, source: 'Coal' },
    // Natural Gas (TWh) - steady growth, dipped in 2009 and 2020
    { year: '2000-01-01', generation: 2752, source: 'Natural Gas' },
    { year: '2001-01-01', generation: 2810, source: 'Natural Gas' },
    { year: '2002-01-01', generation: 2960, source: 'Natural Gas' },
    { year: '2003-01-01', generation: 3100, source: 'Natural Gas' },
    { year: '2004-01-01', generation: 3330, source: 'Natural Gas' },
    { year: '2005-01-01', generation: 3530, source: 'Natural Gas' },
    { year: '2006-01-01', generation: 3740, source: 'Natural Gas' },
    { year: '2007-01-01', generation: 4010, source: 'Natural Gas' },
    { year: '2008-01-01', generation: 4190, source: 'Natural Gas' },
    { year: '2009-01-01', generation: 4050, source: 'Natural Gas' },
    { year: '2010-01-01', generation: 4410, source: 'Natural Gas' },
    { year: '2011-01-01', generation: 4680, source: 'Natural Gas' },
    { year: '2012-01-01', generation: 4830, source: 'Natural Gas' },
    { year: '2013-01-01', generation: 4880, source: 'Natural Gas' },
    { year: '2014-01-01', generation: 5100, source: 'Natural Gas' },
    { year: '2015-01-01', generation: 5340, source: 'Natural Gas' },
    { year: '2016-01-01', generation: 5560, source: 'Natural Gas' },
    { year: '2017-01-01', generation: 5680, source: 'Natural Gas' },
    { year: '2018-01-01', generation: 5950, source: 'Natural Gas' },
    { year: '2019-01-01', generation: 6100, source: 'Natural Gas' },
    { year: '2020-01-01', generation: 5960, source: 'Natural Gas' },
    { year: '2021-01-01', generation: 6340, source: 'Natural Gas' },
    { year: '2022-01-01', generation: 6370, source: 'Natural Gas' },
    { year: '2023-01-01', generation: 6634, source: 'Natural Gas' },
    // Nuclear (TWh) - flat since ~2000, dip after Fukushima 2011
    { year: '2000-01-01', generation: 2590, source: 'Nuclear' },
    { year: '2001-01-01', generation: 2620, source: 'Nuclear' },
    { year: '2002-01-01', generation: 2650, source: 'Nuclear' },
    { year: '2003-01-01', generation: 2630, source: 'Nuclear' },
    { year: '2004-01-01', generation: 2740, source: 'Nuclear' },
    { year: '2005-01-01', generation: 2770, source: 'Nuclear' },
    { year: '2006-01-01', generation: 2790, source: 'Nuclear' },
    { year: '2007-01-01', generation: 2720, source: 'Nuclear' },
    { year: '2008-01-01', generation: 2730, source: 'Nuclear' },
    { year: '2009-01-01', generation: 2700, source: 'Nuclear' },
    { year: '2010-01-01', generation: 2756, source: 'Nuclear' },
    { year: '2011-01-01', generation: 2584, source: 'Nuclear' },
    { year: '2012-01-01', generation: 2460, source: 'Nuclear' },
    { year: '2013-01-01', generation: 2478, source: 'Nuclear' },
    { year: '2014-01-01', generation: 2535, source: 'Nuclear' },
    { year: '2015-01-01', generation: 2572, source: 'Nuclear' },
    { year: '2016-01-01', generation: 2610, source: 'Nuclear' },
    { year: '2017-01-01', generation: 2636, source: 'Nuclear' },
    { year: '2018-01-01', generation: 2700, source: 'Nuclear' },
    { year: '2019-01-01', generation: 2790, source: 'Nuclear' },
    { year: '2020-01-01', generation: 2690, source: 'Nuclear' },
    { year: '2021-01-01', generation: 2800, source: 'Nuclear' },
    { year: '2022-01-01', generation: 2610, source: 'Nuclear' },
    { year: '2023-01-01', generation: 2686, source: 'Nuclear' },
    // Hydro (TWh) - steady growth with year-to-year variation
    { year: '2000-01-01', generation: 2620, source: 'Hydro' },
    { year: '2001-01-01', generation: 2560, source: 'Hydro' },
    { year: '2002-01-01', generation: 2610, source: 'Hydro' },
    { year: '2003-01-01', generation: 2650, source: 'Hydro' },
    { year: '2004-01-01', generation: 2810, source: 'Hydro' },
    { year: '2005-01-01', generation: 2920, source: 'Hydro' },
    { year: '2006-01-01', generation: 3030, source: 'Hydro' },
    { year: '2007-01-01', generation: 3080, source: 'Hydro' },
    { year: '2008-01-01', generation: 3210, source: 'Hydro' },
    { year: '2009-01-01', generation: 3290, source: 'Hydro' },
    { year: '2010-01-01', generation: 3510, source: 'Hydro' },
    { year: '2011-01-01', generation: 3490, source: 'Hydro' },
    { year: '2012-01-01', generation: 3670, source: 'Hydro' },
    { year: '2013-01-01', generation: 3780, source: 'Hydro' },
    { year: '2014-01-01', generation: 3870, source: 'Hydro' },
    { year: '2015-01-01', generation: 3896, source: 'Hydro' },
    { year: '2016-01-01', generation: 4020, source: 'Hydro' },
    { year: '2017-01-01', generation: 4060, source: 'Hydro' },
    { year: '2018-01-01', generation: 4190, source: 'Hydro' },
    { year: '2019-01-01', generation: 4222, source: 'Hydro' },
    { year: '2020-01-01', generation: 4350, source: 'Hydro' },
    { year: '2021-01-01', generation: 4273, source: 'Hydro' },
    { year: '2022-01-01', generation: 4340, source: 'Hydro' },
    { year: '2023-01-01', generation: 4210, source: 'Hydro' },
    // Wind + Solar (TWh) - exponential growth, the real story
    { year: '2000-01-01', generation: 36, source: 'Wind & Solar' },
    { year: '2001-01-01', generation: 45, source: 'Wind & Solar' },
    { year: '2002-01-01', generation: 58, source: 'Wind & Solar' },
    { year: '2003-01-01', generation: 73, source: 'Wind & Solar' },
    { year: '2004-01-01', generation: 93, source: 'Wind & Solar' },
    { year: '2005-01-01', generation: 124, source: 'Wind & Solar' },
    { year: '2006-01-01', generation: 164, source: 'Wind & Solar' },
    { year: '2007-01-01', generation: 216, source: 'Wind & Solar' },
    { year: '2008-01-01', generation: 282, source: 'Wind & Solar' },
    { year: '2009-01-01', generation: 340, source: 'Wind & Solar' },
    { year: '2010-01-01', generation: 436, source: 'Wind & Solar' },
    { year: '2011-01-01', generation: 570, source: 'Wind & Solar' },
    { year: '2012-01-01', generation: 710, source: 'Wind & Solar' },
    { year: '2013-01-01', generation: 850, source: 'Wind & Solar' },
    { year: '2014-01-01', generation: 1010, source: 'Wind & Solar' },
    { year: '2015-01-01', generation: 1183, source: 'Wind & Solar' },
    { year: '2016-01-01', generation: 1390, source: 'Wind & Solar' },
    { year: '2017-01-01', generation: 1593, source: 'Wind & Solar' },
    { year: '2018-01-01', generation: 1860, source: 'Wind & Solar' },
    { year: '2019-01-01', generation: 2200, source: 'Wind & Solar' },
    { year: '2020-01-01', generation: 2590, source: 'Wind & Solar' },
    { year: '2021-01-01', generation: 2895, source: 'Wind & Solar' },
    { year: '2022-01-01', generation: 3440, source: 'Wind & Solar' },
    { year: '2023-01-01', generation: 3935, source: 'Wind & Solar' },
  ],
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { tickCount: 6 } },
    y: {
      field: 'generation',
      type: 'quantitative',
      axis: { title: 'Generation (TWh)', format: '~s', grid: true, tickCount: 8 },
      scale: { domain: [5500, 28000] },
    },
    color: { field: 'source', type: 'nominal' },
  },
  legend: { symbolLimit: 10 },
  labels: { density: 'none' },
  chrome: {
    title: 'Renewables Rising, but Fossil Fuels Still Dominate',
    subtitle: 'Global electricity generation by source, 2000-2023 (TWh)',
    source: 'Source: Ember Global Electricity Review 2025',
    byline: 'Chart: OpenChart',
  },
};

export const StackedArea = () => (
  <div className="story-chart story-h-460">
    <Chart spec={stackedAreaSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Responsive demo
// ---------------------------------------------------------------------------

const compactMultiSeriesSpec: ChartSpec = {
  ...multiSeriesSpec,
  chrome: {
    ...multiSeriesSpec.chrome,
    title: 'Three Recoveries',
    subtitle: 'Real GDP growth, 2019-2024',
  },
};

export const ResponsiveDemo = () => (
  <div className="story-column">
    <div>
      <h3 className="story-heading">Full width (800px)</h3>
      <div
        className="story-debug-border story-fixed-size"
        style={{ '--w': '800px', '--h': '350px' } as React.CSSProperties}
      >
        <Chart spec={multiSeriesSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Medium (500px)</h3>
      <div
        className="story-debug-border story-fixed-size"
        style={{ '--w': '500px', '--h': '350px' } as React.CSSProperties}
      >
        <Chart spec={multiSeriesSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Compact (320px)</h3>
      <div
        className="story-debug-border story-fixed-size"
        style={{ '--w': '320px', '--h': '300px' } as React.CSSProperties}
      >
        <Chart spec={compactMultiSeriesSpec} />
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Interpolation modes: same data rendered with different curve types
// ---------------------------------------------------------------------------

const interpolationData = [
  { month: 'Jan', temp: 2.1 },
  { month: 'Feb', temp: 3.5 },
  { month: 'Mar', temp: 7.8 },
  { month: 'Apr', temp: 12.4 },
  { month: 'May', temp: 17.2 },
  { month: 'Jun', temp: 21.0 },
  { month: 'Jul', temp: 23.5 },
  { month: 'Aug', temp: 22.8 },
  { month: 'Sep', temp: 18.6 },
  { month: 'Oct', temp: 12.9 },
  { month: 'Nov', temp: 7.1 },
  { month: 'Dec', temp: 3.2 },
];

function interpolationSpec(
  mode: 'linear' | 'step' | 'monotone' | 'natural' | 'cardinal',
  title: string,
): ChartSpec {
  return {
    animation: true,
    mark: { type: 'line', interpolate: mode, point: true },
    data: interpolationData,
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: {
        field: 'temp',
        type: 'quantitative',
        axis: { title: 'Temp (\u00B0C)', grid: true },
      },
    },
    labels: { density: 'none' },
    chrome: {
      title,
      subtitle: `interpolate: "${mode}"`,
    },
  };
}

export const InterpolationModes = () => (
  <div className="story-column">
    <div className="story-grid-2">
      <div className="story-debug-border story-h-280">
        <Chart spec={interpolationSpec('linear', 'Linear (default)')} />
      </div>
      <div className="story-debug-border story-h-280">
        <Chart spec={interpolationSpec('step', 'Step')} />
      </div>
      <div className="story-debug-border story-h-280">
        <Chart spec={interpolationSpec('monotone', 'Monotone')} />
      </div>
      <div className="story-debug-border story-h-280">
        <Chart spec={interpolationSpec('natural', 'Natural')} />
      </div>
      <div className="story-debug-border story-h-280">
        <Chart spec={interpolationSpec('cardinal', 'Cardinal')} />
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Step area: EV charging station growth with step interpolation
// ---------------------------------------------------------------------------

const stepAreaSpec: ChartSpec = {
  animation: true,
  mark: { type: 'area', interpolate: 'step' },
  data: [
    { year: '2018-01-01', stations: 54 },
    { year: '2019-01-01', stations: 67 },
    { year: '2020-01-01', stations: 92 },
    { year: '2021-01-01', stations: 129 },
    { year: '2022-01-01', stations: 162 },
    { year: '2023-01-01', stations: 186 },
    { year: '2024-01-01', stations: 214 },
  ],
  encoding: {
    x: { field: 'year', type: 'temporal', axis: { tickCount: 7 } },
    y: {
      field: 'stations',
      type: 'quantitative',
      axis: { title: 'Public Charging Stations (thousands)', format: ',.0f', grid: true },
    },
  },
  labels: { density: 'all', format: ',.0f' },
  chrome: {
    title: 'US Public EV Charging Network Has Quadrupled Since 2018',
    subtitle:
      'Number of public EV charging stations (thousands), step interpolation shows discrete annual jumps',
    source: 'Source: Alternative Fuels Station Locator, DOE',
    byline: 'Chart: OpenChart',
  },
};

export const StepArea = () => (
  <div className="story-chart story-h-400">
    <Chart spec={stepAreaSpec} />
  </div>
);
