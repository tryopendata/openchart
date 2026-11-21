/**
 * The `json demo` fence: a Shiki transformer that keeps the fence's info string,
 * and a hast plugin that turns the highlighted block into the demo figure. The
 * fence carries its own spec, so repo Markdown can show a live chart without a
 * registered demo. Shiki highlights before hast plugins run and drops the info
 * string, which is why the transformer copies it onto the `<pre>` first.
 */
import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";
import type { VizSpec } from "@opendata-ai/openchart-core";
import type { ShikiConfig } from "astro";
import { DEFAULT_DEMO_HEIGHT } from "../../demos/types";
import { fenceDemoId } from "./dom-id";
import { demoFigureHtml } from "./figure";
import { validateDemo } from "./validate";

type HastPlugin = Extract<
  NonNullable<SatteriProcessorOptions["hastPlugins"]>[number],
  { name: string }
>;
type ShikiTransformer = NonNullable<ShikiConfig["transformers"]>[number];

/** Thrown when a `json demo` fence cannot become a figure. The message quotes the fence's first line. */
export class DemoFenceError extends Error {}

/** The fence's info string, on the `<pre>`; its presence marks a demo fence. */
const META = "data-demo";
const TITLE = "data-demo-title";
const SOURCE = "data-demo-source";
const HEIGHT = "data-demo-height";

const DEFAULT_SOURCE = "Illustrative data";

/** Copies `demo`, `title`, `source` and `height` from a fence's info string onto its `<pre>`. */
export const demoFenceMeta: ShikiTransformer = {
  name: "demo-fence-meta",
  pre(node) {
    const raw = (this.options.meta as { __raw?: string } | undefined)?.__raw ?? "";
    // Quoted values are free text ("A demo config"), so tokens are read only outside them.
    const bare = raw.replace(/\w+="[^"]*"/g, " ");
    if (this.options.lang !== "json" || !/(^|\s)demo(\s|$)/.test(bare)) return;
    node.properties[META] = raw;
    const title = /(?:^|\s)title="([^"]*)"/.exec(raw)?.[1];
    const source = /(?:^|\s)source="([^"]*)"/.exec(raw)?.[1];
    const height = /(?:^|\s)height=(\d+)(?:\s|$)/.exec(bare)?.[1];
    if (title !== undefined) node.properties[TITLE] = title;
    if (source !== undefined) node.properties[SOURCE] = source;
    if (height !== undefined) node.properties[HEIGHT] = height;
  },
};

type FenceProperties = Record<string, unknown>;
const stringProperty = (properties: FenceProperties, key: string) => {
  const value = properties[key];
  return typeof value === "string" ? value : undefined;
};

/** Where the fence is, for error messages: the page file and the fence's opening line. */
function fenceLocation(meta: string, fileURL: URL | undefined): string {
  const opening = `\`\`\`json ${meta}`;
  return fileURL ? `${opening} in ${fileURL.pathname}` : opening;
}

/**
 * The spec in the fence body, checked with the library's validator.
 *
 * @throws {DemoFenceError} When the body is not JSON or the spec is invalid; the cause is kept.
 */
function parseFenceSpec(body: string, id: string, location: string): VizSpec {
  let spec: unknown;
  try {
    spec = JSON.parse(body);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DemoFenceError(`Demo fence ${location} is not valid JSON: ${reason}`, {
      cause: error,
    });
  }
  try {
    validateDemo(id, spec);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DemoFenceError(`Demo fence ${location}: ${reason}`, { cause: error });
  }
  return spec as VizSpec;
}

/** Where this document's fence ids are kept: the compile's own data bag, so no state outlives one render. */
const FENCE_IDS = "demoFenceIds";

/**
 * Records a fence id for the document being rendered.
 *
 * @throws {DemoFenceError} When an identical fence already appeared in this document,
 * since both figures would share one id and their SVG and panel ids would collide.
 */
function claimFenceId(data: Record<string, unknown>, id: string, location: string): void {
  data[FENCE_IDS] ??= new Set<string>();
  const seen = data[FENCE_IDS] as Set<string>;
  if (seen.has(id)) {
    throw new DemoFenceError(
      `Demo fence ${location} repeats an earlier fence with the same spec on this page. Remove one, or change one spec.`,
    );
  }
  seen.add(id);
}

/**
 * The node that puts the figure's HTML on the page. Markdown writes a raw node
 * out verbatim; MDX compiles to JSX, which has no raw node, so there the HTML
 * goes through Astro's `<Fragment set:html>` (the MDX integration supplies
 * `Fragment` to every MDX page).
 */
function figureNode(html: string, sourceFormat: "markdown" | "mdx") {
  if (sourceFormat === "markdown") return { type: "raw", value: html };
  return {
    type: "mdxJsxFlowElement",
    name: "Fragment",
    attributes: [{ type: "mdxJsxAttribute", name: "set:html", value: html }],
    children: [],
  };
}

/** Replaces each `json demo` code block with the demo figure. */
export function demoFence(): HastPlugin {
  return {
    name: "demo-fence",
    element: {
      filter: ["pre"],
      async visit(node, ctx) {
        const properties = node.properties as FenceProperties;
        const meta = stringProperty(properties, META);
        if (meta === undefined) return;
        const body = ctx.textContent(node).trim();
        const id = fenceDemoId(body);
        const location = fenceLocation(meta, ctx.fileURL);
        claimFenceId(ctx.data, id, location);
        const spec = parseFenceSpec(body, id, location);
        const height = stringProperty(properties, HEIGHT);
        const html = await demoFigureHtml({
          id,
          spec,
          title: stringProperty(properties, TITLE) ?? "Live example",
          source: { label: stringProperty(properties, SOURCE) ?? DEFAULT_SOURCE },
          height: height ? Number(height) : DEFAULT_DEMO_HEIGHT,
          entrance: true,
          tabs: true,
          static: true,
        });
        return figureNode(html, ctx.sourceFormat);
      },
    },
  } as HastPlugin;
}
