import type { RaceSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRace, type RaceInstance } from '../../race-mount';
import { RACE_RENDERERS } from '../renderers';

vi.mock('../renderers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../renderers')>();
  return { ...original, RACE_RENDERERS: { ...original.RACE_RENDERERS } };
});

const rows = [2020, 2021, 2022].flatMap((year, index) => [
  { key: 'A', year, value: 100 - index * 20 },
  { key: 'B', year, value: 40 + index * 80 },
]);

const spec: RaceSpec = {
  type: 'race',
  mark: 'bar',
  data: rows,
  encoding: {
    time: { field: 'year', type: 'ordinal' },
    key: { field: 'key', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  race: { top: 2, duration: 2000, swap: 0, autoplay: false },
};

const frames = new Map<number, FrameRequestCallback>();
let host: HTMLDivElement;
let race: RaceInstance | undefined;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  let nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++nextFrame, cb);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});

afterEach(() => {
  race?.destroy();
  race = undefined;
  host.remove();
  frames.clear();
  vi.unstubAllGlobals();
});

describe('race playback wiring', () => {
  it('reports a period clamped by an update only once the new race is in the document', () => {
    race = createRace(host, spec, { autoResize: false });
    race.seek(2);
    const seenLabels: Array<string | null | undefined> = [];
    race.on('period', () => {
      seenLabels.push(host.querySelector('.oc-race-period')?.textContent);
    });
    race.update({ ...spec, data: rows.filter((row) => row.year < 2022) });
    expect(race.getState().period.label).toBe('2021');
    expect(seenLabels).toEqual(['2021']);
  });

  it('starts no playback when the first render throws', () => {
    const bar = RACE_RENDERERS.bar;
    const failure = new Error('renderer failed');
    RACE_RENDERERS.bar = () => {
      throw failure;
    };
    try {
      const initialState = { t: 0.5, playing: true, speed: 1, ended: false };
      expect(() => createRace(host, spec, { autoResize: false, initialState })).toThrow(failure);
    } finally {
      RACE_RENDERERS.bar = bar;
    }
    expect(frames.size).toBe(0);
  });

  it('keeps the race wording in playback range errors', () => {
    race = createRace(host, spec, { autoResize: false });
    expect(() => race?.seek(NaN)).toThrow(new RangeError('Race seek position must be finite'));
    expect(() => race?.setSpeed(0)).toThrow(
      new RangeError('Race playback speed must be finite and greater than zero'),
    );
  });
});
