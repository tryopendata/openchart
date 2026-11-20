/**
 * The desk's step reducer driven the way the island drives it: autoplay after
 * load, ticks from the timer, and the reader's clicks at any point.
 */
import { describe, expect, it } from "vitest";
import { type DeskAction, type DeskState, deskReducer, initialDeskState } from "./desk-state";

const run = (actions: DeskAction[], state: DeskState = initialDeskState(5)) =>
  actions.reduce(deskReducer, state);

/** Ticks until the sequence stops, recording each step it shows. */
function playOut(state: DeskState) {
  const shown = [state.step];
  let current = state;
  for (let guard = 0; current.playing && guard < 100; guard += 1) {
    current = deskReducer(current, { type: "tick" });
    shown.push(current.step);
  }
  return { shown, state: current };
}

describe("deskReducer", () => {
  it("starts on the last step, not playing", () => {
    expect(initialDeskState(5)).toMatchObject({ step: 4, playing: false });
  });

  it("autoplay rewinds, plays through twice and rests on the last step", () => {
    const { shown, state } = playOut(run([{ type: "autoplay" }]));
    expect(shown).toEqual([0, 1, 2, 3, 4, 0, 1, 2, 3, 4]);
    expect(state).toMatchObject({ step: 4, playing: false });
  });

  it("Pause stops the sequence, and later ticks change nothing", () => {
    const paused = run([{ type: "autoplay" }, { type: "tick" }, { type: "pause" }]);
    expect(paused).toMatchObject({ step: 1, playing: false });
    expect(run([{ type: "tick" }, { type: "tick" }], paused)).toEqual(paused);
  });

  it("a step choice stops the sequence for good, even if autoplay is asked for again", () => {
    const chosen = run([{ type: "autoplay" }, { type: "select", step: 2 }, { type: "autoplay" }]);
    expect(chosen).toMatchObject({ step: 2, playing: false });
  });

  it("Next and Previous move one step and stop at the ends", () => {
    expect(run([{ type: "next" }])).toMatchObject({ step: 4, playing: false });
    expect(run([{ type: "previous" }, { type: "previous" }])).toMatchObject({ step: 2 });
    expect(run([{ type: "select", step: 0 }, { type: "previous" }])).toMatchObject({ step: 0 });
  });

  it("Play from the last step plays the sequence once; from the middle it finishes the pass", () => {
    expect(playOut(run([{ type: "play" }])).shown).toEqual([0, 1, 2, 3, 4]);
    expect(playOut(run([{ type: "select", step: 2 }, { type: "play" }])).shown).toEqual([2, 3, 4]);
  });
});
