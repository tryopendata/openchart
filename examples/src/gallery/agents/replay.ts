/**
 * Replay engine for the Agents page: pure, DOM-free, unit-tested.
 *
 * A scenario (see `scenarios.ts`) is a script of user turns and agent steps.
 * `buildTimeline` turns it into a `@steamfield/ui` sequencer script and lays
 * it out in time, attaches data, runs the REAL `validateSpec` on every spec
 * the agent emits, and precomputes the text the spec pane streams. The
 * sequencer owns the clock position and what is on screen at it; `viewFrom`
 * reads that into the beats, streamed text and charts this player draws.
 *
 * Nothing about validation or diffs is pre-baked into the scripts: error text
 * comes from the engine and diffs come from `lineDiff`, so the page can't
 * drift from what the library actually does.
 */

import type { AnimationSpec, VizSpec } from '@opendata-ai/openchart-core';
import { validateSpec } from '@opendata-ai/openchart-engine';
import type { DemoScript, Step as DemoStep } from '@steamfield/ui/script';
import type { DemoView, Timeline as SequencerTimeline, Timing } from '@steamfield/ui/sequencer';
import { compile, stateAt } from '@steamfield/ui/sequencer';

// ---------------------------------------------------------------------------
// Script types
// ---------------------------------------------------------------------------

export type DataRow = Record<string, unknown>;

/** Where a spec renders: the single chart, or one cell of the dashboard grid. */
export type Slot = 'main' | 'a' | 'b' | 'c' | 'd';

export type Step =
  | { kind: 'tool'; label: string; result: string }
  | {
      kind: 'spec';
      slot: Slot;
      /** The spec exactly as the agent emits it: no `data`, no `animation`. */
      spec: Record<string, unknown>;
      /** Rows the host attaches before validating and rendering. */
      rows: readonly DataRow[];
      /** Scripted mistakes must say so, and the tests enforce it both ways. */
      expectInvalid?: boolean;
    }
  | { kind: 'prose'; text: string };

export type Turn = { user: string; steps: Step[] };

export type Scenario = {
  id: string;
  title: string;
  turns: Turn[];
  /** Host-side animation config added to every rendered spec. */
  animation?: AnimationSpec;
};

// ---------------------------------------------------------------------------
// Serialization + streaming
// ---------------------------------------------------------------------------

/**
 * Top-level keys stream in this order. `chrome` goes first so a chart mounts
 * once, title included, when the spec completes; anything that arrived after
 * mount would force a second render mid-entrance.
 */
export const STREAM_KEY_ORDER = [
  'type',
  'chrome',
  'mark',
  'encoding',
  'columns',
  'annotations',
] as const;

/** Pretty JSON with top-level keys reordered for streaming. */
export function serializeForStream(spec: Record<string, unknown>): string {
  const ordered: Record<string, unknown> = {};
  for (const key of STREAM_KEY_ORDER) {
    if (key in spec) ordered[key] = spec[key];
  }
  for (const key of Object.keys(spec)) {
    if (!(key in ordered)) ordered[key] = spec[key];
  }
  return JSON.stringify(ordered, null, 2);
}

const TOKEN_BOUNDARY = /[\s,:{}[\]"]/;

/**
 * The visible prefix of `text` after `n` characters have streamed, snapped
 * back to a token boundary so the pane never shows half a word.
 */
export function streamPrefix(text: string, n: number): string {
  if (n >= text.length) return text;
  if (n <= 0) return '';
  let cut = n;
  while (cut > 0 && !TOKEN_BOUNDARY.test(text[cut - 1])) cut--;
  return text.slice(0, cut);
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export type DiffLine = { type: 'same' | 'add' | 'del'; line: string };

/** LCS line diff. Inputs are specs under ~100 lines, so O(n*m) is fine. */
export function lineDiff(prev: string, next: string): DiffLine[] {
  const a = prev.split('\n');
  const b = next.split('\n');
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', line: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'del', line: a[i++] });
    } else {
      out.push({ type: 'add', line: b[j++] });
    }
  }
  while (i < a.length) out.push({ type: 'del', line: a[i++] });
  while (j < b.length) out.push({ type: 'add', line: b[j++] });
  return out;
}

/** A diff hunk line, or a gap marker standing in for elided unchanged lines. */
export type ContextLine = DiffLine | { type: 'gap'; count: number };

