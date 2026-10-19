/** Review-only B3 plates. Query variant=before|after, surface=light|dark, text=2. */
import type { ChartSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { Chart } from '@opendata-ai/openchart-react';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  energyMix,
  populationByCountry,
  renewableCapacityAdditions,
  temperatureAnomaly,
  usPayrolls,
} from '../data';

export default { title: 'Design Chart Craft' };

type Case = 'grid' | 'rows' | 'columns' | 'grouped' | 'endpoint' | 'band';

function chartCraftSpec(kind: Case, candidate: boolean, _dark: boolean, textScale = 1): ChartSpec {
  const theme: ThemeConfig = {
    fonts: {
      sizes: {
        title: 26 * textScale,
        subtitle: 14 * textScale,
        small: 12 * textScale,
        body: 13 * textScale,
        axisTick: 12 * textScale,
        endpointLabel: 13 * textScale,
        endpointValue: 12 * textScale,
      },
    },
  };
  if (kind === 'grid')
    theme.colors = {
      gridline: {
        light: candidate ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.08)',
        dark: 'rgba(255,255,255,0.06)',
      },
      gridlineZero: {
        light: candidate ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.08)',
        dark: candidate ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.06)',
      },
    };
  const shared: Partial<ChartSpec> = { animation: false, theme };
  if (kind === 'endpoint')
    return {
      ...shared,
      mark: 'line',
      data: ['A', 'B', 'C', 'D'].flatMap((series, index) => [
        { date: '2020-01-01', value: 5 + index * 3, series },
        { date: '2021-01-01', value: 10 + index * 0.1, series },
      ]),
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', scale: { domain: [0, 20] } },
        color: { field: 'series', type: 'nominal' },
      },
      endpointLabels: true,
      theme: { ...theme, spacing: { endpointEntryGap: candidate ? 8 : 6 } },
      chrome: {
        title: 'Close endpoints retain their identities',
        subtitle: 'Existing synthetic gallery fixture; values and typography unchanged',
      },
    };
  if (kind === 'band')
    return {
      ...shared,
      mark: 'area',
      data: [...energyMix.data],
      encoding: {
        x: { field: 'year', type: 'ordinal' },
        y: {
          field: 'energy',
          type: 'quantitative',
          stack: 'zero',
          axis: { title: 'Share of primary energy (%)', format: '.0f' },
        },
        color: { field: 'source', type: 'nominal' },
      },
      endpointLabels: { anchor: candidate ? 'band' : 'boundary' },
      legend: { show: false },
      chrome: {
        title: 'Fossil fuels still dominate the mix',
        subtitle: 'Global primary energy mix, 2015–2022 (% of total)',
        source: energyMix.source,
      },
    };
  if (kind === 'rows')
    return {
      ...shared,
      mark: 'bar',
      data: [...populationByCountry.data],
      encoding: {
        x: {
          field: 'population',
          type: 'quantitative',
          axis: { title: 'Population', format: '.2~s' },
        },
        y: {
          field: 'country',
          type: 'nominal',
          sort: 'x',
          scale: candidate ? { paddingInner: 3 / 7, paddingOuter: 3 / 14 } : undefined,
        },
      },
      labels: { density: 'all', format: '.2~s', fontSize: 13 * textScale },
      chrome: {
        title: 'India leads the population ranking',
        subtitle: 'Population by country, 2025 estimates',
        source: populationByCountry.source,
      },
    };
  if (kind === 'grouped')
    return {
      ...shared,
      mark: 'bar',
      data: [...renewableCapacityAdditions.data],
      encoding: {
        x: {
          field: 'year',
          type: 'nominal',
          scale: candidate ? { paddingInner: 0.4, paddingOuter: 0.2 } : undefined,
        },
        y: {
          field: 'capacity',
          type: 'quantitative',
          stack: null,
          axis: { title: 'Capacity added (GW)' },
        },
        color: { field: 'type', type: 'nominal' },
      },
      labels: { density: 'none' },
      chrome: {
        title: 'Solar additions pull away from wind',
        subtitle: 'Renewable capacity added, 2019–2023',
        source: renewableCapacityAdditions.source,
      },
    };
  if (kind === 'columns')
    return {
      ...shared,
      mark: 'bar',
      data: [...usPayrolls.data],
      encoding: {
        x: {
          field: 'month',
          type: 'nominal',
          scale: candidate ? { paddingInner: 0.45, paddingOuter: 0.225 } : undefined,
        },
        y: { field: 'jobs', type: 'quantitative', axis: { title: 'Jobs added (thousands)' } },
      },
      labels: { density: 'auto', format: ',.0f', fontSize: 13 * textScale },
      chrome: {
        title: 'Hiring slowed during 2024',
        subtitle: 'Monthly US nonfarm payroll additions',
        source: usPayrolls.source,
      },
    };
  return {
    ...shared,
    mark: 'bar',
    data: [...temperatureAnomaly.data],
    encoding: {
      x: { field: 'year', type: 'ordinal' },
      y: {
        field: 'anomaly',
        type: 'quantitative',
        axis: { title: 'Temperature anomaly (°C)', format: '+.1f' },
      },
      color: { field: 'trend', type: 'nominal' },
    },
    labels: { density: 'none' },
    chrome: {
      title: 'Recent decades exceed the average',
      subtitle: 'Global temperature relative to the 20th century',
      source: temperatureAnomaly.source,
    },
  };
}

function Plate({ kind }: { kind: Case }) {
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get('variant') === 'after';
  const dark = params.get('surface') === 'dark';
  const textScale = params.get('text') === '2' ? 2 : 1;
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1024);
  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const spec = chartCraftSpec(kind, candidate, dark, textScale);
  let height = 480 * textScale;
  if (kind === 'rows' && candidate) {
    const measured = compileChart(spec, { width, height });
    // Auto-height prototype: retain measured chrome/axis bands, change only
    // the ten-row plot. With this padding denominator, step is exactly28px.
    height = height - measured.area.height + populationByCountry.data.length * 28 * textScale;
  }
  return (
    <div
      ref={host}
      data-chart-craft={kind}
      data-variant={candidate ? 'after' : 'before'}
      style={{
        height: kind === 'rows' && !candidate ? undefined : height,
        background: dark ? '#09090b' : '#fff',
        color: dark ? '#f7f8f8' : '#09090b',
      }}
    >
      <Chart spec={spec} darkMode={dark ? 'force' : 'off'} />
    </div>
  );
}

export const GridHierarchy = () => <Plate kind="grid" />;
export const BarRowRhythm = () => <Plate kind="rows" />;
export const ColumnRhythm = () => <Plate kind="columns" />;
export const GroupedColumnRhythm = () => <Plate kind="grouped" />;

export const EndpointBlocks = () => <Plate kind="endpoint" />;
export const StackedBandAnchors = () => <Plate kind="band" />;
