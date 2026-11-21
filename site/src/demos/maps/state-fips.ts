/**
 * Joins state datasets keyed by two-letter postal code to the us-atlas
 * geography, whose features are keyed by two-digit FIPS code. The map demos use
 * it to draw a verified state dataset on the state shapes.
 */

/** Two-digit FIPS code for each state and DC, by postal code. */
export const FIPS_BY_STATE: Readonly<Record<string, string>> = {
  AL: "01",
  AK: "02",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  HI: "15",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56",
};

/**
 * One row per state, `{ id: <FIPS>, [field]: value }`, sorted by FIPS code.
 *
 * @throws {RangeError} When a postal code has no FIPS code in the table.
 */
export function rowsByFips(
  values: Readonly<Record<string, number>>,
  field: string,
): Record<string, string | number>[] {
  return Object.entries(values)
    .map(([state, value]) => {
      const id = FIPS_BY_STATE[state];
      if (!id) throw new RangeError(`State code "${state}" has no FIPS code in FIPS_BY_STATE.`);
      return { id, [field]: value };
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
