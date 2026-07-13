/**
 * US state unemployment rates by FIPS code.
 *
 * Each entry uses a two-digit FIPS state code (as used in TopoJSON from
 * us-atlas) and a realistic unemployment rate in the 2-8% range. Values are
 * illustrative and loosely based on BLS Local Area Unemployment Statistics.
 */
export const usUnemployment = {
  source: 'Source: Bureau of Labor Statistics, Local Area Unemployment Statistics',
  data: [
    { id: '01', rate: 2.7 }, // Alabama
    { id: '02', rate: 4.8 }, // Alaska
    { id: '04', rate: 4.7 }, // Arizona
    { id: '05', rate: 4.2 }, // Arkansas
    { id: '06', rate: 5.3 }, // California
    { id: '08', rate: 3.8 }, // Colorado
    { id: '09', rate: 4.8 }, // Connecticut
    { id: '10', rate: 5.4 }, // Delaware
    { id: '11', rate: 5.7 }, // District of Columbia
    { id: '12', rate: 4.4 }, // Florida
    { id: '13', rate: 3.5 }, // Georgia
    { id: '15', rate: 2.4 }, // Hawaii
    { id: '16', rate: 3.6 }, // Idaho
    { id: '17', rate: 5.1 }, // Illinois
    { id: '18', rate: 3.6 }, // Indiana
    { id: '19', rate: 3.3 }, // Iowa
    { id: '20', rate: 3.8 }, // Kansas
    { id: '21', rate: 4.2 }, // Kentucky
    { id: '22', rate: 4.4 }, // Louisiana
    { id: '23', rate: 3.3 }, // Maine
    { id: '24', rate: 4.3 }, // Maryland
    { id: '25', rate: 4.7 }, // Massachusetts
    { id: '26', rate: 5.1 }, // Michigan
    { id: '27', rate: 4.9 }, // Minnesota
    { id: '28', rate: 3.8 }, // Mississippi
    { id: '29', rate: 4.2 }, // Missouri
    { id: '30', rate: 3.6 }, // Montana
    { id: '31', rate: 3.1 }, // Nebraska
    { id: '32', rate: 5.1 }, // Nevada
    { id: '33', rate: 3.0 }, // New Hampshire
    { id: '34', rate: 4.9 }, // New Jersey
    { id: '35', rate: 4.8 }, // New Mexico
    { id: '36', rate: 4.4 }, // New York
    { id: '37', rate: 3.7 }, // North Carolina
    { id: '38', rate: 2.8 }, // North Dakota
    { id: '39', rate: 4.0 }, // Ohio
    { id: '40', rate: 3.9 }, // Oklahoma
    { id: '41', rate: 5.2 }, // Oregon
    { id: '42', rate: 4.2 }, // Pennsylvania
    { id: '44', rate: 4.9 }, // Rhode Island
    { id: '45', rate: 4.2 }, // South Carolina
    { id: '46', rate: 2.3 }, // South Dakota
    { id: '47', rate: 3.3 }, // Tennessee
    { id: '48', rate: 4.3 }, // Texas
    { id: '49', rate: 3.8 }, // Utah
    { id: '50', rate: 2.6 }, // Vermont
    { id: '51', rate: 3.8 }, // Virginia
    { id: '53', rate: 5.1 }, // Washington
    { id: '54', rate: 4.5 }, // West Virginia
    { id: '55', rate: 4.0 }, // Wisconsin
    { id: '56', rate: 3.8 }, // Wyoming
  ],
};

/**
 * Prior-period unemployment rates: same states with shifted rates to make the
 * color-change visible when toggling between datasets.
 */
export const usUnemploymentPrior = [
  { id: '01', rate: 4.1 }, // Alabama
  { id: '02', rate: 6.3 }, // Alaska
  { id: '04', rate: 3.5 }, // Arizona
  { id: '05', rate: 5.8 }, // Arkansas
  { id: '06', rate: 7.2 }, // California
  { id: '08', rate: 2.9 }, // Colorado
  { id: '09', rate: 6.1 }, // Connecticut
  { id: '10', rate: 3.8 }, // Delaware
  { id: '11', rate: 7.4 }, // District of Columbia
  { id: '12', rate: 5.9 }, // Florida
  { id: '13', rate: 4.8 }, // Georgia
  { id: '15', rate: 3.7 }, // Hawaii
  { id: '16', rate: 2.5 }, // Idaho
  { id: '17', rate: 6.4 }, // Illinois
  { id: '18', rate: 5.0 }, // Indiana
  { id: '19', rate: 2.1 }, // Iowa
  { id: '20', rate: 5.2 }, // Kansas
  { id: '21', rate: 5.7 }, // Kentucky
  { id: '22', rate: 5.9 }, // Louisiana
  { id: '23', rate: 4.7 }, // Maine
  { id: '24', rate: 3.1 }, // Maryland
  { id: '25', rate: 6.0 }, // Massachusetts
  { id: '26', rate: 6.8 }, // Michigan
  { id: '27', rate: 3.4 }, // Minnesota
  { id: '28', rate: 5.3 }, // Mississippi
  { id: '29', rate: 3.0 }, // Missouri
  { id: '30', rate: 4.9 }, // Montana
  { id: '31', rate: 2.0 }, // Nebraska
  { id: '32', rate: 6.7 }, // Nevada
  { id: '33', rate: 2.2 }, // New Hampshire
  { id: '34', rate: 6.3 }, // New Jersey
  { id: '35', rate: 3.6 }, // New Mexico
  { id: '36', rate: 5.8 }, // New York
  { id: '37', rate: 5.0 }, // North Carolina
  { id: '38', rate: 2.0 }, // North Dakota
  { id: '39', rate: 5.5 }, // Ohio
  { id: '40', rate: 2.7 }, // Oklahoma
  { id: '41', rate: 6.6 }, // Oregon
  { id: '42', rate: 5.6 }, // Pennsylvania
  { id: '44', rate: 6.2 }, // Rhode Island
  { id: '45', rate: 3.0 }, // South Carolina
  { id: '46', rate: 3.6 }, // South Dakota
  { id: '47', rate: 4.7 }, // Tennessee
  { id: '48', rate: 5.8 }, // Texas
  { id: '49', rate: 2.5 }, // Utah
  { id: '50', rate: 3.9 }, // Vermont
  { id: '51', rate: 2.6 }, // Virginia
  { id: '53', rate: 6.5 }, // Washington
  { id: '54', rate: 5.9 }, // West Virginia
  { id: '55', rate: 5.3 }, // Wisconsin
  { id: '56', rate: 2.6 }, // Wyoming
];
