import { describe, expect, it } from 'vitest';
import {
  occupiedBoundsSizeKeyCandidate,
  reserveGeoMapArea,
  reserveSideGeoMapArea,
} from '../layout';

const fullArea = { x: 24, y: 70, width: 976, height: 430 };

describe('map frame reservations', () => {
  it('keeps the legacy top band and its gap inside the measured frame', () => {
    const frame = reserveGeoMapArea(fullArea, 54, 'top');
    expect(frame.area).toEqual({ x: 24, y: 132, width: 976, height: 368 });
    expect(frame.area.y + frame.area.height).toBe(fullArea.y + fullArea.height);
  });
  it('keeps the bottom band below the same undistorted map viewport', () => {
    const frame = reserveGeoMapArea(fullArea, 54, 'bottom');
    expect(frame.area).toEqual({ x: 24, y: 70, width: 976, height: 368 });
    expect(frame.legendReserveGap).toBe(8);
  });
  it('does not invent a gap for a hidden legend', () => {
    expect(reserveGeoMapArea(fullArea, 0, 'top')).toEqual({ area: fullArea, legendReserveGap: 0 });
  });
});

describe('side map frame reservations', () => {
  it('reserves a full-height map beside the entire key stack', () => {
    const frame = reserveSideGeoMapArea(fullArea, 220, 180, 'right')!;
    expect(frame.area).toEqual({ x: 24, y: 70, width: 740, height: 430 });
    expect(frame.legend).toEqual({ x: 780, y: 70, width: 220, height: 180 });
  });
  it('bottom aligns the stack without changing projection space', () => {
    const top = reserveSideGeoMapArea(fullArea, 220, 180, 'right')!;
    const bottom = reserveSideGeoMapArea(fullArea, 220, 180, 'bottom-right')!;
    expect(bottom.area).toEqual(top.area);
    expect(bottom.legend.y + bottom.legend.height).toBe(fullArea.y + fullArea.height);
  });
  it('rejects a gutter that leaves too little geography or overflows height', () => {
    expect(reserveSideGeoMapArea({ ...fullArea, width: 342 }, 220, 180, 'right')).toBeNull();
    expect(reserveSideGeoMapArea(fullArea, 220, 431, 'right')).toBeNull();
  });
});

describe('occupied size-key prototype', () => {
  it('keeps the current bottom-right choice when no occupied bounds conflict', () => {
    expect(occupiedBoundsSizeKeyCandidate(fullArea, 100, 80, [])).toEqual({
      x: 882,
      y: 402,
      width: 100,
      height: 80,
    });
  });
  it('reports when no corner can contain the key without clipping', () => {
    expect(
      occupiedBoundsSizeKeyCandidate({ x: 0, y: 0, width: 100, height: 70 }, 100, 80, []),
    ).toBeNull();
  });
  it('chooses a clear corner while preserving point centers and key size', () => {
    const obstacle = { x: 880, y: 400, width: 110, height: 90 };
    expect(occupiedBoundsSizeKeyCandidate(fullArea, 100, 80, [obstacle])).toEqual({
      x: 42,
      y: 402,
      width: 100,
      height: 80,
    });
  });
});

it('scores point bounds as occupied and keeps deterministic ties', () => {
  const point = { x: 880, y: 400, width: 40, height: 40 };
  const first = occupiedBoundsSizeKeyCandidate(fullArea, 100, 80, [point]);
  expect(first?.x).toBe(42);
  expect(occupiedBoundsSizeKeyCandidate(fullArea, 100, 80, [point])).toEqual(first);
});

it('wraps long unbroken caption text at doubled size without reducing font size', async () => {
  const { measureGeoKeyText } = await import('../layout');
  const measured = measureGeoKeyText(
    'ExtraordinarilyLongUnitWithoutSpaces',
    180,
    { fontFamily: 'Arial', fontSize: 24, fontWeight: 400, fill: '#222', lineHeight: 1.35 },
    (text, size) => ({ width: text.length * size, height: size }),
  );
  expect(measured.lines.join('')).toBe('ExtraordinarilyLongUnitWithoutSpaces');
  for (const line of measured.lines) expect(line.length * 24).toBeLessThanOrEqual(180);
  expect(measured.height).toBeGreaterThan(24);
});

it('excludes zoom controls from size-key choices even when geography occupies other corners', () => {
  const area = { x: 0, y: 0, width: 350, height: 300 };
  const controls = { x: 312, y: 8, width: 30, height: 86 };
  const occupied = [
    { x: 18, y: 202, width: 100, height: 80 },
    { x: 232, y: 202, width: 100, height: 80 },
    { x: 18, y: 18, width: 100, height: 80 },
  ];
  const key = occupiedBoundsSizeKeyCandidate(area, 100, 80, occupied, 18, [controls])!;
  expect(key.y).toBe(202);
});
