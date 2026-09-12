/**
 * Testing / Fixtures: distribution marks pinned e2e stories.
 *
 * Histogram and density over the same donation dataset, pinned by the
 * Playwright visual suite. Do not restyle: this content is a pixel-baseline
 * contract.
 *
 * Data: 440 synthetic contributions in two populations — a long-tailed
 * grassroots distribution with a mode near $60 and a mid-tier bell around
 * $620, chosen so the two overlap and the translucent fill is what the
 * baseline pins. A
 * seeded PRNG produced the draws, then they were frozen to static arrays so
 * the module carries no runtime randomness.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// Frozen dataset: contribution amounts, in dollars
// ---------------------------------------------------------------------------

const GRASSROOTS: number[] = [
  353, 650, 56, 51, 20, 267, 97, 98, 603, 118, 50, 418, 69, 93, 207, 24, 151, 287, 40, 680, 89, 710,
  334, 84, 355, 356, 31, 590, 544, 592, 236, 320, 322, 407, 528, 279, 318, 644, 446, 74, 54, 470,
  353, 465, 157, 296, 594, 54, 38, 53, 22, 432, 644, 95, 463, 575, 99, 506, 113, 496, 143, 510, 20,
  248, 88, 648, 295, 20, 28, 20, 467, 220, 70, 84, 30, 161, 35, 376, 609, 280, 83, 26, 223, 193,
  435, 159, 72, 115, 72, 85, 134, 46, 21, 612, 82, 235, 29, 89, 23, 106, 218, 103, 59, 21, 134, 157,
  55, 459, 154, 24, 291, 24, 109, 710, 400, 167, 21, 28, 573, 40, 556, 48, 149, 111, 255, 106, 620,
  60, 344, 479, 313, 599, 202, 29, 20, 451, 35, 47, 405, 119, 22, 136, 28, 553, 389, 109, 309, 388,
  98, 403, 31, 137, 45, 20, 520, 259, 48, 386, 679, 76, 103, 37, 115, 378, 378, 72, 480, 20, 421,
  37, 62, 600, 230, 34, 253, 209, 376, 130, 328, 238, 525, 216, 20, 91, 482, 301, 21, 92, 23, 31,
  116, 26, 434, 109, 22, 447, 24, 44, 380, 43, 197, 442, 67, 23, 96, 117, 511, 46, 329, 257, 37, 53,
  284, 50, 23, 83, 409, 59, 480, 103, 21, 273, 174, 316, 456, 27, 638, 352, 103, 422, 555, 456, 21,
  51, 178, 246, 67, 121, 71, 79, 103, 111, 268, 29, 96, 290, 524, 312, 162, 201, 57, 178, 30, 63,
  309, 660, 20, 86, 234, 29,
];

const MID_TIER: number[] = [
  661, 806, 253, 564, 931, 725, 678, 698, 596, 468, 170, 387, 425, 582, 242, 545, 302, 897, 701,
  657, 375, 737, 716, 499, 540, 943, 478, 180, 672, 371, 906, 857, 569, 883, 268, 312, 500, 663,
  698, 624, 723, 468, 591, 963, 726, 662, 325, 770, 721, 621, 407, 1016, 330, 692, 974, 262, 1056,
  636, 464, 434, 295, 442, 465, 841, 291, 888, 823, 536, 288, 759, 563, 771, 945, 510, 486, 665,
  510, 849, 803, 232, 760, 465, 1016, 435, 882, 640, 1088, 422, 732, 769, 654, 813, 552, 546, 776,
  337, 691, 349, 240, 618, 445, 703, 502, 623, 384, 866, 425, 618, 887, 659, 569, 620, 811, 530,
  733, 311, 551, 596, 438, 370, 408, 531, 749, 751, 640, 672, 488, 660, 577, 719, 671, 921, 256,
  875, 914, 650, 659, 689, 514, 481, 506, 396, 551, 701, 475, 738, 660, 514, 703, 276, 407, 711,
  900, 1008, 338, 255, 462, 745, 173, 532, 425, 507, 699, 468, 548, 613, 339, 440, 972, 545, 510,
  271, 903, 910, 714, 907, 931, 971, 791, 517,
];

const donations = [
  ...GRASSROOTS.map((amount) => ({ amount, candidate: 'Grassroots' })),
  ...MID_TIER.map((amount) => ({ amount, candidate: 'Mid-tier' })),
];

// ---------------------------------------------------------------------------
// Overlapping histogram
// ---------------------------------------------------------------------------

const histogramSpec: ChartSpec = {
  animation: false,
  mark: { type: 'histogram', binCount: 24 },
  data: donations,
  encoding: {
    x: { field: 'amount', type: 'quantitative', axis: { title: 'Contribution ($)' } },
    color: { field: 'candidate', type: 'nominal' },
  },
  chrome: {
    title: 'Two Donor Bases, One Axis',
    subtitle: 'Contributions binned on a continuous scale; groups overlap rather than dodge.',
    source: 'Illustrative data',
  },
} as ChartSpec;

export const DistributionHistogram = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={histogramSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Overlapping density curves
// ---------------------------------------------------------------------------

const densitySpec: ChartSpec = {
  animation: false,
  mark: { type: 'density' },
  data: donations,
  encoding: {
    x: { field: 'amount', type: 'quantitative', axis: { title: 'Contribution ($)' } },
    color: { field: 'candidate', type: 'nominal' },
  },
  chrome: {
    title: 'The Same Two Distributions, Smoothed',
    subtitle: 'Gaussian kernel density estimate, Silverman bandwidth.',
    source: 'Illustrative data',
  },
} as ChartSpec;

export const DistributionDensity = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={densitySpec} />
  </div>
);
