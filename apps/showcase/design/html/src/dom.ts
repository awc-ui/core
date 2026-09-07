/** Compile-time JSX convenience for native DOM. No virtual DOM or UI framework. */
export const Fragment = ({ children }: any) => children;
const svgTags = new Set(['svg', 'g', 'rect', 'circle', 'ellipse', 'path', 'text', 'tspan', 'defs', 'linearGradient', 'radialGradient', 'stop', 'image', 'line']);
const properties = new Set(['value', 'selected', 'activeTabIndex', 'open', 'checked', 'disabled', 'min', 'max', 'step', 'rows', 'density']);
export function append(parent: Node, value: any): void {
  if (Array.isArray(value)) { value.forEach(child => append(parent, child)); return; }
  if (value === null || value === undefined || typeof value === 'boolean') return;
  parent.appendChild(value instanceof Node ? value : document.createTextNode(String(value)));
}
export function dom(tag: any, props: any, ...children: any[]): any {
  props = props || {};
  if (typeof tag === 'function') return tag({ ...props, children: children.length ? children : props.children });
  const element: any = svgTags.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'key' || key === 'children' || value === undefined || value === null) continue;
    if (key === 'ref') { if (typeof value === 'function') value(element); else (value as any).current = element; continue; }
    if (key.startsWith('on') && typeof value === 'function') {
      const event = key === 'onDoubleClick' ? 'dblclick' : key.slice(2).toLowerCase();
      element.addEventListener(event, value); continue;
    }
    const attr = key === 'className' ? 'class' : key === 'tabIndex' ? 'tabindex' : ['strokeWidth','strokeLinecap','strokeLinejoin','fontSize','fontFamily','fontWeight','textAnchor','letterSpacing'].includes(key) ? key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) : key;
    if (value === false && !attr.startsWith('aria-')) continue;
    if (properties.has(key)) {
      const assign = () => { element[key] = value; };
      assign();
      if (tag.includes('-') && !customElements.get(tag)) customElements.whenDefined(tag).then(assign);
    }
    if (typeof value === 'object') { element[key] = value; continue; }
    element.setAttribute(attr, value === true && !attr.startsWith('aria-') ? '' : String(value));
  }
  children.forEach(child => append(element, child));
  return element;
}
export function replace(host: Element, value: any): void {
  const fragment = document.createDocumentFragment(); append(fragment, value); host.replaceChildren(fragment);
}
declare global {
  namespace JSX {
    type Element = any;
    interface ElementChildrenAttribute { children: {}; }
    interface IntrinsicElements { [tag: string]: any; }
  }
}
