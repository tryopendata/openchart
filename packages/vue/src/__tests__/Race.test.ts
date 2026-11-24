import type { RaceFrame, RaceSpec } from '@opendata-ai/openchart-core';
import type { RaceInstance } from '@opendata-ai/openchart-vanilla';
import * as vanilla from '@opendata-ai/openchart-vanilla';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, shallowRef } from 'vue';
import { createFakeObserver } from '../../../vanilla/src/__test-fixtures__/visibility';
import { setObserverFactory } from '../../../vanilla/src/visibility';
import { Race, type RaceProps, Visualization, VizThemeProvider } from '../index';

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

it('reuses the chart and controls for an equal inline spec', async () => {
  const { getInstance, setProps, wrapper } = renderRace({ spec });
  const update = vi.spyOn(getInstance(), 'update');
  const chart = wrapper.get('svg[role="img"]').element;
  const play = wrapper.get('button[aria-label="Play"]').element;

  await setProps({ spec: structuredClone(spec) });

  expect(update).not.toHaveBeenCalled();
  expect(wrapper.get('svg[role="img"]').element).toBe(chart);
  expect(wrapper.get('button[aria-label="Play"]').element).toBe(play);
});

it('keeps the instance and Play focus for an equal inline theme', async () => {
  const theme = { fonts: { sizes: { title: 32 } } };
  const { getInstance, setProps, wrapper } = renderRace({ spec, theme });
  document.body.append(wrapper.element);
  const instance = getInstance();
  const play = wrapper.get<HTMLButtonElement>('button[aria-label="Play"]').element;
  play.focus();
  expect(document.activeElement).toBe(play);

  await setProps({ theme: structuredClone(theme) });

  expect(getInstance()).toBe(instance);
  expect(wrapper.get('button[aria-label="Play"]').element).toBe(play);
  expect(document.activeElement).toBe(play);
});

it('preserves the speed set before playback starts across a theme remount', async () => {
  const { getInstance, setProps } = renderRace({ spec });
  const previous = getInstance();
  previous.setSpeed(2);

  await setProps({ theme: { fonts: { sizes: { title: 32 } } } });

  expect(getInstance()).not.toBe(previous);
  expect(getInstance().getState()).toMatchObject({ t: 0, playing: false, speed: 2 });
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
    const { getInstance, setProps } = renderRace({ spec, onPeriod });
    expect(getInstance()).toBe(subscriptions[0]?.instance);

    await setProps({ darkMode: 'force' });

    expect(getInstance()).toBe(subscriptions[1]?.instance);
    expect(subscriptions.map(({ events, removed }) => ({ events, removed }))).toEqual([
      { events: ['period'], removed: 1 },
      { events: ['period'], removed: 0 },
    ]);
  } finally {
    mountSpy.mockRestore();
  }
});

enableAutoUnmount(afterEach);

type VueRaceProps = RaceProps & { onPeriodOnce?: RaceProps['onPeriod'] };

function renderRace(
  initialProps: VueRaceProps,
  provider?: { theme: RaceProps['theme']; darkMode: 'force' },
) {
  const props = shallowRef(initialProps);
  const race = shallowRef<{ readonly instance: RaceInstance | null } | null>(null);
  const errors: unknown[] = [];
  const wrapper = mount(
    defineComponent(() => {
      const child = () => h(Race, { ...props.value, ref: race });
      return () => (provider ? h(VizThemeProvider, provider, { default: child }) : child());
    }),
    { global: { config: { errorHandler: (error) => errors.push(error) } } },
  );

  return {
    wrapper,
    errors,
    getInstance() {
      const instance = race.value?.instance;
      if (!instance) throw new Error('Race did not mount');
      return instance;
    },
    async setProps(next: Partial<VueRaceProps>) {
      props.value = { ...props.value, ...next };
      await nextTick();
    },
  };
}

it('mounts a playable race and forwards the wrapper props', () => {
  const { wrapper, getInstance } = renderRace({
    spec,
    class: 'reader-race',
    style: { width: '420px' },
    watermark: false,
  });

  expect(wrapper.get('svg[role="img"]').text()).toContain('Annual leaders');
  expect(wrapper.get('svg[role="img"]').text()).toContain('Alpha');
  expect(wrapper.get('input[type="range"]').attributes('aria-valuetext')).toBe('2020');
  expect(wrapper.classes()).toContain('reader-race');
  expect(wrapper.attributes('style')).toContain('width: 420px');
  expect(wrapper.text()).not.toContain('OpenData');
  expect(getInstance().getState()).toMatchObject({ t: 0, playing: false });
});

