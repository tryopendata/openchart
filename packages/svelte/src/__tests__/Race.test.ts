import type { RaceFrame, RaceSpec } from '@opendata-ai/openchart-core';
import * as vanilla from '@opendata-ai/openchart-vanilla';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import { createFakeObserver } from '../../../vanilla/src/__test-fixtures__/visibility';
import { setObserverFactory } from '../../../vanilla/src/visibility';
import { DARK_MODE_KEY, THEME_KEY } from '../context.js';
import { Race, Visualization } from '../index';
import RaceSpecHarness from './RaceSpecHarness.svelte';

const spec: RaceSpec = {
  type: 'race',
  mark: 'bar',
  data: [
    { year: 2020, name: 'Alpha', value: 10 },
    { year: 2021, name: 'Alpha', value: 20 },
    { year: 2022, name: 'Alpha', value: 30 },
  ],
  encoding: {
    time: { field: 'year', type: 'ordinal' },
    key: { field: 'name', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  race: { top: 1, autoplay: false },
  chrome: { title: 'Annual leaders' },
};

const updated: RaceSpec = { ...spec, chrome: { title: 'Updated leaders' } };

it('preserves the speed set before playback starts across a theme remount', async () => {
  const { component, rerender } = render(Race, { props: { spec } });
  const previous = component.getInstance();
  previous?.setSpeed(2);

  await rerender({ theme: { fonts: { sizes: { title: 32 } } } });

  expect(component.getInstance()).not.toBe(previous);
  expect(component.getInstance()?.getState()).toMatchObject({ t: 0, playing: false, speed: 2 });
});

it('updates on in-place spec edits and reuses the chart for equal snapshots', async () => {
  const { component, getByRole } = render(RaceSpecHarness, { props: { initialSpec: spec } });
  const instance = component.getInstance();
  if (!instance) throw new Error('Race did not mount');
  const update = vi.spyOn(instance, 'update');

  const roundedMark = { type: 'bar', cornerRadius: 8 };
  await fireEvent.click(getByRole('button', { name: 'Round bars' }));
  expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mark: roundedMark }));

  const chart = getByRole('img');
  await fireEvent.click(getByRole('button', { name: 'Render an equal spec' }));
  expect(update).toHaveBeenCalledTimes(1);
  expect(getByRole('img')).toBe(chart);
});

it('moves the initial period subscription to the new instance on remount', async () => {
  const subscriptions: Array<{
    instance: vanilla.RaceInstance;
    events: string[];
    removed: number;
  }> = [];
  const createRace = vanilla.createRace;
  const mountSpy = vi.spyOn(vanilla, 'createRace').mockImplementation((...args) => {
    const instance = createRace(...args);
    const record: (typeof subscriptions)[number] = { instance, events: [], removed: 0 };
    subscriptions.push(record);
    const listen = instance.on;
    vi.spyOn(instance, 'on').mockImplementation((event, callback) => {
      record.events.push(event);
      const unsubscribe = listen(event, callback);
      return () => {
        record.removed++;
        unsubscribe();
      };
    });
    return instance;
  });
  try {
    const onPeriod = (_period: RaceFrame['period']) => {};
    const { component, rerender } = render(Race, { props: { spec, onperiod: onPeriod } });
    expect(component.getInstance()).toBe(subscriptions[0]?.instance);

    await rerender({ darkMode: 'force' });

    expect(component.getInstance()).toBe(subscriptions[1]?.instance);
    expect(subscriptions.map(({ events, removed }) => ({ events, removed }))).toEqual([
      { events: ['period'], removed: 1 },
      { events: ['period'], removed: 0 },
    ]);
  } finally {
    mountSpy.mockRestore();
  }
});

