/** Social cards: /og/index.png for the landing page and /og/docs/<id>.png for each docs page. */
import type { APIRoute, GetStaticPaths } from "astro";
import satori from "satori";
import sharp from "sharp";
import { site } from "../../config";
import { allPages } from "../../lib/collection";
import { type Card, ogCard, ogFonts } from "../../lib/og";

const CARD_SIZE = { width: 1200, height: 630 };

export const getStaticPaths = (async () => {
  const entries = await allPages();
  const landing = { title: site.tagline, description: site.description, siteName: site.name };
  return [
    { params: { slug: "index" }, props: landing },
    ...entries.map(({ page }) => ({
      params: { slug: `docs/${page.id}` },
      props: { title: page.title, description: page.description, siteName: site.name },
    })),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute<Card> = async ({ props }) => {
  const svg = await satori(ogCard(props) as never, { ...CARD_SIZE, fonts: await ogFonts() });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
