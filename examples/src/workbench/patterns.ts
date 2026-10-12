import { type ChartSpec, clarity, type VizSpec } from '@opendata-ai/openchart-core';
import worldTopo from 'world-atlas/countries-110m.json';
import {
  bigTechRevenue,
  energyMix,
  incomeDistribution,
  lifeExpectancyChange,
  populationByCountry,
  stockPerformance,
  worldGdp,
} from '../data';

export interface ReferencePattern {
  id: string;
  title: string;
  description: string;
  takeaway: string;
  spec: VizSpec;
}
const common = { theme: clarity, watermark: false, animation: 'fluid' as const };
const keyedRevenue = bigTechRevenue.data.map((row) => ({
  ...row,
  id: `${row.company.toLowerCase()}_${row.year.replaceAll('-', '')}`,
}));
export const revenueSpec: ChartSpec = {
  ...common,
  chromeLayout: 'grow',
  responsive: { preserveEnd: true, labelSummary: true },
  mark: 'line',
  data: keyedRevenue,
  encoding: {
    key: { field: 'id', type: 'nominal' },
    x: { field: 'year', type: 'temporal', axis: { format: '%Y' } },
    y: {
      field: 'revenue',
      type: 'quantitative',
      format: '$,.0f',
      axis: { title: 'Revenue · $ billions', format: ',.0f' },
    },
    color: {
      field: 'company',
      type: 'nominal',
      scale: {
        domain: ['Amazon', 'Apple', 'Alphabet', 'Microsoft', 'Meta'],
        range: ['#0f766e', '#52525b', '#78716c', '#64748b', '#71717a'],
      },
    },
  },
  seriesStyles: {
    Amazon: { strokeWidth: 3 },
    Apple: { lineStyle: 'dashed' },
    Alphabet: { lineStyle: 'dotted' },
  },
  labels: { density: 'endpoints', format: '$,.0f' },
  fields: {
    id: { type: 'text', role: 'identity' },
    revenue: {
      measure: 'annual-revenue',
      unit: 'USD billions',
      provenance: 'Rounded historical example; not a financial data feed.',
    },
  },
  chrome: {
    title: 'Amazon pulls away from its peers',
    subtitle: 'Annual revenue, 2019–2024 · $ billions',
    source: bigTechRevenue.source,
    footer: 'Rounded example data; fiscal-year reporting periods differ.',
  },
};

