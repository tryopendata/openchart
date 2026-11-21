/**
 * The hero desk's state as a pure reducer: which step is current, and whether
 * the sequence is playing and for how many more advances. The page starts on
 * the last step (the finished chart, which the server renders). When the chart
 * is live and the reader has not asked for reduced motion, `autoplay` rewinds to
 * the first step and plays through twice ("loops once"), then rests on the last
 * step. Any step choice or Pause stops the sequence for good; Play restarts it
 * only because the reader asked.
 */

/** The desk's state. `remaining` counts the automatic advances still to come. */
export type DeskState = {
  step: number;
  count: number;
  playing: boolean;
  remaining: number;
  /** Set by the reader's first interaction; autoplay never starts after it. */
  touched: boolean;
};

export type DeskAction =
  | { type: "autoplay" }
  | { type: "tick" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "select"; step: number }
  | { type: "next" }
  | { type: "previous" };

/** Passes through the steps that autoplay makes: the sequence once, then once more. */
const AUTOPLAY_PASSES = 2;

/** The state the server renders: the last of `count` steps, not playing. */
export function initialDeskState(count: number): DeskState {
  return { step: count - 1, count, playing: false, remaining: 0, touched: false };
}

const clampStep = (state: DeskState, step: number) => Math.min(state.count - 1, Math.max(0, step));

/** The reader took over: show `step` and stop the sequence. */
const chooseStep = (state: DeskState, step: number): DeskState => ({
  ...state,
  step: clampStep(state, step),
  playing: false,
  remaining: 0,
  touched: true,
});

/** Advances from the first step to the last, after showing the first. */
const passAdvances = (count: number) => count - 1;

export function deskReducer(state: DeskState, action: DeskAction): DeskState {
  switch (action.type) {
    case "autoplay":
      if (state.touched || state.count < 2) return state;
      return {
        ...state,
        step: 0,
        playing: true,
        // The wrap from the last step back to the first between passes is one more advance.
        remaining: AUTOPLAY_PASSES * passAdvances(state.count) + (AUTOPLAY_PASSES - 1),
      };
    case "tick": {
      if (!state.playing) return state;
      const remaining = state.remaining - 1;
      return {
        ...state,
        step: (state.step + 1) % state.count,
        remaining,
        playing: remaining > 0,
      };
    }
    case "play": {
      // From the last step, Play starts over; elsewhere it finishes the pass.
      const atEnd = state.step === state.count - 1;
      const step = atEnd ? 0 : state.step;
      const remaining = state.count - 1 - step;
      return { ...state, step, playing: remaining > 0, remaining, touched: true };
    }
    case "pause":
      return { ...state, playing: false, remaining: 0, touched: true };
    case "select":
      return chooseStep(state, action.step);
    case "next":
      return chooseStep(state, state.step + 1);
    case "previous":
      return chooseStep(state, state.step - 1);
  }
}
