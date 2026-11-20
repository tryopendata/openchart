/**
 * Highlights the code shown in one demo figure's panels. Token colors go on
 * classes instead of inline styles (Shiki's style-to-class transformer), and the
 * rules for those classes come back as one stylesheet for the figure, so a token
 * costs a short class name rather than both theme colors written out, and
 * neighbouring tokens of one color share a span. Each rule sets the
 * `--shiki-light` and `--shiki-dark` variables, and demo.css picks one per page theme.
 */
import { transformerStyleToClass } from "@shikijs/transformers";
import { codeToHtml } from "shiki";
import { shikiThemes } from "../code-themes";

/** One block of code to highlight. */
export type CodeBlock = { code: string; lang: string };

/** The highlighted `<pre>` for each block, in order, and the CSS their classes need. */
export type HighlightedCode = { html: string[]; css: string };

/** One letter, since a class name may not start with a digit; the rest is a hash of the style. */
const CLASS_PREFIX = "s";

/** Highlights the blocks with the site's dual Shiki themes, colors on classes. */
export async function highlightCode(blocks: readonly CodeBlock[]): Promise<HighlightedCode> {
  const toClasses = transformerStyleToClass({ classPrefix: CLASS_PREFIX });
  const html = await Promise.all(
    blocks.map(({ code, lang }) =>
      codeToHtml(code, {
        lang,
        themes: shikiThemes,
        defaultColor: false,
        mergeSameStyleTokens: true,
        transformers: [toClasses],
      }),
    ),
  );
  return { html, css: toClasses.getCSS() };
}
