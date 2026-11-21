/**
 * Static tile charts as files: /tiles/<name>.svg, one per tile, size, specimen
 * and theme that the landing wall, the examples gallery and the blog index
 * show (components/shared/tiles/tile-files.ts). Tiles show them as lazy images,
 * which keeps those pages' HTML small. Charts without a static renderer
 * (tables, sankeys, networks) have no file; their tiles show a table or a line.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import { leadTileRequests } from "../../components/blog/lead-tile";
import { galleryTileRequests } from "../../components/gallery/tile-options";
import { vocabularyTileRequests } from "../../components/landing/vocabulary/tile-markup";
import {
  type TileTheme,
  tileFileName,
  tileFileSvg,
  uniqueRequests,
} from "../../components/shared/tiles/tile-files";
import { allPosts } from "../../lib/collection";
import { galleryEntries } from "../../lib/gallery";

const THEMES: readonly TileTheme[] = ["light", "dark"];

type Props = { svg: string };

export const getStaticPaths = (async () => {
  const posts = await allPosts();
  const leads = posts.flatMap(({ post }) => (post.lead ? [post.lead] : []));
  const requests = uniqueRequests([
    ...vocabularyTileRequests(),
    ...galleryTileRequests(galleryEntries),
    ...leadTileRequests(leads),
  ]);
  return requests.flatMap((request) =>
    THEMES.flatMap((theme) => {
      const svg = tileFileSvg(request, theme);
      return svg === null
        ? []
        : [{ params: { name: tileFileName(request, theme) }, props: { svg } }];
    }),
  );
}) satisfies GetStaticPaths;

export const GET: APIRoute<Props> = ({ props }) =>
  new Response(props.svg, { headers: { "Content-Type": "image/svg+xml" } });
