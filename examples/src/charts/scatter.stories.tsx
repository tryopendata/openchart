/**
 * Scatter and bubble chart stories.
 *
 * Demonstrates basic scatter, bubble (size encoding),
 * color grouping, and trend line overlay.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Basic scatter — education spending vs PISA math scores
// ---------------------------------------------------------------------------

const basicScatterSpec: ChartSpec = {
  animation: true,
  mark: 'point',
  data: [
    { country: 'Singapore', spending: 14.5, math: 575 },
    { country: 'Japan', spending: 10.1, math: 536 },
    { country: 'South Korea', spending: 12.2, math: 527 },
    { country: 'Estonia', spending: 8.4, math: 510 },
    { country: 'Switzerland', spending: 17.8, math: 508 },
    { country: 'Netherlands', spending: 13.2, math: 493 },
    { country: 'Canada', spending: 12.4, math: 497 },
    { country: 'Poland', spending: 7.8, math: 489 },
    { country: 'Denmark', spending: 14.1, math: 489 },
    { country: 'Ireland', spending: 11.3, math: 492 },
    { country: 'Australia', spending: 12.8, math: 487 },
    { country: 'United Kingdom', spending: 12.6, math: 489 },
    { country: 'Finland', spending: 12.0, math: 484 },
    { country: 'United States', spending: 14.3, math: 465 },
    { country: 'France', spending: 11.4, math: 474 },
    { country: 'Germany', spending: 13.7, math: 475 },
    { country: 'Italy', spending: 10.2, math: 471 },
    { country: 'Norway', spending: 16.2, math: 468 },
    { country: 'Israel', spending: 10.6, math: 458 },
    { country: 'Chile', spending: 6.1, math: 412 },
    { country: 'Mexico', spending: 3.3, math: 395 },
    { country: 'Colombia', spending: 3.8, math: 383 },
  ],
  encoding: {
    x: {
      field: 'spending',
      type: 'quantitative',
      axis: { title: 'Spending per student ($K, PPP)' },
    },
    y: {
      field: 'math',
      type: 'quantitative',
      axis: { title: 'PISA math score' },
    },
  },
  annotations: [
    { type: 'text', x: 14.5, y: 575, text: 'Singapore', anchor: 'left', fontSize: 10 },
    { type: 'text', x: 14.3, y: 465, text: 'United States', anchor: 'right', fontSize: 10 },
    { type: 'text', x: 8.4, y: 510, text: 'Estonia', anchor: 'left', fontSize: 10 },
    { type: 'refline', y: 472, label: 'OECD avg', style: 'dashed' },
  ],
  chrome: {
    title: "Spending More on Schools Doesn't Guarantee Better Math Scores",
    subtitle: 'Cumulative per-student spending vs. PISA 2022 math performance, OECD countries',
    source: 'Source: OECD PISA 2022, Education at a Glance',
    byline: 'Chart: OpenChart',
  },
};

export const BasicScatter = () => (
  <div className="story-chart story-h-450">
    <Chart spec={basicScatterSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Bubble chart — Gapminder-style wealth vs health
// ---------------------------------------------------------------------------

const bubbleSpec: ChartSpec = {
  animation: true,
  mark: 'point',
  data: [
    { country: 'China', gdp: 12.7, lifeExp: 79, pop: 1412, region: 'Asia' },
    { country: 'India', gdp: 7.3, lifeExp: 73, pop: 1408, region: 'Asia' },
    { country: 'United States', gdp: 76.3, lifeExp: 78.4, pop: 335, region: 'Americas' },
    { country: 'Indonesia', gdp: 13.1, lifeExp: 72, pop: 277, region: 'Asia' },
    { country: 'Brazil', gdp: 10.4, lifeExp: 76, pop: 216, region: 'Americas' },
    { country: 'Nigeria', gdp: 2.2, lifeExp: 55, pop: 224, region: 'Africa' },
    { country: 'Bangladesh', gdp: 6.6, lifeExp: 73, pop: 170, region: 'Asia' },
    { country: 'Japan', gdp: 42.4, lifeExp: 84.8, pop: 124, region: 'Asia' },
    { country: 'Mexico', gdp: 12.6, lifeExp: 75, pop: 129, region: 'Americas' },
    { country: 'Germany', gdp: 54.3, lifeExp: 81.7, pop: 84, region: 'Europe' },
    { country: 'France', gdp: 46.3, lifeExp: 82.5, pop: 68, region: 'Europe' },
    { country: 'United Kingdom', gdp: 48.9, lifeExp: 81.8, pop: 67, region: 'Europe' },
    { country: 'South Korea', gdp: 34.2, lifeExp: 83.7, pop: 52, region: 'Asia' },
    { country: 'South Africa', gdp: 7.1, lifeExp: 65, pop: 60, region: 'Africa' },
    { country: 'Australia', gdp: 64.7, lifeExp: 83.5, pop: 26, region: 'Asia' },
    { country: 'Ethiopia', gdp: 2.8, lifeExp: 67, pop: 126, region: 'Africa' },
    { country: 'Canada', gdp: 53.2, lifeExp: 82, pop: 40, region: 'Americas' },
  ],
  encoding: {
    x: {
      field: 'gdp',
      type: 'quantitative',
      axis: { title: 'GDP per capita ($K, PPP)' },
    },
    y: {
      field: 'lifeExp',
      type: 'quantitative',
      axis: { title: 'Life expectancy (years)' },
    },
    size: { field: 'pop', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: 76.3,
      y: 78.4,
      text: 'US: rich but\ndies younger',
      anchor: 'top',
      offset: { dx: -60, dy: -30 },
      connector: true,
      fontSize: 10,
    },
    {
      type: 'text',
      x: 42.4,
      y: 84.8,
      text: 'Japan',
      anchor: 'top',
      offset: { dx: 0, dy: -10 },
      fontSize: 10,
    },
    { type: 'text', x: 2.2, y: 55, text: 'Nigeria', anchor: 'top', fontSize: 10 },
    { type: 'refline', y: 73.4, label: 'World avg life expectancy', style: 'dashed' },
  ],
  chrome: {
    title: 'Money Buys Health, Up to a Point',
    subtitle: 'GDP per capita vs. life expectancy. Bubble size = population (millions), 2023.',
    source: 'Source: World Bank, Gapminder',
    byline: 'Chart: OpenChart',
  },
};

export const BubbleChart = () => (
  <div className="story-chart story-h-480">
    <Chart spec={bubbleSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Color grouping — global cities: cost of living vs quality of life
// ---------------------------------------------------------------------------

const colorScatterSpec: ChartSpec = {
  animation: true,
  mark: 'point',
  data: [
    { city: 'Zurich', cost: 131, quality: 98, region: 'Europe' },
    { city: 'Vienna', cost: 79, quality: 97, region: 'Europe' },
    { city: 'Geneva', cost: 124, quality: 96, region: 'Europe' },
    { city: 'Copenhagen', cost: 89, quality: 95, region: 'Europe' },
    { city: 'Singapore', cost: 107, quality: 93, region: 'Asia' },
    { city: 'Sydney', cost: 83, quality: 92, region: 'Asia-Pacific' },
    { city: 'Montreal', cost: 64, quality: 91, region: 'Americas' },
    { city: 'Tokyo', cost: 78, quality: 90, region: 'Asia' },
    { city: 'Hong Kong', cost: 120, quality: 78, region: 'Asia' },
    { city: 'London', cost: 101, quality: 89, region: 'Europe' },
    { city: 'New York', cost: 100, quality: 85, region: 'Americas' },
    { city: 'Dubai', cost: 76, quality: 82, region: 'Middle East' },
    { city: 'Seoul', cost: 82, quality: 86, region: 'Asia' },
    { city: 'Warsaw', cost: 51, quality: 88, region: 'Europe' },
    { city: 'Kuala Lumpur', cost: 40, quality: 83, region: 'Asia' },
    { city: 'Buenos Aires', cost: 38, quality: 72, region: 'Americas' },
    { city: 'Bangkok', cost: 44, quality: 70, region: 'Asia' },
    { city: 'Santiago', cost: 47, quality: 79, region: 'Americas' },
    { city: 'Budapest', cost: 52, quality: 87, region: 'Europe' },
  ],
  encoding: {
    x: {
      field: 'cost',
      type: 'quantitative',
      axis: { title: 'Cost of living index' },
    },
    y: {
      field: 'quality',
      type: 'quantitative',
      axis: { title: 'Quality of living index' },
    },
    color: { field: 'region', type: 'nominal' },
  },
  annotations: [
    { type: 'text', x: 131, y: 98, text: 'Zurich', anchor: 'left', fontSize: 10 },
    { type: 'text', x: 64, y: 91, text: 'Montreal', anchor: 'right', fontSize: 10 },
    {
      type: 'text',
      x: 120,
      y: 78,
      text: 'Hong Kong:\npricey, lower quality',
      anchor: 'bottom',
      fontSize: 10,
    },
    { type: 'text', x: 51, y: 88, text: 'Warsaw', anchor: 'right', fontSize: 10 },
  ],
  chrome: {
    title: "You Don't Have to Pay a Fortune to Live Well",
    subtitle: 'Cost of living vs. quality of living in global cities, 2024',
    source: 'Source: Mercer Quality of Living & Cost of Living surveys',
    byline: 'Chart: OpenChart',
  },
};

export const ColorGrouping = () => (
  <div className="story-chart story-h-450">
    <Chart spec={colorScatterSpec} />
  </div>
);
