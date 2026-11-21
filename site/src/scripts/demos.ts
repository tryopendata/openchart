/**
 * Brings the demos on a page to life: mounts each stage's live chart as it
 * comes within LEAD_PX of the viewport, keeps at most MAX_LIVE of them live,
 * remounts them when the site theme changes, and wires the code tabs, the Code
 * disclosure and the Copy buttons. BaseLayout loads it on every page; it does
 * nothing without a demo.
 *
 * A demo marked for the entrance mounts ahead of the reader with the library's
 * entrance held: the library plays it once the chart is actually seen
 * (play-when-seen), and not at all under reduced motion. Until then the head
 * gate and demo.css keep that demo's static SVG out of sight, so the reader
 * never sees a finished chart replaced by one drawing itself in. Where the
 * static SVG is showing anyway (the gate lifted, or reduced motion), the live
 * chart replaces it finished.
 */
import { DEMO_ATTR, DEMO_CLASS, DEMO_PAGE_ATTR } from "../lib/demo/markup";
import { setupDemoCodeToggle } from "./demo-code-toggle";
import { setupDemoCopyButtons } from "./demo-copy";
import type { DemoMount } from "./demo-mount";
import { readFigureSpec, readMountOptions } from "./demo-spec";
import { setupFrameworkChoice } from "./framework-choice";

/** Mount this far ahead of the viewport so the chart is live before the reader reaches it. */
const LEAD_PX = 400;
/** Live mounts with a static SVG to fall back to; beyond this the furthest off-screen one goes. */
const MAX_LIVE = 6;
const FAILURE_TEXT = "This chart could not be rendered.";

type DemoMounter = typeof import("./demo-mount");

type DemoStage = {
  id: string;
  stage: HTMLElement;
  /** The demo element, or the stage itself when it sits in none; `readFigureSpec` reads the spec from it. */
  figure: HTMLElement;
  entrance: boolean;
  /** Types without a static SVG never go back to an empty stage, so they are never evicted. */
  hasStatic: boolean;
  near: boolean;
  /** The entrance has started (or was skipped), so a remount draws the chart finished. */
  played: boolean;
  failed: boolean;
  live: DemoMount | null;
};

function readDemoStage(stage: HTMLElement): DemoStage {
  const figure = stage.closest<HTMLElement>(`[${DEMO_ATTR.figure}]`);
  return {
    id: figure?.getAttribute(DEMO_ATTR.figure) ?? "(unknown demo)",
    stage,
    figure: figure ?? stage,
    entrance: figure?.hasAttribute(DEMO_ATTR.entrance) ?? false,
    hasStatic: stage.querySelector(`svg.${DEMO_CLASS.static}`) !== null,
    near: false,
    played: false,
    failed: false,
    live: null,
  };
}

const isDarkPage = (doc: Document) => doc.documentElement.classList.contains("dark");

/** Pixels between an element and the viewport; 0 while any of it is on screen. */
function distanceFromViewport(element: HTMLElement): number {
  const { top, bottom } = element.getBoundingClientRect();
  const viewportHeight = element.ownerDocument.defaultView?.innerHeight ?? 0;
  if (bottom < 0) return -bottom;
  if (top > viewportHeight) return top - viewportHeight;
  return 0;
}

/** Whether the reader may already be looking at the finished static chart. */
function staticShowing(demo: DemoStage): boolean {
  const statics = demo.stage.querySelectorAll<SVGElement>(`svg.${DEMO_CLASS.static}`);
  return [...statics].some((svg) => svg.checkVisibility({ visibilityProperty: true }));
}

/** Takes away the line a stage without a static SVG shows until its chart mounts. */
function removePlaceholder(demo: DemoStage): void {
  demo.stage.querySelector(`[${DEMO_ATTR.placeholder}]`)?.remove();
}

function showFailure(demo: DemoStage, error: unknown): void {
  if (demo.failed) return;
  demo.failed = true;
  demo.stage.setAttribute(DEMO_ATTR.error, "");
  if (!demo.hasStatic) {
    removePlaceholder(demo);
    const message = demo.stage.ownerDocument.createElement("p");
    message.className = "demo-error";
    message.textContent = FAILURE_TEXT;
    demo.stage.append(message);
  }
  console.error(`Demo "${demo.id}" could not be rendered.`, error);
}

