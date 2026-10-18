import type { GeometryValue } from './parity-signature';

/** Approved pre-RFC v9 fixes, verified against source commit 93112314.
 * The released v8 capture stays unchanged. Only these exact before/after
 * path values are exempted; no fixture or geometry category is exempted. */
export const APPROVED_PRE_RFC_LAYOUT: Record<
  string,
  {
    reason: string;
    changes: Record<string, Record<string, [GeometryValue | undefined, GeometryValue | undefined]>>;
  }
> = {
  '../charts/mobile-regression.stories.tsx.inlineYTitleSpec @390': {
    reason:
      '93112314 frame: point-scale x labels reserve their actual flat extent; source numeric domain unchanged.',
    changes: {
      area: {
        'rect.height': [118.68, 148.65],
      },
      chrome: {
        bottomAnchorY: [314.43, 344.4],
      },
      axes: {
        'x.end.y': [279.43, 309.4],
        'x.start.y': [279.43, 309.4],
        'y.end.y': [279.43, 309.4],
        'y.tick.0.position': [279.43, 309.4],
        'y.tick.1.position': [239.87, 259.85],
        'y.tick.2.position': [200.31, 210.3],
        'y.titlePosition.y': [220.09, 235.08],
      },
      marks: {
        '0.height': [49.45, 61.94],
        '0.y': [180.53, 185.52],
        '1.cy': [196.35, 205.34],
        '2.cy': [190.42, 197.91],
        '3.cy': [204.27, 215.26],
        '4.cy': [186.46, 192.96],
        '5.cy': [180.53, 185.52],
        '6.cy': [229.98, 247.46],
      },
    },
  },
  '../gallery/charts-bar-column.stories.tsx.columnsSpec @390': {
    reason:
      'Pre-RFC v9 mark-anchor correction places annotation connector tails on compiled column bounds.',
    changes: {
      annotations: {
        'a0.connector.to.y': [241.28, 226.03],
      },
    },
  },
  '../gallery/charts-bar-column.stories.tsx.columnsSpec @1280': {
    reason:
      'Pre-RFC v9 mark-anchor correction places annotation connector tails on compiled column bounds.',
    changes: {
      annotations: {
        'a0.connector.to.y': [249.59, 234.34],
      },
    },
  },
  '../gallery/charts-building-blocks.stories.tsx.directLabelSpec @1280': {
    reason:
      'Pre-RFC v9 shared field precision removes redundant trailing zeroes from numeric axis ticks.',
    changes: {
      axes: {
        'x.tick.1.label': ['1.50', '1.5'],
        'x.tick.3.label': ['2.50', '2.5'],
        'x.tick.5.label': ['3.50', '3.5'],
      },
    },
  },
  '../gallery/charts-building-blocks.stories.tsx.scatterLayer @1280': {
    reason:
      'Pre-RFC v9 shared field precision removes redundant trailing zeroes from numeric axis ticks.',
    changes: {
      axes: {
        'x.tick.1.label': ['1.50', '1.5'],
        'x.tick.3.label': ['2.50', '2.5'],
        'x.tick.5.label': ['3.50', '3.5'],
      },
    },
  },
  '../gallery/charts-building-blocks.stories.tsx.labelLayer @1280': {
    reason:
      'Pre-RFC v9 shared field precision removes redundant trailing zeroes from numeric axis ticks.',
    changes: {
      axes: {
        'x.tick.1.label': ['1.50', '1.5'],
        'x.tick.3.label': ['2.50', '2.5'],
        'x.tick.5.label': ['3.50', '3.5'],
      },
    },
  },
  '../gallery/charts-building-blocks.stories.tsx.composedSpecForPanel @1280': {
    reason:
      'Pre-RFC v9 shared field precision removes redundant trailing zeroes from numeric axis ticks.',
    changes: {
      axes: {
        'x.tick.1.label': ['1.50', '1.5'],
        'x.tick.3.label': ['2.50', '2.5'],
        'x.tick.5.label': ['3.50', '3.5'],
      },
    },
  },
  '../testing/fixtures-misc.stories.tsx.textMarkLabelSpec @1280': {
    reason:
      'Pre-RFC v9 shared field precision removes redundant trailing zeroes from numeric axis ticks.',
    changes: {
      axes: {
        'x.tick.1.label': ['1.50', '1.5'],
        'x.tick.3.label': ['2.50', '2.5'],
        'x.tick.5.label': ['3.50', '3.5'],
      },
    },
  },
  '../gallery/charts-building-blocks.stories.tsx.dualAxisSpec @390': {
    reason:
      '93112314 shared figure frame aligns independent-axis marks and y2 ticks to the same plot.',
    changes: {
      axes: {
        'y2.tick.0.position': [271.97, 283.66],
        'y2.tick.1.position': [232.2, 240.24],
        'y2.tick.2.position': [192.42, 196.81],
        'y2.tick.3.position': [152.65, 153.39],
      },
      marks: {
        '11.height': [96.24, 105.09],
        '11.y': [173.33, 175.97],
        '12.cy': [182.88, 186.39],
        '13.cy': [173.33, 175.97],
        '14.cy': [180.49, 183.78],
        '15.cy': [190.04, 194.2],
        '16.cy': [201.17, 206.36],
        '17.cy': [215.49, 222],
        '18.cy': [229.01, 236.76],
        '19.cy': [238.56, 247.18],
        '20.cy': [249.69, 259.34],
        '21.cy': [259.24, 269.76],
        '22.cy': [269.58, 281.05],
      },
    },
  },
  '../testing/fixtures-dual-axis.stories.tsx.dualAxisSpec @390': {
    reason:
      '93112314 shared figure frame aligns independent-axis marks and y2 ticks to the same plot.',
    changes: {
      axes: {
        'y2.tick.0.position': [271.97, 283.66],
        'y2.tick.1.position': [232.2, 240.24],
        'y2.tick.2.position': [192.42, 196.81],
        'y2.tick.3.position': [152.65, 153.39],
      },
      marks: {
        '11.height': [96.24, 105.09],
        '11.y': [173.33, 175.97],
        '12.cy': [182.88, 186.39],
        '13.cy': [173.33, 175.97],
        '14.cy': [180.49, 183.78],
        '15.cy': [190.04, 194.2],
        '16.cy': [201.17, 206.36],
        '17.cy': [215.49, 222],
        '18.cy': [229.01, 236.76],
        '19.cy': [238.56, 247.18],
        '20.cy': [249.69, 259.34],
        '21.cy': [259.24, 269.76],
        '22.cy': [269.58, 281.05],
      },
    },
  },
  '../gallery/charts-building-blocks.stories.tsx.spanSpec @390': {
    reason: '93112314 frame: point-scale x labels reserve their actual flat extent.',
    changes: {
      area: {
        'rect.height': [143.68, 158.3],
      },
      chrome: {
        bottomAnchorY: [297.38, 312],
      },
      axes: {
        'x.end.y': [271.38, 286],
        'x.start.y': [271.38, 286],
        'y.end.y': [271.38, 286],
        'y.tick.0.position': [271.38, 286],
        'y.tick.1.position': [241.45, 253.02],
        'y.tick.2.position': [211.51, 220.04],
        'y.tick.3.position': [181.58, 187.06],
        'y.tick.4.position': [151.65, 154.08],
        'y.titlePosition.y': [199.54, 206.85],
      },
      marks: {
        '0.y1': [250.43, 262.91],
        '0.y2': [215.71, 224.66],
        '1.y1': [265.99, 280.06],
        '1.y2': [216.3, 225.32],
        '10.y1': [244.44, 256.32],
        '10.y2': [200.74, 208.17],
        '11.y1': [246.24, 258.3],
        '11.y2': [212.71, 221.36],
        '2.y1': [252.22, 264.89],
        '2.y2': [206.73, 214.77],
        '3.y1': [215.11, 224],
        '3.y2': [157.63, 160.68],
        '4.y1': [199.54, 206.85],
        '4.y2': [139.07, 140.23],
        '5.y1': [170.8, 175.19],
        '5.y2': [119.32, 118.47],
        '6.y1': [139.07, 140.23],
        '6.y2': [90.58, 86.81],
        '7.y1': [150.45, 152.76],
        '7.y2': [106.15, 103.95],
        '8.y1': [167.81, 171.89],
        '8.y2': [125.9, 125.72],
        '9.y1': [197.15, 204.21],
        '9.y2': [155.84, 158.7],
      },
    },
  },
  '../gallery/dashboards.layouts.tsx.funnelConversionSpec @390': {
    reason: '93112314 frame: point-scale x labels reserve their actual flat extent.',
    changes: {
      area: {
        'rect.height': [265.93, 280.55],
      },
      chrome: {
        bottomAnchorY: [369.38, 384],
      },
      axes: {
        'x.end.y': [343.38, 358],
        'x.start.y': [343.38, 358],
        'y.end.y': [343.38, 358],
        'y.tick.0.position': [318.06, 331.28],
        'y.tick.1.position': [254.74, 264.48],
        'y.tick.2.position': [191.42, 197.69],
        'y.tick.3.position': [128.1, 130.89],
      },
      marks: {
        '0.height': [22.79, 24.05],
        '0.y': [319.32, 332.62],
        '1.height': [70.92, 74.81],
        '1.y': [86.31, 86.8],
      },
    },
  },
  '../gallery/features-animation.stories.tsx.annotationDelaySpec @390': {
    reason: 'Pre-RFC approved UTC scale for date-only fields fixes tick identity and position.',
    changes: {
      axes: {
        'x.tick.0.label': ['2024', 'Jul 2023'],
        'x.tick.0.position': [170.74, 58],
        'x.tick.1.label': [undefined, 'Apr 2024'],
        'x.tick.1.position': [undefined, 226.5],
        'x.tick.2.label': [undefined, 'Oct 2024'],
        'x.tick.2.position': [undefined, 338.62],
      },
    },
  },
  '../testing/fixtures-bars.stories.tsx.simpleColumnSpec @390': {
    reason:
      'Pre-RFC v9 mark-anchor correction places annotation connector tails on compiled column bounds.',
    changes: {
      annotations: {
        'a0.connector.to.x': [302.35, 297.3],
        'a0.connector.to.y': [242.27, 233.29],
      },
    },
  },
  '../testing/fixtures-bars.stories.tsx.simpleColumnSpec @1280': {
    reason:
      'Pre-RFC v9 mark-anchor correction places annotation connector tails on compiled column bounds.',
    changes: {
      annotations: {
        'a0.connector.to.x': [1000.47, 994.45],
        'a0.connector.to.y': [250.12, 234.64],
      },
    },
  },
  '../testing/fixtures-bars.stories.tsx.simpleBarSpec @390': {
    reason:
      'Pre-RFC v9 mark-anchor correction places annotation connector tails on compiled horizontal bar bounds.',
    changes: {
      annotations: {
        'a0.connector.to.x': [368.85, 353.04],
        'a0.connector.to.y': [209.99, 203.38],
        'a1.connector.to.x': [363.6, 345.93],
        'a1.connector.to.y': [204.53, 198.95],
      },
    },
  },
  '../testing/fixtures-bars.stories.tsx.simpleBarSpec @1280': {
    reason:
      'Pre-RFC v9 mark-anchor correction places annotation connector tails on compiled horizontal bar bounds.',
    changes: {
      annotations: {
        'a0.connector.to.x': [1251.32, 1246.65],
        'a0.connector.to.y': [199.12, 194.79],
        'a1.connector.to.x': [1225.31, 1207.65],
        'a1.connector.to.y': [189.86, 184.24],
      },
    },
  },
  '../testing/fixtures-bars.stories.tsx.tempSpec @390': {
    reason:
      'Pre-RFC v9 shared field precision changes tick strings/gutters; existing D14 annotation placement remains separately allowlisted.',
    changes: {
      area: {
        'rect.width': [317.76, 323.88],
        'rect.x': [58.24, 52.12],
      },
      axes: {
        'x.start.x': [58.24, 52.12],
        'x.tick.0.position': [72.17, 66.33],
        'x.tick.1.position': [94.47, 89.05],
        'x.tick.10.position': [295.17, 293.61],
        'x.tick.11.position': [317.46, 316.34],
        'x.tick.12.position': [339.76, 339.07],
        'x.tick.13.position': [362.06, 361.79],
        'x.tick.2.position': [116.77, 111.78],
        'x.tick.3.position': [139.07, 134.51],
        'x.tick.4.position': [161.37, 157.24],
        'x.tick.5.position': [183.67, 179.97],
        'x.tick.6.position': [205.97, 202.7],
        'x.tick.7.position': [228.27, 225.42],
        'x.tick.8.position': [250.57, 248.15],
        'x.tick.9.position': [272.87, 270.88],
        'y.end.x': [58.24, 52.12],
        'y.start.x': [58.24, 52.12],
        'y.tick.0.label': ['\u22120.50', '\u22120.5'],
        'y.tick.2.label': ['0.50', '0.5'],
      },
      marks: {
        '0.width': [16.72, 17.05],
        '0.x': [63.81, 57.8],
        '1.width': [16.72, 17.05],
        '1.x': [86.11, 80.53],
        '10.width': [16.72, 17.05],
        '10.x': [286.8, 285.09],
        '11.width': [16.72, 17.05],
        '11.x': [309.1, 307.81],
        '12.width': [16.72, 17.05],
        '12.x': [331.4, 330.54],
        '13.width': [16.72, 17.05],
        '13.x': [353.7, 353.27],
        '2.width': [16.72, 17.05],
        '2.x': [108.41, 103.26],
        '3.width': [16.72, 17.05],
        '3.x': [130.71, 125.99],
        '4.width': [16.72, 17.05],
        '4.x': [153.01, 148.72],
        '5.width': [16.72, 17.05],
        '5.x': [175.31, 171.44],
        '6.width': [16.72, 17.05],
        '6.x': [197.61, 194.17],
        '7.width': [16.72, 17.05],
        '7.x': [219.91, 216.9],
        '8.width': [16.72, 17.05],
        '8.x': [242.2, 239.63],
        '9.width': [16.72, 17.05],
        '9.x': [264.5, 262.36],
      },
      annotations: {
        'a0.connector.from.x': [156.27, 150.85],
        'a0.connector.to.x': [102.22, 96.8],
        'a0.dot.x': [94.47, 89.05],
        'a0.label.x': [164.27, 158.85],
        'a1.connector.from.x': [162.04, 161.77],
        'a1.connector.to.x': [354.34, 354.07],
        'a1.dot.x': [362.06, 361.79],
        'a1.label.x': [154.06, 153.79],
        'a2.line.start.x': [58.24, 52.12],
      },
      legend: {
        'legends.0.bounds.x': [58.24, 52.12],
        'legends.0.entry.0.x': [58.24, 52.12],
        'legends.0.entry.1.x': [118.63, 112.52],
      },
    },
  },
  '../testing/fixtures-bars.stories.tsx.tempSpec @1280': {
    reason:
      'Pre-RFC v9 shared field precision changes tick strings/gutters; existing D14 annotation placement remains separately allowlisted.',
    changes: {
      axes: {
        'y.tick.0.label': ['\u22120.50', '\u22120.5'],
        'y.tick.2.label': ['0.50', '0.5'],
      },
      annotations: {
        'a0.connector.from.x': [291.2, 208.02],
        'a0.connector.from.y': [197.88, 180.6],
        'a0.connector.to.x': [214.85, 208.02],
        'a0.connector.to.y': [238.74, 234.65],
        'a0.label.x': [257.37, 133.59],
        'a0.label.y': [172.24, 151.8],
      },
    },
  },
  '../testing/fixtures-refresh.stories.tsx.flatColumnsSpec @1280': {
    reason: 'Pre-RFC v9 shared field precision changes tick strings and measured y-label gutter.',
    changes: {
      axes: {
        'y.tick.1.label': ['0.50', '0.5'],
        'y.tick.3.label': ['1.50', '1.5'],
      },
    },
  },
  '../testing/fixtures-misc.stories.tsx.rotatedSpec @1280': {
    reason:
      '93112314 frame reserves actual rotated categorical labels, keeping footer within the fixed figure.',
    changes: {
      area: {
        'rect.height': [229.2, 156.86],
      },
      chrome: {
        bottomAnchorY: [414.74, 342.4],
      },
      axes: {
        'x.end.y': [316.4, 244.06],
        'x.start.y': [316.4, 244.06],
        'y.end.y': [316.4, 244.06],
        'y.gridlines': [8, 4],
        'y.tick.0.position': [316.4, 244.06],
        'y.tick.1.label': ['5', '10'],
        'y.tick.1.position': [283.66, 199.24],
        'y.tick.2.label': ['10', '20'],
        'y.tick.2.position': [250.91, 154.42],
        'y.tick.3.label': ['15', '30'],
        'y.tick.3.position': [218.17, 109.61],
        'y.tick.4.label': ['20', undefined],
        'y.tick.4.position': [185.43, undefined],
        'y.tick.5.label': ['25', undefined],
        'y.tick.5.position': [152.69, undefined],
        'y.tick.6.label': ['30', undefined],
        'y.tick.6.position': [119.94, undefined],
        'y.tick.7.label': ['35', undefined],
        'y.tick.7.position': [87.2, undefined],
        'y.titlePosition.y': [201.8, 165.63],
      },
      marks: {
        '0.height': [212.17, 145.2],
        '0.y': [104.23, 98.85],
        '1.height': [85.79, 58.71],
        '1.y': [230.61, 185.35],
        '2.height': [83.82, 57.36],
        '2.y': [232.58, 186.69],
        '3.height': [68.76, 47.06],
        '3.y': [247.64, 197],
        '4.height': [58.28, 39.89],
        '4.y': [258.12, 204.17],
        '5.height': [55.01, 37.65],
        '5.y': [261.39, 206.41],
      },
      labels: {
        '0.label.y': [92.23, 86.85],
        '1.label.y': [218.61, 173.35],
        '2.label.y': [220.58, 174.69],
        '3.label.y': [235.64, 185],
        '4.label.y': [246.12, 192.17],
        '5.label.y': [249.39, 194.41],
      },
    },
  },
  '../testing/fixtures-refresh.stories.tsx.flatColumnsSpec @390': {
    reason: 'Pre-RFC v9 shared field precision changes tick strings and measured y-label gutter.',
    changes: {
      area: {
        'rect.width': [323.59, 326],
        'rect.x': [52.41, 50],
      },
      axes: {
        'x.start.x': [52.41, 50],
        'x.tick.0.position': [76.92, 74.7],
        'x.tick.1.position': [116.14, 114.21],
        'x.tick.2.position': [155.37, 153.73],
        'x.tick.3.position': [194.59, 193.24],
        'x.tick.4.position': [233.81, 232.76],
        'x.tick.5.position': [273.04, 272.27],
        'x.tick.6.position': [312.26, 311.79],
        'x.tick.7.position': [351.49, 351.3],
        'y.end.x': [52.41, 50],
        'y.start.x': [52.41, 50],
        'y.tick.1.label': ['0.50', '0.5'],
        'y.tick.3.label': ['1.50', '1.5'],
      },
      marks: {
        '0.width': [29.42, 29.64],
        '0.x': [62.21, 59.88],
        '1.width': [29.42, 29.64],
        '1.x': [101.44, 99.39],
        '2.width': [29.42, 29.64],
        '2.x': [140.66, 138.91],
        '3.width': [29.42, 29.64],
        '3.x': [179.88, 178.42],
        '4.width': [29.42, 29.64],
        '4.x': [219.11, 217.94],
        '5.width': [29.42, 29.64],
        '5.x': [258.33, 257.45],
        '6.width': [29.42, 29.64],
        '6.x': [297.55, 296.97],
        '7.width': [29.42, 29.64],
        '7.x': [336.78, 336.48],
      },
      labels: {
        '0.label.x': [76.92, 74.7],
        '1.label.x': [116.14, 114.21],
        '2.label.x': [155.37, 153.73],
        '3.label.x': [194.59, 193.24],
        '4.label.x': [233.81, 232.76],
        '5.label.x': [273.04, 272.27],
        '6.label.x': [312.26, 311.79],
        '7.label.x': [351.49, 351.3],
      },
    },
  },
};

