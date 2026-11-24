import { SVG_NS, setAttrs } from '../renderers/svg-dom';
import type { RaceClockState } from './clock';

const PLAY_PATH = 'M4 2.5v11l9-5.5z';
const PAUSE_PATH = 'M4 3h3v10H4zM9 3h3v10H9z';

export interface RaceControlsOptions {
  periodLabels: string[];
  onToggle(): void;
  onSeek(t: number): void;
  onStep(delta: 1 | -1): void;
}

/** A control strip whose caller supplies playback state through `update()`. */
export interface RaceControls {
  readonly element: HTMLElement;
  update(state: RaceClockState): void;
  destroy(): void;
}

/** Create a detached control strip. Call `update()` when playback state changes. */
export function createRaceControls(options: RaceControlsOptions): RaceControls {
  const { periodLabels, onToggle, onSeek, onStep } = options;
  const element = document.createElement('div');
  element.className = 'oc-race-controls';

  const button = document.createElement('button');
  button.className = 'oc-race-play';
  button.type = 'button';
  const icon = document.createElementNS(SVG_NS, 'svg');
  setAttrs(icon, { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor' });
  icon.setAttribute('aria-hidden', 'true');
  const iconPath = document.createElementNS(SVG_NS, 'path');
  icon.append(iconPath);
  button.append(icon);

  const lastPeriod = periodLabels.length - 1;
  const scrubber = document.createElement('input');
  scrubber.className = 'oc-race-scrub';
  scrubber.type = 'range';
  scrubber.min = '0';
  scrubber.max = String(lastPeriod);
  scrubber.step = 'any';
  scrubber.setAttribute('aria-label', 'Time');

  const readout = document.createElement('span');
  readout.className = 'oc-race-readout';
  const longestLabel = periodLabels.reduce((length, label) => Math.max(length, label.length), 0);
  readout.style.minWidth = `min(${longestLabel}ch, 40%)`;
  element.append(button, scrubber, readout);

  function update({ t, playing }: RaceClockState) {
    const action = playing ? 'Pause' : 'Play';
    if (button.getAttribute('aria-label') !== action) {
      button.setAttribute('aria-label', action);
      iconPath.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
    }
    scrubber.value = String(t);
    const progress = lastPeriod > 0 ? Math.min(1, Math.max(0, t / lastPeriod)) : 0;
    scrubber.style.setProperty('--oc-race-progress', `${progress * 100}%`);
    const label = periodLabels[Math.floor(t)] ?? '';
    scrubber.setAttribute('aria-valuetext', label);
    readout.textContent = label;
  }

  function seek() {
    onSeek(Number(scrubber.value));
  }

  function keydown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      onStep(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (
      event.key === ' ' &&
      !(event.target instanceof Node && button.contains(event.target))
    ) {
      event.preventDefault();
      if (!event.repeat) onToggle();
    }
  }

  update({ t: 0, playing: false, speed: 1, ended: false });
  button.addEventListener('click', onToggle);
  scrubber.addEventListener('input', seek);
  element.addEventListener('keydown', keydown);

  return {
    element,
    update,
    destroy() {
      button.removeEventListener('click', onToggle);
      scrubber.removeEventListener('input', seek);
      element.removeEventListener('keydown', keydown);
      element.remove();
    },
  };
}
