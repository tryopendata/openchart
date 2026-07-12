/**
 * Tests for the text-annotation resolver, focused on the `dot` and
 * `subtitle` fields added in the multi-series area redesign.
 */

import type { Annotation, LayoutStrategy, Rect } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../compiler/types';
import { computeScales } from '../../layout/scales';
import { computeAnnotations } from '../compute';
import {
  DARK_CONNECTOR_STROKE,
  DARK_DOT_FILL,
  DARK_LABEL_BACKGROUND,
  DARK_MUTED_TEXT_FILL,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_ANNOTATION_FONT_WEIGHT,
  DEFAULT_DOT_RADIUS,
  DEFAULT_DOT_STROKE_WIDTH,
  DEFAULT_LINE_HEIGHT,
  FALLBACK_FONT_FAMILY,
  LEDE_FONT_WEIGHT,
  LIGHT_CONNECTOR_STROKE,
  LIGHT_DOT_FILL,
  LIGHT_LABEL_BACKGROUND,
  LIGHT_MUTED_TEXT_FILL,
  SUBTITLE_FONT_SIZE_RATIO,
  SUBTITLE_FONT_WEIGHT,
  SUBTITLE_GAP,
} from '../constants';
import { heuristicMeasure } from '../geometry';

const chartArea: Rect = { x: 50, y: 20, width: 500, height: 300 };

const fullStrategy: LayoutStrategy = {
  labelMode: 'all',
  legendPosition: 'right',
  annotationPosition: 'inline',
  axisLabelDensity: 'full',
};

function makeSpec(annotations: Annotation[]): NormalizedChartSpec {
  return {
    markType: 'line',
    markDef: { type: 'line' },
    data: [
      { date: '2019-01-01', value: 10 },
      { date: '2020-01-01', value: 20 },
      { date: '2021-01-01', value: 30 },
      { date: '2022-01-01', value: 40 },
    ],
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
    },
    chrome: {},
    annotations,
    responsive: true,
    theme: {},
    darkMode: 'off',
    labels: { density: 'auto', format: '' },
  };
}

