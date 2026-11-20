/**
 * The desk's controls: the five steps as a list of buttons (the current one
 * carries `aria-current="step"`, and arrow keys move between them with a roving
 * tab stop), then Previous, Pause or Play, and Next. While the sequence plays, a
 * hairline under the current step fills over the time to the next one.
 */
import { type CSSProperties, type KeyboardEvent, useRef } from "react";

export type StepListProps = {
  labels: string[];
  current: number;
  playing: boolean;
  /** How long each step shows while playing, for the progress hairline. */
  stepMs: number;
  onSelect: (step: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
};

/** The step a key press moves to, or null when the key is not a step key. */
function stepForKey(key: string, current: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return Math.min(count - 1, current + 1);
    case "ArrowLeft":
    case "ArrowUp":
      return Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export function StepList({
  labels,
  current,
  playing,
  stepMs,
  onSelect,
  onPrevious,
  onNext,
  onTogglePlay,
}: StepListProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLOListElement>) {
    const step = stepForKey(event.key, current, labels.length);
    if (step === null) return;
    event.preventDefault();
    onSelect(step);
    buttons.current[step]?.focus();
  }

  return (
    <div className="hero-bar">
      <ol aria-label="Spec steps" className="hero-steps" onKeyDown={onKeyDown}>
        {labels.map((label, index) => (
          <li key={label}>
            <button
              ref={(button) => {
                buttons.current[index] = button;
              }}
              type="button"
              className="hero-step"
              aria-current={index === current ? "step" : undefined}
              tabIndex={index === current ? 0 : -1}
              onClick={() => onSelect(index)}
            >
              <span className="hero-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="hero-step-label">{label}</span>
              {playing && index === current ? (
                <span
                  key={`${current}-progress`}
                  className="hero-step-progress"
                  aria-hidden="true"
                  style={{ "--step-ms": `${stepMs}ms` } as CSSProperties}
                />
              ) : null}
            </button>
          </li>
        ))}
      </ol>
      <div className="hero-controls">
        <button
          type="button"
          className="hero-control"
          aria-label="Previous step"
          onClick={onPrevious}
        >
          <span aria-hidden="true">←</span>
        </button>
        <button type="button" className="hero-control hero-control-play" onClick={onTogglePlay}>
          {playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="hero-control" aria-label="Next step" onClick={onNext}>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
