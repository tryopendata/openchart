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
  DARK_DOT_FILL,
  DARK_MUTED_TEXT_FILL,
  DARK_TEXT_FILL,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_DOT_RADIUS,
  DEFAULT_DOT_STROKE_WIDTH,
  DEFAULT_LINE_HEIGHT,
  LIGHT_DOT_FILL,
  LIGHT_MUTED_TEXT_FILL,
  LIGHT_TEXT_FILL,
  SUBTITLE_FONT_SIZE_RATIO,
  SUBTITLE_GAP,
} from '../constants';

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
  it('does not populate dot when not specified', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'No dot' }]);
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
    expect(dot!.stroke).toBe(LIGHT_TEXT_FILL);
  });

  it('populates dot with dark-mode defaults when isDark is true', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Dark', dot: true }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy, true);

    const dot = annotations[0].dot;
    expect(dot).toBeDefined();
    expect(dot!.fill).toBe(DARK_DOT_FILL);
    expect(dot!.stroke).toBe(DARK_TEXT_FILL);
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
    expect(dot!.stroke).toBe(LIGHT_TEXT_FILL);
    expect(dot!.strokeWidth).toBe(DEFAULT_DOT_STROKE_WIDTH);
  });

  it('dot coordinates match the connector "to" endpoint exactly', () => {
    const spec = makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'Co-render', dot: true }]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const resolved = annotations[0];
    expect(resolved.dot).toBeDefined();
    expect(resolved.label?.connector).toBeDefined();
    expect(resolved.dot!.x).toBe(resolved.label!.connector!.to.x);
    expect(resolved.dot!.y).toBe(resolved.label!.connector!.to.y);
  });

  it('dot coordinates apply user connectorOffset.to', () => {
    const withoutOffset = computeAnnotations(
      makeSpec([{ type: 'text', x: '2020-01-01', y: 20, text: 'A', dot: true }]),
      computeScales(makeSpec([]), chartArea, []),
      chartArea,
      fullStrategy,
    );
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

    // The user's connector offset shifts the data-side endpoint, so the dot
    // should track it. Exact equality with connector.to must hold.
    expect(offsetDot.x).toBe(withOffset[0].label!.connector!.to.x);
    expect(offsetDot.y).toBe(withOffset[0].label!.connector!.to.y);
    // And it should differ from the un-offset case (sanity check).
    expect(offsetDot.x).not.toBe(baseDot.x);
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
      },
    ]);
    const scales = computeScales(spec, chartArea, spec.data);
    const annotations = computeAnnotations(spec, scales, chartArea, fullStrategy);

    const resolved = annotations[0];
    expect(resolved.dot).toBeDefined();
    expect(resolved.subtitle).toBeDefined();
    // Connector + dot still co-render at the same point.
    expect(resolved.dot!.x).toBe(resolved.label!.connector!.to.x);
    expect(resolved.dot!.y).toBe(resolved.label!.connector!.to.y);
  });
});
