import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ENTRANCE_ROLES,
  type EntranceRole,
  type EntranceTimingContext,
  entranceEndMs,
  entranceTiming,
  evalCubicBezier,
  evalKeyframes,
  evalRoleEase,
  KEYFRAMES,
} from '../choreography';
import { evalCurve } from '../curves';
import { FLUID_SPRING, type MotionPhase, sampleMotion } from '../sample';

const stylesDir = resolve(__dirname, '../../styles');
const animationCss = readFileSync(resolve(stylesDir, 'animation.css'), 'utf8');
const tableCss = readFileSync(resolve(stylesDir, 'table-animation.css'), 'utf8');
const keyframesCss = readFileSync(resolve(stylesDir, 'keyframes.css'), 'utf8');

const ROLE_NAMES: EntranceRole[] = [
  'bar',
  'bar-h',
  'stack-segment',
  'stack-reveal',
  'stack-reveal-h',
  'line-area',
  'arc',
  'point',
  'line-point',
  'text',
  'rule',
  'tick',
  'label',
  'annotation',
  'tilemap-tile',
  'map-feature',
  'map-bulk',
  'map-border',
  'map-point',
  'sankey-node',
  'sankey-link',
  'barlist-row',
  'barlist-bar',
  'sparkline-line-area',
  'table-chrome',
  'table-thead',
  'table-row',
  'table-cell',
  'table-heatmap-cell',
  'table-bar-fill',
  'table-sparkline',
  'table-sparkline-dot',
  'table-search-pagination',
];