describe('text annotation: dot', () => {
  // A connector with no arrowhead needs a terminator at the data point, so the
  // engine resolves the default marker for it. `dot: false` opts out.
  it('resolves the default dot when a connector is enabled and no dot key is set', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'No dot key' }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const dot = annotations[0].dot;
    expect(dot).toBeDefined();
    expect(dot!.radius).toBe(DEFAULT_DOT_RADIUS);
  });

  it('resolves the default dot for an explicit straight connector', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Straight', connector: 'straight' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].dot).toBeDefined();
  });

  it('resolves the default dot for a drop-line connector', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Drop', connector: 'drop-line' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].dot).toBeDefined();
  });

  it('honors an explicit dot: true on a drop-line connector', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Drop', connector: 'drop-line', dot: true },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const ann = annotations[0];
    const px = scales.x!.scale(new Date('2020-01-01')) as number;
    const py = scales.y!.scale(20) as number;
    expect(ann.dot).toBeDefined();
    expect(ann.dot!.x).toBeCloseTo(px, 5);
    expect(ann.dot!.y).toBeCloseTo(py, 5);
  });

  // An arrowhead is already a terminator; adding a marker under it double-marks
  // the data point.
  it('does not resolve a default dot when the connector has an arrowhead', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Arrowed', connector: 'curve' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].dot).toBeUndefined();
  });

  it('does not populate dot when the connector is disabled', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Bare', connector: false },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].dot).toBeUndefined();
  });

  it('dot: false suppresses the default marker', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'No marker', dot: false },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].dot).toBeUndefined();
  });

  it('populates dot with default styling when dot: true (light mode)', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'With dot', dot: true }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy, false);

    const dot = annotations[0].dot;
    expect(dot).toBeDefined();
    expect(dot!.radius).toBe(DEFAULT_DOT_RADIUS);
    expect(dot!.strokeWidth).toBe(DEFAULT_DOT_STROKE_WIDTH);
    expect(dot!.fill).toBe(LIGHT_DOT_FILL);
    // Marker and its (non-arrowed) leader share the quiet gray.
    expect(dot!.stroke).toBe(LIGHT_CONNECTOR_STROKE);
  });

  it('populates dot with dark-mode defaults when isDark is true', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Dark', dot: true }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy, true);

    const dot = annotations[0].dot;
    expect(dot).toBeDefined();
    expect(dot!.fill).toBe(DARK_DOT_FILL);
    expect(dot!.stroke).toBe(DARK_CONNECTOR_STROKE);
  });

  it('respects user-supplied dot style overrides', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Custom dot',
        dot: { radius: 8, fill: '#ff00ff', stroke: '#00ff00', strokeWidth: 4 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const dot = annotations[0].dot;
    expect(dot).toBeDefined();
    expect(dot!.radius).toBe(8);
    expect(dot!.fill).toBe('#ff00ff');
    expect(dot!.stroke).toBe('#00ff00');
    expect(dot!.strokeWidth).toBe(4);
  });

  it('partial dot overrides merge with defaults', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Partial', dot: { radius: 3 } },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const dot = annotations[0].dot;
    expect(dot).toBeDefined();
    expect(dot!.radius).toBe(3);
    // Other fields fall back to defaults.
    expect(dot!.fill).toBe(LIGHT_DOT_FILL);
    expect(dot!.stroke).toBe(LIGHT_CONNECTOR_STROKE);
    expect(dot!.strokeWidth).toBe(DEFAULT_DOT_STROKE_WIDTH);
  });

  // The marker sits ON the data point; the connector stops short of it. The old
  // behavior put the dot at the pulled-back connector tip, which offset it from
  // the point it was marking.
  it('dot coordinates sit exactly on the data point, not the pulled-back connector tip', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Co-render',
        dot: true,
        offset: { dx: 60, dy: -60 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const resolved = annotations[0];
    const px = scales.x!.scale(new Date('2020-01-01')) as number;
    const py = scales.y!.scale(20) as number;

    expect(resolved.dot).toBeDefined();
    expect(resolved.dot!.x).toBeCloseTo(px, 5);
    expect(resolved.dot!.y).toBeCloseTo(py, 5);

    // The connector stops short of the marker.
    const connector = resolved.label!.connector!;
    const gap = Math.hypot(px - connector.to.x, py - connector.to.y);
    expect(gap).toBeGreaterThan(resolved.dot!.radius);
  });

  it('dot coordinates apply user connectorOffset.to', () => {
    const baseSpec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'A', dot: true }]);
    const baseScales = computeScales(baseSpec, chartArea, baseSpec.data);
    const withoutOffset = computeAnnotations(baseSpec, baseScales, chartArea, fullStrategy);
    const baseDot = withoutOffset[0].dot!;

    const withOffsetSpec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'A',
        dot: true,
        connectorOffset: { to: { dx: 10, dy: -5 } },
      },
    ]);
    const scales2 = computeScales(withOffsetSpec, chartArea, withOffsetSpec.data);
    const withOffset = computeAnnotations(withOffsetSpec, scales2, chartArea, fullStrategy);
    const offsetDot = withOffset[0].dot!;

    // The user's connector offset shifts the data-side endpoint, so the marker
    // tracks it.
    expect(offsetDot.x).toBeCloseTo(baseDot.x + 10, 5);
    expect(offsetDot.y).toBeCloseTo(baseDot.y - 5, 5);
  });
});

describe('text annotation: background', () => {
  it('does not populate background when not specified', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'No plate' }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].label.background).toBeUndefined();
  });

  it('resolves background: true to the light surface in light mode', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Plate', background: true },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy, false);

    expect(annotations[0].label.background).toBe(LIGHT_LABEL_BACKGROUND);
  });

  // The dark-mode regression: `background: true` must NOT stay white, or the
  // theme's light text renders light-gray-on-white and is unreadable.
  it('resolves background: true to the dark surface when isDark is true', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Plate', background: true },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy, true);

    expect(annotations[0].label.background).toBe(DARK_LABEL_BACKGROUND);
    expect(annotations[0].label.background).not.toBe(LIGHT_LABEL_BACKGROUND);
  });

  it('passes an explicit background color through unchanged in both modes', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Plate', background: '#ff00ff' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);

    expect(
      computeAnnotations(spec, scales, chartArea, fullStrategy, false)[0].label.background,
    ).toBe('#ff00ff');
    expect(
      computeAnnotations(spec, scales, chartArea, fullStrategy, true)[0].label.background,
    ).toBe('#ff00ff');
  });
});

