/**
 * Fuel spotlight strip for the hero desk. Before the live stage has mounted
 * (and without JavaScript), the focus options render as a plain list with the
 * active item marked via `data-active`. Once live, they upgrade to toggle
 * buttons inside a labelled group (`aria-pressed`).
 */
import { useEffect, useId, useRef } from "react";
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

/**
 * Scrolls the chip row sideways just far enough to show `chip`. Only the row
 * moves: `scrollIntoView` would scroll every scrolling ancestor, the window
 * included, so picking a fuel while the picker is off screen would move the page.
 */
function scrollChipIntoRow(row: HTMLElement, chip: HTMLElement) {
  const rowBox = row.getBoundingClientRect();
  const chipBox = chip.getBoundingClientRect();
  if (chipBox.left < rowBox.left) {
    row.scrollTo({ left: row.scrollLeft + chipBox.left - rowBox.left });
  } else if (chipBox.right > rowBox.right) {
    row.scrollTo({ left: row.scrollLeft + chipBox.right - rowBox.right });
  }
}

/** Focus strip letting the reader spotlight a single fuel or view all six together. */
export function SpotlightPicker({ interactive, current, onSelect }: SpotlightPickerProps) {
  const labelId = useId();
  const group = useRef<HTMLFieldSetElement>(null);

  // On phones the fuels scroll sideways on one row; a fuel chosen elsewhere
  // (a table row) has to come into view. `current` is the trigger.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the choice changes
  useEffect(() => {
    const row = group.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && chip) scrollChipIntoRow(row, chip);
  }, [current]);
  return (
    <div className="hero-spotlight-bar">
      <span className="hero-spotlight-label" id={labelId}>
        Focus
      </span>
      {interactive ? (
        <fieldset ref={group} className="hero-spotlight" aria-label="Spotlight a fuel">
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
        </fieldset>
      ) : (
        <ul className="hero-spotlight" aria-labelledby={labelId}>
          {HERO_SPOTLIGHTS.map((item) => (
            <li key={item}>
              <span className="hero-spotlight-item" data-active={item === current ? "" : undefined}>
                {item === "all" ? "All" : item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
