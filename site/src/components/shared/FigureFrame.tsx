/**
 * PublishedFigure.astro's frame for React islands: a ticked rule, an optional
 * headline and deck, the chart (children), then a caption that ends in the
 * Source line. An Astro component can't render inside an island, so an island
 * that draws its own figure uses this. PublishedFigure stays in Astro because
 * Astro wraps slot content passed to a React component in `<astro-static-slot>`
 * elements; FigureFrame.test.ts renders both and holds their markup the same.
 */
import type { ReactNode } from "react";
import type { DemoSource } from "../../demos/types";

type FigureFrameProps = {
  /** The finding, as a headline. Omit when the section heading already says it. */
  title?: string;
  /** Lets a section point `aria-labelledby` at the headline. */
  titleId?: string;
  /** The heading level the headline takes in the page outline. */
  level?: "h2" | "h3";
  /** One sentence under the headline: what is measured, in what unit. */
  deck?: string;
  source: DemoSource;
  /** A sentence before the Source line, such as how to read the chart. */
  note?: string;
  className?: string;
  /** Extra classes on the element holding the chart. */
  bodyClassName?: string;
  /**
   * Whether the figure writes the `@steamfield/ui/reveal` attributes. Default
   * true. Pass false when the reveal script runs before the figure exists, as
   * in an island that re-creates it.
   */
  reveal?: boolean;
  /** The chart. */
  children: ReactNode;
  /** Caption text between the note and the Source line. */
  caption?: ReactNode;
} & { [attribute: `data-${string}`]: string | boolean | undefined };

/** A published figure: rule, headline, deck, chart and a caption ending in "Source: …". */
export function FigureFrame({
  title,
  titleId,
  level: Heading = "h3",
  deck,
  source,
  note,
  className,
  bodyClassName,
  reveal = true,
  children,
  caption,
  ...dataAttributes
}: FigureFrameProps) {
  const motion = (role: string) => (reveal ? role : undefined);
  return (
    <figure
      className={["pub-figure", className].filter(Boolean).join(" ")}
      data-reveal={reveal ? "" : undefined}
      {...dataAttributes}
    >
      <div className="rule-axis" data-motion={motion("wipe")} />
      {title ? (
        <Heading id={titleId} className="pub-figure-title" data-motion={motion("lift-sm")}>
          {title}
        </Heading>
      ) : null}
      {deck ? (
        <p className="pub-figure-deck" data-motion={motion("lift-sm")}>
          {deck}
        </p>
      ) : null}
      <div
        className={["pub-figure-body", bodyClassName].filter(Boolean).join(" ")}
        data-landing-demo=""
      >
        {children}
      </div>
      <figcaption className="figure-caption pub-figure-caption" data-motion={motion("quiet")}>
        {note ? <span>{`${note} `}</span> : null}
        {caption}
        {source.url ? (
          <>
            {"Source: "}
            <a href={source.url}>{source.label}</a>.
          </>
        ) : (
          `Source: ${source.label}.`
        )}
      </figcaption>
    </figure>
  );
}
