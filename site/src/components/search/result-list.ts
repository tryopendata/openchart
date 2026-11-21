/**
 * Draws grouped search results into the dialog's listbox: one `role="group"`
 * per area, labelled by its visible heading, holding `role="option"` links. A
 * group with more than it shows ends in a "Show all n" option that expands it.
 * Options are not focusable; the combobox input keeps focus and points at the
 * active one with aria-activedescendant (scripts/search-dialog.ts).
 */
import { canExpand, type GroupName, type ResultGroup, shownHits } from "../../lib/search/groups";
import type { SearchHit } from "../../lib/search/result-shape";

/** Replaces the listbox's contents with `groups` and returns its options in order. */
export function renderResultList(
  listbox: HTMLElement,
  groups: readonly ResultGroup[],
  expanded: ReadonlySet<GroupName>,
): HTMLElement[] {
  const options: HTMLElement[] = [];
  const nextId = () => `${listbox.id}-${options.length}`;
  const groupElements = groups.map((group, groupIndex) => {
    const element = el("div", "search-group", { role: "group" });
    const name = el("div", "search-group-name", {
      role: "presentation",
      id: `${listbox.id}-group-${groupIndex}`,
    });
    name.textContent = group.name;
    element.setAttribute("aria-labelledby", name.id);
    element.append(name);
    const isExpanded = expanded.has(group.name);
    for (const hit of shownHits(group, isExpanded)) {
      const option = hitOption(hit, nextId());
      options.push(option);
      element.append(option);
    }
    if (canExpand(group) && !isExpanded) {
      const more = expandOption(group, nextId());
      options.push(more);
      element.append(more);
    }
    return element;
  });
  listbox.replaceChildren(...groupElements);
  return options;
}

/**
 * A result: a link with its title, excerpt and location. The title alone names
 * it; the excerpt and location are its description, hidden from the name so a
 * screen reader hears the title first and the rest after a pause.
 */
function hitOption(hit: SearchHit, id: string): HTMLElement {
  const option = el("a", "search-option", {
    role: "option",
    id,
    href: hit.href,
    tabindex: "-1",
    "aria-selected": "false",
  });
  const title = el("span", "search-option-title", {});
  title.textContent = hit.title;
  const excerpt = el("span", "search-option-excerpt", {
    id: `${id}-excerpt`,
    "aria-hidden": "true",
  });
  // safeExcerpt escaped everything but <mark>, so this HTML is safe to insert.
  excerpt.innerHTML = hit.excerptHtml;
  option.append(title, excerpt);
  const described = [excerpt.id];
  if (hit.location) {
    const location = el("span", "search-option-location", {
      id: `${id}-location`,
      "aria-hidden": "true",
    });
    location.textContent = hit.location;
    option.append(location);
    described.push(location.id);
  }
  option.setAttribute("aria-describedby", described.join(" "));
  return option;
}

/** The option that shows the rest of a group. */
function expandOption(group: ResultGroup, id: string): HTMLElement {
  const option = el("div", "search-option search-option-more", {
    role: "option",
    id,
    "aria-selected": "false",
    "data-expand": group.name,
  });
  option.textContent = `Show all ${group.hits.length}`;
  return option;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  attributes: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}
