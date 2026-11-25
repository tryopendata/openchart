import { describe, expect, it } from 'vitest';
import { compileChartPlayback } from '../chart-playback';
import { bubbleRows, bubbleSpec, compileOptions } from './chart-fixtures';

const WCAG_WARNING = /controls disabled.*WCAG 2\.2\.2/;

function compileWith(playback: object): { warnings: string[]; sent: string[] } {
  const sent: string[] = [];
  const { warnings } = compileChartPlayback(bubbleSpec(bubbleRows(), { playback }), {
    ...compileOptions,
    onWarn: (message) => sent.push(message),
  });
  return { warnings, sent };
}

describe('controls: false with autoplay', () => {
  it('warns that viewers cannot pause, in the result and through onWarn', () => {
    const { warnings, sent } = compileWith({ controls: false });
    const warning = warnings.find((message) => WCAG_WARNING.test(message));
    expect(warning).toBeDefined();
    expect(sent).toContain(warning);
  });

  it('stays quiet when autoplay is off or the controls are shown', () => {
    for (const playback of [{ controls: false, autoplay: false }, { autoplay: true }]) {
      expect(compileWith(playback).warnings.some((message) => WCAG_WARNING.test(message))).toBe(
        false,
      );
    }
  });
});
