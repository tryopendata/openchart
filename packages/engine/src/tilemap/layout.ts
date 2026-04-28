/**
 * US state tile grid layout computation.
 *
 * Defines the fixed grid positions for US state tiles (11 columns x 8 rows)
 * and computes pixel positions from a given available area.
 */

export const US_STATE_TILES: Array<{ state: string; col: number; row: number }> = [
  // Row 1
  { state: 'VT', col: 8, row: 1 },
  { state: 'NH', col: 9, row: 1 },
  { state: 'ME', col: 10, row: 1 },

  // Row 2
  { state: 'WA', col: 0, row: 2 },
  { state: 'ID', col: 1, row: 2 },
  { state: 'MT', col: 2, row: 2 },
  { state: 'ND', col: 3, row: 2 },
  { state: 'MN', col: 4, row: 2 },
  { state: 'WI', col: 5, row: 2 },
  { state: 'MI', col: 6, row: 2 },
  { state: 'NY', col: 8, row: 2 },
  { state: 'MA', col: 9, row: 2 },

  // Row 3
  { state: 'OR', col: 0, row: 3 },
  { state: 'NV', col: 1, row: 3 },
  { state: 'WY', col: 2, row: 3 },
  { state: 'SD', col: 3, row: 3 },
  { state: 'IA', col: 4, row: 3 },
  { state: 'IL', col: 5, row: 3 },
  { state: 'IN', col: 6, row: 3 },
  { state: 'OH', col: 7, row: 3 },
  { state: 'PA', col: 8, row: 3 },
  { state: 'NJ', col: 9, row: 3 },
  { state: 'CT', col: 10, row: 3 },

  // Row 4
  { state: 'CA', col: 0, row: 4 },
  { state: 'UT', col: 1, row: 4 },
  { state: 'CO', col: 2, row: 4 },
  { state: 'NE', col: 3, row: 4 },
  { state: 'MO', col: 4, row: 4 },
  { state: 'KY', col: 5, row: 4 },
  { state: 'WV', col: 6, row: 4 },
  { state: 'VA', col: 7, row: 4 },
  { state: 'MD', col: 8, row: 4 },
  { state: 'DE', col: 9, row: 4 },
  { state: 'RI', col: 10, row: 4 },

  // Row 5
  { state: 'AZ', col: 1, row: 5 },
  { state: 'NM', col: 2, row: 5 },
  { state: 'KS', col: 3, row: 5 },
  { state: 'AR', col: 4, row: 5 },
  { state: 'TN', col: 5, row: 5 },
  { state: 'NC', col: 6, row: 5 },
  { state: 'SC', col: 7, row: 5 },
  { state: 'DC', col: 8, row: 5 },

  // Row 6
  { state: 'AK', col: 0, row: 6 },
  { state: 'OK', col: 3, row: 6 },
  { state: 'LA', col: 4, row: 6 },
  { state: 'MS', col: 5, row: 6 },
  { state: 'AL', col: 6, row: 6 },
  { state: 'GA', col: 7, row: 6 },

  // Row 7
  { state: 'HI', col: 1, row: 7 },
  { state: 'TX', col: 3, row: 7 },
  { state: 'FL', col: 7, row: 7 },
];

export const STATE_CODE_SET = new Set(US_STATE_TILES.map((t) => t.state));

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

const GRID_COLS = 11;
const GRID_ROWS = 8;

export interface TilePositions {
  tileSize: number;
  gap: number;
  positions: Map<string, { x: number; y: number }>;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Compute pixel positions for all US state tiles.
 *
 * Calculates the largest tile size that fits the available area,
 * preserving the grid's aspect ratio and returning a map of
 * state codes to pixel coordinates.
 */
export function computeTilePositions(
  availableWidth: number,
  availableHeight: number,
  gap = 4,
): TilePositions {
  const maxTileW = (availableWidth - gap * (GRID_COLS - 1)) / GRID_COLS;
  const maxTileH = (availableHeight - gap * (GRID_ROWS - 1)) / GRID_ROWS;
  const tileSize = Math.max(1, Math.floor(Math.min(maxTileW, maxTileH)));

  const gridWidth = tileSize * GRID_COLS + gap * (GRID_COLS - 1);
  const gridHeight = tileSize * GRID_ROWS + gap * (GRID_ROWS - 1);

  const positions = new Map<string, { x: number; y: number }>();
  for (const { state, col, row } of US_STATE_TILES) {
    positions.set(state, {
      x: col * (tileSize + gap),
      y: row * (tileSize + gap),
    });
  }

  return { tileSize, gap, positions, gridWidth, gridHeight };
}
