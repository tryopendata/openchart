/**
 * US energy flow in 2024, from primary source to end use (quadrillion BTU).
 *
 * Lawrence Livermore National Laboratory, "Estimated U.S. Energy Consumption in
 * 2024" flow chart (94.6 quads), released July 2026, based on DOE/EIA State
 * Energy Data System figures.
 * URL: https://flowcharts.llnl.gov/commodities/energy
 * Retrieved 2026-11-20. The values are read from the numeric labels printed on
 * the published US 2024 chart image, which carries no separate data file.
 *
 * Four columns: fuel source, electricity generation, end-use sector, then
 * rejected energy or energy services. "Distributed electricity" is drawn as
 * links from Electricity generation to each sector. Links under 0.2 quads are
 * left out (9 links, 0.57 quads in all): net electricity imports 0.01,
 * geothermal 0.05 / 0.04 / 0.02 (to electricity, residential, commercial),
 * solar 0.08 / 0.02 (commercial, industrial), coal to commercial 0.01,
 * petroleum to electricity 0.17, biomass to commercial 0.17. The one link under
 * 0.2 that is kept, electricity to transportation 0.02, keeps all four sectors
 * in the same column. Node totals therefore differ slightly from the chart's
 * (petroleum 35.42 against 35.59, for one). The chart also draws an unlabelled hairline from hydro to
 * commercial, which is omitted. Totals may not equal the sum of links because
 * the source rounds each one independently.
 */
export const usEnergyFlow2024 = {
  source:
    'Source: Lawrence Livermore National Laboratory, Estimated U.S. Energy Consumption in 2024 (data: DOE/EIA)',
  url: 'https://flowcharts.llnl.gov/commodities/energy',
  data: [
    { source: 'Solar', target: 'Electricity generation', value: 0.75 },
    { source: 'Nuclear', target: 'Electricity generation', value: 8.17 },
    { source: 'Hydro', target: 'Electricity generation', value: 0.83 },
    { source: 'Wind', target: 'Electricity generation', value: 1.54 },
    { source: 'Natural gas', target: 'Electricity generation', value: 13.94 },
    { source: 'Coal', target: 'Electricity generation', value: 7.01 },
    { source: 'Biomass', target: 'Electricity generation', value: 0.32 },

    { source: 'Solar', target: 'Residential', value: 0.26 },
    { source: 'Natural gas', target: 'Residential', value: 4.58 },
    { source: 'Biomass', target: 'Residential', value: 0.37 },
    { source: 'Petroleum', target: 'Residential', value: 0.92 },
    { source: 'Natural gas', target: 'Commercial', value: 3.46 },
    { source: 'Petroleum', target: 'Commercial', value: 0.8 },
    { source: 'Natural gas', target: 'Industrial', value: 10.9 },
    { source: 'Coal', target: 'Industrial', value: 0.85 },
    { source: 'Biomass', target: 'Industrial', value: 2.36 },
    { source: 'Petroleum', target: 'Industrial', value: 8.73 },
    { source: 'Natural gas', target: 'Transportation', value: 1.39 },
    { source: 'Biomass', target: 'Transportation', value: 1.89 },
    { source: 'Petroleum', target: 'Transportation', value: 24.97 },

    { source: 'Electricity generation', target: 'Residential', value: 5.06 },
    { source: 'Electricity generation', target: 'Commercial', value: 4.95 },
    { source: 'Electricity generation', target: 'Industrial', value: 3.53 },
    { source: 'Electricity generation', target: 'Transportation', value: 0.02 },
    { source: 'Electricity generation', target: 'Rejected energy', value: 19.21 },

    { source: 'Residential', target: 'Rejected energy', value: 3.93 },
    { source: 'Residential', target: 'Energy services', value: 7.3 },
    { source: 'Commercial', target: 'Rejected energy', value: 3.32 },
    { source: 'Commercial', target: 'Energy services', value: 6.17 },
    { source: 'Industrial', target: 'Rejected energy', value: 13.46 },
    { source: 'Industrial', target: 'Energy services', value: 12.93 },
    { source: 'Transportation', target: 'Rejected energy', value: 22.35 },
    { source: 'Transportation', target: 'Energy services', value: 5.94 },
  ],
} as const;
