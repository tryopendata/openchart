/**
 * Global smartphone market share by vendor, Q4 2024 (% of shipments).
 *
 * Editorial data carried over from the existing story files with its original
 * citation (IDC Worldwide Quarterly Mobile Phone Tracker). Directionally
 * consistent with public IDC tracker headlines (Apple edging Samsung, Chinese
 * vendors clustered mid-pack), but the exact per-vendor shares were not
 * re-derived from the OpenData MCP, so the original compiled citation is
 * retained rather than re-attributed.
 */
export const smartphoneShare = {
  source: 'Source: IDC Worldwide Quarterly Mobile Phone Tracker',
  data: [
    { brand: 'Apple', share: 23.0 },
    { brand: 'Samsung', share: 16.0 },
    { brand: 'Xiaomi', share: 14.0 },
    { brand: 'Transsion', share: 9.0 },
    { brand: 'vivo', share: 8.5 },
    { brand: 'OPPO', share: 8.0 },
    { brand: 'Others', share: 21.5 },
  ],
} as const;