describe('text annotation: subtitle', () => {
  it('does not populate subtitle when not specified', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'No subtitle' }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].subtitle).toBeUndefined();
  });

  it('populates subtitle with muted styling and smaller font (light mode)', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Primary',
        subtitle: 'Methodology note',
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy, false);

    const sub = annotations[0].subtitle;
    expect(sub).toBeDefined();
    expect(sub!.text).toBe('Methodology note');
    expect(sub!.style.fill).toBe(LIGHT_MUTED_TEXT_FILL);
    expect(sub!.style.fontSize).toBe(
      Math.round(DEFAULT_ANNOTATION_FONT_SIZE * SUBTITLE_FONT_SIZE_RATIO),
    );
  });

  it('populates subtitle with dark-mode muted color when isDark', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Primary', subtitle: 'Note' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy, true);

    expect(annotations[0].subtitle!.style.fill).toBe(DARK_MUTED_TEXT_FILL);
  });

  it('positions subtitle directly below single-line primary text', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'One line', subtitle: 'sub' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const label = annotations[0].label!;
    const sub = annotations[0].subtitle!;
    const fontSize = label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
    const expectedY = label.y + fontSize * DEFAULT_LINE_HEIGHT * 1 + SUBTITLE_GAP;
    expect(sub.y).toBe(expectedY);
    expect(sub.x).toBe(label.x);
  });

  it('positions subtitle below all primary lines when text contains newlines', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Line one\nLine two\nLine three',
        subtitle: 'after multi-line',
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const label = annotations[0].label!;
    const sub = annotations[0].subtitle!;
    const fontSize = label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;
    const expectedY = label.y + fontSize * DEFAULT_LINE_HEIGHT * 3 + SUBTITLE_GAP;
    expect(sub.y).toBe(expectedY);
  });

  it('subtitle font size scales with custom primary fontSize', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Big',
        fontSize: 20,
        subtitle: 'small',
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].subtitle!.style.fontSize).toBe(Math.round(20 * SUBTITLE_FONT_SIZE_RATIO));
  });
});

describe('text annotation: dot + subtitle co-resolution', () => {
  it('both fields resolve simultaneously without interfering', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Big moment',
        subtitle: 'Adjusted for inflation',
        dot: true,
        offset: { dx: 60, dy: -60 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const resolved = annotations[0];
    const px = scales.x!.scale(new Date('2020-01-01')) as number;
    const py = scales.y!.scale(20) as number;

    expect(resolved.dot).toBeDefined();
    expect(resolved.subtitle).toBeDefined();
    expect(resolved.dot!.x).toBeCloseTo(px, 5);
    expect(resolved.dot!.y).toBeCloseTo(py, 5);
    expect(resolved.label!.connector).toBeDefined();
  });

  // The connector must clear the subtitle too, not just the primary line. The
  // subtitle is often the wider of the two.
  it('connector origin clears the subtitle when the subtitle is the wider line', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Short',
        subtitle: 'A considerably longer subtitle line than the primary',
        // Label sits below-left of the point, so the connector exits up/right
        // and would cross the subtitle if bounds ignored it.
        offset: { dx: 0, dy: 90 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const ann = annotations[0];
    const connector = ann.label!.connector!;
    const bounds = ann.bounds!;

    // The origin must sit outside the full (label ∪ subtitle) block.
    const insideX = connector.from.x >= bounds.x && connector.from.x <= bounds.x + bounds.width;
    const insideY = connector.from.y >= bounds.y && connector.from.y <= bounds.y + bounds.height;
    expect(insideX && insideY).toBe(false);
  });
});

describe('text annotation: connector suppression', () => {
  // The default anchor offset is only 8px, so a plain text annotation's leader
  // would be a sub-14px stub. The marker alone reads better.
  it('suppresses a connector shorter than MIN_CONNECTOR_LENGTH but keeps the dot', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Tiny leader' }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].label!.connector).toBeUndefined();
    expect(annotations[0].dot).toBeDefined();
  });

  it('suppresses the connector when the data point lands inside the text block', () => {
    // Offset pushes the label so its box straddles the data point.
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'The point sits inside this label',
        offset: { dx: -60, dy: 4 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].label!.connector).toBeUndefined();
    expect(annotations[0].dot).toBeDefined();
  });

  it('keeps the connector once the label is far enough from the point', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Far label', offset: { dx: 0, dy: -60 } },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const connector = annotations[0].label!.connector!;
    expect(connector).toBeDefined();
    const length = Math.hypot(connector.to.x - connector.from.x, connector.to.y - connector.from.y);
    expect(length).toBeGreaterThanOrEqual(14);
  });
});

