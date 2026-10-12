/**
 * GDP per capita by country, using ISO 3166-1 numeric codes.
 *
 * These codes match the feature IDs in world-atlas TopoJSON files.
 * Values are approximate GDP per capita in current USD (World Bank, 2023).
 */
export const worldGdp = {
  source: 'Source: World Bank, GDP per capita (current US$)',
  data: [
    { id: '840', gdp: 80035 }, // United States
    { id: '156', gdp: 12720 }, // China
    { id: '392', gdp: 33815 }, // Japan
    { id: '276', gdp: 51384 }, // Germany
    { id: '356', gdp: 2485 }, // India
    { id: '826', gdp: 46125 }, // United Kingdom
    { id: '250', gdp: 44408 }, // France
    { id: '380', gdp: 37146 }, // Italy
    { id: '076', gdp: 8918 }, // Brazil
    { id: '124', gdp: 52722 }, // Canada
    { id: '643', gdp: 12195 }, // Russia
    { id: '036', gdp: 63529 }, // Australia
    { id: '410', gdp: 32423 }, // South Korea
    { id: '484', gdp: 10948 }, // Mexico
    { id: '360', gdp: 4788 }, // Indonesia
    { id: '528', gdp: 57025 }, // Netherlands
    { id: '682', gdp: 30436 }, // Saudi Arabia
    { id: '756', gdp: 99994 }, // Switzerland
    { id: '792', gdp: 10674 }, // Turkey
    { id: '616', gdp: 18321 }, // Poland
    { id: '752', gdp: 55215 }, // Sweden
    { id: '578', gdp: 82832 }, // Norway
    { id: '032', gdp: 13650 }, // Argentina
    { id: '710', gdp: 6191 }, // South Africa
    { id: '764', gdp: 7233 }, // Thailand
    { id: '566', gdp: 1621 }, // Nigeria
    { id: '818', gdp: 3614 }, // Egypt
    { id: '586', gdp: 1505 }, // Pakistan
    { id: '704', gdp: 4316 }, // Vietnam
    { id: '608', gdp: 3905 }, // Philippines
  ],
};
