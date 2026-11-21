/**
 * The HeroDesk island: editorial form tabs, fuel spotlight focus strip, the
 * live chart/table stage at full width, and the spec closed in a disclosure
 * underneath, wired to the pure desk reducer. The server renders the default
 * view (`Line` + `Coal`) with the static SVG pair (passed as children), plain
 * non-interactive lists for the controls, and the spec closed. There is no
 * autoplay timer: once the chart library mounts, the controls upgrade to full
 * interactive tabs and toggle buttons.
 */
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  type HeroFormId,
  type HeroFuel,
  type HeroSpotlight,
  heroSpecDiff,
} from "../../../landing/hero";
import { useHydrated } from "../../shared/use-hydrated";
import { useMotionTools } from "../../shared/use-motion-tools";
import { deskReducer, INITIAL_DESK_STATE } from "./desk-state";
import { FormTabs } from "./FormTabs";
import { HeroStage } from "./HeroStage";
import { SpecDisclosure } from "./SpecDisclosure";
import { SpotlightPicker } from "./SpotlightPicker";
import { revealAddedLines } from "./spec-reveal";

/** Props for `HeroDesk`. */
export type HeroDeskProps = {
  /** The static SVGs of the default view, shown until the live stage has drawn. */
  children?: ReactNode;
};

/** Interactive hero desk wiring form tabs, fuel spotlighting, live stage, and spec disclosure. */
export default function HeroDesk({ children }: HeroDeskProps) {
  const [state, dispatch] = useReducer(deskReducer, INITIAL_DESK_STATE);
  const [mounted, setMounted] = useState(false);
  const [specOpen, setSpecOpen] = useState(false);
  const hydrated = useHydrated();
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const tabId = (form: HeroFormId) => `${baseId}-tab-${form}`;

  const diff = useMemo(
    () => heroSpecDiff(state.form, state.spotlight),
    [state.form, state.spotlight],
  );

  const tools = useMotionTools("the hero desk");
  const pane = useRef<HTMLElement>(null);

  // While the spec is open, reveal the added lines on every form or spotlight change.
  // Closed, nothing runs: the lines settle in place when the reader opens the disclosure.
  const viewKey = `${state.form}:${state.spotlight}`;
  const shownKey = useRef(viewKey);
  useEffect(() => {
    if (!pane.current || shownKey.current === viewKey) return;
    shownKey.current = viewKey;
    if (!specOpen) return;
    return revealAddedLines(pane.current, tools);
  }, [viewKey, tools, specOpen]);

  const onSpecToggle = useCallback((open: boolean) => {
    setSpecOpen(open);
    // Opening lands on the active view's added lines, without motion.
    if (open && pane.current) revealAddedLines(pane.current, null);
  }, []);

  const onMounted = useCallback(() => setMounted(true), []);
  const onSelectForm = useCallback((form: HeroFormId) => dispatch({ type: "set-form", form }), []);
  const onSelectSpotlight = useCallback(
    (spotlight: HeroSpotlight) => dispatch({ type: "set-spotlight", spotlight }),
    [],
  );
  const onRowSelectFuel = useCallback(
    (fuel: HeroFuel) => dispatch({ type: "toggle-spotlight", fuel }),
    [],
  );

  return (
    <div className="hero-desk">
      <FormTabs
        interactive={mounted}
        current={state.form}
        panelId={panelId}
        tabId={tabId}
        onSelect={onSelectForm}
      />
      <SpotlightPicker
        interactive={mounted}
        current={state.spotlight}
        onSelect={onSelectSpotlight}
      />
      <HeroStage
        form={state.form}
        spec={diff.spec}
        interactive={mounted}
        panelId={panelId}
        activeTabId={tabId(state.form)}
        onMounted={onMounted}
        onRowSelectFuel={onRowSelectFuel}
      >
        {children}
      </HeroStage>
      <SpecDisclosure ref={pane} diff={diff} hydrated={hydrated} onToggle={onSpecToggle} />
    </div>
  );
}
