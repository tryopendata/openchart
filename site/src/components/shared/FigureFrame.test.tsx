// @vitest-environment node
/**
 * FigureFrame (the React islands' figure) and PublishedFigure.astro (the Astro
 * pages') render the same frame: rule, headline, deck, body and a caption
 * ending in the Source line. Both are rendered for real and compared as DOM, so
 * attribute order and the whitespace between elements don't count, and the
 * text does. Astro renders components only in the node environment, so the
 * markup is parsed in a happy-dom Window.
 */
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { type Element, type Node, Window } from "happy-dom";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { FigureFrame } from "./FigureFrame";
import PublishedFigure from "./PublishedFigure.astro";

/** The same body and caption text as Astro slot HTML and as React elements. */
const BODY_HTML = '<div class="chart"><svg role="img"></svg></div>';
const BODY = (
  <div className="chart">
    <svg role="img" />
  </div>
);
const CAPTION_HTML = "<em>Read across.</em> ";
const CAPTION = (
  <>
    <em>Read across.</em>{" "}
  </>
);

type FrameProps = Omit<ComponentProps<typeof FigureFrame>, "children" | "caption">;

const CASES: { name: string; props: FrameProps; caption?: boolean }[] = [
  {
    name: "a headline, deck, note, caption text and a linked source",
    props: {
      title: "Life expectancy rose everywhere",
      titleId: "desk-title",
      level: "h2",
      deck: "Years at birth, by country.",
      note: "The same chart at five stages.",
      source: { label: "World Bank", url: "https://data.worldbank.org/" },
      className: "hero-figure",
    },
    caption: true,
  },
  {
    name: "a bare figure with an unlinked source",
    props: { source: { label: "Bureau of Labor Statistics" } },
  },
];

const NodeType = { element: 1, text: 3 } as const;

/** Serializes an element with sorted attributes, dropping whitespace-only text between elements. */
function canonical(node: Node): string {
  if (node.nodeType === NodeType.text) {
    return node.textContent.trim() === "" ? "" : node.textContent;
  }
  if (node.nodeType !== NodeType.element) return "";
  const element = node as Element;
  const attributes = [...element.attributes]
    .map((attribute) => `${attribute.name}="${attribute.value}"`)
    .sort()
    .join(" ");
  const children = [...element.childNodes].map(canonical).join("");
  const tag = element.localName;
  return `<${tag}${attributes ? ` ${attributes}` : ""}>${children}</${tag}>`;
}

let window: Window;

beforeAll(() => {
  window = new Window();
});

/**
 * The one figure in the markup, in canonical form. Comments go first: React
 * writes one between adjacent text nodes, which a browser reads as one run.
 */
function figureOf(html: string): string {
  const { document } = window;
  document.body.innerHTML = html;
  const figures = document.querySelectorAll("figure");
  expect(figures).toHaveLength(1);
  const figure = figures[0] as Element;
  const comments = document.createTreeWalker(document.body, window.NodeFilter.SHOW_COMMENT);
  const found: Node[] = [];
  for (let comment = comments.nextNode(); comment; comment = comments.nextNode()) {
    found.push(comment);
  }
  for (const comment of found) comment.parentNode?.removeChild(comment);
  figure.normalize();
  return canonical(figure);
}

async function renderAstro(props: FrameProps, caption: boolean): Promise<string> {
  const { className, ...rest } = props;
  const container = await AstroContainer.create();
  return container.renderToString(PublishedFigure, {
    props: { ...rest, class: className },
    slots: { default: BODY_HTML, ...(caption ? { caption: CAPTION_HTML } : {}) },
  });
}

function renderReact(props: FrameProps, caption: boolean): string {
  return renderToStaticMarkup(
    <FigureFrame {...props} caption={caption ? CAPTION : undefined}>
      {BODY}
    </FigureFrame>,
  );
}

describe("FigureFrame and PublishedFigure", () => {
  it.each(CASES)("render the same figure for $name", async ({ props, caption = false }) => {
    const astro = figureOf(await renderAstro(props, caption));
    const react = figureOf(renderReact(props, caption));
    expect(react).toBe(astro);
  });

  it("writes no reveal attributes with reveal off, and passes data attributes to the figure", () => {
    const { document } = window;
    document.body.innerHTML = renderToStaticMarkup(
      <FigureFrame
        {...(CASES[0]?.props as FrameProps)}
        className="agent-chart"
        bodyClassName="agent-chart-stage"
        reveal={false}
        data-agent-chart
      >
        <svg />
      </FigureFrame>,
    );
    const figure = document.querySelector("figure");
    expect(figure?.getAttribute("class")).toBe("pub-figure agent-chart");
    expect(figure?.getAttribute("data-agent-chart")).toBe("true");
    expect(document.querySelector(".pub-figure-body svg")?.parentElement?.className).toBe(
      "pub-figure-body agent-chart-stage",
    );
    expect(document.querySelectorAll("[data-reveal], [data-motion]")).toHaveLength(0);
    expect(document.querySelector("figcaption")?.textContent).toBe(
      "The same chart at five stages. Source: World Bank.",
    );
  });
});
