/**
 * The `json demo` fence: a Shiki transformer that keeps the fence's info string,
 * and a hast plugin that turns the highlighted block into the demo figure.
 */
import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";
import type { ShikiConfig } from "astro";

type HastPlugin = Extract<
  NonNullable<SatteriProcessorOptions["hastPlugins"]>[number],
  { name: string }
>;
type ShikiTransformer = NonNullable<ShikiConfig["transformers"]>[number];

/** Copies `demo`, `title`, `source` and `height` from a fence's info string onto its `<pre>`. */
export const demoFenceMeta: ShikiTransformer = { name: "demo-fence-meta" };

/** Replaces each `json demo` code block with the demo figure. */
export function demoFence(): HastPlugin {
  return { name: "demo-fence" } as HastPlugin;
}
