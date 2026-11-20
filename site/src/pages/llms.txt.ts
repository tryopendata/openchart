/** llms.txt: the index of every docs page's Markdown export, for agents. */
import type { APIRoute } from "astro";
import { allPages } from "../lib/collection";
import { llmsIndex } from "../lib/docs";

export const GET: APIRoute = async () => {
  const pages = (await allPages()).map((entry) => entry.page);
  return new Response(llmsIndex(pages), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
