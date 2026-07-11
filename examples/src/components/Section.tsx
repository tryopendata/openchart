/**
 * Section: a titled group of Demo cards within a GalleryPage.
 *
 * Registers an anchor (`id`) and exposes its title to GalleryPage's TOC.
 * GalleryPage reads `id`/`title` off each Section child's props to build the
 * right-rail TOC, so those two props are the TOC contract.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';

export type SectionProps = {
  /** Anchor slug, unique per page; also the TOC target. */
  id: string;
  title: string;
  /** Optional intro line for the section. */
  lede?: string;
  children?: ReactNode;
};

function LinkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function Section({ id, title, lede, children }: SectionProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (typeof location === 'undefined') return;
    const base = `${location.origin}${location.pathname}${location.search}`.replace(/#.*$/, '');
    try {
      await navigator.clipboard.writeText(`${base}#${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* no-op */
    }
  };

  return (
    <section className="oc-section" id={id}>
      <div className="oc-section-title-row">
        <h2 className="oc-section-title">{title}</h2>
        <button
          type="button"
          className="oc-anchor-btn"
          onClick={copyLink}
          aria-label={copied ? 'Link copied' : `Copy link to "${title}"`}
          title={copied ? 'Link copied' : 'Copy link to this section'}
        >
          <LinkIcon />
        </button>
      </div>
      {lede ? <p className="oc-section-lede">{lede}</p> : null}
      <div className="oc-section-body">{children}</div>
    </section>
  );
}
