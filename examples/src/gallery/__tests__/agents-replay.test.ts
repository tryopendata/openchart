import type { ChartSpec, RectMark } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  deriveView,
  lineDiff,
  nextTarget,
  serializeForStream,
  streamPrefix,
  turnTarget,
  validate,
  withContext,
} from '../agents/replay';
import { chatAnalyst, SCENARIOS } from '../agents/scenarios';

describe('serializeForStream', () => {
  it('puts chrome before mark and encoding so the chart mounts with its title', () => {
    const text = serializeForStream({ encoding: {}, mark: 'bar', chrome: { title: 'T' } });
    expect(Object.keys(JSON.parse(text))).toEqual(['chrome', 'mark', 'encoding']);
  });
});

describe('streamPrefix', () => {
  it('never cuts mid-token and returns the whole text at the end', () => {
    const text = '{\n  "mark": "bar"\n}';
    expect(streamPrefix(text, 10)).toBe('{\n  "mark"');
    expect(streamPrefix(text, text.length)).toBe(text);
    expect(streamPrefix(text, 0)).toBe('');
  });

  it('snaps back to the last boundary when the cut lands mid-word', () => {
    expect(streamPrefix('{"mark": "bar"}', 5)).toBe('{"');
    expect(streamPrefix('Solar grew fast', 8)).toBe('Solar ');
  });

  it('shows nothing rather than a word fragment at the start of prose', () => {
    expect(streamPrefix("Solar's additions", 3)).toBe('');
  });
});

describe('lineDiff', () => {
  it('reports only the changed lines between grouped and stacked specs', () => {
    // Spec steps in script order: grouped, the invalid attempt, the repair.
    const [first, , repaired] = chatAnalyst.turns
      .flatMap((t) => t.steps)
      .filter((s) => s.kind === 'spec');
    if (first?.kind !== 'spec' || repaired?.kind !== 'spec') {
      throw new Error('scenario shape changed');
    }
    const diff = lineDiff(serializeForStream(first.spec), serializeForStream(repaired.spec));
    const changed = diff.filter((d) => d.type !== 'same').map((d) => `${d.type} ${d.line.trim()}`);
    expect(changed).toEqual([
      'del "subtitle": "Global renewable capacity additions by source, 2019-2023 (GW)",',
      'add "subtitle": "Global renewable capacity additions by source, 2019-2023 (GW), stacked to show the total",',
      'del "stack": null',
      'add "stack": "zero"',
    ]);
  });

  it('elides unchanged runs outside the context window', () => {
    const prev = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].join('\n');
    const next = ['a', 'b', 'c', 'd', 'e', 'f', 'X'].join('\n');
    const ctx = withContext(lineDiff(prev, next), 1);
    expect(ctx[0]).toEqual({ type: 'gap', count: 5 });
    expect(ctx.slice(1).map((l) => l.type)).toEqual(['same', 'del', 'add']);
  });
});

describe('validate', () => {
  it('returns the engine error with a did-you-mean fix for the hallucinated field', () => {
    const bad = chatAnalyst.turns[1].steps[0];
    if (bad.kind !== 'spec') throw new Error('scenario shape changed');
    const result = validate(bad.spec, bad.rows);
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/encoding\.y\.field.*Did you mean "capacity"\?/);
  });

  it("doesn't repeat the path when the engine message already names it", () => {
    const bad = chatAnalyst.turns[1].steps[0];
    if (bad.kind !== 'spec') throw new Error('scenario shape changed');
    const [error] = validate(bad.spec, bad.rows).errors;
    expect(error.split('encoding.y.field').length - 1).toBe(1);
  });
});

