/**
 * The motion island: one payrolls chart and a bench of controls beside it.
 * "Replay entrance" re-creates the chart, "Next month" adds a month of data (a
 * data update the library animates), and the animation choice rewrites the
 * spec's `animation` field. The spec excerpt marks the line the last control
 * changed. The chart animates through the library's own transitions; under
 * reduced motion the library skips them and the controls still change the chart.
 */
import { type ReactNode, useState } from "react";
import { LiveChart } from "./live-chart";
import {
  FIRST_MONTHS,
  lastMonthName,
  MOTION_CHOICES,
  type MotionChoice,
  motionExcerpt,
  motionSource,
  nextMonthCount,
  payrollSpec,
} from "./motion-spec";

export type MotionReplayProps = {
  /** The static SVGs of the opening chart. */
  children?: ReactNode;
};

/** The motion section's chart and control bench. */
export function MotionReplay({ children }: MotionReplayProps) {
  const [months, setMonths] = useState(FIRST_MONTHS);
  const [choice, setChoice] = useState<MotionChoice>("fluid");
  const [mountKey, setMountKey] = useState(0);
  const [lastChange, setLastChange] = useState<"data" | "animation" | null>(null);
  const following = nextMonthCount(months);

  return (
    <div className="motion-bench-layout">
      <figure className="motion-figure">
        <LiveChart spec={payrollSpec(months, choice)} mountKey={mountKey} className="motion-chart">
          {children}
        </LiveChart>
        <figcaption className="figure-caption motion-caption">
          Source: <a href={motionSource.url}>{motionSource.label}</a>.
        </figcaption>
      </figure>

      <div className="motion-bench">
        <div className="motion-row">
          <button type="button" className="btn" onClick={() => setMountKey((key) => key + 1)}>
            Replay entrance
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setMonths(following);
              setLastChange("data");
            }}
          >
            {following > months ? "Next month" : "Back to June"}
          </button>
          <p className="motion-note">
            Showing January to <span className="tabular-nums">{lastMonthName(months)}</span>
          </p>
        </div>

        <fieldset className="motion-row motion-choice">
          <legend className="motion-legend">animation</legend>
          {MOTION_CHOICES.map((option) => (
            <label key={option} className="motion-option">
              <input
                type="radio"
                name="motion-animation"
                value={option}
                checked={choice === option}
                onChange={() => {
                  setChoice(option);
                  setLastChange("animation");
                }}
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>

        <pre className="motion-excerpt">
          {motionExcerpt(months, choice, lastChange).map((line) => (
            <span
              key={line.text.split(":")[0]}
              className="motion-line"
              data-changed={line.changed || undefined}
            >
              {line.text}
              {"\n"}
            </span>
          ))}
        </pre>

        <p className="motion-reduced">
          The library reads the reader's reduced-motion setting itself. With it on, these controls
          still change the chart, and nothing animates.
        </p>
      </div>
    </div>
  );
}
