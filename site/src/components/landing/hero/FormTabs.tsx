/**
 * Editorial form switcher for the hero desk. Before the live stage has mounted
 * (and without JavaScript), the four forms render as a plain list with the
 * active form marked via `aria-current="true"`. Once live, they upgrade to a
 * WAI-ARIA `tablist` with roving focus and ArrowLeft/ArrowRight/Home/End
 * keyboard navigation.
 */
import { type CSSProperties, type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { HERO_FORMS, type HeroFormId, heroFormLabels } from "../../../landing/hero";

/** Props for `FormTabs`. */
export type FormTabsProps = {
  /** False until the live stage is mounted: forms render as a plain list with no controls. */
  interactive: boolean;
  /** Currently active editorial form. */
  current: HeroFormId;
  /** Id of the tabpanel controlled by these tabs. */
  panelId: string;
  /** Returns the DOM id for a form's tab button. */
  tabId: (form: HeroFormId) => string;
  /** Called when the reader selects a form. */
  onSelect: (form: HeroFormId) => void;
};

/** The form a tab key moves to, wrapping across `HERO_FORMS`, or null for other keys. */
function formForKey(key: string, from: HeroFormId): HeroFormId | null {
  const index = HERO_FORMS.indexOf(from);
  const count = HERO_FORMS.length;
  switch (key) {
    case "ArrowRight":
      return HERO_FORMS[(index + 1) % count] ?? null;
    case "ArrowLeft":
      return HERO_FORMS[(index - 1 + count) % count] ?? null;
    case "Home":
      return HERO_FORMS[0] ?? null;
    case "End":
      return HERO_FORMS[count - 1] ?? null;
    default:
      return null;
  }
}

type TabIndicator = { left: number; width: number; top: number; animate: boolean };

/** Four editorial form tabs, or a plain list until the live stage has mounted. */
export function FormTabs({ interactive, current, panelId, tabId, onSelect }: FormTabsProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const buttons = useRef<Partial<Record<HeroFormId, HTMLButtonElement | null>>>({});
  const hasMeasured = useRef(false);
  const [indicator, setIndicator] = useState<TabIndicator | null>(null);

  useLayoutEffect(() => {
    if (!interactive) return;
    const measure = () => {
      const active = buttons.current[current];
      if (!active) return;
      const next = {
        left: active.offsetLeft,
        width: active.offsetWidth,
        top: active.offsetTop + active.offsetHeight - 2,
        animate: hasMeasured.current,
      };
      hasMeasured.current = true;
      setIndicator(next);
    };
    measure();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [interactive, current]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, form: HeroFormId) {
    const next = formForKey(event.key, form);
    if (next === null) return;
    event.preventDefault();
    onSelect(next);
    buttons.current[next]?.focus();
  }

  if (!interactive) {
    // Before the live stage is up (and without JavaScript) the forms are a plain
    // list with the default one marked: nothing here can be pressed yet.
    return (
      <ul className="hero-forms" aria-label="Editorial forms">
        {HERO_FORMS.map((form) => (
          <li key={form}>
            <span className="hero-form-tab" aria-current={form === current ? "true" : undefined}>
              {heroFormLabels[form]}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const indicatorStyle: CSSProperties | undefined = indicator
    ? {
        transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0) scaleX(${indicator.width})`,
      }
    : undefined;

  return (
    <div
      ref={listRef}
      className="hero-forms"
      role="tablist"
      aria-label="Editorial forms"
      data-sliding={indicator ? "" : undefined}
    >
      {HERO_FORMS.map((form) => (
        <button
          key={form}
          ref={(button) => {
            buttons.current[form] = button;
          }}
          type="button"
          role="tab"
          id={tabId(form)}
          aria-selected={form === current}
          aria-controls={panelId}
          tabIndex={form === current ? 0 : -1}
          className="hero-form-tab"
          onClick={() => onSelect(form)}
          onKeyDown={(event) => handleKeyDown(event, form)}
        >
          {heroFormLabels[form]}
        </button>
      ))}
      {indicator ? (
        <span
          className="hero-forms-indicator"
          aria-hidden="true"
          data-instant={indicator.animate ? undefined : ""}
          style={indicatorStyle}
        />
      ) : null}
    </div>
  );
}