describe('scenarios', () => {
  for (const scenario of SCENARIOS) {
    const timeline = buildTimeline(scenario);
    for (const beat of timeline.beats) {
      if (beat.kind !== 'spec') continue;
      it(`${scenario.id} turn ${beat.turn + 1} ${beat.slot}: validity matches the script`, () => {
        expect(beat.validation.valid, beat.validation.errors.join('\n')).toBe(!beat.expectInvalid);
      });
    }
  }

  it('turn 1 renders grouped bars (v8 stacks by default, so stack: null matters)', () => {
    const view = deriveView(buildTimeline(chatAnalyst), buildTimeline(chatAnalyst).turnEnds[0]);
    const layout = compileChart(view.slots.main as ChartSpec, { width: 700, height: 420 });
    const rects = layout.marks as RectMark[];
    const in2019 = rects.filter((m) => m.key?.endsWith('|2019'));
    expect(in2019).toHaveLength(3);
    expect(new Set(in2019.map((m) => Math.round(m.x))).size).toBe(3);
  });

  it('keeps the last valid chart on screen while a spec is invalid', () => {
    const timeline = buildTimeline(chatAnalyst);
    const invalid = timeline.beats.find((b) => b.kind === 'spec' && !b.validation.valid);
    const valid = timeline.beats.find((b) => b.kind === 'spec' && b.validation.valid);
    if (!invalid || invalid.kind !== 'spec' || !valid || valid.kind !== 'spec') {
      throw new Error('scenario shape changed');
    }
    const view = deriveView(timeline, invalid.end + 1);
    expect(view.slots.main).toBe(valid.renderSpec);
    expect(view.paneBeat?.beat).toBe(invalid);
  });

  it('diffs the repair against the rejected attempt, so the fix is one line', () => {
    const timeline = buildTimeline(chatAnalyst);
    const specs = timeline.beats.filter((b) => b.kind === 'spec');
    const [first, attempt, repair] = specs;
    if (first?.kind !== 'spec' || attempt?.kind !== 'spec' || repair?.kind !== 'spec') {
      throw new Error('scenario shape changed');
    }
    expect(first.diff).toBeNull();
    expect(attempt.repairing).toBe(false);
    expect(repair.repairing).toBe(true);
    expect(repair.changes).toEqual({ add: 1, del: 1 });
    const changed = (repair.diff ?? [])
      .filter((l) => l.type === 'add' || l.type === 'del')
      .map((l) => ('line' in l ? `${l.type} ${l.line.trim()}` : ''));
    expect(changed).toEqual(['del "field": "capacity_gw",', 'add "field": "capacity",']);
  });

  it('streams a spec partially mid-beat and fully at the end', () => {
    const timeline = buildTimeline(chatAnalyst);
    const spec = timeline.beats.find((b) => b.kind === 'spec');
    if (!spec || spec.kind !== 'spec') throw new Error('scenario shape changed');
    const mid = deriveView(timeline, (spec.start + spec.end) / 2);
    expect(mid.paneBeat?.visibleText.length).toBeGreaterThan(0);
    expect(mid.paneBeat?.visibleText.length).toBeLessThan(spec.text.length);
    expect(mid.slots.main).toBeUndefined();
    expect(deriveView(timeline, spec.end).slots.main).toBe(spec.renderSpec);
  });
});

describe('controls', () => {
  const timeline = buildTimeline(chatAnalyst);
  const { turnStarts, turnEnds, total } = timeline;

  it('jumps to a turn start when playing and to its finished state when still', () => {
    expect(turnTarget(timeline, 1, false)).toBe(turnStarts[1]);
    expect(turnTarget(timeline, 1, true)).toBe(turnEnds[1]);
  });

  it('Next from the very start skips to turn 2, since turn 1 is already playing', () => {
    expect(nextTarget(timeline, 0, false)).toBe(turnStarts[1]);
  });

  it('Next during the last turn goes to the end of the session', () => {
    expect(nextTarget(timeline, turnStarts[2] + 1, false)).toBe(total);
  });

  it('still-mode Next steps through finished turns and stops at the end', () => {
    expect(nextTarget(timeline, turnEnds[0], true)).toBe(turnEnds[1]);
    expect(nextTarget(timeline, turnEnds[2], true)).toBe(total);
  });
});
