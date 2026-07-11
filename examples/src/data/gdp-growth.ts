/**
 * US real GDP, annualized quarterly change, 2020-2024 (%).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (Bureau of Economic Analysis). Captures the pandemic contraction
 * and recovery. Not independently re-derived from an OpenData MCP dataset;
 * the original compiled citation is retained.
 */
export const usGdpGrowth = {
  source: 'Source: Bureau of Economic Analysis',
  url: 'https://www.bea.gov/data/gdp/gross-domestic-product',
  data: [
    { quarter: "Q1 '20", growth: -5.3 },
    { quarter: "Q2 '20", growth: -31.2 },
    { quarter: "Q3 '20", growth: 33.8 },
    { quarter: "Q4 '20", growth: 4.0 },
    { quarter: "Q2 '21", growth: 7.0 },
    { quarter: "Q4 '21", growth: 7.0 },
    { quarter: "Q1 '22", growth: -1.6 },
    { quarter: "Q2 '22", growth: -0.6 },
    { quarter: "Q4 '22", growth: 2.6 },
    { quarter: "Q2 '23", growth: 2.1 },
    { quarter: "Q3 '23", growth: 4.9 },
    { quarter: "Q4 '23", growth: 3.4 },
    { quarter: "Q2 '24", growth: 3.0 },
    { quarter: "Q4 '24", growth: 2.3 },
  ],
} as const;