export const referencePatterns: ReferencePattern[] = [
  {
    id: 'line',
    title: 'Change over time',
    description: 'Find the signal in several series',
    takeaway: 'Read Amazon’s 2024 value and identify the nearest peer.',
    spec: revenueSpec,
  },
  {
    id: 'ranking',
    title: 'A clear comparison',
    description: 'Make magnitude easy to read',
    takeaway: 'Identify the two largest populations in the supplied order.',
    spec: {
      ...common,
      mark: { type: 'bar', fill: '#0f766e' },
      data: [...populationByCountry.data],
      encoding: {
        key: { field: 'country', type: 'nominal', sort: null },
        x: {
          field: 'population',
          type: 'quantitative',
          format: '.3~s',
          axis: { title: 'Population', format: '.2~s' },
        },
        y: { field: 'country', type: 'nominal', sort: null },
      },
      labels: { density: 'all', format: '.3~s' },
      chrome: {
        title: 'Two countries, more than a billion people each',
        subtitle: 'Population estimates · 2025',
        source: populationByCountry.source,
      },
    },
  },
  {
    id: 'composition',
    title: 'Parts of the whole',
    description: 'Show how the mix is changing',
    takeaway: 'Identify the dominant sources and how their shares changed.',
    spec: {
      ...common,
      mark: 'area',
      responsive: { preserveEnd: true },
      data: [...energyMix.data],
      encoding: {
        x: { field: 'year', type: 'ordinal' },
        y: {
          field: 'energy',
          type: 'quantitative',
          stack: 'zero',
          axis: { title: 'Share of primary energy · %' },
        },
        color: { field: 'source', type: 'nominal' },
      },
      fields: { energy: { measure: 'primary-energy-share', unit: '%', representation: 'percent' } },
      chrome: {
        title: 'Fossil fuels still dominate the mix',
        subtitle: 'Global primary energy by source · 2015–2022',
        source: energyMix.source,
      },
    },
  },
  {
    id: 'distribution',
    title: 'Spread & outliers',
    description: 'Look beyond the average',
    takeaway: 'Compare the spread; recognize this is illustrative sampled data.',
    spec: {
      ...common,
      mark: 'beeswarm',
      data: incomeDistribution.data.map((row, i) => ({ ...row, id: `income:${i}` })),
      encoding: {
        key: { field: 'id', type: 'nominal' },
        x: {
          field: 'income',
          type: 'quantitative',
          axis: { title: 'Household income · $ thousands' },
        },
        y: { field: 'region', type: 'nominal' },
      },
      chrome: {
        title: 'Income varies within every region',
        subtitle: 'Illustrative household draws, not population microdata',
        source: incomeDistribution.source,
      },
    },
  },
  {
    id: 'change',
    title: 'Before & after',
    description: 'Connect two moments directly',
    takeaway: 'Read Japan’s endpoints and their absolute difference.',
    spec: {
      ...common,
      mark: 'range',
      data: [...lifeExpectancyChange.data],
      encoding: {
        key: { field: 'country', type: 'nominal', sort: null },
        y: { field: 'country', type: 'nominal', sort: null },
        x: {
          field: 'y2000',
          type: 'quantitative',
          title: '2000',
          axis: { title: 'Life expectancy · years' },
        },
        x2: { field: 'y2023', type: 'quantitative', title: '2023' },
      },
      fields: {
        y2000: { measure: 'life-expectancy', unit: 'years' },
        y2023: { measure: 'life-expectancy', unit: 'years' },
      },
      chrome: {
        title: 'Longer lives, persistent gaps',
        subtitle: 'Life expectancy at birth · gray: 2000 · teal: 2023',
        source: lifeExpectancyChange.source,
      },
    },
  },
  {
    id: 'map',
    title: 'A geographic lens',
    description: 'Locate the differences',
    takeaway: 'Inspect a country and distinguish missing observations.',
    spec: {
      ...common,
      type: 'map',
      geo: { features: worldTopo, projection: 'equalEarth' },
      data: [...worldGdp.data],
      encoding: {
        key: { field: 'id', type: 'nominal' },
        color: { field: 'gdp', type: 'quantitative', title: 'GDP per capita · US$' },
      },
      fields: {
        gdp: { label: 'GDP per capita', unit: 'USD', measure: 'gdp-per-capita' },
        id: { label: 'Country code' },
      },
      valueFormat: '$,.0f',
      chrome: {
        title: 'Economic output, per person',
        subtitle: 'GDP per capita · current US dollars · 2023',
        source: worldGdp.source,
      },
    },
  },
  {
    id: 'table',
    title: 'The details matter',
    description: 'Compare precise values',
    takeaway: 'Find a company and compare its price and year-to-date change.',
    spec: {
      ...common,
      type: 'table',
      mobileLayout: 'priority',
      data: [...stockPerformance.data],
      columns: [
        { key: 'ticker', label: 'Ticker', sortable: true, priority: 1 },
        { key: 'name', label: 'Company', priority: 2 },
        { key: 'price', label: 'Price', format: '$,.2f', sortable: true, priority: 1 },
        {
          key: 'ytdChange',
          label: 'YTD change (%)',
          format: '+.1f',
          delta: true,
          sortable: true,
          priority: 1,
        },
        { key: 'sector', label: 'Sector', priority: 2 },
        { key: 'trend', label: 'Recent trend', sparkline: { type: 'line' }, priority: 2 },
      ],
      fields: {
        ytdChange: {
          label: 'YTD change',
          unit: '%',
          measure: 'ytd-price-change',
          representation: 'percent',
        },
        price: { label: 'Price', unit: 'USD' },
      },
      search: true,
      pagination: { pageSize: 10 },
      chrome: {
        title: 'A closer look at company performance',
        subtitle: 'Illustrative prices and year-to-date changes · not live market data',
        source: stockPerformance.source,
      },
    },
  },
  {
    id: 'narrative',
    title: 'Build a narrative',
    description: 'One dataset, a sequence of ideas',
    takeaway: 'Follow the same companies across years without losing orientation.',
    spec: {
      ...revenueSpec,
      chrome: { ...revenueSpec.chrome, title: 'Start together. Follow the divergence.' },
    },
  },
];