it('mounts a playable race and forwards the wrapper props', () => {
  const { component, container } = render(Race, {
    props: { spec, class: 'reader-race', style: 'width: 420px', watermark: false },
  });

  const chart = within(screen.getByRole('img'));
  expect(chart.getByText('Annual leaders')).toBeInTheDocument();
  expect(chart.getByText('Alpha')).toBeInTheDocument();
  expect(screen.getByRole('slider', { name: 'Time' })).toHaveAttribute('aria-valuetext', '2020');
  expect(container.firstElementChild).toHaveClass('reader-race');
  expect(container.firstElementChild).toHaveStyle({ width: '420px' });
  expect(screen.queryByText('OpenData')).not.toBeInTheDocument();
  expect(component.getInstance()?.getState()).toMatchObject({ t: 0, playing: false });
});

it('updates the chart on the same instance and keeps the fractional playhead', async () => {
  const { component, rerender } = render(Race, { props: { spec } });
  const instance = component.getInstance();
  expect(instance).toBeTruthy();
  instance?.seek(1.25);

  await rerender({ spec: updated });

  expect(within(screen.getByRole('img')).getByText('Updated leaders')).toBeInTheDocument();
  expect(component.getInstance()).toBe(instance);
  expect(instance?.getState()).toMatchObject({ t: 1.25, playing: false });
});

it.each([true, false])('restores t and playing=%s after a theme remount', async (playing) => {
  const raceSpec = { ...spec, race: { ...spec.race, autoplay: !playing } };
  const { component, rerender } = render(Race, { props: { spec: raceSpec } });
  const previous = component.getInstance();
  expect(previous).toBeTruthy();
  previous?.seek(1.25);
  previous?.setSpeed(2);
  if (playing) previous?.play();
  else previous?.pause();

  await rerender({ theme: { fonts: { sizes: { title: 32 } } } });

  expect(component.getInstance()).not.toBe(previous);
  expect(component.getInstance()?.getState()).toMatchObject({ t: 1.25, playing, speed: 2 });
  expect(screen.getByText('Annual leaders').style.fontSize).toBe('32px');
  expect(previous?.getState().playing).toBe(false);
});

it('keeps visibility autoplay pending after a dark mode change', async () => {
  const observer = createFakeObserver();
  setObserverFactory(observer.factory);
  try {
    const visible: RaceSpec = { ...spec, race: { ...spec.race, autoplay: 'visible' } };
    const { component, container, rerender } = render(Race, { props: { spec: visible } });
    const host = container.firstElementChild;
    if (!host) throw new Error('Race did not mount');
    const playing = () => component.getInstance()?.getState().playing;
    expect(playing()).toBe(false);

    await rerender({ darkMode: 'force' });

    expect(playing()).toBe(false);
    observer.fire(host, 0.5);
    expect(playing()).toBe(true);
  } finally {
    setObserverFactory(null);
  }
});

it('passes a NaN update through to the runtime after a missing value', async () => {
  const missing: RaceSpec = {
    ...spec,
    data: spec.data.map((row) => (row.year === 2021 ? { ...row, value: null } : row)),
  };
  const nonFinite: RaceSpec = {
    ...spec,
    data: spec.data.map((row) => (row.year === 2021 ? { ...row, value: NaN } : row)),
  };
  const reports: string[] = [];
  const { component, rerender } = render(Race, {
    props: { spec: missing, onWarn: (message) => reports.push(message) },
  });
  const instance = component.getInstance();

  await rerender({ spec: nonFinite });

  expect(component.getInstance()).toBe(instance);
  expect(reports).toEqual(["Dropped 1 non-finite values from 'value'."]);
});

it('merges context theme and remounts when the resolved dark mode changes', async () => {
  const raceSpec = { ...spec, chrome: { title: 'Annual leaders', source: 'Annual survey' } };
  const { component, rerender, container } = render(Race, {
    props: { spec: raceSpec, theme: { fonts: { sizes: { title: 28 } } } },
    context: new Map<symbol, () => unknown>([
      [THEME_KEY, () => ({ fonts: { sizes: { title: 34, small: 17 } } })],
      [DARK_MODE_KEY, () => 'force'],
    ]),
  });
  const previous = component.getInstance();
  previous?.seek(1.25);
  expect(container.querySelector('.oc-dark')).toBeInTheDocument();
  expect(screen.getByText('Annual leaders').style.fontSize).toBe('28px');
  expect(screen.getByText('Annual survey').style.fontSize).toBe('17px');

  await rerender({ darkMode: 'off' });

  expect(container.querySelector('.oc-dark')).not.toBeInTheDocument();
  expect(component.getInstance()).not.toBe(previous);
  expect(component.getInstance()?.getState().t).toBe(1.25);
});

