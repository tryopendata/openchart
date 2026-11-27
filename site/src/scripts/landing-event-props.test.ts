/**
 * Tests which DOM elements qualify for landing analytics and which properties
 * each sends.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  demoInteractedProps,
  docsLinkProps,
  installCopiedProps,
  sectionOf,
} from "./landing-event-props";

afterEach(() => {
  document.body.replaceChildren();
});

function render(markup: string) {
  document.body.innerHTML = markup;
}

function element(selector: string) {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`Missing test element ${selector}`);
  return node;
}

function docsLink(href: string) {
  const link = document.createElement("a");
  link.href = href;
  return link;
}

describe("landing sections", () => {
  it("uses the nearest marked section's id", () => {
    render(
      '<section id="desk" data-landing-section><section id="edit" data-landing-section><span></span></section></section>',
    );
    expect(sectionOf(element("span"))).toBe("edit");
  });

  it("returns null outside a marked section", () => {
    render('<section id="other"><span></span></section>');
    expect(sectionOf(element("span"))).toBeNull();
  });
});

describe("install copy properties", () => {
  it("uses the manager suffix from the install command's tab panel", () => {
    render(`
      <section id="desk" data-landing-section>
        <div id="hero-install-npm" role="tabpanel"><button data-copy-command></button></div>
        <div id="hero-install-bun" role="tabpanel"><button data-copy-command></button></div>
      </section>
    `);
    expect(installCopiedProps(element("#hero-install-npm button"))).toEqual({
      section: "desk",
      manager: "npm",
    });
    expect(installCopiedProps(element("#hero-install-bun button"))).toEqual({
      section: "desk",
      manager: "bun",
    });
  });

  it("reads the manager and framework the start section's bench names", () => {
    render(`
      <section id="start" data-landing-section>
        <div class="install-tab-command" data-install-manager="npm" data-install-framework="vue">
          <button class="copy-button"><span>Copy</span></button>
        </div>
        <div class="install-tab-code-head"><button class="copy-button"></button></div>
      </section>
    `);
    expect(installCopiedProps(element(".install-tab-command span"))).toEqual({
      section: "start",
      manager: "npm",
      framework: "vue",
    });
    expect(installCopiedProps(element(".install-tab-code-head button"))).toBeNull();
  });

  it("ignores a copy button outside a section or without an install panel", () => {
    render(`
      <div id="hero-install-npm" role="tabpanel"><button data-copy-command></button></div>
      <section id="agents" data-landing-section><button data-copy-command></button></section>
    `);
    expect(installCopiedProps(element("#hero-install-npm button"))).toBeNull();
    expect(installCopiedProps(element("#agents button"))).toBeNull();
  });
});

describe("docs link properties", () => {
  it("keeps only the path of a same-site docs link", () => {
    render('<section id="start" data-landing-section></section>');
    const link = docsLink("/docs/api/export/?ref=landing#animated-gif-export");
    element("#start").append(link);
    expect(docsLinkProps(link)).toEqual({ section: "start", href_path: "/docs/api/export/" });
  });

  it("ignores docs links outside landing sections", () => {
    const link = docsLink("/docs/");
    document.body.append(link);
    expect(docsLinkProps(link)).toBeNull();
  });

  it.each(["https://other.example/docs/", "/docs", "/docs-preview/", "/examples/"])(
    "ignores %s inside a landing section",
    (href) => {
      render('<section id="desk" data-landing-section></section>');
      const link = docsLink(href);
      element("#desk").append(link);
      expect(docsLinkProps(link)).toBeNull();
    },
  );
});

describe("demo interaction properties", () => {
  it("uses the section of the demo a control is in", () => {
    render(`
      <section id="motion" data-landing-section>
        <figure><div data-landing-demo><button><span></span></button></div></figure>
      </section>
      <section id="vocabulary" data-landing-section>
        <div class="wall" data-landing-demo><button></button></div>
      </section>
    `);
    expect(demoInteractedProps(element("#motion span"))).toEqual({ section: "motion" });
    expect(demoInteractedProps(element("#vocabulary button"))).toEqual({ section: "vocabulary" });
  });

  it.each(['[role="slider"]', '[role="tab"]', "input", "select"])("counts %s", (selector) => {
    render(`
      <section id="desk" data-landing-section><div data-landing-demo>
        <div role="slider" tabindex="0"></div><div role="tab"></div><input /><select></select>
      </div></section>
    `);
    expect(demoInteractedProps(element(selector))).toEqual({ section: "desk" });
  });

  it("ignores links, focusable panes, the plot itself and controls outside a demo", () => {
    render(`
      <section id="desk" data-landing-section>
        <button id="outside"></button>
        <figure>
          <div data-landing-demo>
            <svg><path /></svg>
            <section tabindex="0" id="pane"><code>{}</code></section>
            <a id="tile" href="/docs/charts/line/">Line</a>
          </div>
          <figcaption>Source: <a id="source" href="https://example.org/data">Example</a></figcaption>
        </figure>
      </section>
      <div data-landing-demo><button id="unsectioned"></button></div>
    `);
    for (const selector of ["#outside", "path", "#pane code", "#tile", "#source", "#unsectioned"]) {
      expect(demoInteractedProps(element(selector)), selector).toBeNull();
    }
  });
});
