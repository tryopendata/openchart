import { describe, expect, it } from 'vitest';
import { createRaceControls } from '../controls';

function setup() {
  const actions: Array<'toggle' | ['seek' | 'step', number]> = [];
  const controls = createRaceControls({
    periodLabels: ['1980', '1981', '1982'],
    onToggle: () => actions.push('toggle'),
    onSeek: (t) => actions.push(['seek', t]),
    onStep: (delta) => actions.push(['step', delta]),
  });
  const { element } = controls;
  const button = element.querySelector('button');
  const scrubber = element.querySelector('input');
  const readout = element.querySelector('span');
  if (!button || !scrubber || !readout) throw new Error('Missing race controls');
  return { controls, element, button, scrubber, readout, actions };
}

function keydown(target: HTMLElement, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('race controls', () => {
  it('exposes the stylesheet hooks on the strip and each control', () => {
    const { element, button, scrubber, readout } = setup();
    expect(element.matches('div.oc-race-controls')).toBe(true);
    expect(button.matches('button.oc-race-play')).toBe(true);
    expect(scrubber.matches('input.oc-race-scrub')).toBe(true);
    expect(readout.matches('span.oc-race-readout')).toBe(true);
  });

  it('shows Play or Pause and sends one toggle when clicked', () => {
    const { controls, button, actions } = setup();
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Play');
    button.click();
    controls.update({ t: 0, playing: true, speed: 1, ended: false });
    expect(button.getAttribute('aria-label')).toBe('Pause');
    button.click();
    controls.update({ t: 2, playing: false, speed: 1, ended: true });
    expect(button.getAttribute('aria-label')).toBe('Play');
    expect(actions).toEqual(['toggle', 'toggle']);
  });

  it('sets up the Time scrubber and displays the current whole-period label', () => {
    const { controls, scrubber, readout, actions } = setup();
    expect([scrubber.type, scrubber.min, scrubber.max, scrubber.step]).toEqual([
      'range',
      '0',
      '2',
      'any',
    ]);
    expect(scrubber.getAttribute('aria-label')).toBe('Time');
    expect(scrubber.value).toBe('0');
    expect(scrubber.getAttribute('aria-valuetext')).toBe('1980');
    expect(readout.textContent).toBe('1980');
    controls.update({ t: 1.75, playing: true, speed: 2, ended: false });
    expect(scrubber.value).toBe('1.75');
    expect(scrubber.getAttribute('aria-valuetext')).toBe('1981');
    expect(readout.textContent).toBe('1981');
    expect(actions).toEqual([]);
  });

  it('seeks to the fractional position chosen with the scrubber', () => {
    const { scrubber, actions } = setup();
    scrubber.value = '0.25';
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    expect(actions).toEqual([['seek', 0.25]]);
  });

  it('handles Space on the strip and scrubber, and leaves native button activation to the browser', () => {
    const { button, element, scrubber, actions } = setup();
    expect(keydown(element, ' ')).toBe(true);
    expect(keydown(scrubber, ' ')).toBe(true);
    expect(keydown(button, ' ')).toBe(false);
    expect(actions).toEqual(['toggle', 'toggle']);
  });

  it('steps from anywhere in the strip and prevents default arrow behavior', () => {
    const { button, element, scrubber, actions } = setup();
    expect(keydown(scrubber, 'ArrowRight')).toBe(true);
    expect(keydown(scrubber, 'ArrowLeft')).toBe(true);
    expect(keydown(button, 'ArrowLeft')).toBe(true);
    expect(keydown(element, 'ArrowRight')).toBe(true);
    expect(keydown(element, 'ArrowDown')).toBe(false);
    expect(actions).toEqual([
      ['step', 1],
      ['step', -1],
      ['step', -1],
      ['step', 1],
    ]);
  });

  it('preserves modified browser shortcuts', () => {
    const { scrubber, actions } = setup();
    expect(keydown(scrubber, 'ArrowLeft', { altKey: true })).toBe(false);
    expect(keydown(scrubber, 'ArrowRight', { ctrlKey: true })).toBe(false);
    expect(keydown(scrubber, ' ', { metaKey: true })).toBe(false);
    expect(actions).toEqual([]);
  });

  it('handles held Space as a single toggle', () => {
    const { scrubber, actions } = setup();
    expect(keydown(scrubber, ' ')).toBe(true);
    expect(keydown(scrubber, ' ', { repeat: true })).toBe(true);
    expect(actions).toEqual(['toggle']);
  });

  it('detaches the strip and all listeners on destroy', () => {
    const { controls, element, button, scrubber, actions } = setup();
    const host = document.createElement('div');
    host.append(element);
    controls.destroy();
    controls.destroy();
    expect(host.children).toHaveLength(0);
    button.click();
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    expect(keydown(element, ' ')).toBe(false);
    expect(keydown(scrubber, 'ArrowRight')).toBe(false);
    expect(actions).toEqual([]);
  });
});
