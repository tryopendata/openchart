import type { ElementFactory } from './renderers/svg-dom';
import { SVG_NS, XLINK_NS } from './renderers/svg-dom';

type StaticNode = StaticElement | StaticText;
export class StaticText {
  readonly nodeType = 3;
  parentNode: StaticElement | null = null;
  constructor(public data: string) {}
  get textContent(): string {
    return this.data;
  }
  set textContent(value: string) {
    this.data = value;
  }
  remove(): void {
    this.parentNode?.removeChild(this);
  }
}

function cssName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
function createStyle(element: StaticElement): CSSStyleDeclaration {
  const declarations = () =>
    new Map(
      (element.getAttribute('style') ?? '').split(';').flatMap((part) => {
        const colon = part.indexOf(':');
        return colon < 0
          ? []
          : [[part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as const];
      }),
    );
  const write = (values: Map<string, string>) => {
    if (values.size)
      element.setAttribute(
        'style',
        [...values].map(([name, value]) => `${name}: ${value};`).join(' '),
      );
    else element.removeAttribute('style');
  };
  const api = {
    setProperty(name: string, value: string, priority = '') {
      const values = declarations();
      if (value === '') values.delete(name);
      else values.set(name, `${String(value)}${priority ? ' !important' : ''}`);
      write(values);
    },
    removeProperty(name: string) {
      const values = declarations();
      const previous = values.get(name) ?? '';
      values.delete(name);
      write(values);
      return previous;
    },
    getPropertyValue(name: string) {
      return (declarations().get(name) ?? '').replace(/\s*!important\s*$/, '');
    },
    getPropertyPriority(name: string) {
      return /!important\s*$/.test(declarations().get(name) ?? '') ? 'important' : '';
    },
    get cssText() {
      return element.getAttribute('style') ?? '';
    },
    set cssText(value: string) {
      element.setAttribute('style', value);
      write(declarations());
    },
  };
  return new Proxy(api, {
    get(target, key) {
      return key in target
        ? Reflect.get(target, key)
        : typeof key === 'string'
          ? target.getPropertyValue(cssName(key))
          : undefined;
    },
    set(target, key, value) {
      if (key === 'cssText') target.cssText = String(value);
      else if (typeof key === 'string') target.setProperty(cssName(key), String(value));
      return true;
    },
  }) as unknown as CSSStyleDeclaration;
}

export class StaticElement {
  readonly nodeType = 1;
  readonly attributes = new Map<string, string>();
  readonly childNodes: StaticNode[] = [];
  parentNode: StaticElement | null = null;
  readonly style = createStyle(this);
  readonly classList = {
    add: (...tokens: string[]) => {
      this.setAttribute('class', [...new Set([...this.classes(), ...tokens])].join(' '));
    },
    remove: (...tokens: string[]) => {
      this.setAttribute(
        'class',
        this.classes()
          .filter((token) => !tokens.includes(token))
          .join(' '),
      );
    },
    contains: (token: string) => this.classes().includes(token),
    toggle: (token: string, force?: boolean) => {
      const include = force ?? !this.classList.contains(token);
      if (include) this.classList.add(token);
      else this.classList.remove(token);
      return include;
    },
    [Symbol.iterator]: () => this.classes()[Symbol.iterator](),
  };
  constructor(
    public readonly tagName: string,
    public readonly namespaceURI = SVG_NS,
  ) {}
  private classes(): string[] {
    return (this.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  }
  get id(): string {
    return this.getAttribute('id') ?? '';
  }
  set id(value: string) {
    this.setAttribute('id', value);
  }
  get children(): StaticElement[] {
    return this.childNodes.filter((node): node is StaticElement => node instanceof StaticElement);
  }
  get firstElementChild(): StaticElement | null {
    return this.children[0] ?? null;
  }
  get firstChild(): StaticNode | null {
    return this.childNodes[0] ?? null;
  }
  get nextSibling(): StaticNode | null {
    if (!this.parentNode) return null;
    return this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null;
  }
  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join('');
  }
  set textContent(value: string) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes.length = 0;
    if (value) this.appendChild(new StaticText(String(value)));
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }
  setAttributeNS(_namespace: string, name: string, value: string): void {
    this.setAttribute(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  appendChild<T extends StaticNode>(child: T): T {
    return this.insertBefore(child, null);
  }
  append(...nodes: Array<StaticNode | string>): void {
    for (const node of nodes)
      this.appendChild(typeof node === 'string' ? new StaticText(node) : node);
  }
  insertBefore<T extends StaticNode>(child: T, before: StaticNode | null): T {
    if (child === before) return child;
    child.parentNode?.removeChild(child);
    const index = before === null ? this.childNodes.length : this.childNodes.indexOf(before);
    if (index < 0) throw new Error('insertBefore reference is not a child');
    this.childNodes.splice(index, 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild<T extends StaticNode>(child: T): T {
    const index = this.childNodes.indexOf(child);
    if (index < 0) throw new Error('removeChild target is not a child');
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  remove(): void {
    this.parentNode?.removeChild(this);
  }
  insertAdjacentElement(position: string, element: StaticElement): StaticElement | null {
    if (position === 'afterend' && this.parentNode)
      return this.parentNode.insertBefore(element, this.nextSibling);
    if (position === 'beforebegin' && this.parentNode)
      return this.parentNode.insertBefore(element, this);
    if (position === 'afterbegin') return this.insertBefore(element, this.firstChild);
    if (position === 'beforeend') return this.appendChild(element);
    return null;
  }
  matches(selector: string): boolean {
    return selector
      .split(',')
      .some((part) => matchesChain(this, part.trim().split(/\s+(?![^[]*\])/)));
  }
  closest(selector: string): StaticElement | null {
    for (let node: StaticElement | null = this; node; node = node.parentNode)
      if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector: string): StaticElement[] {
    const found: StaticElement[] = [];
    const visit = (node: StaticElement) => {
      for (const child of node.children) {
        if (child.matches(selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
  querySelector(selector: string): StaticElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}
function matchesSimple(element: StaticElement, selector: string): boolean {
  const tag = /^[\w*:-]+/.exec(selector)?.[0];
  if (tag && tag !== '*' && element.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  for (const match of selector.matchAll(
    /([.#])([\w-]+)|\[([^\]=\s]+)(?:\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\]]+)))?\]/g,
  )) {
    if (match[1] === '.' && !element.classList.contains(match[2])) return false;
    if (match[1] === '#' && element.id !== match[2]) return false;
    if (match[3]) {
      if (!element.hasAttribute(match[3])) return false;
      const value = match[4] ?? match[5] ?? match[6];
      if (value !== undefined && element.getAttribute(match[3]) !== value) return false;
    }
  }
  return true;
}
function matchesChain(element: StaticElement, parts: string[]): boolean {
  if (!parts.length || !matchesSimple(element, parts[parts.length - 1])) return false;
  if (parts.length === 1) return true;
  for (let parent = element.parentNode; parent; parent = parent.parentNode)
    if (matchesChain(parent, parts.slice(0, -1))) return true;
  return false;
}
export const staticFactory: ElementFactory = {
  svg: (tag) => new StaticElement(tag) as unknown as SVGElement,
  html: (tag) => new StaticElement(tag, 'http://www.w3.org/1999/xhtml') as unknown as HTMLElement,
  text: (data) => new StaticText(data) as unknown as Text,
};
export const GEOMETRY_ATTRIBUTES = new Set(
  'x y x1 y1 x2 y2 width height r rx ry cx cy dx dy d points transform viewBox'.split(' '),
);
const NUMBER_TOKEN = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
export function roundGeometryValue(value: string, precision: number | null): string {
  if (precision === null) return value;
  let previousEnd = -1;
  return value.replace(NUMBER_TOKEN, (token, offset: number) => {
    const separator = offset === previousEnd ? ' ' : '';
    previousEnd = offset + token.length;
    return separator + String(Number(Number(token).toFixed(precision)));
  });
}
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttribute(value: string): string {
  return escapeText(value)
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}
/** Serialize only geometry at the requested precision; authored text and metadata are exact. */
export function serialize(node: StaticNode, options: { precision?: number | null } = {}): string {
  const precision = options.precision === undefined ? 3 : options.precision;
  if (precision !== null && (!Number.isInteger(precision) || precision < 0 || precision > 15))
    throw new Error('precision must be an integer between 0 and 15, or null.');
  const hasXlink = (element: StaticElement): boolean =>
    [...element.attributes.keys()].some((name) => name.startsWith('xlink:')) ||
    element.children.some(hasXlink);
  const write = (current: StaticNode, root = false, inheritedNamespace = SVG_NS): string => {
    if (current instanceof StaticText) return escapeText(current.data);
    const attributes = new Map(current.attributes);
    let head = `<${current.tagName}`;
    if (root) {
      head += ` xmlns="${escapeAttribute(attributes.get('xmlns') ?? current.namespaceURI)}"`;
      attributes.delete('xmlns');
      if (hasXlink(current)) {
        head += ` xmlns:xlink="${XLINK_NS}"`;
        attributes.delete('xmlns:xlink');
      }
    }
    if (!root && current.namespaceURI !== inheritedNamespace) {
      head += ` xmlns="${escapeAttribute(current.namespaceURI)}"`;
      attributes.delete('xmlns');
    }
    for (const [name, original] of attributes) {
      const value = GEOMETRY_ATTRIBUTES.has(name)
        ? roundGeometryValue(original, precision)
        : original;
      head += ` ${name}="${escapeAttribute(value)}"`;
    }
    return current.childNodes.length
      ? `${head}>${current.childNodes.map((child) => write(child, false, current.namespaceURI)).join('')}</${current.tagName}>`
      : `${head}/>`;
  };
  return write(node, true);
}