/** B1 endpoint correctness: reserve the 18px painted gap (formerly 16px),
 * measure every displayed string and apply shared precision without losing
 * compact magnitude formatting. Exact released-v8/current values only. */
export const APPROVED_RFC_B1_LAYOUT: typeof APPROVED_PRE_RFC_LAYOUT = {
  '../charts/mobile-regression.stories.tsx.autoHeightChromeGrowthSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1094.18, 1092.18],
      },
      axes: {
        'x.end.x': [1138.18, 1136.18],
        'x.tick.1.position': [284.44, 284.04],
        'x.tick.2.position': [497.87, 497.07],
        'x.tick.3.position': [711.31, 710.11],
        'x.tick.4.position': [924.74, 923.14],
        'x.tick.5.position': [1138.18, 1136.18],
      },
      marks: {
        '0.width': [1067.18, 1065.18],
        '10.cx': [497.87, 497.07],
        '11.cx': [711.31, 710.11],
        '12.cx': [924.74, 923.14],
        '13.cx': [1138.18, 1136.18],
        '14.width': [1067.18, 1065.18],
        '16.cx': [284.44, 284.04],
        '17.cx': [497.87, 497.07],
        '18.cx': [711.31, 710.11],
        '19.cx': [924.74, 923.14],
        '2.cx': [284.44, 284.04],
        '20.cx': [1138.18, 1136.18],
        '3.cx': [497.87, 497.07],
        '4.cx': [711.31, 710.11],
        '5.cx': [924.74, 923.14],
        '6.cx': [1138.18, 1136.18],
        '7.width': [1067.18, 1065.18],
        '9.cx': [284.44, 284.04],
      },
      endpointLabels: {
        'bounds.x': [1156.18, 1154.18],
      },
    },
  },
  '../gallery/charts-line-area.stories.tsx.multiSeriesSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1085.06, 1083.06],
      },
      axes: {
        'x.end.x': [1129.06, 1127.06],
        'x.tick.1.position': [419.52, 418.86],
        'x.tick.2.position': [774.53, 773.2],
        'x.tick.3.position': [1129.06, 1127.06],
      },
      marks: {
        '0.width': [1064.06, 1062.06],
        '1.width': [1064.06, 1062.06],
        '2.width': [1064.06, 1062.06],
      },
      annotations: {
        'a0.line.end.x': [1129.06, 1127.06],
        'a1.label.x': [426.81, 426.13],
        'a1.rect.width': [133.07, 132.82],
        'a1.rect.x': [360.28, 359.72],
      },
      endpointLabels: {
        'bounds.x': [1147.06, 1145.06],
      },
    },
  },
  '../gallery/charts-line-area.stories.tsx.interactiveSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1111.64, 1109.64],
      },
      axes: {
        'x.end.x': [1155.64, 1153.64],
        'x.tick.1.position': [287.81, 287.41],
        'x.tick.2.position': [505.21, 504.41],
        'x.tick.3.position': [722.02, 720.82],
        'x.tick.4.position': [938.83, 937.23],
        'x.tick.5.position': [1155.64, 1153.64],
      },
      marks: {
        '0.width': [1084.64, 1082.64],
        '1.width': [1084.64, 1082.64],
        '2.width': [1084.64, 1082.64],
        '3.width': [1084.64, 1082.64],
        '4.width': [1084.64, 1082.64],
      },
      endpointLabels: {
        'bounds.x': [1173.64, 1171.64],
      },
    },
  },
  '../gallery/dashboards.layouts.tsx.marketsCompareSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1088.1, 1086.1],
      },
      axes: {
        'x.end.x': [1132.1, 1130.1],
        'x.tick.1.position': [353.91, 353.38],
        'x.tick.2.position': [636.82, 635.75],
        'x.tick.3.position': [920.5, 918.9],
      },
      marks: {
        '0.width': [1061.1, 1059.1],
        '1.width': [1061.1, 1059.1],
        '2.width': [1061.1, 1059.1],
        '3.width': [1061.1, 1059.1],
      },
      annotations: {
        'a0.label.x': [1128.1, 1126.1],
        'a0.line.end.x': [1132.1, 1130.1],
      },
      endpointLabels: {
        'bounds.x': [1150.1, 1148.1],
      },
    },
  },
  '../gallery/dashboards.stories.tsx.crosshairSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1088.1, 1086.1],
      },
      axes: {
        'x.end.x': [1132.1, 1130.1],
        'x.tick.1.position': [353.91, 353.38],
        'x.tick.2.position': [636.82, 635.75],
        'x.tick.3.position': [920.5, 918.9],
      },
      marks: {
        '0.width': [1061.1, 1059.1],
        '1.width': [1061.1, 1059.1],
        '2.width': [1061.1, 1059.1],
        '3.width': [1061.1, 1059.1],
      },
      annotations: {
        'a0.label.x': [1128.1, 1126.1],
        'a0.line.end.x': [1132.1, 1130.1],
      },
      endpointLabels: {
        'bounds.x': [1150.1, 1148.1],
      },
    },
  },
  '../gallery/dashboards.layouts.tsx.funnelConversionSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1103.37, 1101.37],
      },
      axes: {
        'x.end.x': [1126.37, 1124.37],
        'x.tick.1.position': [346.46, 345.92],
        'x.tick.2.position': [638.93, 637.84],
        'x.tick.3.position': [931.39, 929.76],
      },
      marks: {
        '0.width': [1072.37, 1070.37],
        '1.width': [1072.37, 1070.37],
      },
      endpointLabels: {
        'bounds.x': [1144.37, 1142.37],
      },
    },
  },
  '../gallery/dashboards.layouts.tsx.incidentTtrcSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1113.89, 1111.89],
      },
      axes: {
        'x.end.x': [1157.89, 1155.89],
        'x.tick.1.position': [307.86, 307.42],
        'x.tick.2.position': [550.73, 549.84],
        'x.tick.3.position': [793.59, 792.26],
        'x.tick.4.position': [1036.46, 1034.68],
      },
      marks: {
        '0.width': [1092.89, 1090.89],
        '1.width': [1092.89, 1090.89],
      },
      endpointLabels: {
        'bounds.x': [1175.89, 1173.89],
      },
    },
  },
  '../gallery/features-animation.stories.tsx.lineDrawSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1107.06, 1105.06],
      },
      axes: {
        'x.end.x': [1151.06, 1149.06],
        'x.tick.1.position': [364.39, 363.85],
        'x.tick.2.position': [657.78, 656.69],
        'x.tick.3.position': [954.39, 952.76],
      },
      marks: {
        '0.width': [1080.06, 1078.06],
        '10.cx': [954.39, 952.76],
        '11.cx': [1054.34, 1052.52],
        '12.cx': [1151.06, 1149.06],
        '13.width': [1080.06, 1078.06],
        '15.cx': [170.95, 170.76],
        '16.cx': [264.44, 264.09],
        '17.cx': [364.39, 363.85],
        '18.cx': [461.11, 460.39],
        '19.cx': [561.06, 560.15],
        '2.cx': [170.95, 170.76],
        '20.cx': [657.78, 656.69],
        '21.cx': [757.73, 756.45],
        '22.cx': [857.67, 856.22],
        '23.cx': [954.39, 952.76],
        '24.cx': [1054.34, 1052.52],
        '25.cx': [1151.06, 1149.06],
        '3.cx': [264.44, 264.09],
        '4.cx': [364.39, 363.85],
        '5.cx': [461.11, 460.39],
        '6.cx': [561.06, 560.15],
        '7.cx': [657.78, 656.69],
        '8.cx': [757.73, 756.45],
        '9.cx': [857.67, 856.22],
      },
      endpointLabels: {
        'bounds.x': [1169.06, 1167.06],
      },
    },
  },
  '../gallery/features-responsive.stories.tsx.flagshipSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1085.06, 1083.06],
      },
      axes: {
        'x.end.x': [1129.06, 1127.06],
        'x.tick.1.position': [241.43, 241.1],
        'x.tick.2.position': [418.86, 418.19],
        'x.tick.3.position': [596.77, 595.77],
        'x.tick.4.position': [774.2, 772.87],
        'x.tick.5.position': [951.63, 949.96],
        'x.tick.6.position': [1129.06, 1127.06],
      },
      marks: {
        '0.width': [1065.06, 1063.06],
        '1.width': [1065.06, 1063.06],
        '2.width': [1065.06, 1063.06],
      },
      endpointLabels: {
        'bounds.x': [1147.06, 1145.06],
      },
    },
  },
  '../gallery/features-responsive.stories.tsx.ratioSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1106.06, 1104.06],
      },
      axes: {
        'x.end.x': [1129.06, 1127.06],
        'x.tick.1.position': [223.93, 223.59],
        'x.tick.2.position': [404.85, 404.19],
        'x.tick.3.position': [586.28, 585.28],
        'x.tick.4.position': [767.2, 765.87],
        'x.tick.5.position': [948.13, 946.47],
        'x.tick.6.position': [1129.06, 1127.06],
      },
      marks: {
        '0.width': [1086.06, 1084.06],
        '1.width': [1086.06, 1084.06],
        '2.width': [1086.06, 1084.06],
      },
      endpointLabels: {
        'bounds.x': [1147.06, 1145.06],
      },
    },
  },
  '../gallery/showcase.stories.tsx.multiLineSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1111.64, 1109.64],
      },
      axes: {
        'x.end.x': [1155.64, 1153.64],
        'x.tick.1.position': [287.81, 287.41],
        'x.tick.2.position': [505.21, 504.41],
        'x.tick.3.position': [722.02, 720.82],
        'x.tick.4.position': [938.83, 937.23],
        'x.tick.5.position': [1155.64, 1153.64],
      },
      marks: {
        '0.width': [1084.64, 1082.64],
        '1.width': [1084.64, 1082.64],
        '2.width': [1084.64, 1082.64],
        '3.width': [1084.64, 1082.64],
        '4.width': [1084.64, 1082.64],
      },
      annotations: {
        'a0.dot.x': [505.21, 504.41],
        'a0.label.x': [517.21, 516.41],
      },
      endpointLabels: {
        'bounds.x': [1173.64, 1171.64],
      },
    },
  },
  '../testing/fixtures-lines.stories.tsx.gdpLineSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1085.06, 1083.06],
      },
      axes: {
        'x.end.x': [1129.06, 1127.06],
        'x.tick.1.position': [241.43, 241.1],
        'x.tick.2.position': [418.86, 418.19],
        'x.tick.3.position': [596.77, 595.77],
        'x.tick.4.position': [774.2, 772.87],
        'x.tick.5.position': [951.63, 949.96],
        'x.tick.6.position': [1129.06, 1127.06],
      },
      marks: {
        '0.width': [1065.06, 1063.06],
        '1.width': [1065.06, 1063.06],
        '2.width': [1065.06, 1063.06],
      },
      annotations: {
        'a0.label.x': [500.28, 499.46],
        'a0.rect.width': [162.85, 162.54],
        'a0.rect.x': [418.86, 418.19],
        'a1.line.end.x': [1129.06, 1127.06],
      },
      endpointLabels: {
        'bounds.x': [1147.06, 1145.06],
      },
    },
  },
  '../testing/fixtures-lines.stories.tsx.compactGdpSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1085.06, 1083.06],
      },
      axes: {
        'x.end.x': [1129.06, 1127.06],
        'x.tick.1.position': [241.43, 241.1],
        'x.tick.2.position': [418.86, 418.19],
        'x.tick.3.position': [596.77, 595.77],
        'x.tick.4.position': [774.2, 772.87],
        'x.tick.5.position': [951.63, 949.96],
        'x.tick.6.position': [1129.06, 1127.06],
      },
      marks: {
        '0.width': [1065.06, 1063.06],
        '1.width': [1065.06, 1063.06],
        '2.width': [1065.06, 1063.06],
      },
      annotations: {
        'a0.label.x': [500.28, 499.46],
        'a0.rect.width': [162.85, 162.54],
        'a0.rect.x': [418.86, 418.19],
        'a1.line.end.x': [1129.06, 1127.06],
      },
      endpointLabels: {
        'bounds.x': [1147.06, 1145.06],
      },
    },
  },
  '../testing/fixtures-lines.stories.tsx.fiveSeriesSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1111.64, 1109.64],
      },
      axes: {
        'x.end.x': [1155.64, 1153.64],
        'x.tick.1.position': [259.52, 259.17],
        'x.tick.2.position': [448.56, 447.86],
        'x.tick.3.position': [637.08, 636.03],
        'x.tick.4.position': [825.6, 824.21],
        'x.tick.5.position': [1014.12, 1012.38],
      },
      marks: {
        '0.width': [1084.64, 1082.64],
        '1.width': [1084.64, 1082.64],
        '2.width': [1084.64, 1082.64],
        '3.width': [1084.64, 1082.64],
        '4.width': [1084.64, 1082.64],
      },
      annotations: {
        'a0.connector.from.x': [290.97, 290.36],
        'a0.connector.to.x': [393.38, 392.77],
        'a0.dot.x': [401.04, 400.43],
        'a0.label.x': [283.04, 282.43],
      },
      endpointLabels: {
        'bounds.x': [1173.64, 1171.64],
      },
    },
  },
  '../testing/fixtures-lines.stories.tsx.multiSeriesAreaOverlapSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1138.31, 1136.31],
      },
      axes: {
        'x.end.x': [1161.31, 1159.31],
        'x.tick.1.position': [331.4, 330.9],
        'x.tick.2.position': [608.04, 607.04],
        'x.tick.3.position': [884.67, 883.17],
        'x.tick.4.position': [1161.31, 1159.31],
      },
      marks: {
        '0.width': [1107.31, 1105.31],
        '1.width': [1107.31, 1105.31],
        '2.width': [1107.31, 1105.31],
        '3.width': [1107.31, 1105.31],
        '4.width': [1107.31, 1105.31],
        '5.width': [1107.31, 1105.31],
        '6.width': [1107.31, 1105.31],
        '7.width': [1107.31, 1105.31],
      },
      annotations: {
        'a0.connector.from.x': [1021.86, 1020.11],
        'a0.connector.to.x': [1021.86, 1020.11],
        'a0.dot.x': [1021.86, 1020.11],
        'a0.label.x': [950.14, 948.39],
        'a0.subtitle.x': [950.14, 948.39],
      },
      endpointLabels: {
        'bounds.x': [1179.31, 1177.31],
      },
    },
  },
  '../testing/fixtures-lines.stories.tsx.multiSeriesAreaStackedSpec @390': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [280.35, 273.98],
      },
      axes: {
        'x.end.x': [294.35, 287.98],
        'x.tick.1.position': [183.11, 179.65],
      },
      marks: {
        '0.width': [244.35, 237.98],
        '1.width': [244.35, 237.98],
        '2.width': [244.35, 237.98],
        '3.width': [244.35, 237.98],
        '4.width': [244.35, 237.98],
        '5.width': [244.35, 237.98],
      },
      endpointLabels: {
        'bounds.x': [312.35, 305.98],
      },
    },
  },
  '../testing/fixtures-lines.stories.tsx.multiSeriesAreaStackedSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1152.35, 1145.98],
      },
      axes: {
        'x.end.x': [1175.35, 1168.98],
        'x.tick.1.position': [208.96, 208.1],
        'x.tick.2.position': [360.58, 358.86],
        'x.tick.3.position': [513.87, 511.28],
        'x.tick.4.position': [667.16, 663.69],
        'x.tick.5.position': [818.78, 814.45],
        'x.tick.6.position': [970.41, 965.21],
        'x.tick.7.position': [1123.69, 1117.62],
      },
      marks: {
        '0.width': [1116.35, 1109.98],
        '1.width': [1116.35, 1109.98],
        '2.width': [1116.35, 1109.98],
        '3.width': [1116.35, 1109.98],
        '4.width': [1116.35, 1109.98],
        '5.width': [1116.35, 1109.98],
      },
      endpointLabels: {
        'bounds.x': [1193.35, 1186.98],
      },
    },
  },
  '../testing/fixtures-lines.stories.tsx.lineSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1015.41, 1013.41],
      },
      axes: {
        'x.end.x': [1059.41, 1057.41],
        'x.tick.1.position': [211.93, 211.65],
        'x.tick.2.position': [352.4, 351.84],
        'x.tick.3.position': [494.42, 493.57],
        'x.tick.4.position': [636.44, 635.3],
        'x.tick.5.position': [776.91, 775.49],
        'x.tick.6.position': [917.39, 915.68],
        'x.tick.7.position': [1059.41, 1057.41],
      },
      marks: {
        '0.width': [986.41, 984.41],
        '1.width': [986.41, 984.41],
        '2.width': [986.41, 984.41],
      },
      annotations: {
        'a0.connector.from.x': [742.02, 740.6],
        'a0.connector.to.x': [769.48, 768.05],
        'a0.dot.x': [776.91, 775.49],
        'a0.label.x': [748.91, 747.49],
        'a1.label.x': [297.68, 297.11],
      },
      legend: {
        'legends.0.bounds.x': [1176.09, 1174.09],
        'legends.0.entry.0.x': [1176.09, 1174.09],
        'legends.0.entry.1.x': [1176.09, 1174.09],
        'legends.0.entry.2.x': [1176.09, 1174.09],
      },
      endpointLabels: {
        'bounds.x': [1077.41, 1075.41],
      },
    },
  },
  '../testing/fixtures-misc.stories.tsx.chromeSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1169.04, 1167.04],
      },
      axes: {
        'x.end.x': [1192.04, 1190.04],
        'x.tick.1.position': [186.92, 186.67],
        'x.tick.2.position': [329.83, 329.33],
        'x.tick.3.position': [474.32, 473.57],
        'x.tick.4.position': [618.81, 617.8],
        'x.tick.5.position': [760.15, 758.9],
        'x.tick.6.position': [903.07, 901.57],
        'x.tick.7.position': [1047.55, 1045.81],
        'x.tick.8.position': [1192.04, 1190.04],
      },
      marks: {
        '0.width': [1148.04, 1146.04],
        '1.width': [1148.04, 1146.04],
      },
      endpointLabels: {
        'bounds.x': [1210.04, 1208.04],
      },
    },
  },
  '../testing/fixtures-misc.stories.tsx.fullChromeSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1169.04, 1167.04],
      },
      axes: {
        'x.end.x': [1192.04, 1190.04],
        'x.tick.1.position': [186.92, 186.67],
        'x.tick.2.position': [329.83, 329.33],
        'x.tick.3.position': [474.32, 473.57],
        'x.tick.4.position': [618.81, 617.8],
        'x.tick.5.position': [760.15, 758.9],
        'x.tick.6.position': [903.07, 901.57],
        'x.tick.7.position': [1047.55, 1045.81],
        'x.tick.8.position': [1192.04, 1190.04],
      },
      marks: {
        '0.width': [1148.04, 1146.04],
        '1.width': [1148.04, 1146.04],
      },
      endpointLabels: {
        'bounds.x': [1210.04, 1208.04],
      },
    },
  },
  '../testing/fixtures-ranking.stories.tsx.slopeMarketShareSpec @390': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [92.47, 88.47],
        'rect.x': [148.77, 150.77],
      },
      axes: {
        'x.end.x': [241.23, 239.23],
        'x.start.x': [148.77, 150.77],
        'x.tick.0.position': [148.77, 150.77],
        'x.tick.1.position': [241.23, 239.23],
      },
      marks: {
        '0.width': [92.47, 88.47],
        '0.x': [148.77, 150.77],
        '1.width': [92.47, 88.47],
        '1.x': [148.77, 150.77],
        '2.width': [92.47, 88.47],
        '2.x': [148.77, 150.77],
        '3.width': [92.47, 88.47],
        '3.x': [148.77, 150.77],
        '4.width': [92.47, 88.47],
        '4.x': [148.77, 150.77],
      },
      endpointLabels: {
        'bounds.x': [259.23, 257.23],
        'leadingBounds.x': [12, 14],
      },
    },
  },
  '../testing/fixtures-ranking.stories.tsx.slopeMarketShareSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [964.47, 960.47],
        'rect.x': [157.77, 159.77],
      },
      axes: {
        'x.end.x': [1122.23, 1120.23],
        'x.start.x': [157.77, 159.77],
        'x.tick.0.position': [157.77, 159.77],
        'x.tick.1.position': [1122.23, 1120.23],
      },
      marks: {
        '0.width': [964.47, 960.47],
        '0.x': [157.77, 159.77],
        '1.width': [964.47, 960.47],
        '1.x': [157.77, 159.77],
        '2.width': [964.47, 960.47],
        '2.x': [157.77, 159.77],
        '3.width': [964.47, 960.47],
        '3.x': [157.77, 159.77],
        '4.width': [964.47, 960.47],
        '4.x': [157.77, 159.77],
      },
      endpointLabels: {
        'bounds.x': [1140.23, 1138.23],
        'leadingBounds.x': [21, 23],
      },
    },
  },
  '../testing/fixtures-ranking.stories.tsx.bumpConstructorsSpec @390': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [150.15, 146.15],
        'rect.x': [119.92, 121.92],
      },
      axes: {
        'x.end.x': [270.08, 268.08],
        'x.start.x': [119.92, 121.92],
        'x.tick.0.position': [146.92, 148.92],
        'x.tick.1.position': [196.18, 196.58],
        'x.tick.2.position': [245.45, 244.25],
        'y.end.x': [119.92, 121.92],
        'y.start.x': [119.92, 121.92],
      },
      marks: {
        '0.width': [123.15, 119.15],
        '0.x': [146.92, 148.92],
        '1.cx': [146.92, 148.92],
        '10.cx': [196.18, 196.58],
        '11.cx': [220.82, 220.42],
        '12.cx': [245.45, 244.25],
        '13.cx': [270.08, 268.08],
        '14.width': [123.15, 119.15],
        '14.x': [146.92, 148.92],
        '15.cx': [146.92, 148.92],
        '16.cx': [171.55, 172.75],
        '17.cx': [196.18, 196.58],
        '18.cx': [220.82, 220.42],
        '19.cx': [245.45, 244.25],
        '2.cx': [171.55, 172.75],
        '20.cx': [270.08, 268.08],
        '21.width': [123.15, 119.15],
        '21.x': [146.92, 148.92],
        '22.cx': [146.92, 148.92],
        '23.cx': [171.55, 172.75],
        '24.cx': [196.18, 196.58],
        '25.cx': [220.82, 220.42],
        '26.cx': [245.45, 244.25],
        '27.cx': [270.08, 268.08],
        '28.width': [123.15, 119.15],
        '28.x': [146.92, 148.92],
        '29.cx': [146.92, 148.92],
        '3.cx': [196.18, 196.58],
        '30.cx': [171.55, 172.75],
        '31.cx': [196.18, 196.58],
        '32.cx': [220.82, 220.42],
        '33.cx': [245.45, 244.25],
        '34.cx': [270.08, 268.08],
        '4.cx': [220.82, 220.42],
        '5.cx': [245.45, 244.25],
        '6.cx': [270.08, 268.08],
        '7.width': [123.15, 119.15],
        '7.x': [146.92, 148.92],
        '8.cx': [146.92, 148.92],
        '9.cx': [171.55, 172.75],
      },
      endpointLabels: {
        'bounds.x': [288.08, 286.08],
        'leadingBounds.x': [12, 14],
      },
    },
  },
  '../testing/fixtures-ranking.stories.tsx.bumpConstructorsSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1022.15, 1018.15],
        'rect.x': [128.92, 130.92],
      },
      axes: {
        'x.end.x': [1151.08, 1149.08],
        'x.start.x': [128.92, 130.92],
        'x.tick.0.position': [155.92, 157.92],
        'x.tick.1.position': [354.95, 356.15],
        'x.tick.2.position': [553.98, 554.38],
        'x.tick.3.position': [753.02, 752.62],
        'x.tick.4.position': [952.05, 950.85],
        'x.tick.5.position': [1151.08, 1149.08],
        'y.end.x': [128.92, 130.92],
        'y.start.x': [128.92, 130.92],
      },
      marks: {
        '0.width': [995.15, 991.15],
        '0.x': [155.92, 157.92],
        '1.cx': [155.92, 157.92],
        '10.cx': [553.98, 554.38],
        '11.cx': [753.02, 752.62],
        '12.cx': [952.05, 950.85],
        '13.cx': [1151.08, 1149.08],
        '14.width': [995.15, 991.15],
        '14.x': [155.92, 157.92],
        '15.cx': [155.92, 157.92],
        '16.cx': [354.95, 356.15],
        '17.cx': [553.98, 554.38],
        '18.cx': [753.02, 752.62],
        '19.cx': [952.05, 950.85],
        '2.cx': [354.95, 356.15],
        '20.cx': [1151.08, 1149.08],
        '21.width': [995.15, 991.15],
        '21.x': [155.92, 157.92],
        '22.cx': [155.92, 157.92],
        '23.cx': [354.95, 356.15],
        '24.cx': [553.98, 554.38],
        '25.cx': [753.02, 752.62],
        '26.cx': [952.05, 950.85],
        '27.cx': [1151.08, 1149.08],
        '28.width': [995.15, 991.15],
        '28.x': [155.92, 157.92],
        '29.cx': [155.92, 157.92],
        '3.cx': [553.98, 554.38],
        '30.cx': [354.95, 356.15],
        '31.cx': [553.98, 554.38],
        '32.cx': [753.02, 752.62],
        '33.cx': [952.05, 950.85],
        '34.cx': [1151.08, 1149.08],
        '4.cx': [753.02, 752.62],
        '5.cx': [952.05, 950.85],
        '6.cx': [1151.08, 1149.08],
        '7.width': [995.15, 991.15],
        '7.x': [155.92, 157.92],
        '8.cx': [155.92, 157.92],
        '9.cx': [354.95, 356.15],
      },
      endpointLabels: {
        'bounds.x': [1169.08, 1167.08],
        'leadingBounds.x': [21, 23],
      },
    },
  },
  '../testing/fixtures-refresh.stories.tsx.presetSpec @1280': {
    reason:
      'B1 endpoint full-set width, shared precision and corrected 18px reservation of the already-painted gap; compared against released v8 and pre-RFC93112314 source.',
    changes: {
      area: {
        'rect.width': [1085.06, 1083.06],
      },
      axes: {
        'x.end.x': [1129.06, 1127.06],
        'x.tick.1.position': [273.01, 272.61],
        'x.tick.2.position': [487.02, 486.22],
        'x.tick.3.position': [701.04, 699.84],
        'x.tick.4.position': [915.05, 913.45],
        'x.tick.5.position': [1129.06, 1127.06],
      },
      marks: {
        '0.width': [1070.06, 1068.06],
        '1.width': [1070.06, 1068.06],
      },
      endpointLabels: {
        'bounds.x': [1147.06, 1145.06],
      },
    },
  },
};

