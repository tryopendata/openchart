const NOTE_SELECTOR = '[data-note-spec-index], [data-note-marker-index]';

/** Link source-identified notes and their facet markers without mutating the spec. */
export function wireAnnotationNotes(svg: SVGSVGElement): void {
  // A graphic's children are presentational to assistive technology. Keep the
  // chart's name, but expose its interactive note list and marker buttons.
  if (svg.querySelector(NOTE_SELECTOR) && svg.getAttribute('role') === 'img') {
    svg.setAttribute('role', 'group');
  }
  // Compatible updates reconcile descendants into this SVG. Delegate events
  // and resolve peers at interaction time so retained listeners never point at
  // detached notes or at the temporary SVG used to construct the next scene.
  const linked = () => [...svg.querySelectorAll<SVGElement>(NOTE_SELECTOR)];
  const key = (element: Element) =>
    element.getAttribute('data-note-spec-index') ?? element.getAttribute('data-note-marker-index');
  const target = (event: Event) =>
    event.target instanceof Element ? event.target.closest<SVGElement>(NOTE_SELECTOR) : null;
  const emphasize = (index: string | null) => {
    for (const element of linked()) {
      element.classList.toggle('oc-note-active', index !== null && key(element) === index);
    }
  };
  svg.addEventListener('focusin', (event) => {
    const element = target(event);
    if (element) emphasize(key(element));
  });
  svg.addEventListener('focusout', (event) => {
    if (target(event)) emphasize(null);
  });
  svg.addEventListener('click', (event) => {
    const element = target(event);
    if (element) emphasize(key(element));
  });
  svg.addEventListener('keydown', (event) => {
    const element = target(event);
    if (!element) return;
    if (event.key === 'Escape') {
      event.stopImmediatePropagation();
      emphasize(null);
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    // Activation belongs to note navigation, even when its marker is selected.
    event.stopImmediatePropagation();
    const isNote = element.hasAttribute('data-note-spec-index');
    const peer = linked().find(
      (candidate) =>
        key(candidate) === key(element) &&
        candidate.hasAttribute('data-note-spec-index') !== isNote,
    );
    peer?.focus();
    emphasize(key(element));
  });
}
