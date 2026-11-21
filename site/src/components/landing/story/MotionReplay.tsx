/**
 * The motion island: one payrolls chart and a bench of controls beside it.
 * "Replay entrance" re-creates the chart, "Next month" adds a month of data (a
 * data update the library animates), and the animation choice rewrites the
 * spec's `animation` field. The spec excerpt, read off the live spec, marks the
 * field the last control changed. The chart animates through the library's own
 * transitions; under reduced motion the library skips them and the controls
 * still change the chart.
 *
 * Every control is disabled until the island hydrates, so the server's HTML
 * never offers a control that cannot work yet.
 */
import { type ReactNode, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { LiveChart } from "../../shared/LiveChart";
import {
  type ChangedField,
  FIRST_MONTHS,
  MOTION_CHOICES,
  type MotionChoice,
  monthName,
  motionExcerpt,
  nextMonthCount,
  payrollSpec,
} from "./motion-spec";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export type MotionReplayProps = {
  /** The static SVGs of the opening chart. */
  children?: ReactNode;
};

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True while the reader's system asks for reduced motion. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/** True once the island has hydrated in the browser. */
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/** Why "Replay entrance" can do nothing, or null when it can play. */
function replayBlockedReason(choice: MotionChoice, reducedMotion: boolean): string | null {
  if (reducedMotion) return "Replay is off: your system asks for reduced motion.";
  if (choice === "off") return "Replay is off while animation is false.";
  return null;
}

/** The motion section's chart and control bench. */
export function MotionReplay({ children }: MotionReplayProps) {
  const [months, setMonths] = useState(FIRST_MONTHS);
  const [choice, setChoice] = useState<MotionChoice>("fluid");
  const [mountKey, setMountKey] = useState(0);
  const [lastChange, setLastChange] = useState<ChangedField | null>(null);
  const hydrated = useHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const reasonId = useId();
  const spec = useMemo(() => payrollSpec(months, choice), [months, choice]);
  const following = nextMonthCount(months);
  const blocked = replayBlockedReason(choice, reducedMotion);

  return (
    <div className="motion-bench-layout">
      <div className="motion-stage">
        <LiveChart spec={spec} mountKey={mountKey} className="motion-chart">
          {children}
        </LiveChart>
      </div>

      <div className="motion-bench">
        <div className="motion-row">
          <button
            type="button"
            className="btn"
            disabled={!hydrated || blocked !== null}
            aria-describedby={blocked === null ? undefined : reasonId}
            onClick={() => setMountKey((key) => key + 1)}
          >
            Replay entrance
          </button>
          <button
            type="button"
            className="btn"
            disabled={!hydrated}
            onClick={() => {
              setMonths(following);
              setLastChange("data");
            }}
          >
            {following > months ? "Next month" : `Back to ${monthName(FIRST_MONTHS)}`}
          </button>
          <p className="motion-note" data-motion-months>
            Showing January to {monthName(months)}
          </p>
          {hydrated && blocked !== null ? (
            <p id={reasonId} className="motion-note">
              {blocked}
            </p>
          ) : null}
        </div>

        <fieldset className="motion-row motion-choice" disabled={!hydrated}>
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

        <pre className="motion-excerpt" data-motion-excerpt>
          {motionExcerpt(spec, lastChange).map((line) => (
            <span key={line.key} className="motion-line" data-changed={line.changed || undefined}>
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
