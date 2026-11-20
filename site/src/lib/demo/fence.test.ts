// @vitest-environment node
/**
 * The `json demo` fence, rendered through the same Sätteri processor and Shiki
 * transformers the docs use, then read back as HTML.
 */
import { createSatteriMarkdownProcessor, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { docsHastPlugins, docsShikiTransformers } from "../markdown";

async function render(markdown: string) {
  const processor = await createSatteriMarkdownProcessor({
    hastPlugins: [satteriHeadingIdsPlugin(), ...docsHastPlugins],
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
      transformers: docsShikiTransformers,
    },
  });
  const { code } = await processor.render(markdown);
  return { html: code, doc: new new Window().DOMParser().parseFromString(code, "text/html") };
}

const BAR_SPEC = {
  mark: "bar",
  data: [
    { region: "North", orders: 42 },
    { region: "South", orders: 31 },
  ],
  encoding: {
    y: { field: "region", type: "nominal" },
    x: { field: "orders", type: "quantitative" },
  },
};

const fence = (info: string, body: string) => `\`\`\`${info}\n${body}\n\`\`\`\n`;

describe("the json demo fence", () => {
  it("becomes the demo figure with the spec embedded, both static SVGs and five code tabs", async () => {
    const { doc } = await render(
      fence('json demo title="Orders" source="Sales ledger" height=320', JSON.stringify(BAR_SPEC)),
    );
    const figure = doc.querySelector("figure.demo");
    expect(figure?.getAttribute("data-demo")).toMatch(/^fence-[0-9a-f]{8}$/);
    const stage = figure?.querySelector("[data-demo-stage]");
    expect(stage?.getAttribute("style")).toBe("--demo-height: 320px");
    expect(
      [...(stage?.querySelectorAll("svg.demo-static") ?? [])].map((svg) =>
        svg.getAttribute("data-theme"),
      ),
    ).toEqual(["light", "dark"]);
    expect(JSON.parse(figure?.querySelector("[data-demo-spec]")?.textContent ?? "")).toEqual(
      BAR_SPEC,
    );
    expect(
      [...(figure?.querySelectorAll("[data-demo-tab]") ?? [])].map((tab) =>
        tab.getAttribute("data-demo-tab"),
      ),
    ).toEqual(["spec", "react", "vue", "svelte", "vanilla"]);
    expect(figure?.querySelectorAll("[data-demo-panel] button")).toHaveLength(5);
    expect(figure?.querySelector("figcaption")?.textContent).toBe("Orders. Source: Sales ledger.");
    expect(doc.querySelector("pre[data-demo]")).toBeNull();
  });

  it("throws with the fence's first line when the body is not JSON", async () => {
    await expect(render(fence('json demo title="Broken"', "{ mark: bar"))).rejects.toThrow(
      '```json demo title="Broken"',
    );
  });

  it("throws naming the fence when the spec fails validation", async () => {
    await expect(render(fence("json demo", '{"mark":"bar"}'))).rejects.toThrow(
      /```json demo: Demo "fence-[0-9a-f]{8}" has an invalid spec/,
    );
  });

  it("leaves a plain json fence as a highlighted code block", async () => {
    const { doc } = await render(fence("json", JSON.stringify(BAR_SPEC)));
    expect(doc.querySelector("figure.demo")).toBeNull();
    expect(doc.querySelector("figure.code-frame pre")?.textContent).toContain('"mark"');
  });

  it("ignores the word demo and height= inside quoted values of a plain json fence", async () => {
    const { doc } = await render(fence('json title="A demo config height=9"', '{"not":"a spec"}'));
    expect(doc.querySelector("figure.demo")).toBeNull();
    expect(doc.querySelector("figure.code-frame figcaption")?.textContent).toBe(
      "A demo config height=9",
    );
  });

  it("throws naming the fence when an identical fence repeats on the same page", async () => {
    const twice = fence("json demo", JSON.stringify(BAR_SPEC)).repeat(2);
    await expect(render(twice)).rejects.toThrow(
      /```json demo repeats an earlier fence with the same spec/,
    );
  });

  it("renders the same fence again in a later render of the page", async () => {
    const once = fence("json demo", JSON.stringify(BAR_SPEC));
    const processor = await createSatteriMarkdownProcessor({
      hastPlugins: docsHastPlugins,
      syntaxHighlight: "shiki",
      shikiConfig: { transformers: docsShikiTransformers },
    });
    await processor.render(once);
    const { code } = await processor.render(once);
    expect(code).toContain('<figure class="demo"');
  });

  it("escapes </script> inside a spec string so the embedded JSON stays in its element", async () => {
    const spec = { ...BAR_SPEC, chrome: { title: "Ends </script><b>here</b>" } };
    const { html, doc } = await render(fence("json demo", JSON.stringify(spec)));
    expect(html).not.toContain("</script><b>");
    expect(JSON.parse(doc.querySelector("[data-demo-spec]")?.textContent ?? "")).toEqual(spec);
  });
});
