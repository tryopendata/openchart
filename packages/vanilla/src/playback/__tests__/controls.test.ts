import { describe, expect, it } from 'vitest';
import { createRaceControls } from '../../race/controls';
import { createPlaybackControls } from '../controls';

const periodLabels = ['1980', '1981', '1982'];

function setup(classPrefix: string) {
  const actions: Array<'toggle' | ['seek' | 'step', number]> = [];
  const controls = createPlaybackControls({
    classPrefix,
    periodLabels,
    onToggle: () => actions.push('toggle'),
    onSeek: (t) => actions.push(['seek', t]),
    onStep: (delta) => actions.push(['step', delta]),
  });
  return { controls, actions };
}

describe('playback controls', () => {
  it('emits classes under the oc-playback prefix', () => {
    const { controls } = setup('oc-playback');
    const { element } = controls;
    expect(element.matches('div.oc-playback-controls')).toBe(true);
    expect(element.querySelector('button.oc-playback-play')).not.toBeNull();
    expect(element.querySelector('input.oc-playback-scrub')).not.toBeNull();
    expect(element.querySelector('span.oc-playback-readout')).not.toBeNull();
    expect(element.querySelector('[class*="oc-race"]')).toBeNull();
    controls.update({ t: 1, playing: false, speed: 1, ended: false });
    const scrubber = element.querySelector('input');
    expect(scrubber?.style.getPropertyValue('--oc-playback-progress')).toBe('50%');
  });

  it('builds the same DOM as the race controls with the oc-race prefix', () => {
    const race = createRaceControls({
      periodLabels,
      onToggle() {},
      onSeek() {},
      onStep() {},
    });
    const { controls } = setup('oc-race');
    expect(controls.element.outerHTML).toBe(race.element.outerHTML);
    const state = { t: 1.5, playing: true, speed: 1, ended: false };
    race.update(state);
    controls.update(state);
    expect(controls.element.outerHTML).toBe(race.element.outerHTML);
  });

  it('sends toggle, seek and step actions', () => {
    const { controls, actions } = setup('oc-playback');
    const { element } = controls;
    element.querySelector('button')?.click();
    const scrubber = element.querySelector('input');
    if (!scrubber) throw new Error('Missing scrubber');
    scrubber.value = '2';
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    scrubber.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
    );
    expect(actions).toEqual(['toggle', ['seek', 2], ['step', -1]]);
  });

  it('removes the strip on destroy', () => {
    const { controls } = setup('oc-playback');
    document.body.append(controls.element);
    controls.destroy();
    expect(controls.element.isConnected).toBe(false);
  });
});
