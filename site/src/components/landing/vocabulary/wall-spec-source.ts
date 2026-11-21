/**
 * Reads tile specs in the browser from the wall's JSON document. The document
 * is fetched once, on the first request, and each spec comes back whole, with
 * its shared values filled in, as a fresh copy a mount may change.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { setValueAt } from "../../../lib/demo/spec-path";
import type { WallSpecsDocument } from "./wall-specs";

/** Thrown when the document cannot be fetched or has no spec for a tile. */
export class WallSpecError extends Error {}

export type WallSpecSource = { spec(demo: string): Promise<VizSpec> };

async function fetchDocument(url: string, fetcher: typeof fetch): Promise<WallSpecsDocument> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new WallSpecError(`GET ${url} returned ${response.status}; the wall's tiles stay static.`);
  }
  return (await response.json()) as WallSpecsDocument;
}

/** A source over the document at `url`. A failed fetch is retried on the next request. */
export function createWallSpecSource(url: string, fetcher: typeof fetch = fetch): WallSpecSource {
  let loading: Promise<WallSpecsDocument> | null = null;
  return {
    async spec(demo) {
      loading ??= fetchDocument(url, fetcher).catch((error: unknown) => {
        loading = null;
        throw error;
      });
      const document = await loading;
      const entry = document.specs[demo];
      if (!entry) throw new WallSpecError(`${url} has no spec for the tile "${demo}".`);
      const spec: unknown = structuredClone(entry.spec);
      for (const { path, hash } of entry.refs) {
        if (!(hash in document.shared)) {
          throw new WallSpecError(`${url} has no shared value ${hash} for the tile "${demo}".`);
        }
        setValueAt(spec, path, structuredClone(document.shared[hash]));
      }
      return spec as VizSpec;
    },
  };
}
