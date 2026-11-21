/** The blog's derived values: reading time, JSON-LD, the RSS feed, tags and related docs links. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { articleJsonLd, postsByTag, readingTime, relatedLinks, rssXml, tagsInUse } from "./blog";
import type { BlogPost } from "./blog-types";

const words = (count: number) => Array.from({ length: count }, (_, i) => `word${i}`).join(" ");

const post = (overrides: Partial<BlogPost> = {}): BlogPost => ({
  slug: "how-to-chart-a-temperature-anomaly",
  title: "How to chart a temperature anomaly",
  description: "An anomaly chart plots each year's distance from a reference period.",
  published: new Date("2026-11-20"),
  author: "OpenChart",
  tags: ["chart-choice", "climate"],
  related: ["comparison/column"],
  ...overrides,
});

const channel = {
  title: "OpenChart blog",
  description: "Articles on charts.",
  link: "https://openchart.example/blog/",
  feedUrl: "https://openchart.example/blog/rss.xml",
};

const links = {
  canonical: "https://openchart.example/blog/how-to-chart-a-temperature-anomaly/",
  image: "https://openchart.example/og/blog/how-to-chart-a-temperature-anomaly.png",
  publisher: { name: "OpenChart", url: "https://openchart.example" },
};

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

describe("readingTime", () => {
  it.each([
    ["an empty body", "", 1],
    ["230 words", words(230), 1],
    ["231 words", words(231), 2],
    ["690 words", words(690), 3],
  ])("reads %s in %i min", (_label, body, minutes) => {
    expect(readingTime(body)).toBe(minutes);
  });

  it("counts neither code fences, import lines, MDX comments nor JSX tags", () => {
    const body = [
      'import Demo from "../../components/demo/Demo.astro";',
      "{/* a note for editors with several words in it */}",
      words(230),
      '<Demo id="blog/gistemp-columns" />',
      "```json demo",
      words(400),
      "```",
      "## A heading",
    ].join("\n");
    // 230 words plus "A heading": the fence, import, comment, tag and "##" add nothing.
    expect(readingTime(body)).toBe(2);
    expect(readingTime(body.replace("## A heading", ""))).toBe(1);
  });
});

describe("articleJsonLd", () => {
  it("describes the post as a BlogPosting by its canonical URL and social card", () => {
    const ld = JSON.parse(articleJsonLd(post({ updated: new Date("2026-12-01") }), links));
    expect(ld).toEqual({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "How to chart a temperature anomaly",
      description: "An anomaly chart plots each year's distance from a reference period.",
      datePublished: "2026-11-20",
      dateModified: "2026-12-01",
      author: { "@type": "Organization", name: "OpenChart", url: "https://openchart.example" },
      publisher: { "@type": "Organization", name: "OpenChart", url: "https://openchart.example" },
      image: links.image,
      mainEntityOfPage: { "@type": "WebPage", "@id": links.canonical },
      keywords: ["Chart choice", "Climate"],
    });
  });

  it("dates a post never updated as modified when published, and makes a named author a Person", () => {
    const ld = JSON.parse(articleJsonLd(post({ author: "Ada Byline" }), links));
    expect(ld.dateModified).toBe(ld.datePublished);
    expect(ld.author).toEqual({ "@type": "Person", name: "Ada Byline" });
  });

  it("escapes </script> so a title can't close the script tag it sits in", () => {
    const json = articleJsonLd(post({ title: "Charts </script><script>alert(1)" }), links);
    expect(json).not.toContain("</script>");
    expect(JSON.parse(json).headline).toBe("Charts </script><script>alert(1)");
  });
});