/** Keep changed lines plus `context` unchanged lines around each change. */
export function withContext(diff: DiffLine[], context = 2): ContextLine[] {
  const keep = new Array<boolean>(diff.length).fill(false);
  diff.forEach((d, idx) => {
    if (d.type === 'same') return;
    for (let k = Math.max(0, idx - context); k <= Math.min(diff.length - 1, idx + context); k++) {
      keep[k] = true;
    }
  });
  const out: ContextLine[] = [];
  let gap = 0;
  diff.forEach((d, idx) => {
    if (keep[idx]) {
      if (gap > 0) out.push({ type: 'gap', count: gap });
      gap = 0;
      out.push(d);
    } else {
      gap++;
    }
  });
  if (gap > 0) out.push({ type: 'gap', count: gap });
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type Validation = { valid: boolean; errors: string[] };

/**
 * Attach rows and run the engine's validator. Errors are formatted with the
 * repair recipe from docs/generating-specs.md: path, message, suggestion. The
 * path is left off when the engine's message already names it.
 */
export function validate(spec: Record<string, unknown>, rows: readonly DataRow[]): Validation {
  const result = validateSpec({ ...spec, data: rows });
  return {
    valid: result.valid,
    errors: result.errors.map((e) =>
      [e.path && !e.message.includes(e.path) ? `${e.path}:` : '', e.message, e.suggestion]
        .filter(Boolean)
        .join(' '),
    ),
  };
}

// ---------------------------------------------------------------------------
// Timeline (laid out by @steamfield/ui's sequencer)
// ---------------------------------------------------------------------------

/** Pacing at 1x. Exported so tests and the sequencer timing agree. */
export const PACE = {
  specCharsPerSec: 600,
  proseCharsPerSec: 90,
  userMs: 700,
  toolMs: 900,
  /** Pause after each step so the eye can land on what just happened. */
  stepGapMs: 1000,
  /** Longer hold on a validation failure before the repair starts. */
  errorHoldMs: 1800,
  turnGapMs: 2600,
} as const;

/** What a tool-call step carries so `toolMs` can size it: how long it runs, in ms. */
export type StepData = { runMs: number };

/**
 * PACE as sequencer timing. Every gap the sequencer would otherwise add is zero:
 * the script spells its holds out as `pause` steps, so the schedule is exactly
 * the one PACE describes. A user message "plays" for `userMs` (the thinking
 * phase, which the transcript doesn't draw), prose streams a character at a
 * time, and a tool call runs for the `runMs` its step carries.
 */
export const DEMO_TIMING: Partial<Timing<StepData>> = {
  startDelay: 0,
  typeMsPerChar: 0,
  jitter: 0,
  preTypedHoldMs: 0,
  submitHoldMs: 0,
  flashMs: 0,
  thinkingAfterUser: PACE.userMs,
  thinkingMs: 0,
  streamUnit: 'char',
  streamLeadMs: 0,
  wordMs: 1000 / PACE.proseCharsPerSec,
  punctuationMs: 1000 / PACE.proseCharsPerSec,
  readMs: 0,
  lineMs: 0,
  revealCapMs: 0,
  toolMs: (step) => (step.body?.kind === 'custom' ? step.body.data.runMs : PACE.toolMs),
  gapMs: 0,
};

type BeatBase = { start: number; end: number; turn: number };

export type Beat = BeatBase &
  (
    | { kind: 'user'; text: string }
    | { kind: 'tool'; label: string; result: string }
    | { kind: 'prose'; text: string }
    | {
        kind: 'spec';
        slot: Slot;
        text: string;
        rowCount: number;
        validation: Validation;
        /** Spec with data + host animation attached; null when invalid. */
        renderSpec: VizSpec | null;
        /**
         * Diff against the previous spec in this slot: the rejected attempt
         * for a repair (so the fix reads as the one line it is), otherwise
         * the last valid spec. Null for a slot's first spec.
         */
        diff: ContextLine[] | null;
        changes: { add: number; del: number } | null;
        /** True when the previous spec in this slot was rejected. */
        repairing: boolean;
        expectInvalid: boolean;
      }
  );

export type Timeline = {
  /** One beat per visible step, with the sequencer's start and end times. */
  beats: Beat[];
  /** Start time of each turn. */
  turnStarts: number[];
  /** Time at which each turn is fully played (before the turn gap). */
  turnEnds: number[];
  total: number;
  /** The scenario as a sequencer script: hand this to `useAgentDemo`. */
  script: DemoScript<StepData>;
  /** The script laid out with `DEMO_TIMING`. */
  compiled: SequencerTimeline;
  /** Script step index of each beat (pause steps have none), parallel to `beats`. */
  stepIndex: number[];
  /** Turn of each script step, pauses included. */
  turnOfStep: number[];
};

type BeatBody = DistributiveOmit<Beat, keyof BeatBase>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function durationOf(chars: number, perSec: number): number {
  return Math.ceil((chars / perSec) * 1000);
}

/**
 * Turns a scenario into a sequencer script, running the real validator and
 * the diffs on the way. Beats and script steps are built together so a beat
 * knows which step it is.
 */
function toScript(scenario: Scenario) {
  const steps: DemoStep<StepData>[] = [];
  const bodies: (BeatBody | null)[] = [];
  const turnOfStep: number[] = [];
  /** Index of each turn's closing gap, whose start is the turn's end. */
  const turnGapAt: number[] = [];
  const lastValidText = new Map<Slot, string>();
  const rejectedText = new Map<Slot, string>();

  const push = (turn: number, step: DemoStep<StepData>, body: BeatBody | null) => {
    steps.push(step);
    bodies.push(body);
    turnOfStep.push(turn);
  };
  const hold = (turn: number, ms: number) => push(turn, { kind: 'pause', ms }, null);

  scenario.turns.forEach((turn, turnIdx) => {
    push(turnIdx, { kind: 'user', text: turn.user }, { kind: 'user', text: turn.user });
    hold(turnIdx, PACE.stepGapMs / 2);

    for (const step of turn.steps) {
      if (step.kind === 'tool') {
        push(
          turnIdx,
          {
            kind: 'tool-call',
            name: step.label,
            body: { kind: 'custom', data: { runMs: PACE.toolMs } },
          },
          { kind: 'tool', label: step.label, result: step.result },
        );
        hold(turnIdx, PACE.stepGapMs / 2);
      } else if (step.kind === 'prose') {
        push(turnIdx, { kind: 'agent-text', text: step.text }, { kind: 'prose', text: step.text });
        hold(turnIdx, PACE.stepGapMs);
      } else {
        const text = serializeForStream(step.spec);
        const validation = validate(step.spec, step.rows);
        const renderSpec = validation.valid
          ? ({
              ...step.spec,
              data: step.rows.map((r) => ({ ...r })),
              ...(scenario.animation !== undefined ? { animation: scenario.animation } : {}),
            } as VizSpec)
          : null;
        const rejected = rejectedText.get(step.slot);
        const base = rejected ?? lastValidText.get(step.slot);
        const full = base !== undefined ? lineDiff(base, text) : null;
        push(
          turnIdx,
          {
            kind: 'tool-call',
            name: 'emit_spec',
            status: validation.valid ? 'done' : 'error',
            body: {
              kind: 'custom',
              data: { runMs: durationOf(text.length, PACE.specCharsPerSec) },
            },
          },
          {
            kind: 'spec',
            slot: step.slot,
            text,
            rowCount: step.rows.length,
            validation,
            renderSpec,
            diff: full && withContext(full),
            changes: full && {
              add: full.filter((l) => l.type === 'add').length,
              del: full.filter((l) => l.type === 'del').length,
            },
            repairing: rejected !== undefined,
            expectInvalid: step.expectInvalid ?? false,
          },
        );
        if (validation.valid) {
          lastValidText.set(step.slot, text);
          rejectedText.delete(step.slot);
        } else {
          rejectedText.set(step.slot, text);
        }
        hold(turnIdx, validation.valid ? PACE.stepGapMs : PACE.errorHoldMs);
      }
    }
    if (turnIdx < scenario.turns.length - 1) {
      turnGapAt.push(steps.length);
      hold(turnIdx, PACE.turnGapMs);
    }
  });

  return {
    script: { id: scenario.id, steps } satisfies DemoScript<StepData>,
    bodies,
    turnOfStep,
    turnGapAt,
  };
}

export function buildTimeline(scenario: Scenario): Timeline {
  const { script, bodies, turnOfStep, turnGapAt } = toScript(scenario);
  const compiled = compile(script, { timing: DEMO_TIMING });

  const beats: Beat[] = [];
  const stepIndex: number[] = [];
  bodies.forEach((body, i) => {
    const step = compiled.steps[i];
    if (!body || !step) return;
    beats.push({ ...body, start: step.start, end: step.end, turn: turnOfStep[i] ?? 0 } as Beat);
    stepIndex.push(i);
  });

  // A turn ends where its closing gap starts; the last turn ends with the session.
  const turnEnds = [
    ...turnGapAt.map((i) => compiled.steps[i]?.start ?? compiled.duration),
    compiled.duration,
  ].slice(0, scenario.turns.length);

  return {
    beats,
    turnStarts: [...compiled.turnStarts],
    turnEnds,
    total: compiled.duration,
    script,
    compiled,
    stepIndex,
    turnOfStep,
  };
}

// ---------------------------------------------------------------------------
// View derivation
// ---------------------------------------------------------------------------

export type VisibleBeat = { beat: Beat; done: boolean; visibleText: string };

export type View = {
  /** Beats that have started, in order, with how much of each has streamed. */
  visible: VisibleBeat[];
  /** Latest valid rendered spec per slot (object identity is stable). */
  slots: Partial<Record<Slot, VizSpec>>;
  /** The spec beat the pane should show: streaming now, or the last one done. */
  paneBeat: VisibleBeat | null;
  /** Index of the turn currently playing. */
  turn: number;
};

/**
 * What the sequencer's view means for this player: which beats show, how much
 * of the spec and prose has streamed, and which chart each slot holds. The
 * sequencer decides what's on screen; this only reads it.
 */
export function viewFrom(timeline: Timeline, demoView: DemoView): View {
  const beatAt = new Map(timeline.stepIndex.map((step, i) => [step, timeline.beats[i]] as const));
  const visible: VisibleBeat[] = [];
  const slots: Partial<Record<Slot, VizSpec>> = {};
  let paneBeat: VisibleBeat | null = null;
  let turn = 0;

  for (const entry of demoView.entries) {
    const beat = beatAt.get(entry.index);
    if (!beat) continue; // a pause: nothing to draw
    turn = beat.turn;
    const done = entry.phase === 'done';
    let visibleText = '';
    if (beat.kind === 'prose') {
      visibleText = done ? beat.text : streamPrefix(beat.text, entry.visibleText?.length ?? 0);
    } else if (beat.kind === 'spec') {
      visibleText = done
        ? beat.text
        : streamPrefix(beat.text, Math.floor(entry.progress * beat.text.length));
    }
    const vb: VisibleBeat = { beat, done, visibleText };
    visible.push(vb);
    if (beat.kind === 'spec') {
      paneBeat = vb;
      if (done && beat.renderSpec) slots[beat.slot] = beat.renderSpec;
    }
  }

  return { visible, slots, paneBeat, turn };
}

/** The view at `elapsed` ms, for tests and anything that isn't the live player. */
export function deriveView(timeline: Timeline, elapsed: number): View {
  return viewFrom(timeline, stateAt(timeline.compiled, { ms: elapsed }));
}

/** `finalPolicy` that keeps only the first turn: what motion-off shows before a jump. */
export function firstTurnOnly(timeline: Timeline): (steps: readonly unknown[]) => number[] {
  return (steps) => steps.flatMap((_, i) => (timeline.turnOfStep[i] === 0 ? [i] : []));
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/**
 * Where jumping to turn `i` lands: its start when playing (so it plays from
 * the user's message), its finished state when motion is off.
 */
export function turnTarget(timeline: Timeline, i: number, still: boolean): number {
  return still ? (timeline.turnEnds[i] ?? timeline.total) : (timeline.turnStarts[i] ?? 0);
}

/**
 * Where Next lands from `elapsed`: the next turn that hasn't started (or, with
 * motion off, the next finished turn), else the end of the session.
 */
export function nextTarget(timeline: Timeline, elapsed: number, still: boolean): number {
  const marks = still ? timeline.turnEnds : timeline.turnStarts;
  const i = marks.findIndex((m) => m > elapsed);
  return i >= 0 ? (marks[i] ?? timeline.total) : timeline.total;
}
