import type { RaceFrame, RaceSpec } from '@opendata-ai/openchart-core';
import * as vanilla from '@opendata-ai/openchart-vanilla';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { expect, it, onTestFinished, vi } from 'vitest';
import { installFrameClock } from '../../../vanilla/src/__test-fixtures__/graph-frame-clock';
import { createFakeObserver } from '../../../vanilla/src/__test-fixtures__/visibility';
import { setObserverFactory } from '../../../vanilla/src/visibility';
import { Race, type RaceHandle, Visualization, VizThemeProvider } from '../index';

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
const playbackSpec: RaceSpec = { ...spec, race: { ...spec.race, duration: 400, holdEnd: 0 } };

it.each([
  false,
  true,
])('replays from the start after a completed race changes theme with autoplay=%s', (autoplay) => {
  const clock = installFrameClock();
  onTestFinished(clock.restore);
  const replaySpec: RaceSpec = { ...playbackSpec, race: { ...playbackSpec.race, autoplay } };
  const ref = createRef<RaceHandle>();
  const { rerender } = render(<Race spec={replaySpec} ref={ref} />);
  const previous = ref.current?.instance;
  if (!previous) throw new Error('Race did not mount');
  previous.setSpeed(2);
  if (!autoplay) fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  clock.pump(0);
  clock.pump(200);
  expect(previous.getState()).toMatchObject({ t: 2, playing: false, ended: true });

  rerender(<Race spec={replaySpec} ref={ref} theme={{ fonts: { sizes: { title: 32 } } }} />);
  const current = ref.current?.instance;
  expect(current).toBe(previous);
  expect(current?.getState()).toMatchObject({ t: 2, playing: false, ended: true, speed: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(current?.getState()).toMatchObject({ t: 0, playing: true, speed: 2 });

  clock.pump(300);
  clock.pump(400);
  expect(current?.getState().t).toBe(1);
});

it('replays from the start after a completed race remounts', () => {
  const clock = installFrameClock();
  onTestFinished(clock.restore);
  const replaySpec: RaceSpec = { ...playbackSpec, race: { ...playbackSpec.race, autoplay: true } };
  const ref = createRef<RaceHandle>();
  const { rerender } = render(<Race spec={replaySpec} ref={ref} />);
  const previous = ref.current?.instance;
  if (!previous) throw new Error('Race did not mount');
  previous.setSpeed(2);
  clock.pump(0);
  clock.pump(200);
  expect(previous.getState()).toMatchObject({ t: 2, playing: false, ended: true });

  rerender(<Race spec={replaySpec} ref={ref} watermark={false} />);
  const current = ref.current?.instance;
  expect(current).not.toBe(previous);
  expect(current?.getState()).toMatchObject({ t: 2, playing: false, ended: true, speed: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(current?.getState()).toMatchObject({ t: 0, playing: true, speed: 2 });

  clock.pump(300);
  clock.pump(400);
  expect(current?.getState().t).toBe(1);
});

it('reuses the chart and controls for an equal inline spec', () => {
  const ref = createRef<RaceHandle>();
  const { rerender } = render(<Race ref={ref} spec={spec} />);
  const instance = ref.current?.instance;
  if (!instance) throw new Error('Race did not mount');
  const update = vi.spyOn(instance, 'update');
  const chart = screen.getByRole('img');
  const play = screen.getByRole('button', { name: 'Play' });

  rerender(<Race ref={ref} spec={structuredClone(spec)} />);

  expect(update).not.toHaveBeenCalled();
  expect(screen.getByRole('img')).toBe(chart);
  expect(screen.getByRole('button', { name: 'Play' })).toBe(play);
});

it('keeps the instance and Play focus for an equal inline theme', () => {
  const ref = createRef<RaceHandle>();
  const theme = { fonts: { sizes: { title: 32 } } };
  const { rerender } = render(<Race ref={ref} spec={spec} theme={theme} />);
  const instance = ref.current?.instance;
  const play = screen.getByRole('button', { name: 'Play' });
  play.focus();
  expect(play).toHaveFocus();

  rerender(<Race ref={ref} spec={spec} theme={structuredClone(theme)} />);

  expect(ref.current?.instance).toBe(instance);
  expect(screen.getByRole('button', { name: 'Play' })).toBe(play);
  expect(play).toHaveFocus();
});

it('preserves the speed set before playback starts after a theme change', () => {
  const ref = createRef<RaceHandle>();
  const { rerender } = render(<Race ref={ref} spec={spec} />);
  const previous = ref.current?.instance;
  previous?.setSpeed(2);

  rerender(<Race ref={ref} spec={spec} theme={{ fonts: { sizes: { title: 32 } } }} />);

  expect(ref.current?.instance).toBe(previous);
  expect(ref.current?.instance?.getState()).toMatchObject({ t: 0, playing: false, speed: 2 });
});

it('moves the initial period subscription to the new instance on remount', () => {
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
    const ref = createRef<RaceHandle>();
    const { rerender } = render(<Race ref={ref} spec={spec} onPeriod={onPeriod} />);
    expect(ref.current?.instance).toBe(subscriptions[0]?.instance);

    rerender(<Race ref={ref} spec={spec} watermark={false} onPeriod={onPeriod} />);

    expect(ref.current?.instance).toBe(subscriptions[1]?.instance);
    expect(subscriptions.map(({ events, removed }) => ({ events, removed }))).toEqual([
      { events: ['period'], removed: 1 },
      { events: ['period'], removed: 0 },
    ]);
  } finally {
    mountSpy.mockRestore();
  }
});

it('mounts one playable race in Strict Mode and forwards the wrapper props', () => {
  const ref = createRef<RaceHandle>();
  const { container } = render(
    <StrictMode>
      <Race
        spec={spec}
        ref={ref}
        className="reader-race"
        style={{ width: 420 }}
        watermark={false}
      />
    </StrictMode>,
  );

  const chart = within(screen.getByRole('img'));
  expect(chart.getByText('Annual leaders')).toBeInTheDocument();
  expect(chart.getByText('Alpha')).toBeInTheDocument();
  expect(screen.getByRole('slider', { name: 'Time' })).toHaveAttribute('aria-valuetext', '2020');
  expect(container.firstElementChild).toHaveClass('reader-race');
  expect(container.firstElementChild).toHaveStyle({ width: '420px' });
  expect(screen.queryByText('OpenChart')).not.toBeInTheDocument();
  expect(ref.current?.instance?.getState()).toMatchObject({ t: 0, playing: false });
});

it('updates the chart on the same instance and keeps the fractional playhead', () => {
  const ref = createRef<RaceHandle>();
  const { rerender } = render(<Race spec={spec} ref={ref} />);
  const instance = ref.current?.instance;
  expect(instance).toBeTruthy();
  instance?.seek(1.25);

  rerender(<Race spec={updated} ref={ref} />);

  expect(within(screen.getByRole('img')).getByText('Updated leaders')).toBeInTheDocument();
  expect(ref.current?.instance).toBe(instance);
  expect(instance?.getState()).toMatchObject({ t: 1.25, playing: false });
});

it.each([true, false])('keeps t and playing=%s after a theme change', (playing) => {
  const ref = createRef<RaceHandle>();
  const raceSpec = { ...spec, race: { ...spec.race, autoplay: !playing } };
  const { rerender } = render(<Race spec={raceSpec} ref={ref} />);
  const previous = ref.current?.instance;
  expect(previous).toBeTruthy();
  previous?.seek(1.25);
  previous?.setSpeed(2);
  if (playing) previous?.play();
  else previous?.pause();

  rerender(<Race spec={raceSpec} ref={ref} theme={{ fonts: { sizes: { title: 32 } } }} />);

  expect(ref.current?.instance).toBe(previous);
  expect(ref.current?.instance?.getState()).toMatchObject({ t: 1.25, playing, speed: 2 });
  expect(screen.getByText('Annual leaders').style.fontSize).toBe('32px');
});

it('keeps visibility autoplay pending when the wrapper remounts an unseen race', () => {
  const observer = createFakeObserver();
  setObserverFactory(observer.factory);
  onTestFinished(() => setObserverFactory(null));
  const visible: RaceSpec = { ...spec, race: { ...spec.race, autoplay: 'visible' } };
  const ref = createRef<RaceHandle>();
  const { container, rerender } = render(<Race spec={visible} ref={ref} />);
  const previous = ref.current?.instance;
  const host = container.firstElementChild;
  if (!host || !previous) throw new Error('Race did not mount');

  rerender(<Race spec={visible} ref={ref} watermark={false} />);
  expect(ref.current?.instance).not.toBe(previous);
  expect(ref.current?.instance?.getState()).toMatchObject({ t: 0, playing: false });
  observer.fire(host, 0.5);
  expect(ref.current?.instance?.getState().playing).toBe(true);
});

it('keeps visibility autoplay pending after a dark mode change', () => {
  const observer = createFakeObserver();
  setObserverFactory(observer.factory);
  try {
    const visible: RaceSpec = { ...spec, race: { ...spec.race, autoplay: 'visible' } };
    const ref = createRef<RaceHandle>();
    const { container, rerender } = render(<Race spec={visible} ref={ref} />);
    const host = container.firstElementChild;
    if (!host) throw new Error('Race did not mount');
    const playing = () => ref.current?.instance?.getState().playing;
    expect(playing()).toBe(false);

    rerender(<Race spec={visible} ref={ref} darkMode="force" />);

    expect(playing()).toBe(false);
    observer.fire(host, 0.5);
    expect(playing()).toBe(true);
  } finally {
    setObserverFactory(null);
  }
});

it('merges context theme and redraws when the resolved dark mode changes', () => {
  const ref = createRef<RaceHandle>();
  const theme = { fonts: { sizes: { title: 34, small: 17 } } };
  const override = { fonts: { sizes: { title: 28 } } };
  const raceSpec = { ...spec, chrome: { title: 'Annual leaders', source: 'Annual survey' } };
  const view = (darkMode?: 'off') => (
    <VizThemeProvider theme={theme} darkMode="force">
      <Race spec={raceSpec} ref={ref} theme={override} darkMode={darkMode} />
    </VizThemeProvider>
  );
  const { rerender, container } = render(view());
  const previous = ref.current?.instance;
  previous?.seek(1.25);
  expect(container.querySelector('.oc-dark')).toBeInTheDocument();
  expect(screen.getByText('Annual leaders').style.fontSize).toBe('28px');
  expect(screen.getByText('Annual survey').style.fontSize).toBe('17px');

  rerender(view('off'));

  expect(container.querySelector('.oc-dark')).not.toBeInTheDocument();
  expect(ref.current?.instance).toBe(previous);
  expect(ref.current?.instance?.getState().t).toBe(1.25);
});

it('delivers period crossings in order and stops notifying a removed callback', () => {
  const clock = installFrameClock();
  onTestFinished(clock.restore);
  const first: RaceFrame['period'][] = [];
  const second: RaceFrame['period'][] = [];
  const ref = createRef<RaceHandle>();
  const { rerender, unmount } = render(
    <Race spec={playbackSpec} ref={ref} onPeriod={(period) => first.push(period)} />,
  );
  const instance = ref.current?.instance;
  if (!instance) throw new Error('Race did not mount');

  instance.play();
  clock.pump(0);
  clock.pump(100);
  expect(first).toEqual([]);
  clock.pump(200);
  const period2021 = { index: 1, value: 2021, label: '2021' };
  expect(first).toEqual([period2021]);
  clock.pump(400);
  const period2022 = { index: 2, value: 2022, label: '2022' };
  expect(first).toEqual([period2021, period2022]);

  rerender(<Race spec={playbackSpec} ref={ref} onPeriod={(period) => second.push(period)} />);
  expect(ref.current?.instance).toBe(instance);
  instance.seek(0);
  const period2020 = { index: 0, value: 2020, label: '2020' };
  expect(second).toEqual([period2020]);
  rerender(<Race spec={playbackSpec} ref={ref} />);
  instance.seek(1);
  expect(second).toEqual([period2020]);
  rerender(<Race spec={playbackSpec} ref={ref} onPeriod={(period) => first.push(period)} />);
  unmount();
  instance.seek(2);
  expect(first).toEqual([period2021, period2022]);
});

it('stops and destroys the real instance on unmount', () => {
  const ref = createRef<RaceHandle>();
  const { container, unmount } = render(<Race spec={spec} ref={ref} />);
  const host = container.firstElementChild;
  const handle = ref.current;
  const instance = handle?.instance;
  expect(screen.getByRole('img')).toBeInTheDocument();
  instance?.seek(1.25);
  instance?.play();

  unmount();
  instance?.play();
  instance?.seek(0);

  expect(handle?.instance).toBeNull();
  expect(host?.querySelector('svg')).toBeNull();
  expect(instance?.getState()).toMatchObject({ t: 1.25, playing: false });
});

it('forwards compile warnings to the current callback and propagates invalid specs', () => {
  const first: string[] = [];
  const second: string[] = [];
  const ref = createRef<RaceHandle>();
  const { rerender } = render(
    <Race spec={spec} ref={ref} onWarn={(message) => first.push(message)} />,
  );
  const instance = ref.current?.instance;
  const warns: RaceSpec = { ...spec, race: { ...spec.race, top: 2 } };
  rerender(<Race spec={warns} ref={ref} onWarn={(message) => second.push(message)} />);

  expect(ref.current?.instance).toBe(instance);
  expect(first).toEqual([]);
  expect(second).toEqual(['race.top is 2 but the data has 1 distinct keys. Showing at most 1.']);

  const invalid: RaceSpec = { ...spec, race: { top: 0 } };
  expect(() => rerender(<Race spec={invalid} ref={ref} />)).toThrow(/top/);
});

it('routes race specs through Visualization', () => {
  render(
    <Visualization
      spec={spec}
      theme={{ fonts: { sizes: { title: 32 } } }}
      darkMode="force"
      className="routed-race"
      style={{ width: 420 }}
    />,
  );

  const chart = screen.getByRole('img');
  expect(chart.closest('.routed-race')).toHaveStyle({ width: '420px' });
  expect(chart.closest('.oc-dark')).toBeInTheDocument();
  expect(within(chart).getByText('Annual leaders').style.fontSize).toBe('32px');
  expect(within(chart).getByText('OpenChart')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
});
