/**
 * Exercises delegated landing analytics with DOM events and a reduced copy of
 * the built landing page's markup.
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
      <div data-install-command data-part="tabs">
        <div id="hero-install-npm" role="tabpanel" data-part="tab-panel" data-default data-copy-root>
          <code id="hero-install-npm-command">npm install @opendata-ai/openchart-react</code>
          <button type="button" data-copy-command aria-controls="hero-install-npm-command"
            aria-label="Copy command"><span data-copy-label>Copy</span></button>
        </div>
      </div>
      <figure class="pub-figure hero-figure">
        <div role="tab" tabindex="0">Line</div>
        <figcaption></figcaption>
      </figure>
    </section>
    <section id="motion" data-landing-section>
      <figure class="pub-figure figure-hairline" data-reveal><figcaption></figcaption></figure>
      <figure class="pub-figure figure-hairline" data-reveal>
        <button type="button" class="btn">Next month</button>
      </figure>
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

function click(selector: string) {
  dispatch(selector, new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function pressPointer(selector: string) {
  dispatch(selector, new PointerEvent("pointerdown", { bubbles: true }));
}

function pressKey(selector: string, key: string) {
  dispatch(selector, new KeyboardEvent("keydown", { key, bubbles: true }));
}

it("counts a click on the copy button's inner label and a landing docs click", () => {
  const onCopyClick = vi.fn();
  document.querySelector("#desk button")?.addEventListener("click", onCopyClick);
  const observed = vi.fn();
  const afterDocument = (event: Event) => {
    observed(event.target, event.defaultPrevented);
    event.preventDefault();
  };
  window.addEventListener("click", afterDocument);
  try {
    click("#desk [data-copy-label]");
    click("#desk a");
    expect(onCopyClick).toHaveBeenCalledTimes(1);
    expect(observed.mock.calls).toEqual([
      [document.querySelector("#desk [data-copy-label]"), false],
      [document.querySelector("#desk a"), false],
    ]);
    expect(send.mock.calls).toEqual([
      ["install_copied", { section: "desk", manager: "npm" }],
      ["docs_link_clicked", { section: "desk", href_path: "/docs/get-started/getting-started/" }],
    ]);
  } finally {
    window.removeEventListener("click", afterDocument);
  }
});

it("counts the first pointer or key press in each figure's section once per watch", () => {
  click("#motion button");
  pressPointer("#desk [role=tab]");
  pressKey("#desk [role=tab]", "ArrowRight");
  pressKey("#motion button", "Enter");
  pressPointer("#motion button");
  expect(send.mock.calls).toEqual([
    ["demo_interacted", { section: "desk" }],
    ["demo_interacted", { section: "motion" }],
  ]);

  stop();
  stop = watchLandingEvents(document, send);
  pressPointer("#desk [role=tab]");
  expect(send.mock.calls).toEqual([
    ["demo_interacted", { section: "desk" }],
    ["demo_interacted", { section: "motion" }],
    ["demo_interacted", { section: "desk" }],
  ]);
});

it.each([
  new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
  new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
])("counts a figure press without bubbling on $type", (event) => {
  const onPress = vi.fn((press: Event) => {
    press.preventDefault();
    press.stopPropagation();
  });
  document.querySelector("#motion button")?.addEventListener(event.type, onPress);
  dispatch("#motion button", event);
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(send.mock.calls).toEqual([["demo_interacted", { section: "motion" }]]);
});

it("ignores the header docs link, page body key presses, and presses outside figures", () => {
  document.querySelector("header a")?.addEventListener("click", (event) => event.preventDefault());
  click("header a");
  pressKey("body", "Enter");
  pressPointer("#desk button");
  expect(send.mock.calls).toEqual([]);
});

it("stops sending click, pointer and key events after teardown", () => {
  click("#desk [data-copy-label]");
  stop();
  click("#desk [data-copy-label]");
  pressPointer("#desk [role=tab]");
  pressKey("#motion button", "Enter");
  expect(send.mock.calls).toEqual([["install_copied", { section: "desk", manager: "npm" }]]);
});

it("does not count a press on a figure's text, or focus passing through its controls", () => {
  // A thumb landing on the chart to scroll the page, and Tab moving through it.
  pressPointer("#desk figcaption");
  pressPointer("#motion figcaption");
  pressKey("#desk [role=tab]", "Tab");
  pressKey("#motion button", "Shift");
  expect(send.mock.calls).toEqual([]);
});
