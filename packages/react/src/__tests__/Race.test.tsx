import type { RaceFrame, RaceSpec } from '@opendata-ai/openchart-core';
import { render, screen, within } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
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
  expect(screen.queryByText('OpenData')).not.toBeInTheDocument();
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

it.each([true, false])('restores t and playing=%s after a theme remount', (playing) => {
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

  expect(ref.current?.instance).not.toBe(previous);
  expect(ref.current?.instance?.getState()).toMatchObject({ t: 1.25, playing, speed: 2 });
  expect(screen.getByText('Annual leaders').style.fontSize).toBe('32px');
  expect(previous?.getState().playing).toBe(false);
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

it('passes a NaN update through to the runtime after a missing value', () => {
  const missing: RaceSpec = {
    ...spec,
    data: spec.data.map((row) => (row.year === 2021 ? { ...row, value: null } : row)),
  };
  const nonFinite: RaceSpec = {
    ...spec,
    data: spec.data.map((row) => (row.year === 2021 ? { ...row, value: NaN } : row)),
  };
  const ref = createRef<RaceHandle>();
  const reports: string[] = [];
  const onWarn = (message: string) => reports.push(message);
  const { rerender } = render(<Race spec={missing} ref={ref} onWarn={onWarn} />);
  const instance = ref.current?.instance;

  rerender(<Race spec={nonFinite} ref={ref} onWarn={onWarn} />);

  expect(ref.current?.instance).toBe(instance);
  expect(reports).toEqual(["Dropped 1 non-finite values from 'value'."]);
});

it('merges context theme and remounts when the resolved dark mode changes', () => {
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
  expect(ref.current?.instance).not.toBe(previous);
  expect(ref.current?.instance?.getState().t).toBe(1.25);
});

it('forwards period payloads, replaces the listener in place, and unsubscribes on unmount', () => {
  const ref = createRef<RaceHandle>();
  const { rerender, unmount } = render(<Race spec={spec} ref={ref} />);
  const instance = ref.current?.instance;
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

  const firstHandler = (value: RaceFrame['period']) => first.push(value);
  rerender(<Race spec={spec} ref={ref} onPeriod={firstHandler} />);
  for (const listener of listeners) listener(period);
  expect(first).toEqual([period]);

  rerender(<Race spec={updated} ref={ref} onPeriod={firstHandler} />);
  expect(on).toHaveBeenCalledTimes(1);

  rerender(<Race spec={updated} ref={ref} onPeriod={(value) => second.push(value)} />);
  for (const listener of listeners) listener(period);
  expect(ref.current?.instance).toBe(instance);
  expect(on.mock.calls.map(([event]) => event)).toEqual(['period', 'period']);
  expect(first).toEqual([period]);
  expect(second).toEqual([period]);
  expect(listeners.size).toBe(1);

  rerender(<Race spec={updated} ref={ref} />);
  expect(listeners.size).toBe(0);
  rerender(<Race spec={updated} ref={ref} onPeriod={firstHandler} />);
  expect(listeners.size).toBe(1);

  unmount();
  expect(listeners.size).toBe(0);
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
  expect(within(chart).getByText('OpenData')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
});
