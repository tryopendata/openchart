/**
 * Nameplate capacity (megawatts) of US utility-scale generators by the year they came
 * online and by fuel, 2000-2025.
 *
 * Rows come from the OpenData dataset `eia/generator-inventory` (view `all`), verified
 * 2026-11-22: the sum of `nameplate_capacity_mw` per `online_year` for natural gas,
 * solar, wind, battery storage and coal. A fuel with no units that year has no key
 * (the table's blank cells), and a missing key means zero.
 *
 * The inventory is a single monthly snapshot of generators that exist now, so a plant
 * that came online in an early year and has since retired is not counted. Early-year
 * totals, especially for coal and gas, are understated for that reason. The values are
 * nameplate capacity, not electricity generated.
 */
export const eiaCapacityOnlineByYear = {
  source:
    'Source: US Energy Information Administration, Form EIA-860M preliminary monthly generator inventory',
  url: 'https://www.eia.gov/electricity/data/eia860m/',
  data: [
    { year: 2000, natural_gas_mw: 28260.0, wind_mw: 19.0, coal_mw: 101.0 },
    { year: 2001, natural_gas_mw: 41519.0, solar_mw: 4.0, wind_mw: 1351.0, coal_mw: 514.0 },
    { year: 2002, natural_gas_mw: 64612.0, solar_mw: 3.0, wind_mw: 658.0 },
    {
      year: 2003,
      natural_gas_mw: 51188.0,
      solar_mw: 0.0,
      wind_mw: 1550.0,
      battery_mw: 40.0,
      coal_mw: 90.0,
    },
    { year: 2004, natural_gas_mw: 24959.0, wind_mw: 357.0 },
    { year: 2005, natural_gas_mw: 17020.0, solar_mw: 2.0, wind_mw: 2145.0, coal_mw: 434.0 },
    { year: 2006, natural_gas_mw: 10223.0, solar_mw: 2.0, wind_mw: 2637.0, coal_mw: 574.0 },
    { year: 2007, natural_gas_mw: 7433.0, solar_mw: 108.0, wind_mw: 5259.0, coal_mw: 1575.0 },
    { year: 2008, natural_gas_mw: 8769.0, solar_mw: 32.0, wind_mw: 8259.0, coal_mw: 1584.0 },
    { year: 2009, natural_gas_mw: 10087.0, solar_mw: 98.0, wind_mw: 10036.0, coal_mw: 1936.0 },
    { year: 2010, natural_gas_mw: 7007.0, solar_mw: 239.0, wind_mw: 4828.0, coal_mw: 5304.0 },
    {
      year: 2011,
      natural_gas_mw: 10877.0,
      solar_mw: 757.0,
      wind_mw: 6665.0,
      battery_mw: 21.0,
      coal_mw: 4255.0,
    },
    {
      year: 2012,
      natural_gas_mw: 11422.0,
      solar_mw: 1607.0,
      wind_mw: 13347.0,
      battery_mw: 61.0,
      coal_mw: 3043.0,
    },
    { year: 2013, natural_gas_mw: 8047.0, solar_mw: 3527.0, wind_mw: 868.0, battery_mw: 25.0 },
    { year: 2014, natural_gas_mw: 9347.0, solar_mw: 3820.0, wind_mw: 5049.0, battery_mw: 22.0 },
    { year: 2015, natural_gas_mw: 7114.0, solar_mw: 3545.0, wind_mw: 8253.0, battery_mw: 93.0 },
    { year: 2016, natural_gas_mw: 9374.0, solar_mw: 8104.0, wind_mw: 8786.0, battery_mw: 163.0 },
    { year: 2017, natural_gas_mw: 10713.0, solar_mw: 5251.0, wind_mw: 6606.0, battery_mw: 83.0 },
    { year: 2018, natural_gas_mw: 21706.0, solar_mw: 4952.0, wind_mw: 7083.0, battery_mw: 200.0 },
    { year: 2019, natural_gas_mw: 8377.0, solar_mw: 5851.0, wind_mw: 8527.0, battery_mw: 193.0 },
    {
      year: 2020,
      natural_gas_mw: 7143.0,
      solar_mw: 10651.0,
      wind_mw: 14893.0,
      battery_mw: 584.0,
      coal_mw: 17.0,
    },
    { year: 2021, natural_gas_mw: 7361.0, solar_mw: 13774.0, wind_mw: 13848.0, battery_mw: 3006.0 },
    { year: 2022, natural_gas_mw: 6990.0, solar_mw: 11301.0, wind_mw: 9478.0, battery_mw: 4125.0 },
    { year: 2023, natural_gas_mw: 9868.0, solar_mw: 19813.0, wind_mw: 6635.0, battery_mw: 7114.0 },
    { year: 2024, natural_gas_mw: 2397.0, solar_mw: 31168.0, wind_mw: 5156.0, battery_mw: 11065.0 },
    {
      year: 2025,
      natural_gas_mw: 5257.0,
      solar_mw: 29709.0,
      wind_mw: 6272.0,
      battery_mw: 16370.0,
      coal_mw: 10.0,
    },
  ],
};
