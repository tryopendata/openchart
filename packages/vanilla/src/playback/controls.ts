/**
 * Playback control strip: a play/pause button, a time scrubber and a period readout.
 * It reports reader actions through callbacks and shows whatever state the caller
 * passes to `update()`. Class names take a prefix so the race keeps its `oc-race-*` DOM.
 */
import { SVG_NS, setAttrs } from '../renderers/svg-dom';
import type { PlaybackClockState } from './clock';

/** Height of the control strip in pixels; hosts reserve it below the chart. */
export const PLAYBACK_CONTROLS_HEIGHT = 44;

const PLAY_PATH = 'M4 2.5v11l9-5.5z';
const PAUSE_PATH = 'M4 3h3v10H4zM9 3h3v10H9z';
const ICON_SIZE = 16;

/** Labels, class prefix and action callbacks for a control strip. */
export interface PlaybackControlsOptions {
  /**
   * Class prefix for the strip and its parts (`<prefix>-controls`, `-play`, `-scrub`,
   * `-readout`) and the scrubber's `--<prefix>-progress` property. The race passes `oc-race`.
   */
  classPrefix: string;
  periodLabels: string[];
  onToggle(): void;
  onSeek(t: number): void;
  onStep(delta: 1 | -1): void;
}

/** A control strip whose caller supplies playback state through `update()`. */
export interface PlaybackControls {
  readonly element: HTMLElement;
  update(state: PlaybackClockState): void;
  destroy(): void;
}

function createPlayButton(doc: Document, classPrefix: string) {
  const button = doc.createElement('button');
  button.className = `${classPrefix}-play`;
  button.type = 'button';
  const icon = doc.createElementNS(SVG_NS, 'svg');
  setAttrs(icon, {
    width: ICON_SIZE,
    height: ICON_SIZE,
    viewBox: `0 0 ${ICON_SIZE} ${ICON_SIZE}`,
    fill: 'currentColor',
  });
  icon.setAttribute('aria-hidden', 'true');
  const iconPath = doc.createElementNS(SVG_NS, 'path');
  icon.append(iconPath);
  button.append(icon);
  return { button, iconPath };
}

function createScrubber(doc: Document, classPrefix: string, lastPeriod: number) {
  const scrubber = doc.createElement('input');
  scrubber.className = `${classPrefix}-scrub`;
  scrubber.type = 'range';
  scrubber.min = '0';
  scrubber.max = String(lastPeriod);
  scrubber.step = 'any';
  scrubber.setAttribute('aria-label', 'Time');
  return scrubber;
}

function createReadout(doc: Document, classPrefix: string, periodLabels: string[]) {
  const readout = doc.createElement('span');
  readout.className = `${classPrefix}-readout`;
  const longestLabel = periodLabels.reduce((length, label) => Math.max(length, label.length), 0);
  readout.style.minWidth = `min(${longestLabel}ch, 40%)`;
  return readout;
}

/** Map arrow keys to period steps and Space (outside the button) to play/pause. */
function createKeyHandler(
  button: HTMLButtonElement,
  { onToggle, onStep }: Pick<PlaybackControlsOptions, 'onToggle' | 'onStep'>,
) {
  return (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onStep(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onStep(-1);
    } else if (
      event.key === ' ' &&
      !(event.target instanceof Node && button.contains(event.target))
    ) {
      event.preventDefault();
      if (!event.repeat) onToggle();
    }
  };
}

/** Create a detached control strip. Call `update()` when playback state changes. */
export function createPlaybackControls(options: PlaybackControlsOptions): PlaybackControls {
  const { classPrefix, periodLabels, onToggle, onSeek } = options;
  const doc = document;
  const element = doc.createElement('div');
  element.className = `${classPrefix}-controls`;
  const { button, iconPath } = createPlayButton(doc, classPrefix);
  const lastPeriod = periodLabels.length - 1;
  const scrubber = createScrubber(doc, classPrefix, lastPeriod);
  const readout = createReadout(doc, classPrefix, periodLabels);
  element.append(button, scrubber, readout);

  let previousPeriod = -1;
  function update({ t, playing }: PlaybackClockState) {
    const action = playing ? 'Pause' : 'Play';
    if (button.getAttribute('aria-label') !== action) {
      button.setAttribute('aria-label', action);
      iconPath.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
    }
    const period = Math.floor(t);
    // A focused range input reports each value change to screen readers, so while it
    // has focus during playback, move it once per period. Otherwise follow t.
    const throttle = playing && element.ownerDocument.activeElement === scrubber;
    if (!throttle || period !== previousPeriod) {
      const value = String(throttle ? period : t);
      if (scrubber.value !== value) scrubber.value = value;
    }
    const progress = lastPeriod > 0 ? Math.min(1, Math.max(0, t / lastPeriod)) : 0;
    scrubber.style.setProperty(`--${classPrefix}-progress`, `${progress * 100}%`);
    if (period === previousPeriod) return;
    previousPeriod = period;
    const label = periodLabels[period] ?? '';
    if (scrubber.getAttribute('aria-valuetext') !== label) {
      scrubber.setAttribute('aria-valuetext', label);
      readout.textContent = label;
    }
  }

  const seek = () => onSeek(Number(scrubber.value));
  const keydown = createKeyHandler(button, options);

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
