/**
 * Fuel spotlight strip for the hero desk. Before the live stage has mounted
 * (and without JavaScript), the focus options render as a plain list with the
 * active item marked via `data-active`. Once live, they upgrade to toggle
 * buttons inside a labelled group (`aria-pressed`).
 */
import { useId } from "react";
import { HERO_SPOTLIGHTS, type HeroSpotlight } from "../../../landing/hero";

/** Props for `SpotlightPicker`. */
export type SpotlightPickerProps = {
  /** False until the live stage is mounted: items render as plain text with no controls. */
  interactive: boolean;
  /** Currently spotlighted fuel, or `"all"` for the full mix. */
  current: HeroSpotlight;
  /** Called when the reader chooses a spotlight option. */
  onSelect: (spotlight: HeroSpotlight) => void;
};

/** Focus strip letting the reader spotlight a single fuel or view all six together. */
export function SpotlightPicker({ interactive, current, onSelect }: SpotlightPickerProps) {
  const labelId = useId();
  return (
    <div className="hero-spotlight-bar">
      <span className="hero-spotlight-label" id={labelId}>
        Focus
      </span>
      {interactive ? (
        <div className="hero-spotlight" role="group" aria-label="Spotlight a fuel">
          {HERO_SPOTLIGHTS.map((item) => (
            <button
              key={item}
              type="button"
              className="hero-spotlight-item"
              aria-pressed={item === current}
              onClick={() => onSelect(item)}
            >
              {item === "all" ? "All" : item}
            </button>
          ))}
        </div>
      ) : (
        <ul className="hero-spotlight" aria-labelledby={labelId}>
          {HERO_SPOTLIGHTS.map((item) => (
            <li key={item}>
              <span
                className="hero-spotlight-item"
                data-active={item === current ? "" : undefined}
              >
                {item === "all" ? "All" : item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
