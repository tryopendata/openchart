/**
 * GalleryPage: the page shell every gallery story renders inside.
 *
 * - Stamps `[data-oc-mode='light'|'dark']` on its root (from the provider's
 *   resolved mode context), which crosses into the width-addon iframe so
 *   gallery-content CSS follows dark mode there (constraint C3).
 * - Renders the page title (Bricolage Grotesque) + lede.
 * - Builds a sticky right-rail TOC from its Section children (hidden < 1200px).
 * - Content column max-width ~1040px, centered; a `.oc-bleed` wrapper is
 *   available for full-bleed showcase sections.
 */
import type { ReactElement, ReactNode } from 'react';
import { Children, isValidElement } from 'react';
import '@opendata-ai/openchart-core/styles.css';
import './gallery.css';
import { useOcMode } from './mode-context';
import type { SectionProps } from './Section';

export type GalleryPageProps = {
  title: string;
  lede?: ReactNode;
  children?: ReactNode;
};

/** Pull { id, title } off each Section child for the TOC. */
function collectSections(children: ReactNode): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = (child as ReactElement<Partial<SectionProps>>).props;
    if (props && typeof props.id === 'string' && typeof props.title === 'string') {
      out.push({ id: props.id, title: props.title });
    }
  });
  return out;
}

export function GalleryPage({ title, lede, children }: GalleryPageProps) {
  const mode = useOcMode();
  const sections = collectSections(children);

  return (
    <div className="oc-gallery" data-oc-mode={mode}>
      <div className="oc-gallery-layout">
        <div className="oc-gallery-shell">
          <main className="oc-gallery-main">
            <header className="oc-gallery-header">
              <h1 className="oc-gallery-title">{title}</h1>
              {lede ? <p className="oc-gallery-lede">{lede}</p> : null}
            </header>
            {children}
          </main>
        </div>
        {sections.length > 0 ? (
          <nav className="oc-toc" aria-label="On this page">
            <p className="oc-toc-heading">On this page</p>
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
