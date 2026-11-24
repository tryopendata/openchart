import type { RaceClockState } from './clock';

export interface RaceControlsOptions {
  periodLabels: string[];
  onToggle(): void;
  onSeek(t: number): void;
  onStep(delta: 1 | -1): void;
}

export interface RaceControls {
  readonly element: HTMLElement;
  update(state: RaceClockState): void;
  destroy(): void;
}

export function createRaceControls(options: RaceControlsOptions): RaceControls {
  const { periodLabels, onToggle, onSeek, onStep } = options;
  const element = document.createElement('div');
  element.className = 'oc-race-controls';

  const button = document.createElement('button');
  button.className = 'oc-race-play';
  button.type = 'button';

  const scrubber = document.createElement('input');
  scrubber.className = 'oc-race-scrub';
  scrubber.type = 'range';
  scrubber.min = '0';
  scrubber.max = String(periodLabels.length - 1);
  scrubber.step = 'any';
  scrubber.setAttribute('aria-label', 'Time');

  const readout = document.createElement('span');
  readout.className = 'oc-race-readout';
  element.append(button, scrubber, readout);

  function update({ t, playing }: RaceClockState) {
    button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    button.textContent = playing ? '⏸︎' : '▶︎';
    scrubber.value = String(t);
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
