/**
 * Brings the demo figures on a page to life: mounts each stage's live chart as it
 * comes within LEAD_PX of the viewport, keeps at most MAX_LIVE of them live,
 * remounts them when the site theme changes, and wires the code tabs and Copy
 * buttons. BaseLayout loads it on every page; it does nothing without a demo.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { setupDemoCopyButtons } from "../components/demo/copy-buttons";
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
  specJson: string;
  entrance: boolean;
  /** Types without a static SVG never go back to an empty stage, so they are never evicted. */
  hasStatic: boolean;
  near: boolean;
  played: boolean;
  failed: boolean;
  live: { destroy(): void } | null;
};

function readDemoStage(stage: HTMLElement): DemoStage {
  const figure = stage.closest<HTMLElement>("figure[data-demo]");
  return {
    id: figure?.dataset.demo ?? "(unknown demo)",
    stage,
    specJson: figure?.querySelector("[data-demo-spec]")?.textContent ?? "",
    entrance: figure?.hasAttribute("data-demo-entrance") ?? false,
    hasStatic: stage.querySelector("svg.demo-static") !== null,
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

function showFailure(demo: DemoStage, error: unknown): void {
  if (demo.failed) return;
  demo.failed = true;
  demo.stage.setAttribute("data-demo-error", "");
  if (!demo.hasStatic) {
    const message = demo.stage.ownerDocument.createElement("p");
    message.className = "demo-error";
    message.textContent = FAILURE_TEXT;
    demo.stage.append(message);
  }
  console.error(`Demo "${demo.id}" could not be rendered.`, error);
}

function unmount(demo: DemoStage): void {
  demo.live?.destroy();
  demo.live = null;
  demo.stage.removeAttribute("data-demo-live");
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
    const spec = JSON.parse(demo.specJson) as VizSpec;
    // Only the first mount may play the entrance; evictions and theme changes remount quietly.
    const entrance = demo.entrance && !demo.played;
    const dark = isDarkPage(demo.stage.ownerDocument);
    demo.live = mounter.mountDemo(demo.stage, spec, { dark, entrance });
    demo.played = true;
    demo.stage.setAttribute("data-demo-live", "");
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
  const stages = [...doc.querySelectorAll<HTMLElement>("[data-demo-stage]")];
  if (stages.length === 0) return;
  const demos = stages.map(readDemoStage);
  let mounter: Promise<DemoMounter> | null = null;
  let loaded: DemoMounter | null = null;

  observeApproach(demos, (demo) => {
    mounter ??= import("./demo-mount");
    mounter
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

setupFrameworkChoice(document);
setupDemoCopyButtons(document);
startDemos(document);
