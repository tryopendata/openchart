import type { ResolvedAnnotation } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { refreshConnector } from '../geometry';
import { interpolateAnnotationGeometry } from '../interpolate';

const next: ResolvedAnnotation = {
  type: 'text',
  id: 'a',
  bounds: { x: 100, y: 40, width: 80, height: 40 },
  label: {
    text: 'Heading',
    x: 100,
    y: 53,
    visible: true,
    style: { fontSize: 13 },
    bounds: { x: 100, y: 40, width: 80, height: 17 },
    connector: {
      from: { x: 100, y: 60 },
      to: { x: 300, y: 200 },
      endpoint: { x: 305, y: 205 },
      stroke: 'black',
      style: 'curve',
      arrow: true,
      bend: 0.5,
    },
  },
  subtitle: { text: 'Subtitle', x: 100, y: 73, style: { fontSize: 11 } },
  dot: { x: 305, y: 205, radius: 4, strokeWidth: 1, stroke: 'black', fill: 'white' },
};
next.label!.connector = refreshConnector(next.label!.connector!, next.bounds!, 4.5);
const previous = structuredClone(next);
previous.label!.x = 40;
previous.label!.y = 83;
previous.label!.connector!.endpoint = { x: 405, y: 105 };
previous.dot!.x = 405;
previous.dot!.y = 105;

describe('independent annotation animation geometry', () => {
  it('interpolates label and data anchor independently, rebuilding control points', () => {
    const sample = interpolateAnnotationGeometry(previous, next, 0.5);
    expect(sample.label!.x).toBe(70);
    expect(sample.label!.y).toBe(68);
    expect(sample.dot).toMatchObject({ x: 355, y: 155 });
    expect(sample.label!.connector!.endpoint).toEqual({ x: 355, y: 155 });
    expect(sample.label!.connector).toEqual(
      refreshConnector(sample.label!.connector!, sample.bounds!, 4.5, true),
    );
  });
  it('ends at exact engine geometry without mutating either layout', () => {
    const before = structuredClone(previous);
    const after = structuredClone(next);
    expect(interpolateAnnotationGeometry(previous, next, 1)).toEqual(next);
    interpolateAnnotationGeometry(previous, next, 0.4);
    expect(previous).toEqual(before);
    expect(next).toEqual(after);
  });
  it('suppresses a leader throughout when final geometry has none', () => {
    const hidden = structuredClone(next);
    delete hidden.label!.connector;
    for (const t of [0, 0.25, 0.5, 0.75, 1])
      expect(interpolateAnnotationGeometry(previous, hidden, t).label!.connector).toBeUndefined();
  });
  it('does not flicker when a final visible leader becomes short mid-transition', () => {
    const crossing = structuredClone(previous);
    crossing.label!.connector!.endpoint = { x: 0, y: 0 };
    for (const t of [0, 0.25, 0.5, 0.75, 1])
      expect(interpolateAnnotationGeometry(crossing, next, t).label!.connector).toBeDefined();
  });
});
