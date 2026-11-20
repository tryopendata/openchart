import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  anchorMs,
  ENTRANCE_ROLES,
  type EntranceRole,
  type EntranceTimingContext,
  EXIT_CURVE,
  EXIT_FADE_MS,
  entranceAnchorVars,
  entranceEndMs,
  entranceRole,
  entranceTiming,
  evalCubicBezier,
  evalKeyframes,
  evalRoleEase,
  invertRoleEase,
  KEYFRAMES,
  keyframeProperties,
  progressTimeMs,
  UPDATE_ENTER_START,
  updateTimeline,
} from '../choreography';
import { evalCurve, invertCurve } from '../curves';
import { FLUID_SPRING, type MotionPhase, sampleMotion } from '../sample';
import { clampStaggerDelay } from '../stagger';

const stylesDir = resolve(__dirname, '../../styles');
const animationCss = readFileSync(resolve(stylesDir, 'animation.css'), 'utf8');
const tableCss = readFileSync(resolve(stylesDir, 'table-animation.css'), 'utf8');
const keyframesCss = readFileSync(resolve(stylesDir, 'keyframes.css'), 'utf8');

const ROLE_NAMES: EntranceRole[] = [
  'bar',
  'bar-h',
  'cell',
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
  'endpoint-label',
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

const VALUE_ROLES: EntranceRole[] = [
  'bar',
  'bar-h',
  'stack-reveal',
  'stack-reveal-h',
  'barlist-bar',
  'table-bar-fill',
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
      expect(css.includes(role.vars.after)).toBe(emits('delay') && !!role.delay.after);
    }
  });

  it('role vars never shadow a custom property the CSS reads for something else', () => {
    const roleVars = new Set(
      ENTRANCE_ROLES.flatMap((r) => [r.vars.delay, r.vars.duration, r.vars.after]),
    );
    const read = new Set(
      [...`${animationCss}${tableCss}`.matchAll(/var\(\s*(--oc-[a-z0-9-]+)/g)].map((m) => m[1]),
    );
    // Legacy inputs: anything read that isn't a role var must not collide with one.
    const legacy = [...read].filter((name) => !roleVars.has(name));
    expect(legacy).toContain('--oc-annotation-delay');
    for (const name of legacy) expect(roleVars.has(name)).toBe(false);
    // Each role reads its own vars at most; no two roles share a name.
    expect(roleVars.size).toBe(ENTRANCE_ROLES.length * 3);
  });

  it('no longer chains stacked segments', () => {
    expect(animationCss).not.toContain('--oc-stack-segment-duration');
    expect(animationCss).not.toContain('--oc-stack-pos');
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

  it('value roles never fade: their keyframes animate geometry only', () => {
    for (const role of VALUE_ROLES) {
      const row = entranceRole(role);
      for (const kf of [row.keyframe, row.horizontalKeyframe].filter(Boolean)) {
        expect(keyframeProperties(kf!)).not.toContain('opacity');
      }
      expect(row.fade).toBeUndefined();
      expect(row.timing.kind).toBe('author');
    }
    expect(keyframeProperties('oc-enter-bar')).toEqual(['clip-path']);
  });

  it('rules, ticks and annotations never translate', () => {
    for (const role of ['rule', 'tick', 'annotation'] as const) {
      expect(keyframeProperties(entranceRole(role).keyframe)).toEqual(['opacity']);
    }
  });

  it('text fades over 140ms under its geometry', () => {
    expect(entranceRole('text').fade).toEqual({ ms: 140 });
    expect(keyframeProperties(entranceRole('text').keyframe)).toEqual(['transform']);
    expect(KEYFRAMES['oc-enter-rise'].stops[0].values.transform).toEqual({
      type: 'translateY',
      value: 0.6,
      unit: 'em',
    });
  });

  it('labels fade in place once their bar reaches 0.97', () => {
    const label = entranceRole('label');
    expect(label.fade).toBeUndefined();
    expect(label.keyframe).toBe('oc-enter-fade-only');
    expect(label.duration).toEqual({ kind: 'fixed', ms: 260 });
    expect(label.delay).toEqual({
      after: { kind: 'progress', progress: 0.97, of: 'bar' },
      stagger: 'mark',
    });
    expect(Object.keys(KEYFRAMES)).not.toContain('oc-enter-label');
  });
});

// ---------------------------------------------------------------------------
// Golden timing. D is --oc-animation-duration; maps stamp min(D, 500).
// A progress point resolves through the phase's own curve: `reach(p)` is the
// first share of the tween at which it reaches p, found here by brute force,
// independently of invertRoleEase.
// ---------------------------------------------------------------------------

const S = 20; // --oc-animation-stagger
const I = 3; // element index
const LAST = 5; // last mark's stagger index
const ANNOTATION = 150;
const POINT_STAGGER = 12;
const TILE_DELAY = 77;

type Golden = [delay: number, duration: number, geometry: number, opacity: number];

function bruteReach(f: (t: number) => number): (p: number) => number {
  return (p) => {
    const steps = 200_000;
    for (let i = 0; i <= steps; i++) if (f(i / steps) >= p) return i / steps;
    return 1;
  };
}

function goldens(D: number, reach: (p: number) => number): Record<EntranceRole, Golden> {
  const M = Math.min(D, 500);
  const sparkline = S * I + D * reach(0.7);
  return {
    // delay, duration, geometry (non-opacity props), opacity settle
    bar: [S * I, D, D, 0],
    'bar-h': [S * I, D, D, 0],
    cell: [S * I, 300, 0, 300],
    'stack-reveal': [S * I, D, D, 0],
    'stack-reveal-h': [S * I, D, D, 0],
    'line-area': [S * I, D, D, 0.15 * D],
    arc: [S * I, 300, 0, 300],
    point: [S * I, 300, 0, 300],
    // Unstamped: once the line (index 0) reaches 0.5, plus its own stagger.
    'line-point': [S * I + D * reach(0.5), 300, 0, 300],
    text: [S * I, D, D, 140],
    rule: [S * I, 0.5 * D, 0, 0.5 * D],
    tick: [S * I, 0.5 * D, 0, 0.5 * D],
    label: [S * I + D * reach(0.97), 260, 0, 260],
    // Once its own series' line (same index) is 95% of the way across.
    'endpoint-label': [S * I + D * reach(0.95), 300, 0, 300],
    // When the last mark reaches 0.9, plus the authored gap.
    annotation: [S * LAST + D * reach(0.9) + ANNOTATION, 300, 0, 300],
    'tilemap-tile': [TILE_DELAY, 0.35 * D, 0, 0.35 * D],
    'map-feature': [I * S, M, M, M],
    'map-bulk': [0, M, 0, M],
    'map-border': [0.6 * 540, 0.4 * M, 0, 0.4 * M],
    'map-point': [0.65 * 540 + I * POINT_STAGGER, 0.4 * M, 0.4 * M, 0.4 * M],
    'sankey-node': [S * I, D, 0, D],
    'sankey-link': [S * I + D * reach(0.5), D, 0, D],
    'barlist-row': [S * I, 0.6 * D, 0.6 * D, 140],
    'barlist-bar': [S * I, D, D, 0],
    'table-chrome': [0, 0.6 * D, 0.6 * D, 0.6 * D],
    'table-thead': [0, 0.4 * D, 0, 0.4 * D],
    'table-row': [S * I, D, D, 0],
    'table-cell': [S * I, 0.5 * D, 0, 0.5 * D],
    'table-heatmap-cell': [S * I + D * reach(0.5), 0.7 * D, 0, 0.7 * D],
    'table-bar-fill': [S * I + D * reach(0.5), D, D, 0],
    'table-sparkline': [sparkline, 0.8 * D, 0.8 * D, 0.15 * 0.8 * D],
    'table-sparkline-dot': [sparkline + 0.8 * D * reach(0.95), 0.3 * D, 0, 0.3 * D],
    'table-search-pagination': [0, 0.5 * D, 0, 0.5 * D],
  };
}

const CONTEXT: EntranceTimingContext = {
  staggerMs: S,
  annotationDelayMs: ANNOTATION,
  pointStaggerMs: POINT_STAGGER,
  delayMs: TILE_DELAY,
  lastMarkIndex: LAST,
};

const phases = (D: number): [string, MotionPhase, (t: number) => number][] => [
  ['smooth', { duration: D, ease: 'smooth' }, (t) => evalCurve('smooth', t)],
  ['snappy', { duration: D, ease: 'snappy' }, (t) => evalCurve('snappy', t)],
  ['gentle', { duration: D, ease: 'gentle' }, (t) => evalCurve('gentle', t)],
  [
    'spring',
    { duration: D, spring: FLUID_SPRING },
    (t) => sampleMotion({ duration: D, spring: FLUID_SPRING }, t * D).position,
  ],
];

describe.each([600, 800])('entranceTiming golden ms at D=%i', (D) => {
  it('covers every role', () => {
    expect(Object.keys(goldens(D, () => 0)).sort()).toEqual([...ROLE_NAMES].sort());
  });
  describe.each(phases(D))('ease %s', (_label, phase, curve) => {
    const expected = goldens(D, bruteReach(curve));
    it.each(ROLE_NAMES)('%s', (role) => {
      const t = entranceTiming(role, I, phase, CONTEXT);
      const [delay, duration, geometry, opacity] = expected[role];
      // Brute-force reach is exact to 1/200000 of the tween.
      expect(Math.abs(t.delayMs - delay)).toBeLessThan(0.02);
      expect(t.durationMs).toBeCloseTo(duration, 6);
      expect(t.geometryMs).toBeCloseTo(geometry, 6);
      expect(t.opacityMs).toBeCloseTo(opacity, 6);
    });
  });
});

describe('progress points follow the phase curve', () => {
  it('a snappy entrance reaches 0.9 far sooner than smooth, so annotations come sooner', () => {
    const smooth = anchorMs('annotation', { duration: 800, ease: 'smooth' });
    const snappy = anchorMs('annotation', { duration: 800, ease: 'snappy' });
    expect(smooth).toBeCloseTo(800 * invertCurve('smooth', 0.9), 6);
    expect(snappy).toBeCloseTo(800 * invertCurve('snappy', 0.9), 6);
    expect(snappy).toBeLessThan(smooth / 2);
  });

  it('annotation delay is when the last mark reaches 0.9, plus the authored gap', () => {
    const phase: MotionPhase = { duration: 600, ease: 'smooth' };
    const stagger = clampStaggerDelay(80, 5); // 80ms, under the cap
    const ctx = { staggerMs: stagger, lastMarkIndex: 4, annotationDelayMs: 0 };
    const lastBarStart = 4 * stagger;
    const reached = progressTimeMs('bar', 4, phase, ctx, 0.9);
    expect(reached).toBeCloseTo(lastBarStart + 600 * invertCurve('smooth', 0.9), 6);
    // At that moment the last bar's eased progress is 0.9.
    expect(evalRoleEase('bar', phase, (reached - lastBarStart) / 600)).toBeCloseTo(0.9, 6);
    expect(entranceTiming('annotation', 0, phase, ctx).delayMs).toBeCloseTo(reached, 6);
    expect(
      entranceTiming('annotation', 0, phase, { ...ctx, annotationDelayMs: 150 }).delayMs,
    ).toBeCloseTo(reached + 150, 6);
  });

  it('invertRoleEase inverts evalRoleEase for curves, beziers and springs', () => {
    const cases: [EntranceRole, MotionPhase][] = [
      ['bar', { duration: 600, ease: 'smooth' }],
      ['bar', { duration: 600, ease: 'snappy' }],
      ['tilemap-tile', { duration: 600 }],
      ['bar', { duration: 600, spring: FLUID_SPRING }],
    ];
    for (const [role, phase] of cases) {
      for (const p of [0.1, 0.5, 0.9]) {
        expect(evalRoleEase(role, phase, invertRoleEase(role, phase, p))).toBeCloseTo(p, 4);
      }
    }
  });

  it('stamped anchors are what the CSS reads, and win over the computed value', () => {
    const phase: MotionPhase = { duration: 600, ease: 'snappy' };
    const vars = entranceAnchorVars(phase, { staggerMs: 75, lastMarkIndex: 4 });
    expect(Object.keys(vars).sort()).toEqual(
      ENTRANCE_ROLES.filter((r) => r.scope === 'chart' && r.delay.after)
        .map((r) => r.vars.after)
        .sort(),
    );
    expect(parseFloat(vars['--oc-annotation-after'])).toBeCloseTo(
      300 + 600 * invertCurve('snappy', 0.9),
      6,
    );
    expect(
      entranceTiming('sankey-link', 0, phase, { afterMs: { 'sankey-link': 42 } }).delayMs,
    ).toBe(42);
    const table = entranceAnchorVars(phase, {}, 'table');
    expect(Object.keys(table)).toContain('--oc-table-sparkline-dot-after');
  });

  it('a per-element stamped delay replaces the whole delay rule', () => {
    const phase: MotionPhase = { duration: 600 };
    expect(entranceTiming('line-point', 7, phase, { stampedDelayMs: 123 }).delayMs).toBe(123);
  });
});

describe('entranceTiming defaults', () => {
  it('falls back to the CSS fallbacks when nothing is stamped', () => {
    const phase = { duration: 600, ease: 'smooth' as const };
    expect(entranceTiming('bar', 2, phase).delayMs).toBe(160); // --oc-animation-stagger: 80ms
    expect(entranceTiming('annotation', 0, phase).delayMs).toBeCloseTo(
      600 * invertCurve('smooth', 0.9) + 150,
      6,
    );
    expect(entranceTiming('map-point', 2, phase).delayMs).toBeCloseTo(0.65 * 540 + 120, 6); // 60ms
    expect(entranceTiming('map-feature', 5, phase).delayMs).toBe(0); // --oc-map-delay: 0ms
  });
});

describe('entranceEndMs', () => {
  const phase: MotionPhase = { duration: 600, ease: 'smooth' };

  it('is the latest delay + duration over the roles present', () => {
    // 5 bars 75ms apart: the last starts at 300 and ends at 900.
    expect(entranceEndMs({ phase, staggerMs: 75, roles: { bar: 5 } })).toBe(900);
    // A text mark's 140ms fade sits inside its 600ms rise.
    expect(entranceEndMs({ phase, staggerMs: 75, roles: { text: 1 } })).toBe(600);
  });

  it('honours extents for stamped delays and map sweeps', () => {
    expect(
      entranceEndMs({ phase, roles: { 'tilemap-tile': { count: 50, maxDelayMs: 900 } } }),
    ).toBeCloseTo(900 + 0.35 * 600, 6);
    // Stamped line points: the latest stamped start plus the 300ms fade.
    expect(
      entranceEndMs({
        phase,
        roles: { 'line-point': { count: 20, maxStampedDelayMs: 480, stampedCount: 20 } },
      }),
    ).toBe(780);
    // 11 features, 800ms phase: budget 540 over 10 gaps, each feature 500ms.
    expect(
      entranceEndMs({
        phase: { duration: 800 },
        staggerMs: 54,
        roles: { 'map-feature': 11, 'map-border': 1 },
      }),
    ).toBe(540 + 500);
  });

  it('is 0 with no animated elements', () => {
    expect(entranceEndMs({ phase, roles: { bar: 0 } })).toBe(0);
  });
});

describe('punch curve usage', () => {
  it('is referenced only by roles flagged as accent', () => {
    const users = ENTRANCE_ROLES.filter(
      (r) => r.timing.kind === 'curve' && r.timing.curve === 'punch',
    );
    for (const role of users) expect(role.accent).toBe(true);
  });
});

describe('role easing', () => {
  it('follows the author ease, a fixed curve, or a fixed CSS function', () => {
    const snappy: MotionPhase = { duration: 600, ease: 'snappy' };
    expect(evalRoleEase('bar', snappy, 0.4)).toBe(evalCurve('snappy', 0.4));
    // Labels fade on the author ease.
    expect(evalRoleEase('label', snappy, 0.4)).toBe(evalCurve('snappy', 0.4));
    // Annotations hard-code --oc-ease-glide regardless of the author's ease.
    expect(evalRoleEase('annotation', snappy, 0.4)).toBe(evalCurve('glide', 0.4));
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
    const mid = evalKeyframes('oc-enter-line', 0.5, linear);
    expect(mid['clip-path']).toEqual({ type: 'inset', top: 0, right: 50, bottom: 0, left: 0 });
    expect(mid.opacity).toEqual({ type: 'number', value: 1 });
    const early = evalKeyframes('oc-enter-line', 0.075, linear);
    expect(early.opacity).toEqual({ type: 'number', value: 0.5 });
  });

  it('interpolates em translations, keeping the unit', () => {
    const linear = (x: number) => x;
    expect(evalKeyframes('oc-enter-rise', 0.5, linear).transform).toEqual({
      type: 'translateY',
      value: 0.3,
      unit: 'em',
    });
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

describe('updateTimeline (D9 exits)', () => {
  const update: MotionPhase = { duration: 500, ease: 'smooth' };
  const exit: MotionPhase = { duration: EXIT_FADE_MS, ease: EXIT_CURVE };

  it('runs exits, survivors and enters together when nothing is removed', () => {
    expect(updateTimeline(update, exit, false)).toEqual({
      exitMs: 120,
      updateDelayMs: 0,
      enterDelayMs: UPDATE_ENTER_START * 500,
      enterMs: 500 - UPDATE_ENTER_START * 500,
      totalMs: 500,
    });
  });

  it('holds survivors and enters until removal ghosts have faded', () => {
    const t = updateTimeline(update, exit, true);
    expect(t.updateDelayMs).toBe(t.exitMs);
    expect(t.enterDelayMs).toBe(t.exitMs + UPDATE_ENTER_START * 500);
    expect(t.enterDelayMs + t.enterMs).toBe(t.totalMs);
    expect(t.totalMs).toBe(620);
  });

  it('fades exits on a monotone ease-out that ends at exactly 1', () => {
    let prev = 0;
    for (let ms = 0; ms <= EXIT_FADE_MS; ms += 4) {
      const p = sampleMotion(exit, ms).position;
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
    expect(sampleMotion(exit, EXIT_FADE_MS).position).toBe(1);
    // Ease-out: past halfway within the first third.
    expect(sampleMotion(exit, EXIT_FADE_MS / 3).position).toBeGreaterThan(0.5);
  });
});