it('forwards period payloads, replaces the listener in place, and unsubscribes on unmount', async () => {
  const { component, rerender, unmount } = render(Race, { props: { spec } });
  const instance = component.getInstance();
  if (!instance) throw new Error('Race did not mount');
  const listen = instance.on.bind(instance);
  const listeners = new Set<(period: RaceFrame['period']) => void>();
  const on = vi.spyOn(instance, 'on').mockImplementation((event, callback) => {
    const unsubscribe = listen(event, callback);
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
      unsubscribe();
    };
  });
  const first: RaceFrame['period'][] = [];
  const second: RaceFrame['period'][] = [];
  const period = { index: 1, value: 2021, label: '2021' };

  await rerender({ onperiod: (value) => first.push(value) });
  for (const listener of listeners) listener(period);
  expect(first).toEqual([period]);

  await rerender({ spec: updated });
  expect(on).toHaveBeenCalledTimes(1);

  await rerender({ onperiod: (value) => second.push(value) });
  for (const listener of listeners) listener(period);
  expect(component.getInstance()).toBe(instance);
  expect(on.mock.calls.map(([event]) => event)).toEqual(['period', 'period']);
  expect(first).toEqual([period]);
  expect(second).toEqual([period]);
  expect(listeners.size).toBe(1);

  await rerender({ onperiod: undefined });
  expect(listeners.size).toBe(0);
  await rerender({ onperiod: (value) => first.push(value) });
  expect(listeners.size).toBe(1);

  unmount();
  expect(listeners.size).toBe(0);
});

it('stops and destroys the real instance on unmount', () => {
  const { component, container, unmount } = render(Race, { props: { spec } });
  const host = container.firstElementChild;
  const instance = component.getInstance();
  expect(screen.getByRole('img')).toBeInTheDocument();
  instance?.seek(1.25);
  instance?.play();

  unmount();
  instance?.play();
  instance?.seek(0);

  expect(component.getInstance()).toBeNull();
  expect(host?.querySelector('svg')).toBeNull();
  expect(instance?.getState()).toMatchObject({ t: 1.25, playing: false });
});

it('forwards compile warnings to the current callback and propagates invalid specs', async () => {
  const first: string[] = [];
  const second: string[] = [];
  const { component, rerender } = render(Race, {
    props: { spec, onWarn: (message) => first.push(message) },
  });
  const instance = component.getInstance();
  const warns: RaceSpec = { ...spec, race: { ...spec.race, top: 2 } };
  await rerender({ spec: warns, onWarn: (message) => second.push(message) });

  expect(component.getInstance()).toBe(instance);
  expect(first).toEqual([]);
  expect(second).toEqual(['race.top is 2 but the data has 1 distinct keys. Showing at most 1.']);

  const invalid: RaceSpec = { ...spec, race: { top: 0 } };
  await expect(rerender({ spec: invalid })).rejects.toThrow(/top/);
});

it('routes race specs through Visualization', () => {
  render(Visualization, {
    props: {
      spec,
      theme: { fonts: { sizes: { title: 32 } } },
      darkMode: 'force',
      class: 'routed-race',
      style: 'width: 420px',
    },
  });

  const chart = screen.getByRole('img');
  expect(chart.closest('.routed-race')).toHaveStyle({ width: '420px' });
  expect(chart.closest('.oc-dark')).toBeInTheDocument();
  expect(within(chart).getByText('Annual leaders').style.fontSize).toBe('32px');
  expect(within(chart).getByText('OpenData')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
});