describe("rssXml", () => {
  const older = post({ slug: "older", title: "Older", published: new Date("2026-01-05") });
  const newer = post({
    slug: "newer",
    title: 'Bars & lines: "when" <to> use each',
    description: "Fish & chips < 5",
    published: new Date("2026-11-20"),
  });
  const feed = parseXml(rssXml([older, newer], channel));

  it("parses as XML and links itself with atom:link rel=self", () => {
    expect(feed.querySelector("parsererror")).toBeNull();
    const self = feed.getElementsByTagName("atom:link")[0];
    expect(self?.getAttribute("rel")).toBe("self");
    expect(self?.getAttribute("href")).toBe(channel.feedUrl);
  });

  it("lists the posts newest first, with canonical links and guids", () => {
    const items = [...feed.querySelectorAll("item")];
    expect(items.map((item) => item.querySelector("link")?.textContent)).toEqual([
      "https://openchart.example/blog/newer/",
      "https://openchart.example/blog/older/",
    ]);
    expect(items.map((item) => item.querySelector("guid")?.textContent)).toEqual([
      "https://openchart.example/blog/newer/",
      "https://openchart.example/blog/older/",
    ]);
  });

  it("escapes titles and descriptions, so they read back exactly", () => {
    const item = feed.querySelector("item");
    expect(item?.querySelector("title")?.textContent).toBe('Bars & lines: "when" <to> use each');
    expect(item?.querySelector("description")?.textContent).toBe("Fish & chips < 5");
  });

  it("writes RFC 822 dates and one category per tag", () => {
    const item = feed.querySelector("item");
    expect(item?.querySelector("pubDate")?.textContent).toBe("Fri, 20 Nov 2026 12:00:00 GMT");
    expect([...(item?.querySelectorAll("category") ?? [])].map((c) => c.textContent)).toEqual([
      "Chart choice",
      "Climate",
    ]);
  });

  it("dates the feed by the latest day any post was published or updated, at noon GMT", () => {
    const revised = post({
      slug: "revised",
      published: new Date("2026-01-05"),
      updated: new Date("2026-12-02"),
    });
    const lastBuild = (posts: BlogPost[]) =>
      parseXml(rssXml(posts, channel)).querySelector("lastBuildDate")?.textContent;
    expect(lastBuild([older, newer, revised])).toBe("Wed, 02 Dec 2026 12:00:00 GMT");
    expect(lastBuild([older, newer])).toBe("Fri, 20 Nov 2026 12:00:00 GMT");
  });

  it("is a valid empty channel with no posts", () => {
    const empty = parseXml(rssXml([], channel));
    expect(empty.querySelector("parsererror")).toBeNull();
    expect(empty.querySelectorAll("item")).toHaveLength(0);
    expect(empty.querySelector("channel > title")?.textContent).toBe("OpenChart blog");
  });
});

describe("tags", () => {
  const climate = post({ slug: "a", tags: ["climate"] });
  const color = post({ slug: "b", tags: ["color", "chart-choice"] });
  const both = post({ slug: "c", tags: ["chart-choice", "climate"] });

  it("postsByTag keeps exactly the posts carrying the tag, in order", () => {
    expect(postsByTag([climate, color, both], "climate").map((p) => p.slug)).toEqual(["a", "c"]);
    expect(postsByTag([climate, color, both], "maps")).toEqual([]);
  });

  it("tagsInUse lists each tag some post carries once, in blogTags order", () => {
    expect(tagsInUse([climate, color, both]).map((tag) => tag.id)).toEqual([
      "chart-choice",
      "color",
      "climate",
    ]);
  });
});

describe("relatedLinks", () => {
  const pages = [
    { id: "comparison/column", title: "Column chart" },
    { id: "framing/annotations", title: "Annotations" },
  ];

  it("resolves docs ids to titles and docs routes, in the post's order", () => {
    expect(relatedLinks(["framing/annotations", "comparison/column"], pages)).toEqual([
      { title: "Annotations", href: "/docs/framing/annotations/" },
      { title: "Column chart", href: "/docs/comparison/column/" },
    ]);
  });

  it("throws naming an id no page has", () => {
    expect(() => relatedLinks(["style/colour"], pages)).toThrow('"style/colour"');
  });
});

describe("displayDate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("prints the day a post's date names in a time zone west of UTC", async () => {
    // Post dates are UTC midnights, which are the evening before in Los Angeles.
    vi.stubEnv("TZ", "America/Los_Angeles");
    vi.resetModules();
    const { displayDate: inLosAngeles } = await import("./blog");
    expect(new Date("2026-11-20").getDate()).toBe(19);
    expect(inLosAngeles(new Date("2026-11-20"))).toBe("November 20, 2026");
  });
});