describe('choreography table', () => {
  it('has exactly one row per role', () => {
    const names = ENTRANCE_ROLES.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual([...ROLE_NAMES].sort());
  });

  it('every role var is read by the generated CSS', () => {
    for (const role of ENTRANCE_ROLES) {
      const css = role.scope === 'table' ? tableCss : animationCss;
      const emits = (part: 'delay' | 'duration') =>
        role.emit === 'shorthand' || role.emit.includes(part);
      expect(css.includes(role.vars.delay)).toBe(emits('delay'));
      expect(css.includes(role.vars.duration)).toBe(emits('duration'));
    }
  });

  it('role vars never shadow a custom property the CSS reads for something else', () => {
    const roleVars = new Set(ENTRANCE_ROLES.flatMap((r) => [r.vars.delay, r.vars.duration]));
    const read = new Set(
      [...`${animationCss}${tableCss}`.matchAll(/var\(\s*(--oc-[a-z0-9-]+)/g)].map((m) => m[1]),
    );
    // Legacy inputs: anything read that isn't a role var must not collide with one.
    const legacy = [...read].filter((name) => !roleVars.has(name));
    expect(legacy).toContain('--oc-annotation-delay');
    for (const name of legacy) expect(roleVars.has(name)).toBe(false);
    // Each role reads its own pair at most; no two roles share a name.
    expect(roleVars.size).toBe(ENTRANCE_ROLES.length * 2);
  });

  it('every role rule carries the play-state hook', () => {
    const rules = `${animationCss}${tableCss}`.match(/animation[a-z-]*:[^;]*;/g) ?? [];
    const playStates = `${animationCss}${tableCss}`.match(
      /animation-play-state: var\(--oc-play-state, running\);/g,
    );
    expect(rules.length).toBeGreaterThan(0);
    expect(playStates?.length).toBe(ENTRANCE_ROLES.length);
  });

  it('keeps the non-entrance keyframes', () => {
    for (const name of ['oc-pulse', 'oc-tooltip-in', 'oc-enter-point']) {
      expect(keyframesCss).toContain(`@keyframes ${name} {`);
    }
    for (const name of Object.keys(KEYFRAMES)) {
      expect(keyframesCss).toContain(`@keyframes ${name} {`);
    }
  });
});

// ---------------------------------------------------------------------------
// Golden timing: hand-computed from the pre-generation animation.css and
// table-animation.css. D is --oc-animation-duration; maps stamp min(D, 500).
// ---------------------------------------------------------------------------

const S = 20; // --oc-animation-stagger
const I = 3; // element index
const ANNOTATION = 150;
const SEGMENT = 120;
const STACK_POS = 2;
const POINT_STAGGER = 12;
const TILE_DELAY = 77;

type Golden = [delay: number, duration: number, geometry: number, opacity: number];

function goldens(D: number): Record<EntranceRole, Golden> {
  const M = Math.min(D, 500);
  return {
    // delay, duration, geometry (non-opacity props), opacity settle
    bar: [S * I, D, D, 0.75 * D],
    'bar-h': [S * I, D, D, 0.75 * D],
    'stack-segment': [S * I + STACK_POS * SEGMENT, SEGMENT, SEGMENT, 0.75 * SEGMENT],
    'stack-reveal': [0, D, D, 0.75 * D],
    'stack-reveal-h': [0, D, D, 0.75 * D],
    'line-area': [S * I, D, D, 0.15 * D],
    arc: [S * I, D, 0, D],
    point: [S * I, 0.4 * D, 0, 0.4 * D],
    'line-point': [0.35 * D + S * I, 0.4 * D, 0, 0.4 * D],
    text: [S * I, 0.6 * D, 0.6 * D, 0.6 * D],
    rule: [S * I, 0.5 * D, 0.5 * D, 0.5 * D],
    tick: [S * I, 0.5 * D, 0.5 * D, 0.5 * D],
    label: [S * I + 0.7 * D, 250, 250, 250],
    annotation: [D + ANNOTATION, 300, 300, 300],
    'tilemap-tile': [TILE_DELAY, 0.35 * D, 0, 0.35 * D],
    'map-feature': [I * S, M, M, M],
    'map-bulk': [0, M, 0, M],
    'map-border': [0.7 * M, 0.4 * M, 0, 0.4 * M],
    'map-point': [0.8 * M + I * POINT_STAGGER, 0.4 * M, 0.4 * M, 0.4 * M],
    'sankey-node': [S * I, D, 0, D],
    'sankey-link': [0.3 * D + S * I, D, 0, D],
    'barlist-row': [40 * I, 0.6 * D, 0.6 * D, 0.6 * D],
    'barlist-bar': [40 * I, D, D, 0.75 * D],
    'sparkline-line-area': [S * I, D, D, 0.15 * D],
    'table-chrome': [0, 0.6 * D, 0.6 * D, 0.6 * D],
    'table-thead': [0, 0.4 * D, 0, 0.4 * D],
    'table-row': [S * I, D, D, 0],
    'table-cell': [S * I, 0.5 * D, 0, 0.5 * D],
    'table-heatmap-cell': [S * I + 0.3 * D, 0.7 * D, 0, 0.7 * D],
    'table-bar-fill': [S * I + 0.3 * D, 0.8 * D, 0.8 * D, 0],
    'table-sparkline': [S * I + 0.4 * D, 0.8 * D, 0.8 * D, 0.15 * 0.8 * D],
    'table-sparkline-dot': [S * I + 0.8 * D, 0.3 * D, 0, 0.3 * D],
    'table-search-pagination': [0, 0.5 * D, 0, 0.5 * D],
  };
}

const CONTEXT: EntranceTimingContext = {
  staggerMs: S,
  annotationDelayMs: ANNOTATION,
  stackPos: STACK_POS,
  stackSegmentMs: SEGMENT,
  pointStaggerMs: POINT_STAGGER,
  delayMs: TILE_DELAY,
};

const phases = (D: number): [string, MotionPhase][] => [
  ['smooth', { duration: D, ease: 'smooth' }],
  ['snappy', { duration: D, ease: 'snappy' }],
  ['spring', { duration: D, spring: FLUID_SPRING }],
];

describe.each([450, 800])('entranceTiming golden ms at D=%i', (D) => {
  const expected = goldens(D);
  it('covers every role', () => {
    expect(Object.keys(expected).sort()).toEqual([...ROLE_NAMES].sort());
  });
  describe.each(phases(D))('ease %s', (_label, phase) => {
    it.each(ROLE_NAMES)('%s', (role) => {
      const t = entranceTiming(role, I, phase, CONTEXT);
      const [delay, duration, geometry, opacity] = expected[role];
      expect(t.delayMs).toBeCloseTo(delay, 6);
      expect(t.durationMs).toBeCloseTo(duration, 6);
      expect(t.geometryMs).toBeCloseTo(geometry, 6);
      expect(t.opacityMs).toBeCloseTo(opacity, 6);
    });
  });
});

describe('entranceTiming defaults', () => {
  it('falls back to the CSS fallbacks when nothing is stamped', () => {
    const phase = { duration: 450, ease: 'smooth' as const };
    expect(entranceTiming('bar', 2, phase).delayMs).toBe(60); // --oc-animation-stagger: 30ms
    expect(entranceTiming('annotation', 0, phase).delayMs).toBe(600); // + 150ms
    expect(entranceTiming('stack-segment', 0, phase, { stackPos: 1 }).delayMs).toBe(150);
    expect(entranceTiming('map-point', 2, phase).delayMs).toBe(0.8 * 450 + 120); // 60ms
    expect(entranceTiming('map-feature', 5, phase).delayMs).toBe(0); // --oc-map-delay: 0ms
  });
});

describe('entranceEndMs', () => {
  const phase: MotionPhase = { duration: 450, ease: 'smooth' };

  it('is the latest delay + duration over the roles present', () => {
    // 5 bars: last starts at 4 * 30, ends at 120 + 450 = 570.
    expect(entranceEndMs({ phase, staggerMs: 30, roles: { bar: 5 } })).toBe(570);
    // Annotations end later: 450 + 150 + 300.
    expect(
      entranceEndMs({
        phase,
        staggerMs: 30,
        annotationDelayMs: 150,
        roles: { bar: 5, annotation: 1 },
      }),
    ).toBe(900);
    // 20 line points outlast the line: 0.35D + 19 * 10 + 0.4D.
    expect(
      entranceEndMs({ phase, staggerMs: 10, roles: { 'line-area': 1, 'line-point': 20 } }),
    ).toBeCloseTo(0.35 * 450 + 190 + 0.4 * 450, 6);
  });

  it('honours extents for stacks, stamped delays and map sweeps', () => {
    expect(
      entranceEndMs({
        phase,
        staggerMs: 30,
        stackSegmentMs: 150,
        roles: { 'stack-segment': { count: 12, maxIndex: 3, maxStackPos: 2 } },
      }),
    ).toBe(90 + 300 + 150);
    expect(
      entranceEndMs({ phase, roles: { 'tilemap-tile': { count: 50, maxDelayMs: 900 } } }),
    ).toBeCloseTo(900 + 0.35 * 450, 6);
    // 11 features, 800ms phase: budget 960 over 10 gaps, each feature 500ms.
    expect(
      entranceEndMs({
        phase: { duration: 800 },
        staggerMs: 96,
        roles: { 'map-feature': 11, 'map-border': 1 },
      }),
    ).toBe(960 + 500);
  });

  it('is 0 with no animated elements', () => {
    expect(entranceEndMs({ phase, roles: { bar: 0 } })).toBe(0);
  });
});

describe('role easing', () => {
  it('follows the author ease, a fixed curve, or a fixed CSS function', () => {
    const snappy: MotionPhase = { duration: 450, ease: 'snappy' };
    expect(evalRoleEase('bar', snappy, 0.4)).toBe(evalCurve('snappy', 0.4));
    // Labels hard-code --oc-ease-smooth regardless of the author's ease.
    expect(evalRoleEase('label', snappy, 0.4)).toBe(evalCurve('smooth', 0.4));
    expect(evalRoleEase('stack-segment', snappy, 0.4)).toBeCloseTo(0.4, 6);
    // CSS ease-in at 0.5 (cubic-bezier(0.42, 0, 1, 1)).
    expect(evalRoleEase('tilemap-tile', snappy, 0.5)).toBeCloseTo(0.3153568, 5);
  });

  it('samples a spring over the base duration', () => {
    const spring: MotionPhase = { duration: 600, spring: FLUID_SPRING };
    expect(evalRoleEase('point', spring, 0.25)).toBe(
      sampleMotion({ duration: 600, spring: FLUID_SPRING }, 150).position,
    );
  });

  it('evaluates cubic-bezier end points exactly', () => {
    expect(evalCubicBezier([0.16, 1, 0.3, 1], 0)).toBeCloseTo(0, 6);
    expect(evalCubicBezier([0.16, 1, 0.3, 1], 1)).toBeCloseTo(1, 6);
  });
});

describe('evalKeyframes', () => {
  it('eases each property within its own keyframe segments, like CSS', () => {
    const linear = (x: number) => x;
    const mid = evalKeyframes('oc-enter-bar', 0.5, linear);
    expect(mid['clip-path']).toEqual({ type: 'inset', top: 50, right: 0, bottom: 0, left: 0 });
    expect(mid.opacity).toEqual({ type: 'number', value: 0.5 / 0.75 });
    const late = evalKeyframes('oc-enter-bar', 0.9, linear);
    expect(late.opacity).toEqual({ type: 'number', value: 1 });
  });

  it('switches non-interpolable values at the eased midpoint', () => {
    const linear = (x: number) => x;
    expect(evalKeyframes('oc-enter-map-fill', 0.4, linear).fill).toEqual({
      type: 'css',
      css: 'var(--oc-secondary)',
    });
    expect(evalKeyframes('oc-enter-map-fill', 0.6, linear).fill).toEqual({
      type: 'css',
      css: 'var(--oc-feature-fill)',
    });
  });
});
