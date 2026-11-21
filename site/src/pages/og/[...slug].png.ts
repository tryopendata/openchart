/**
 * Social cards: /og/docs/<id>.png for each docs page, /og/examples/<slug>.png
 * for each gallery entry and /og/blog/<slug>.png for each blog post. Other
 * pages use the brand card, /og-image.png.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import satori from "satori";
import sharp from "sharp";
import { site } from "../../config";
import { allPages, allPosts } from "../../lib/collection";
import { galleryEntries } from "../../lib/gallery";
import { type Card, ogCard, ogFonts } from "../../lib/og";

const CARD_SIZE = { width: 1200, height: 630 };

/** One card's path under /og/ (without .png) and its text. */
const card = (slug: string, title: string, description: string) => ({
  params: { slug },
  props: { title, description, siteName: site.name },
});

export const getStaticPaths = (async () => {
  const [pages, posts] = await Promise.all([allPages(), allPosts()]);
  return [
    ...pages.map(({ page }) => card(`docs/${page.id}`, page.title, page.description)),
    ...galleryEntries.map((entry) =>
      card(`examples/${entry.slug}`, entry.title, entry.description),
    ),
    ...posts.map(({ post }) => card(`blog/${post.slug}`, post.title, post.description)),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute<Card> = async ({ props }) => {
  const svg = await satori(ogCard(props) as never, { ...CARD_SIZE, fonts: await ogFonts() });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
