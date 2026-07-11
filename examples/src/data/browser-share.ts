/**
 * Global browser market share (desktop + mobile), January 2024 (% of page views).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (StatCounter Global Stats). Directionally consistent with public
 * StatCounter figures (Chrome near two-thirds, Safari a distant second), but the
 * exact shares were not re-derived from the OpenData MCP, so the original
 * compiled citation is retained rather than re-attributed.
 */
export const browserShare = {
  source: 'Source: StatCounter Global Stats',
  url: 'https://gs.statcounter.com/',
  data: [
    { browser: 'Chrome', share: 63.6 },
    { browser: 'Safari', share: 19.8 },
    { browser: 'Edge', share: 5.3 },
    { browser: 'Firefox', share: 2.9 },
    { browser: 'Samsung Internet', share: 2.6 },
    { browser: 'Opera', share: 2.4 },
    { browser: 'Others', share: 3.4 },
  ],
} as const;