/** B1: point category keys paint in their resolved top reservation. Released
 * v8 reserved the top band but painted the key at the bottom. */
export const APPROVED_MAP_KEY_PLACEMENT: Record<
  string,
  (typeof APPROVED_RFC_B1_LAYOUT)[string] & { style: Record<string, [unknown, unknown]> }
> = {
  '../gallery/maps.stories.tsx.pointLayerSpec @390': {
    reason:
      'B1: paint the point category key in its existing resolved top reservation; v8 incorrectly painted it at the bottom without reserving a bottom band.',
    style: { 'legends.pointCategoricalLegend.position': ['bottom', 'top'] },
    changes: {
      legend: {
        'pointCategoricalLegend.bounds.y': [327.4, 74.85],
        'pointCategoricalLegend.entry.0.x': [undefined, 10],
        'pointCategoricalLegend.entry.0.y': [undefined, 74.85],
        'pointCategoricalLegend.entry.1.x': [undefined, 49.34],
        'pointCategoricalLegend.entry.1.y': [undefined, 74.85],
        'pointCategoricalLegend.entry.2.x': [undefined, 88.67],
        'pointCategoricalLegend.entry.2.y': [undefined, 74.85],
      },
    },
  },
  '../gallery/maps.stories.tsx.pointLayerSpec @1280': {
    reason:
      'B1: paint the point category key in its existing resolved top reservation; v8 incorrectly painted it at the bottom without reserving a bottom band.',
    style: { 'legends.pointCategoricalLegend.position': ['bottom', 'top'] },
    changes: {
      legend: {
        'pointCategoricalLegend.bounds.y': [307.4, 97.2],
        'pointCategoricalLegend.entry.0.x': [undefined, 20],
        'pointCategoricalLegend.entry.0.y': [undefined, 97.2],
        'pointCategoricalLegend.entry.1.x': [undefined, 59.34],
        'pointCategoricalLegend.entry.1.y': [undefined, 97.2],
        'pointCategoricalLegend.entry.2.x': [undefined, 98.67],
        'pointCategoricalLegend.entry.2.y': [undefined, 97.2],
      },
    },
  },
  '../gallery/maps.stories.tsx.readerZoomPointsSpec @390': {
    reason:
      'B1: paint the point category key in its existing resolved top reservation; v8 incorrectly painted it at the bottom without reserving a bottom band.',
    style: { 'legends.pointCategoricalLegend.position': ['bottom', 'top'] },
    changes: {
      legend: {
        'pointCategoricalLegend.bounds.y': [327.4, 101.3],
        'pointCategoricalLegend.entry.0.x': [undefined, 10],
        'pointCategoricalLegend.entry.0.y': [undefined, 101.3],
        'pointCategoricalLegend.entry.1.x': [undefined, 49.34],
        'pointCategoricalLegend.entry.1.y': [undefined, 101.3],
        'pointCategoricalLegend.entry.2.x': [undefined, 88.67],
        'pointCategoricalLegend.entry.2.y': [undefined, 101.3],
      },
    },
  },
  '../gallery/maps.stories.tsx.readerZoomPointsSpec @1280': {
    reason:
      'B1: paint the point category key in its existing resolved top reservation; v8 incorrectly painted it at the bottom without reserving a bottom band.',
    style: { 'legends.pointCategoricalLegend.position': ['bottom', 'top'] },
    changes: {
      legend: {
        'pointCategoricalLegend.bounds.y': [307.4, 97.2],
        'pointCategoricalLegend.entry.0.x': [undefined, 20],
        'pointCategoricalLegend.entry.0.y': [undefined, 97.2],
        'pointCategoricalLegend.entry.1.x': [undefined, 59.34],
        'pointCategoricalLegend.entry.1.y': [undefined, 97.2],
        'pointCategoricalLegend.entry.2.x': [undefined, 98.67],
        'pointCategoricalLegend.entry.2.y': [undefined, 97.2],
      },
    },
  },
};

