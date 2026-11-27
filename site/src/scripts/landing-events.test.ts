/**
 * Exercises the landing page's delegated analytics listeners with DOM events,
 * over fragments copied from the built landing page: the hero's install command
 * and figure (with its spec pane and source link), the start section's bench,
 * the vocabulary wall and a playback figure.
 */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { watchLandingEvents } from "./landing-events";

const send = vi.fn();
let stop: () => void;

beforeEach(() => {
  document.body.innerHTML = `
    <header><a href="/docs/">Docs</a></header>
    <section id="desk" data-landing-section>
      <a href="/docs/get-started/getting-started/" class="hero-action">Read the docs</a>
      <figure class="pub-figure hero-figure">
        <div class="pub-figure-body" data-landing-demo>
          <div role="tablist"><button type="button" role="tab" id="hero-tab">Line</button></div>
          <svg><path id="hero-line" /></svg>
          <section tabindex="0" id="spec-pane"><code>{ "mark": "line" }</code></section>
        </div>
        <figcaption class="figure-caption pub-figure-caption">
          Source: <a id="hero-source" href="https://ourworldindata.org/electricity-mix">Our World in Data</a>.
        </figcaption>
      </figure>
      <div id="hero-install" class="hero-install">
        <div data-install-command data-part="tabs">
          <div id="hero-install-npm" role="tabpanel" data-part="tab-panel" data-default data-copy-root>
            <code id="hero-install-npm-command">npm install @opendata-ai/openchart-react</code>
            <button type="button" data-copy-command aria-controls="hero-install-npm-command"
              aria-label="Copy command"><span data-copy-label>Copy</span></button>
          </div>
        </div>
      </div>
    </section>
    <section id="vocabulary" data-landing-section>
      <div class="wall" data-landing-demo>
        <fieldset class="tile-filter">
          <button type="button" class="tile-filter-button" aria-pressed="false">Change over time</button>
        </fieldset>
        <ul class="wall-grid"><li><a id="tile" href="/docs/charts/line/">Line</a></li></ul>
      </div>
    </section>
    <section id="motion" data-landing-section>
      <figure class="pub-figure figure-hairline">
        <div class="pub-figure-body" data-landing-demo>
          <button type="button" id="play">Pause</button>
          <div role="slider" tabindex="0" id="scrubber" aria-valuenow="2016"></div>
        </div>
        <figcaption>Source: <a href="https://data.worldbank.org/">World Bank</a>.</figcaption>
      </figure>
    </section>
    <section id="start" data-landing-section>
      <div class="install-tab-command" data-install-manager="npm" data-install-framework="svelte">
        <code>npm install @opendata-ai/openchart-svelte</code>
        <button type="button" class="copy-button" id="bench-copy"><span>Copy</span></button>
      </div>
      <div class="install-tab-code-head">
        <button type="button" class="copy-button" id="sample-copy"><span>Copy</span></button>
      </div>
    </section>
  `;
  stop = watchLandingEvents(document, send);
});

afterEach(() => {
  stop();
  send.mockClear();
  document.body.replaceChildren();
});

function dispatch(selector: string, event: Event) {
  const target = document.querySelector(selector);
  if (!target) throw new Error(`Missing test target ${selector}`);
  target.dispatchEvent(event);
}

/** What a copy button reports once the clipboard has answered. */
function copied(selector: string, ok: boolean) {
  dispatch(selector, new CustomEvent("sf:copy", { bubbles: true, detail: { ok } }));
}

