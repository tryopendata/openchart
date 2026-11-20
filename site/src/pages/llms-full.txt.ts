/** llms-full.txt: every docs page's Markdown export in one file, for agents. */
import type { APIRoute } from "astro";
import { demoSpec } from "../demos/registry";
import { allPages } from "../lib/collection";
import { llmsFull } from "../lib/docs";

export const GET: APIRoute = async () =>
  new Response(llmsFull(await allPages(), demoSpec), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