function unmount(demo: DemoStage): void {
  if (!demo.live) return;
  // A held entrance that never ran is still owed to the next mount.
  if (!demo.live.entranceWaiting()) demo.played = true;
  demo.live.destroy();
  demo.live = null;
  demo.stage.removeAttribute(DEMO_ATTR.live);
}

/** Destroys the furthest off-screen evictable mount when the cap is reached. */
function makeRoom(demos: DemoStage[], incoming: DemoStage): void {
  if (!incoming.hasStatic) return;
  const evictable = demos.filter((demo) => demo.live && demo.hasStatic && demo !== incoming);
  if (evictable.length < MAX_LIVE) return;
  const offScreen = evictable.filter((demo) => !demo.near);
  const furthest = offScreen.sort(
    (a, b) => distanceFromViewport(b.stage) - distanceFromViewport(a.stage),
  )[0];
  // Every live chart is near the viewport: going over the cap beats leaving one static.
  if (furthest) unmount(furthest);
}

function mountNow(demos: DemoStage[], demo: DemoStage, mounter: DemoMounter): void {
  if (demo.live || demo.failed) return;
  makeRoom(demos, demo);
  try {
    const spec = readFigureSpec(demo.figure);
    const { renderer } = readMountOptions(demo.figure);
    const entrance = demo.entrance && !demo.played && !staticShowing(demo);
    const dark = isDarkPage(demo.stage.ownerDocument);
    const ownTheme = demo.figure.hasAttribute(DEMO_ATTR.ownTheme);
    demo.live = mounter.mountDemo(demo.stage, spec, { dark, entrance, ownTheme, renderer });
    removePlaceholder(demo);
    demo.stage.setAttribute(DEMO_ATTR.live, "");
  } catch (error) {
    showFailure(demo, error);
  }
}

/** Calls `onApproach` each time a stage comes within LEAD_PX of the viewport. */
function observeApproach(demos: DemoStage[], onApproach: (demo: DemoStage) => void): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const demo = demos.find((candidate) => candidate.stage === entry.target);
        if (!demo) continue;
        demo.near = entry.isIntersecting;
        if (demo.near && !demo.live && !demo.failed) onApproach(demo);
      }
    },
    { rootMargin: `${LEAD_PX}px 0px` },
  );
  for (const demo of demos) observer.observe(demo.stage);
}

/** Calls `onChange` when the `dark` class on `<html>` flips. */
function observeTheme(doc: Document, onChange: () => void): void {
  let dark = isDarkPage(doc);
  new MutationObserver(() => {
    if (isDarkPage(doc) === dark) return;
    dark = isDarkPage(doc);
    onChange();
  }).observe(doc.documentElement, { attributes: true, attributeFilter: ["class"] });
}

/** Observes every demo stage on the page and mounts each as it approaches. */
export function startDemos(doc: Document): void {
  const stages = [...doc.querySelectorAll<HTMLElement>(`[${DEMO_ATTR.stage}]`)];
  if (stages.length === 0) return;
  const demos = stages.map(readDemoStage);
  let mounter: Promise<DemoMounter> | null = null;
  let loaded: DemoMounter | null = null;
  const loadMounter = () => {
    mounter ??= import("./demo-mount");
    return mounter;
  };

  // A demo on screen at load waits on an empty stage for its entrance, so fetch the library now.
  if (demos.some((demo) => demo.entrance)) {
    // Without the library no demo can mount: bring every static chart back at once.
    loadMounter().catch((error: unknown) => {
      for (const demo of demos) showFailure(demo, error);
    });
  }

  observeApproach(demos, (demo) => {
    loadMounter()
      .then((module) => {
        loaded = module;
        if (demo.near) mountNow(demos, demo, module);
      })
      .catch((error: unknown) => showFailure(demo, error));
  });

  // A mounted chart has no theme setter, so a theme change rebuilds each live one.
  observeTheme(doc, () => {
    if (!loaded) return;
    for (const demo of demos.filter((candidate) => candidate.live)) {
      unmount(demo);
      mountNow(demos, demo, loaded);
    }
  });
}

document.documentElement.setAttribute(DEMO_PAGE_ATTR.ready, "");
setupFrameworkChoice(document);
setupDemoCodeToggle(document);
setupDemoCopyButtons(document);
startDemos(document);