/** B1: alphabetic title baselines must leave room for rotated glyph ascent. */
export const APPROVED_AXIS_TITLE_LAYOUT: typeof APPROVED_PRE_RFC_LAYOUT = {
  '../charts/mobile-regression.stories.tsx.inlineYTitleSpec @390': {
    reason:
      'B1 enlarged rotated title no longer clips beyond the viewport; marks, ticks and plot stay unchanged.',
    changes: { axes: { 'y.titlePosition.x': [19, 21] } },
  },
  '../gallery/charts-scatter-distribution.stories.tsx.stripSpec @390': {
    reason:
      'B1 rotated title no longer clips beyond the viewport; marks, ticks and plot stay unchanged.',
    changes: { axes: { 'y.titlePosition.x': [5.87, 13] } },
  },
};

/** B1 collision correction: clamp top-overflow anchors before the separation sweep.
 * Values and marks are unchanged; only these label centers move into available space. */
export const APPROVED_ENDPOINT_TOP_SWEEP: typeof APPROVED_PRE_RFC_LAYOUT = {
  '../gallery/dashboards.layouts.tsx.marketsCompareSpec @1280': {
    reason:
      'Clamp top-overflow endpoint anchors before separation so labels retain their minimum spacing.',
    changes: {
      endpointLabels: {
        '0.labelY': [139.52, 145.45],
        '2.labelY': [180.77, 186.7],
        '3.labelY': [222.02, 227.95],
      },
    },
  },
  '../gallery/dashboards.stories.tsx.crosshairSpec @1280': {
    reason:
      'Clamp top-overflow endpoint anchors before separation so labels retain their minimum spacing.',
    changes: {
      endpointLabels: {
        '0.labelY': [139.52, 145.45],
        '2.labelY': [180.77, 186.7],
        '3.labelY': [222.02, 227.95],
      },
    },
  },
  '../testing/fixtures-lines.stories.tsx.multiSeriesAreaStackedSpec @390': {
    reason:
      'Clamp top-overflow endpoint anchors before separation so labels retain their minimum spacing.',
    changes: { endpointLabels: { '0.labelY': [226.2, 227.2], '1.labelY': [182.56, 185.95] } },
  },
  '../testing/fixtures-lines.stories.tsx.multiSeriesAreaStackedSpec @1280': {
    reason:
      'Clamp top-overflow endpoint anchors before separation so labels retain their minimum spacing.',
    changes: { endpointLabels: { '1.labelY': [142.77, 145.45] } },
  },
};
