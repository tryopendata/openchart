/**
 * The landing page's vocabulary wall specs, one static JSON file the page
 * fetches when its first tile mounts (see components/landing/vocabulary/wall-specs.ts).
 */
import type { APIRoute } from "astro";
import { wallSpecsDocument } from "../components/landing/vocabulary/wall-specs";
import { vocabularyTiles } from "../landing/vocabulary";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(wallSpecsDocument(vocabularyTiles)), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