it('updates the chart on the same instance and keeps the fractional playhead', async () => {
  const { wrapper, getInstance, setProps } = renderRace({ spec });
  const instance = getInstance();
  instance.seek(1.25);

  await setProps({ spec: updated });

  expect(wrapper.get('svg[role="img"]').text()).toContain('Updated leaders');
  expect(getInstance()).toBe(instance);
  expect(instance.getState()).toMatchObject({ t: 1.25, playing: false });
});

it.each([true, false])('restores t and playing=%s after a theme remount', async (playing) => {
  const raceSpec = { ...spec, race: { ...spec.race, autoplay: !playing } };
  const { wrapper, getInstance, setProps } = renderRace({ spec: raceSpec });
  const previous = getInstance();
  previous.seek(1.25);
  previous.setSpeed(2);
  if (playing) previous.play();
  else previous.pause();

  await setProps({ theme: { fonts: { sizes: { title: 32 } } } });

  expect(getInstance()).not.toBe(previous);
  expect(getInstance().getState()).toMatchObject({ t: 1.25, playing, speed: 2 });
  expect(wrapper.get('.oc-title').attributes('style')).toContain('font-size: 32px');
  expect(previous.getState().playing).toBe(false);
});

it('keeps visibility autoplay pending after a dark mode change', async () => {
  const observer = createFakeObserver();
  setObserverFactory(observer.factory);
  try {
    const visible: RaceSpec = { ...spec, race: { ...spec.race, autoplay: 'visible' } };
    const { wrapper, getInstance, setProps } = renderRace({ spec: visible });
    const host = wrapper.element;
    const playing = () => getInstance().getState().playing;
    expect(playing()).toBe(false);

    await setProps({ darkMode: 'force' });

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
  const { getInstance, setProps } = renderRace({
    spec: missing,
    onWarn: (message) => reports.push(message),
  });
  const instance = getInstance();

  await setProps({ spec: nonFinite });

  expect(getInstance()).toBe(instance);
  expect(reports).toEqual(["Dropped 1 non-finite values from 'value'."]);
});

it('merges context theme and remounts when the resolved dark mode changes', async () => {
  const raceSpec = { ...spec, chrome: { title: 'Annual leaders', source: 'Annual survey' } };
  const { wrapper, getInstance, setProps } = renderRace(
    { spec: raceSpec, theme: { fonts: { sizes: { title: 28 } } } },
    { theme: { fonts: { sizes: { title: 34, small: 17 } } }, darkMode: 'force' },
  );
  const previous = getInstance();
  previous.seek(1.25);
  expect(wrapper.find('.oc-dark').exists()).toBe(true);
  expect(wrapper.get('.oc-title').attributes('style')).toContain('font-size: 28px');
  expect(wrapper.get('.oc-source').attributes('style')).toContain('font-size: 17px');

  await setProps({ darkMode: 'off' });

  expect(wrapper.find('.oc-dark').exists()).toBe(false);
  expect(getInstance()).not.toBe(previous);
  expect(getInstance().getState().t).toBe(1.25);
});

it('emits period payloads, replaces the listener in place, and unsubscribes on unmount', async () => {
  const { wrapper, getInstance, setProps } = renderRace({ spec });
  const instance = getInstance();
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

  await setProps({ onPeriod: (value) => first.push(value) });
  for (const listener of listeners) listener(period);
  expect(first).toEqual([period]);

  await setProps({ spec: updated });
  expect(on).toHaveBeenCalledTimes(1);

  await setProps({ onPeriod: (value) => second.push(value) });
  for (const listener of listeners) listener(period);
  expect(getInstance()).toBe(instance);
  expect(on.mock.calls.map(([event]) => event)).toEqual(['period', 'period']);
  expect(first).toEqual([period]);
  expect(second).toEqual([period]);
  expect(listeners.size).toBe(1);

  await setProps({ onPeriod: undefined });
  expect(listeners.size).toBe(0);
  await setProps({ onPeriod: (value) => first.push(value) });
  expect(listeners.size).toBe(1);

  wrapper.unmount();
  expect(listeners.size).toBe(0);
});

it('stops and destroys the real instance on unmount', () => {
  const { wrapper, getInstance } = renderRace({ spec });
  const host = wrapper.element;
  const instance = getInstance();
  instance.seek(1.25);
  instance.play();

  wrapper.unmount();
  instance.play();
  instance.seek(0);

  expect(host.querySelector('svg')).toBeNull();
  expect(instance.getState()).toMatchObject({ t: 1.25, playing: false });
});

it('forwards compile warnings to the current callback and propagates invalid specs', async () => {
  const first: string[] = [];
  const second: string[] = [];
  const { errors, getInstance, setProps } = renderRace({
    spec,
    onWarn: (message) => first.push(message),
  });
  const instance = getInstance();
  const warns: RaceSpec = { ...spec, race: { ...spec.race, top: 2 } };
  await setProps({ spec: warns, onWarn: (message) => second.push(message) });

  expect(getInstance()).toBe(instance);
  expect(first).toEqual([]);
  expect(second).toEqual(['race.top is 2 but the data has 1 distinct keys. Showing at most 1.']);

  const invalid: RaceSpec = { ...spec, race: { top: 0 } };
  await setProps({ spec: invalid });
  expect(errors).toEqual([expect.objectContaining({ message: expect.stringContaining('top') })]);
});

it('routes race specs through Visualization', () => {
  const wrapper = mount(Visualization, {
    props: {
      spec,
      theme: { fonts: { sizes: { title: 32 } } },
      darkMode: 'force',
      class: 'routed-race',
      style: { width: '420px' },
    },
  });

  expect(wrapper.classes()).toContain('routed-race');
  expect(wrapper.attributes('style')).toContain('width: 420px');
  expect(wrapper.find('.oc-dark').exists()).toBe(true);
  expect(wrapper.get('svg[role="img"]').text()).toContain('Annual leaders');
  expect(wrapper.get('.oc-title').attributes('style')).toContain('font-size: 32px');
  expect(wrapper.text()).toContain('OpenData');
  expect(wrapper.get('button').attributes('aria-label')).toBe('Play');
});

it('keeps a working race when a theme change comes with an invalid spec and applies both on recovery', async () => {
  const { wrapper, errors, getInstance, setProps } = renderRace({ spec });
  const instance = getInstance();
  instance.seek(1.25);

  const invalid: RaceSpec = { ...spec, race: { top: 0 } };
  await setProps({ spec: invalid, theme: { fonts: { sizes: { title: 32 } } } });

  expect(errors).toEqual([expect.objectContaining({ message: expect.stringContaining('top') })]);
  expect(getInstance()).toBe(instance);
  expect(wrapper.get('.oc-title').text()).toBe('Annual leaders');

  await setProps({ spec: updated });

  expect(getInstance()).not.toBe(instance);
  expect(getInstance().getState().t).toBe(1.25);
  expect(wrapper.get('.oc-title').text()).toBe('Updated leaders');
  expect(wrapper.get('.oc-title').attributes('style')).toContain('font-size: 32px');
});

it('applies the host style before a theme remount with autoResize disabled', async () => {
  const { wrapper, setProps } = renderRace({ spec, style: { width: '400px' }, autoResize: false });
  const host = wrapper.element;
  if (!(host instanceof HTMLElement)) throw new Error('Race host did not mount');
  const widths: string[] = [];

  await setProps({
    spec: { ...spec, race: { ...spec.race, top: 2 } },
    theme: { fonts: { sizes: { title: 32 } } },
    style: { width: '500px' },
    onWarn: () => widths.push(host.style.width),
  });

  expect(widths).toEqual(['500px']);
});

const periodProps: Array<'onPeriod' | 'onPeriodOnce'> = ['onPeriod', 'onPeriodOnce'];

it.each(
  periodProps,
)('binds %s even when the same update contains an invalid spec', async (prop) => {
  const { errors, getInstance, setProps } = renderRace({ spec });
  const instance = getInstance();
  const on = vi.spyOn(instance, 'on');
  const periods: RaceFrame['period'][] = [];

  const invalid: RaceSpec = { ...spec, race: { top: 0 } };
  await setProps({ spec: invalid, [prop]: (value: RaceFrame['period']) => periods.push(value) });
  expect(errors).toHaveLength(1);

  await setProps({ spec: updated });

  expect(getInstance()).toBe(instance);
  expect(on.mock.calls.map(([event]) => event)).toEqual(['period']);
  const callback = on.mock.calls[0]?.[1];
  const second = { index: 2, value: 2022, label: '2022' };
  const first = { index: 1, value: 2021, label: '2021' };
  callback?.(first);
  callback?.(second);
  expect(periods).toEqual(prop === 'onPeriodOnce' ? [first] : [first, second]);
});
