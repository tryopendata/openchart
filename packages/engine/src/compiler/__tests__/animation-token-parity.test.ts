/**
 * The CSS animation tokens and the engine's resolved animation defaults are two
 * halves of one timing system: the engine stamps its numbers onto
 * `--oc-animation-duration` / `--oc-animation-stagger` / `--oc-annotation-delay`
 * at render time, and the CSS partials fall back to the token defaults when a
 * chart renders without a resolved animation.
 *
 * `token-theme-parity.test.ts` in core covers the color/typography half; it
 * cannot cover this one because core does not depend on the engine. So the
 * assertion lives here, on the side that owns the constants.
 */

import { cssTokenDefault } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { ENTER_DEFAULTS, resolveAnimation } from '../animation';

const ms = (token: string) => parseFloat(cssTokenDefault(token, 'light'));

describe('animation token / engine parity', () => {
  it('--oc-animation-duration matches the enter duration', () => {
    expect(ms('--oc-animation-duration')).toBe(ENTER_DEFAULTS.duration);
  });

  it('--oc-animation-stagger matches the enter stagger', () => {
    expect(ms('--oc-animation-stagger')).toBe(ENTER_DEFAULTS.staggerDelay);
  });

  it('--oc-annotation-delay matches the resolved annotation delay', () => {
    expect(ms('--oc-annotation-delay')).toBe(resolveAnimation(true)!.annotationDelay);
  });
});