function click(selector: string, init: MouseEventInit = {}) {
  dispatch(selector, new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
}

function pointer(type: string, selector: string, init: PointerEventInit = {}) {
  dispatch(selector, new PointerEvent(type, { bubbles: true, pointerId: 1, ...init }));
}

function key(selector: string, init: KeyboardEventInit) {
  dispatch(selector, new KeyboardEvent("keydown", { bubbles: true, ...init }));
}

it("counts an install command once the clipboard has taken it, from the hero and the bench", () => {
  copied("#hero-install-npm [data-copy-command]", true);
  copied("#bench-copy", true);
  expect(send.mock.calls).toEqual([
    ["install_copied", { section: "desk", manager: "npm" }],
    ["install_copied", { section: "start", manager: "npm", framework: "svelte" }],
  ]);
});

it("does not count a refused copy, a bare click on the button, or a copied code sample", () => {
  copied("#hero-install-npm [data-copy-command]", false);
  copied("#bench-copy", false);
  click("#hero-install-npm [data-copy-label]");
  copied("#sample-copy", true);
  expect(send.mock.calls).toEqual([]);
});

it("counts a docs link in a section however it is opened, and leaves the click alone", () => {
  const seen = vi.fn((event: Event) => event.preventDefault());
  window.addEventListener("click", seen);
  try {
    click("#desk .hero-action");
    click("#tile", { metaKey: true });
    expect(seen.mock.calls.map(([event]) => event.defaultPrevented)).toEqual([true, true]);
  } finally {
    window.removeEventListener("click", seen);
  }
  expect(send.mock.calls).toEqual([
    ["docs_link_clicked", { section: "desk", href_path: "/docs/get-started/getting-started/" }],
    ["docs_link_clicked", { section: "vocabulary", href_path: "/docs/charts/line/" }],
  ]);
});

it("ignores the header's docs link and a figure's source link", () => {
  document.querySelector("header a")?.addEventListener("click", (event) => event.preventDefault());
  click("header a");
  click("#hero-source");
  expect(send.mock.calls).toEqual([]);
});

it("counts the first press on a control in each section's demo, once per watch", () => {
  pointer("pointerdown", "#hero-tab");
  key("#hero-tab", { key: "ArrowRight" });
  key("#play", { key: "Enter" });
  pointer("pointerdown", "#scrubber");
  pointer("pointerdown", ".tile-filter-button");
  expect(send.mock.calls).toEqual([
    ["demo_interacted", { section: "desk" }],
    ["demo_interacted", { section: "motion" }],
    ["demo_interacted", { section: "vocabulary" }],
  ]);

  stop();
  stop = watchLandingEvents(document, send);
  pointer("pointerdown", "#hero-tab");
  expect(send.mock.calls).toHaveLength(4);
});

it.each([
  new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
  new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
])("counts a press a control stops from bubbling on $type", (event) => {
  document.querySelector("#scrubber")?.addEventListener(event.type, (press) => {
    press.preventDefault();
    press.stopPropagation();
  });
  dispatch("#scrubber", event);
  expect(send.mock.calls).toEqual([["demo_interacted", { section: "motion" }]]);
});

it("counts a touch on a control when the finger lifts, not when the browser scrolls instead", () => {
  pointer("pointerdown", "#play", { pointerType: "touch", pointerId: 7 });
  expect(send.mock.calls).toEqual([]);
  pointer("pointercancel", "#play", { pointerType: "touch", pointerId: 7 });
  pointer("pointerup", "#play", { pointerType: "touch", pointerId: 7 });
  expect(send.mock.calls).toEqual([]);

  pointer("pointerdown", "#scrubber", { pointerType: "touch", pointerId: 8 });
  pointer("pointerup", "#scrubber", { pointerType: "touch", pointerId: 8 });
  expect(send.mock.calls).toEqual([["demo_interacted", { section: "motion" }]]);
});

it("does not count presses that are not using a demo", () => {
  // The plot, the scrolling spec pane, a source link and a tile link.
  pointer("pointerdown", "#hero-line");
  pointer("pointerdown", "#spec-pane code");
  pointer("pointerdown", "#hero-source");
  pointer("pointerdown", "#tile");
  // A right click, and a control outside any demo.
  pointer("pointerdown", "#play", { button: 2 });
  pointer("pointerdown", "#bench-copy");
  // Focus passing through, page keys and browser shortcuts.
  for (const init of [
    { key: "Tab" },
    { key: "Shift" },
    { key: "PageDown" },
    { key: "F5" },
    { key: "r", metaKey: true },
    { key: "l", ctrlKey: true },
  ]) {
    key("#play", init);
  }
  key("body", { key: "Enter" });
  expect(send.mock.calls).toEqual([]);
});

it("sends nothing after teardown", () => {
  copied("#bench-copy", true);
  stop();
  copied("#bench-copy", true);
  click("#desk .hero-action");
  pointer("pointerdown", "#hero-tab");
  pointer("pointerdown", "#play", { pointerType: "touch" });
  pointer("pointerup", "#play", { pointerType: "touch" });
  key("#play", { key: "Enter" });
  expect(send.mock.calls).toEqual([
    ["install_copied", { section: "start", manager: "npm", framework: "svelte" }],
  ]);
});
