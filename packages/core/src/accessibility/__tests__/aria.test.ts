import { describe, expect, it } from 'vitest';
import type { Mark, MarkAria } from '../../types/layout';
import { generateAriaLabels } from '../aria';

const defaultAria: MarkAria = { label: 'test' };

describe('generateAriaLabels', () => {
  it('generates labels for line marks', () => {
    const marks: Mark[] = [
      {
        type: 'line',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        stroke: '#333',
        strokeWidth: 2,
        seriesKey: 'US',
        data: [],
        aria: defaultAria,
      },
    ];

    const labels = generateAriaLabels(marks);
    expect(labels.get('mark-0')).toContain('Line series: US');
    expect(labels.get('mark-0')).toContain('2 points');
  });

  it('generates labels for rect marks', () => {
    const marks: Mark[] = [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 50,
        height: 100,
        fill: '#1b7fa3',
        data: { category: 'Tech', value: 42 },
        aria: defaultAria,
      },
    ];

    const labels = generateAriaLabels(marks);
    expect(labels.get('mark-0')).toContain('Data point');
    expect(labels.get('mark-0')).toContain('category: Tech');
    expect(labels.get('mark-0')).toContain('value: 42');
  });

  it('generates labels for arc marks', () => {
    const marks: Mark[] = [
      {
        type: 'arc',
        path: 'M...',
        centroid: { x: 50, y: 50 },
        innerRadius: 0,
        outerRadius: 100,
        startAngle: 0,
        endAngle: Math.PI,
        fill: '#e15759',
        stroke: '#fff',
        strokeWidth: 1,
        data: { sector: 'Healthcare', percent: 25 },
        aria: defaultAria,
      },
    ];

    const labels = generateAriaLabels(marks);
    expect(labels.get('mark-0')).toContain('Slice');
    expect(labels.get('mark-0')).toContain('Healthcare');
  });

  it('generates labels for point marks', () => {
    const marks: Mark[] = [
      {
        type: 'point',
        cx: 100,
        cy: 200,
        r: 5,
        fill: '#333',
        stroke: '#333',
        strokeWidth: 1,
        data: { x: 10, y: 20 },
        aria: defaultAria,
      },
    ];

    const labels = generateAriaLabels(marks);
    expect(labels.get('mark-0')).toContain('Data point');
    expect(labels.get('mark-0')).toContain('x: 10');
  });

  it('handles empty marks array', () => {
    const labels = generateAriaLabels([]);
    expect(labels.size).toBe(0);
  });

  it('handles multiple marks with sequential keys', () => {
    const marks: Mark[] = [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fill: '#333',
        data: { a: 1 },
        aria: defaultAria,
      },
      {
        type: 'rect',
        x: 20,
        y: 0,
        width: 10,
        height: 10,
        fill: '#666',
        data: { a: 2 },
        aria: defaultAria,
      },
    ];

    const labels = generateAriaLabels(marks);
    expect(labels.has('mark-0')).toBe(true);
    expect(labels.has('mark-1')).toBe(true);
  });
});
