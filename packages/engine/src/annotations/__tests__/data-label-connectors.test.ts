import type {
  ChartLayout,
  ChartSpec,
  Point,
  Rect,
  ResolvedLabel,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { computeLabelBounds } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { interpolateAnnotationGeometry } from '../interpolate';

type Connector = NonNullable<ResolvedLabel['connector']>;

const payrolls = (
  [
    ['Jan', 353],
    ['Feb', 275],
    ['Mar', 303],
    ['Apr', 175],
    ['May', 272],
    ['Jun', 206],
    ['Jul', 114],
    ['Aug', 142],
    ['Sep', 254],
    ['Oct', 12],
    ['Nov', 227],
    ['Dec', 256],
  ] as const
).map(([month, jobs]) => ({ month, jobs }));

function columns(annotation: TextAnnotation, labels = true): ChartSpec {
  return {
    mark: 'bar',
    data: payrolls,
    encoding: {
      x: { field: 'month', type: 'nominal' },
      y: { field: 'jobs', type: 'quantitative' },
    },
    labels: labels ? { density: 'all', format: ',.0f' } : { density: 'none' },
    annotations: [annotation],
    animation: false,
  };
}

function dataLabelBoxes(layout: ChartLayout): Rect[] {
  return layout.marks.flatMap((mark) =>
    'label' in mark && mark.label?.visible ? [computeLabelBounds(mark.label)] : [],
  );
}

/** Dense samples along the drawn connector: the chord, or the quadratic the renderer draws. */
function samples(connector: Connector): Point[] {
  const { from, to, control } = connector;
  const points: Point[] = [];
  for (let i = 0; i <= 400; i++) {
    const t = i / 400;
    const u = 1 - t;
    points.push(
      connector.style === 'curve' && control
        ? {
            x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
            y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
          }
        : { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
    );
  }
  return points;
}

function crossedLabels(connector: Connector, boxes: Rect[]): Rect[] {
  return boxes.filter((box) =>
    samples(connector).some(
      (p) => p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height,
    ),
  );
}

const story: TextAnnotation = {
  type: 'text',
  x: 'Oct',
  y: 12,
  text: 'Hurricanes and strikes\nstalled October hiring',
  anchor: 'top',
  offset: { dy: -170 },
  connector: true,
};

describe('annotation connectors and data labels', () => {
  it('stops an authored leader short of the value label it would strike through', () => {
    const layout = compileChart(columns(story), { width: 990, height: 450 });
    const connector = layout.annotations[0].label?.connector;
    expect(connector).toBeDefined();
    expect(crossedLabels(connector!, dataLabelBoxes(layout))).toEqual([]);
    // The leader still reaches down to the value label: it is shortened, not dropped.
    expect(connector!.to.y).toBeGreaterThan(connector!.from.y + 100);

    // The authored offset wins: the block sits exactly where it does without labels.
    const unlabeled = compileChart(columns(story, false), { width: 990, height: 450 });
    expect(layout.annotations[0].bounds).toEqual(unlabeled.annotations[0].bounds);
    expect(layout.annotations[0].dot).toEqual(unlabeled.annotations[0].dot);
  });

  it.each([
    ['straight', true],
    ['curve', 'curve'],
  ] as const)('keeps a default-placed %s leader off every value label', (_, connector) => {
    const annotation: TextAnnotation = {
      type: 'text',
      x: 'Jul',
      y: 114,
      text: 'A notable callout\nwith two lines',
      connector,
    };
    const layout = compileChart(columns(annotation), { width: 400, height: 450 });
    const resolved = layout.annotations[0].label?.connector;
    expect(resolved).toBeDefined();
    expect(crossedLabels(resolved!, dataLabelBoxes(layout))).toEqual([]);
  });

  it('nudges an anchored block to a spot whose leader clears the value labels', () => {
    const annotation: TextAnnotation = {
      type: 'text',
      x: 'Mar',
      y: 303,
      text: 'A much longer single line callout',
      anchor: 'top',
      connector: true,
    };
    const layout = compileChart(columns(annotation), { width: 700, height: 450 });
    const resolved = layout.annotations[0].label?.connector;
    expect(resolved).toBeDefined();
    expect(crossedLabels(resolved!, dataLabelBoxes(layout))).toEqual([]);
  });

  it('keeps the stop when geometry is rebuilt mid-transition', () => {
    const layout = compileChart(columns(story), { width: 990, height: 450 });
    const annotation = layout.annotations[0];
    const frame = interpolateAnnotationGeometry(annotation, annotation, 0.5);
    expect(crossedLabels(frame.label!.connector!, dataLabelBoxes(layout))).toEqual([]);
  });
});
