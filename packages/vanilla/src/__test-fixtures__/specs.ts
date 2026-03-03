/**
 * Shared chart, table, and graph spec fixtures for vanilla package tests.
 *
 * These cover all chart types and common configurations so individual test
 * files don't need to duplicate spec definitions.
 */

import type { ChartSpec, GraphSpec, TableSpec } from '@opendata-ai/openchart-engine';

// ---------------------------------------------------------------------------
// Line chart specs
// ---------------------------------------------------------------------------

export const lineSpec: ChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 40, country: 'US' },
    { date: '2020-01-01', value: 15, country: 'UK' },
    { date: '2021-01-01', value: 35, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'GDP Growth',
    subtitle: 'US vs UK over time',
    source: 'World Bank',
  },
};

export const singleSeriesLineSpec: ChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 10 },
    { date: '2021-01-01', value: 40 },
    { date: '2022-01-01', value: 25 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

// ---------------------------------------------------------------------------
// Bar chart specs
// ---------------------------------------------------------------------------

export const barSpec: ChartSpec = {
  type: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 30 },
    { name: 'C', value: 20 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
  chrome: {
    title: 'Updated Chart',
  },
};

// ---------------------------------------------------------------------------
// Column chart specs
// ---------------------------------------------------------------------------

export const columnSpec: ChartSpec = {
  type: 'column',
  data: [
    { category: 'Q1', revenue: 100 },
    { category: 'Q2', revenue: 200 },
    { category: 'Q3', revenue: 150 },
  ],
  encoding: {
    x: { field: 'category', type: 'nominal' },
    y: { field: 'revenue', type: 'quantitative' },
  },
  chrome: {
    title: 'Quarterly Revenue',
  },
};

// ---------------------------------------------------------------------------
// Scatter chart specs
// ---------------------------------------------------------------------------

export const scatterSpec: ChartSpec = {
  type: 'scatter',
  data: [
    { x: 10, y: 20, group: 'A' },
    { x: 30, y: 40, group: 'A' },
    { x: 50, y: 10, group: 'B' },
    { x: 60, y: 30, group: 'B' },
  ],
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    color: { field: 'group', type: 'nominal' },
  },
  chrome: {
    title: 'Scatter Plot',
  },
};

// ---------------------------------------------------------------------------
// Pie chart specs
// ---------------------------------------------------------------------------

export const pieSpec: ChartSpec = {
  type: 'pie',
  data: [
    { category: 'Red', value: 30 },
    { category: 'Blue', value: 50 },
    { category: 'Green', value: 20 },
  ],
  encoding: {
    color: { field: 'category', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'Market Share',
  },
};

// ---------------------------------------------------------------------------
// Multi-series bar spec (grouped)
// ---------------------------------------------------------------------------

export const multiSeriesBarSpec: ChartSpec = {
  type: 'bar',
  data: [
    { name: 'A', value: 10, group: 'X' },
    { name: 'B', value: 30, group: 'X' },
    { name: 'A', value: 20, group: 'Y' },
    { name: 'B', value: 15, group: 'Y' },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
    color: { field: 'group', type: 'nominal' },
  },
};

// ---------------------------------------------------------------------------
// Table specs
// ---------------------------------------------------------------------------

export function makeTableSpec(overrides?: Partial<TableSpec>): TableSpec {
  return {
    type: 'table',
    data: [
      { name: 'Alice', age: 30, city: 'Portland' },
      { name: 'Bob', age: 25, city: 'Seattle' },
      { name: 'Charlie', age: 35, city: 'Portland' },
      { name: 'Diana', age: 28, city: 'Denver' },
      { name: 'Eve', age: 22, city: 'Seattle' },
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
      { key: 'city', label: 'City' },
    ],
    chrome: { title: 'People' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Graph specs
// ---------------------------------------------------------------------------

export const graphSpec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'Node A', community: 'group1' },
    { id: 'b', label: 'Node B', community: 'group1' },
    { id: 'c', label: 'Node C', community: 'group2' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ],
};
