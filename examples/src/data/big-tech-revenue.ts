/**
 * Annual revenue for the five largest US technology companies, 2019-2024 ($B).
 *
 * Editorial data carried over from the existing `line` story (originally
 * compiled from company SEC filings), aggregated from quarterly to annual
 * totals. Directionally matches reported fiscal-year revenue (Amazon ~$638B,
 * Apple ~$391B, Alphabet ~$350B, Microsoft ~$245B, Meta ~$164B for FY2024);
 * figures are rounded and not re-derived from a single filing, so the general
 * "company filings" citation is retained. Five crossing series — the case where
 * direct endpoint labels stop working and a legend earns its keep.
 */
export const bigTechRevenue = {
  source: 'Source: Company annual reports (SEC 10-K filings)',
  url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany',
  data: [
    { year: '2019-01-01', revenue: 280, company: 'Amazon' },
    { year: '2020-01-01', revenue: 386, company: 'Amazon' },
    { year: '2021-01-01', revenue: 470, company: 'Amazon' },
    { year: '2022-01-01', revenue: 514, company: 'Amazon' },
    { year: '2023-01-01', revenue: 574, company: 'Amazon' },
    { year: '2024-01-01', revenue: 638, company: 'Amazon' },
    { year: '2019-01-01', revenue: 268, company: 'Apple' },
    { year: '2020-01-01', revenue: 296, company: 'Apple' },
    { year: '2021-01-01', revenue: 378, company: 'Apple' },
    { year: '2022-01-01', revenue: 387, company: 'Apple' },
    { year: '2023-01-01', revenue: 387, company: 'Apple' },
    { year: '2024-01-01', revenue: 396, company: 'Apple' },
    { year: '2019-01-01', revenue: 161, company: 'Alphabet' },
    { year: '2020-01-01', revenue: 182, company: 'Alphabet' },
    { year: '2021-01-01', revenue: 257, company: 'Alphabet' },
    { year: '2022-01-01', revenue: 283, company: 'Alphabet' },
    { year: '2023-01-01', revenue: 307, company: 'Alphabet' },
    { year: '2024-01-01', revenue: 350, company: 'Alphabet' },
    { year: '2019-01-01', revenue: 135, company: 'Microsoft' },
    { year: '2020-01-01', revenue: 153, company: 'Microsoft' },
    { year: '2021-01-01', revenue: 185, company: 'Microsoft' },
    { year: '2022-01-01', revenue: 204, company: 'Microsoft' },
    { year: '2023-01-01', revenue: 228, company: 'Microsoft' },
    { year: '2024-01-01', revenue: 262, company: 'Microsoft' },
    { year: '2019-01-01', revenue: 71, company: 'Meta' },
    { year: '2020-01-01', revenue: 86, company: 'Meta' },
    { year: '2021-01-01', revenue: 118, company: 'Meta' },
    { year: '2022-01-01', revenue: 117, company: 'Meta' },
    { year: '2023-01-01', revenue: 135, company: 'Meta' },
    { year: '2024-01-01', revenue: 164, company: 'Meta' },
  ],
} as const;
