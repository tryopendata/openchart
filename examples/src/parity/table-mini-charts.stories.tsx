/**
 * Parity test: Table with sparklines and inline bar columns.
 *
 * Stock performance data with sparkline trends and YTD change bars,
 * demonstrating Infrographic-comparable mini-chart table columns.
 */

import type { Story } from '@ladle/react';
import type { TableSpec } from '@opendata-ai/openchart-core';
import { DataTable } from '@opendata-ai/openchart-react';

const data = [
  {
    ticker: 'AAPL',
    name: 'Apple',
    price: 189.84,
    ytdChange: 48.2,
    trend: [142, 155, 165, 170, 178, 185, 190, 189],
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft',
    price: 378.91,
    ytdChange: 57.8,
    trend: [240, 275, 295, 310, 330, 345, 365, 379],
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet',
    price: 141.8,
    ytdChange: 58.3,
    trend: [89, 95, 108, 120, 125, 130, 138, 142],
  },
  {
    ticker: 'AMZN',
    name: 'Amazon',
    price: 153.42,
    ytdChange: 82.6,
    trend: [84, 98, 105, 112, 128, 135, 145, 153],
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA',
    price: 495.22,
    ytdChange: 239.0,
    trend: [146, 230, 280, 320, 390, 420, 470, 495],
  },
  {
    ticker: 'META',
    name: 'Meta',
    price: 353.96,
    ytdChange: 194.1,
    trend: [120, 165, 210, 240, 290, 310, 340, 354],
  },
  {
    ticker: 'TSLA',
    name: 'Tesla',
    price: 248.48,
    ytdChange: 101.7,
    trend: [123, 180, 195, 175, 260, 240, 255, 248],
  },
  {
    ticker: 'JPM',
    name: 'JPMorgan',
    price: 170.1,
    ytdChange: 26.8,
    trend: [134, 138, 140, 145, 150, 155, 163, 170],
  },
  {
    ticker: 'V',
    name: 'Visa',
    price: 260.38,
    ytdChange: 25.2,
    trend: [208, 218, 225, 230, 240, 248, 255, 260],
  },
  {
    ticker: 'JNJ',
    name: 'Johnson & Johnson',
    price: 156.74,
    ytdChange: -11.3,
    trend: [177, 170, 162, 155, 160, 158, 155, 157],
  },
  {
    ticker: 'WMT',
    name: 'Walmart',
    price: 162.5,
    ytdChange: 14.8,
    trend: [141, 145, 148, 150, 155, 158, 160, 163],
  },
  {
    ticker: 'PG',
    name: 'Procter & Gamble',
    price: 154.3,
    ytdChange: 2.1,
    trend: [151, 150, 148, 152, 153, 150, 152, 154],
  },
  {
    ticker: 'UNH',
    name: 'UnitedHealth',
    price: 527.4,
    ytdChange: -0.8,
    trend: [532, 540, 535, 525, 520, 530, 528, 527],
  },
  {
    ticker: 'HD',
    name: 'Home Depot',
    price: 342.9,
    ytdChange: 8.5,
    trend: [316, 320, 328, 330, 335, 338, 340, 343],
  },
  {
    ticker: 'MA',
    name: 'Mastercard',
    price: 415.6,
    ytdChange: 18.3,
    trend: [351, 360, 375, 380, 390, 400, 408, 416],
  },
  {
    ticker: 'DIS',
    name: 'Disney',
    price: 93.2,
    ytdChange: 7.1,
    trend: [87, 90, 92, 88, 85, 90, 91, 93],
  },
  {
    ticker: 'PFE',
    name: 'Pfizer',
    price: 28.5,
    ytdChange: -44.3,
    trend: [51, 45, 40, 35, 32, 30, 29, 29],
  },
  {
    ticker: 'BAC',
    name: 'Bank of America',
    price: 33.8,
    ytdChange: 1.8,
    trend: [33, 32, 31, 30, 32, 33, 34, 34],
  },
  {
    ticker: 'CRM',
    name: 'Salesforce',
    price: 262.4,
    ytdChange: 98.2,
    trend: [132, 155, 180, 200, 220, 240, 255, 262],
  },
  {
    ticker: 'NFLX',
    name: 'Netflix',
    price: 486.9,
    ytdChange: 65.1,
    trend: [295, 330, 360, 380, 420, 450, 470, 487],
  },
];

const spec: TableSpec = {
  type: 'table',
  data,
  columns: [
    { key: 'ticker', label: 'Ticker', sortable: true },
    { key: 'name', label: 'Company', sortable: true },
    { key: 'price', label: 'Price', format: '$,.2f', sortable: true, align: 'right' },
    { key: 'ytdChange', label: 'YTD %', format: '+.1f', sortable: true, align: 'right', bar: {} },
    { key: 'trend', label: '8-Week Trend', sparkline: { type: 'line' } },
  ],
  chrome: {
    title: 'US Tech Stock Performance',
    subtitle: 'Year-to-date returns and 8-week price trends',
    source: 'Market data, 2023',
  },
  search: true,
  pagination: { pageSize: 10 },
};

export const StockSparklines: Story = () => (
  <div className="story-centered" style={{ maxWidth: 800 }}>
    <DataTable spec={spec} />
  </div>
);

// Column sparkline variant: quarterly revenue
const revenueData = [
  {
    company: 'Apple',
    q1: 94.8,
    q2: 81.8,
    q3: 89.5,
    q4: 119.6,
    quarterly: [94.8, 81.8, 89.5, 119.6],
  },
  {
    company: 'Microsoft',
    q1: 52.7,
    q2: 56.2,
    q3: 56.5,
    q4: 62.0,
    quarterly: [52.7, 56.2, 56.5, 62.0],
  },
  {
    company: 'Alphabet',
    q1: 69.8,
    q2: 74.6,
    q3: 76.7,
    q4: 86.3,
    quarterly: [69.8, 74.6, 76.7, 86.3],
  },
  {
    company: 'Amazon',
    q1: 127.4,
    q2: 134.4,
    q3: 143.1,
    q4: 170.0,
    quarterly: [127.4, 134.4, 143.1, 170.0],
  },
  { company: 'Meta', q1: 28.6, q2: 32.0, q3: 34.1, q4: 40.1, quarterly: [28.6, 32.0, 34.1, 40.1] },
];

const revenueSpec: TableSpec = {
  type: 'table',
  data: revenueData,
  columns: [
    { key: 'company', label: 'Company', sortable: true },
    { key: 'q1', label: 'Q1', format: '.1f', sortable: true, align: 'right' },
    { key: 'q2', label: 'Q2', format: '.1f', sortable: true, align: 'right' },
    { key: 'q3', label: 'Q3', format: '.1f', sortable: true, align: 'right' },
    { key: 'q4', label: 'Q4', format: '.1f', sortable: true, align: 'right' },
    { key: 'quarterly', label: 'Trend', sparkline: { type: 'column' } },
  ],
  chrome: {
    title: 'Big Tech Quarterly Revenue',
    subtitle: 'Revenue in billions USD, 2023',
    source: 'Company earnings reports',
  },
};

export const RevenueColumns: Story = () => (
  <div className="story-centered" style={{ maxWidth: 750 }}>
    <DataTable spec={revenueSpec} />
  </div>
);
