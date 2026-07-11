/**
 * US energy flow: primary sources through carriers to end-use sectors.
 *
 * Three-column sankey flow (source -> carrier -> sector) with magnitudes in the
 * spirit of the EIA's annual energy flow diagram (quadrillion BTU). Editorial
 * data carried over from the pre-existing sankey story with its original
 * citation; magnitudes are illustrative of the EIA's published flow shape, not a
 * row-for-row transcription, so it is attributed to the source but not URL-cited.
 */
export const energyFlow = {
  source: 'Source: U.S. Energy Information Administration, Annual Energy Review',
  url: 'https://www.eia.gov/totalenergy/data/annual/',
  data: [
    // Primary sources -> carriers
    { source: 'Coal', target: 'Electricity', value: 46.5 },
    { source: 'Natural Gas', target: 'Electricity', value: 38.2 },
    { source: 'Natural Gas', target: 'Heating', value: 25.8 },
    { source: 'Nuclear', target: 'Electricity', value: 19.7 },
    { source: 'Solar', target: 'Electricity', value: 10.3 },
    { source: 'Wind', target: 'Electricity', value: 14.1 },
    { source: 'Petroleum', target: 'Transport', value: 55.4 },
    { source: 'Petroleum', target: 'Industry', value: 12.3 },
    // Carriers -> end-use sectors
    { source: 'Electricity', target: 'Residential', value: 38.5 },
    { source: 'Electricity', target: 'Commercial', value: 35.8 },
    { source: 'Electricity', target: 'Industry', value: 34.5 },
    { source: 'Heating', target: 'Residential', value: 15.2 },
    { source: 'Heating', target: 'Commercial', value: 10.6 },
    { source: 'Transport', target: 'Passenger', value: 32.1 },
    { source: 'Transport', target: 'Freight', value: 23.3 },
  ],
} as const;
