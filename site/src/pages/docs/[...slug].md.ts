/** Each docs page as Markdown at /docs/<id>.md, linked from the page head as rel="alternate". */
import type { APIRoute, GetStaticPaths } from "astro";
import { demoSpec } from "../../demos/registry";
import { allPages, type PageEntry } from "../../lib/collection";
import { toMarkdownExport } from "../../lib/docs";

export const getStaticPaths = (async () =>
  (await allPages()).map((entry) => ({
    params: { slug: entry.page.id },
    props: entry,
  }))) satisfies GetStaticPaths;

export const GET: APIRoute<PageEntry> = ({ props }) =>
  new Response(toMarkdownExport(props.page, props.body, demoSpec), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
