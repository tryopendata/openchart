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
  it("uses the manager suffix from either install command's tab panel", () => {
    render(`
      <section id="desk" data-landing-section>
        <div id="hero-install-npm" role="tabpanel"><button data-copy-command></button></div>
      </section>
      <section id="start" data-landing-section>
        <div id="start-install-bun" role="tabpanel"><button data-copy-command></button></div>
      </section>
    `);
    expect(installCopiedProps(element("#desk button"))).toEqual({
      section: "desk",
      manager: "npm",
    });
    expect(installCopiedProps(element("#start button"))).toEqual({
      section: "start",
      manager: "bun",
    });
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
  it("uses the id of the section containing the figure", () => {
    render(
      '<section id="motion" data-landing-section><figure><button></button></figure></section>',
    );
    expect(demoInteractedProps(element("button"))).toEqual({ section: "motion" });
  });

  it("ignores targets outside a figure or in a figure outside a landing section", () => {
    render(`
      <section id="desk" data-landing-section><button></button></section>
      <figure><button></button></figure>
    `);
    expect(demoInteractedProps(element("#desk button"))).toBeNull();
    expect(demoInteractedProps(element("figure button"))).toBeNull();
  });
});