describe('text annotation: connector config', () => {
  it('bare "curve" string defaults arrow to true', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Curve',
        connector: 'curve',
        offset: { dx: 0, dy: -60 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const c = annotations[0].label!.connector!;
    expect(c.style).toBe('curve');
    expect(c.arrow).toBe(true);
  });

  it('bare "straight" string defaults arrow to false', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Straight',
        connector: 'straight',
        offset: { dx: 0, dy: -60 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const c = annotations[0].label!.connector!;
    expect(c.style).toBe('straight');
    expect(c.arrow).toBe(false);
  });

  it('boolean true defaults to straight with no arrow', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Default',
        connector: true,
        offset: { dx: 0, dy: -60 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const c = annotations[0].label!.connector!;
    expect(c.style).toBe('straight');
    expect(c.arrow).toBe(false);
  });

  it('object form { type: "straight", arrow: true } enables arrow on straight', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Arrow straight',
        connector: { type: 'straight', arrow: true },
        offset: { dx: 0, dy: -60 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const c = annotations[0].label!.connector!;
    expect(c.style).toBe('straight');
    expect(c.arrow).toBe(true);
  });

  it('object form { type: "curve", arrow: false } disables arrow on curve', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'No arrow curve',
        connector: { type: 'curve', arrow: false },
        offset: { dx: 0, dy: -60 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const c = annotations[0].label!.connector!;
    expect(c.style).toBe('curve');
    expect(c.arrow).toBe(false);
  });

  it('object form { type: "curve" } defaults arrow to true', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Default curve',
        connector: { type: 'curve' },
        offset: { dx: 0, dy: -60 },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const c = annotations[0].label!.connector!;
    expect(c.style).toBe('curve');
    expect(c.arrow).toBe(true);
  });

  it('connector: false disables connector entirely', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'No connector', connector: false },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].label!.connector).toBeUndefined();
  });

  it('drop-line string connector always has arrow: false', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Drop line', connector: 'drop-line' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const c = annotations[0].label!.connector!;
    expect(c.style).toBe('drop-line');
    expect(c.arrow).toBe(false);
  });

  it('object form { type: "drop-line", arrow: true } clamps arrow to false', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Drop line forced',
        connector: { type: 'drop-line', arrow: true },
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const c = annotations[0].label!.connector!;
    expect(c.style).toBe('drop-line');
    expect(c.arrow).toBe(false);
  });
});

describe('text annotation: typography', () => {
  it('defaults to the regular annotation font size and weight', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Plain' }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const style = annotations[0].label!.style;
    expect(style.fontSize).toBe(DEFAULT_ANNOTATION_FONT_SIZE);
    expect(style.fontWeight).toBe(DEFAULT_ANNOTATION_FONT_WEIGHT);
  });

  // Lede rule: a subtitle turns the primary line into a lede, so it goes bold.
  it('promotes the primary text to the lede weight when a subtitle is present', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Feb. 25', subtitle: '2015 maximum' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].label!.style.fontWeight).toBe(LEDE_FONT_WEIGHT);
    // The subtitle never inherits it.
    expect(annotations[0].subtitle!.style.fontWeight).toBe(SUBTITLE_FONT_WEIGHT);
  });

  it('an explicit fontWeight wins over the lede rule', () => {
    const spec = makeSpec([
      {
        type: 'text',
        x: '2020-01-01',
        y: 20,
        text: 'Feb. 25',
        subtitle: '2015 maximum',
        fontWeight: 500,
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].label!.style.fontWeight).toBe(500);
  });

  it('threads the theme font family into text, range, and refline labels', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'Callout' },
      { type: 'range', x: ['2019-01-01', '2020-01-01'], label: 'Band' },
      { type: 'refline', y: 25, label: 'Target' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, {
      scales,
      chartArea,
      strategy: fullStrategy,
      isDark: false,
      obstacles: [],
      svg: { width: 600, height: 360 },
      measure: heuristicMeasure,
      fontFamily: 'Georgia, serif',
    });

    for (const ann of annotations) {
      expect(ann.label!.style.fontFamily).toBe('Georgia, serif');
    }
  });

  it('falls back to the default font stack when no theme font is threaded', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Callout' }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].label!.style.fontFamily).toBe(FALLBACK_FONT_FAMILY);
  });
});

describe('text annotation: alignment', () => {
  // Text blocks are never centered: they align on the edge facing the point.
  it('left-aligns multi-line text instead of centering it', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'First line\nSecond line' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].label!.style.textAnchor).toBe('start');
  });

  it('right-aligns the block when it sits to the left of the point', () => {
    const spec = makeSpec([
      { type: 'text', x: '2020-01-01', y: 20, text: 'First line\nSecond line', anchor: 'left' },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    expect(annotations[0].label!.style.textAnchor).toBe('end');
  });
});
