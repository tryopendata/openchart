import type { ChartLayout, RectMark } from '@opendata-ai/openchart-core';

const SVG_NS = 'http://www.w3.org/2000/svg';
const EXCLUDED =
  'a, button, input, textarea, select, [contenteditable], [role=button], [data-element-ref], .oc-legend, .oc-annotations';

/** Passive paint: pointer events always reach marks, notes and author controls. */
export function wireRowHover(
  svg: SVGElement,
  container: HTMLElement,
  layout: ChartLayout,
): () => void {
  const rows = layout.marks.flatMap((mark, index) =>
    mark.type === 'rect' &&
    mark.orient === 'horizontal' &&
    mark.stackPos === undefined &&
    !('opacity' in mark && mark.opacity === 0)
      ? [{ mark, id: `rect-${index}` }]
      : [],
  );
  const ordered = [...rows].sort((a, b) => a.mark.y - b.mark.y);
  if (
    !rows.length ||
    layout.facet ||
    ordered.some(
      ({ mark }, i) => i > 0 && mark.y < ordered[i - 1].mark.y + ordered[i - 1].mark.height,
    )
  )
    return () => {};
  const bands = new Map<RectMark, { top: number; bottom: number }>();
  const center = (mark: RectMark) => mark.y + mark.height / 2;
  ordered.forEach(({ mark }, i) => {
    bands.set(mark, {
      top: i ? (center(ordered[i - 1].mark) + center(mark)) / 2 : layout.area.y,
      bottom:
        i < ordered.length - 1
          ? (center(mark) + center(ordered[i + 1].mark)) / 2
          : layout.area.y + layout.area.height,
    });
  });
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', 'oc-row-hover');
  group.setAttribute('pointer-events', 'none');
  group.setAttribute('aria-hidden', 'true');
  group.setAttribute('color', layout.theme.colors.text);
  const background = document.createElementNS(SVG_NS, 'rect');
  const outline = document.createElementNS(SVG_NS, 'rect');
  background.setAttribute('fill', 'currentColor');
  background.setAttribute('fill-opacity', '0.035');
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', 'currentColor');
  outline.setAttribute('stroke-opacity', '0.6');
  outline.setAttribute('stroke-width', '1');
  group.append(background, outline);
  // Paint below axes and marks; no overlay can obscure authored annotations.
  svg.insertBefore(group, svg.querySelector(':scope > g'));
  const clear = () => group.setAttribute('display', 'none');
  clear();
  const show = (mark: RectMark) => {
    const { top, bottom } = bands.get(mark)!;
    for (const [key, value] of Object.entries({
      x: 0,
      y: top,
      width: layout.dimensions.width,
      height: bottom - top,
    }))
      background.setAttribute(key, String(value));
    for (const [key, value] of Object.entries({
      x: mark.x,
      y: mark.y,
      width: mark.width,
      height: mark.height,
    }))
      outline.setAttribute(key, String(value));
    group.removeAttribute('display');
  };
  const excluded = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest(EXCLUDED);
  // Layout replacement rewires this controller. Scroll/resize refresh screen
  // coordinates outside pointer sampling so painting cannot force layout reads.
  let bounds: DOMRect | undefined;
  const refreshBounds = () => {
    bounds = svg.getBoundingClientRect();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.buttons || excluded(event.target)) return clear();
    if (!bounds) refreshBounds();
    if (!bounds) return clear();
    if (!bounds.width || !bounds.height) return clear();
    const x = ((event.clientX - bounds.left) * layout.dimensions.width) / bounds.width;
    const y = ((event.clientY - bounds.top) * layout.dimensions.height) / bounds.height;
    if (
      x < 0 ||
      x > layout.dimensions.width ||
      y < layout.area.y ||
      y > layout.area.y + layout.area.height
    )
      return clear();
    let lo = 0;
    let hi = ordered.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (y < bands.get(ordered[mid].mark)!.bottom) hi = mid;
      else lo = mid + 1;
    }
    const row = ordered[lo];
    show(row.mark);
  };
  const keys = (event: KeyboardEvent) => {
    if (excluded(event.target)) return clear();
    const focused = svg.querySelector('.oc-mark-focused');
    const row = rows.find(({ id }) => id === focused?.getAttribute('data-mark-id'));
    if (row) show(row.mark);
    else clear();
  };
  container.addEventListener('pointerenter', refreshBounds);
  window.addEventListener('scroll', refreshBounds, true);
  window.addEventListener('resize', refreshBounds);
  container.addEventListener('pointermove', move);
  container.addEventListener('pointerleave', clear);
  container.addEventListener('pointerdown', clear);
  container.addEventListener('pointercancel', clear);
  container.addEventListener('keydown', keys);
  container.addEventListener('blur', clear);
  return () => {
    container.removeEventListener('pointerenter', refreshBounds);
    window.removeEventListener('scroll', refreshBounds, true);
    window.removeEventListener('resize', refreshBounds);
    container.removeEventListener('pointermove', move);
    container.removeEventListener('pointerleave', clear);
    container.removeEventListener('pointerdown', clear);
    container.removeEventListener('pointercancel', clear);
    container.removeEventListener('keydown', keys);
    container.removeEventListener('blur', clear);
    group.remove();
  };
}
