/**
 * Race sizing: the host's available content box, less the playback control strip.
 */
import { PLAYBACK_CONTROLS_HEIGHT } from '../playback/controls';

/** Height reserved below the race for its control strip. */
export const RACE_CONTROLS_HEIGHT = PLAYBACK_CONTROLS_HEIGHT;

/** Measure the host's available content box without the mounted race in flow. */
export function measureRaceSize(
  container: HTMLElement,
  { width, height }: { width?: number; height?: number },
  controls: boolean,
  root?: HTMLElement,
): { width: number; height: number } {
  if (width === undefined || height === undefined) {
    const position = root?.style.position;
    if (root) root.style.position = 'absolute';
    try {
      const style = getComputedStyle(container);
      const padding = (value: string) => Number.parseFloat(value) || 0;
      const contentWidth =
        container.clientWidth - padding(style.paddingLeft) - padding(style.paddingRight);
      const contentHeight =
        container.clientHeight - padding(style.paddingTop) - padding(style.paddingBottom);
      width ??= contentWidth > 0 ? contentWidth : 640;
      height ??= contentHeight >= 100 ? contentHeight : 520;
    } finally {
      if (root) root.style.position = position ?? '';
    }
  }
  return { width, height: Math.max(0, height - (controls ? RACE_CONTROLS_HEIGHT : 0)) };
}
