// @vitest-environment node
// The post list the blog index and tag pages share, rendered from the real
// component: each post as a linked h2 with its date, reading time and tag
// links, and a plain line when there are no posts.
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import type { BlogPost } from "../../lib/blog-types";
import PostList from "./PostList.astro";

const post: BlogPost = {
  slug: "a-post",
  title: "A post",
  description: "What the post says.",
  published: new Date("2026-11-20"),
  author: "OpenChart",
  tags: ["chart-choice", "climate"],
  related: ["comparison/column"],
};

async function render(items: { post: BlogPost; minutes: number }[]) {
  const container = await AstroContainer.create();
  const html = await container.renderToString(PostList, { props: { items } });
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document.body;
}

describe("PostList", () => {
  it('says "No posts yet." and lists nothing when there are no posts', async () => {
    const body = await render([]);
    expect(body.textContent?.trim()).toContain("No posts yet.");
    expect(body.querySelectorAll("ol, li")).toHaveLength(0);
  });

  it("lists a post with its title link, date, reading time and tag links", async () => {
    const body = await render([{ post, minutes: 4 }]);
    expect(body.textContent).not.toContain("No posts yet.");
    const entry = body.querySelector("li");
    expect(entry?.querySelector("h2 a")?.getAttribute("href")).toBe("/blog/a-post/");
    expect(entry?.querySelector("time")?.getAttribute("datetime")).toBe("2026-11-20");
    expect(entry?.textContent).toContain("4 min read");
    const tags = [...(entry?.querySelectorAll(".blog-entry-meta a") ?? [])].map((a) => [
      a.textContent,
      a.getAttribute("href"),
    ]);
    expect(tags).toEqual([
      ["Chart choice", "/blog/tags/chart-choice/"],
      ["Climate", "/blog/tags/climate/"],
    ]);
  });
});
