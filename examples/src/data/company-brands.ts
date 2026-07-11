/**
 * Big-tech FY2024 revenue with inline monogram logos and quarterly series.
 *
 * The image-cell demo needs an image URL per row. To keep rendering
 * deterministic (no network fetch, so the visual suite stays stable) the
 * `logo` field is a self-contained data-URI SVG monogram rather than a remote
 * asset. Revenue figures carry over the SEC-filing citation from the
 * `bigTechRevenue` chart dataset (FY2024 totals, $B); `quarterly` is an
 * illustrative quarter split summing near the annual total, used for the
 * column-sparkline cell.
 */

/** Build a rounded-square monogram logo as a self-contained data-URI SVG. */
function monogram(letter: string, bg: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
    `<rect width="40" height="40" rx="9" fill="${bg}"/>` +
    `<text x="20" y="27" font-family="Inter, system-ui, sans-serif" font-size="22" ` +
    `font-weight="700" fill="#ffffff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const companyBrands = {
  source: 'Source: Company annual reports (SEC 10-K filings); quarterly split illustrative',
  url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany',
  data: [
    {
      company: 'Amazon',
      logo: monogram('A', '#ff9900'),
      revenue: 638,
      quarterly: [143, 148, 159, 188],
    },
    {
      company: 'Apple',
      logo: monogram('A', '#111827'),
      revenue: 391,
      quarterly: [90, 86, 95, 120],
    },
    {
      company: 'Alphabet',
      logo: monogram('G', '#4285f4'),
      revenue: 350,
      quarterly: [80, 85, 88, 97],
    },
    {
      company: 'Microsoft',
      logo: monogram('M', '#0078d4'),
      revenue: 245,
      quarterly: [57, 62, 62, 64],
    },
    { company: 'Meta', logo: monogram('M', '#0866ff'), revenue: 164, quarterly: [36, 39, 41, 48] },
  ],
} as const;
