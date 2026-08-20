import { isDomNode } from './tooltip';

/**
 * `isDomNode` is the only runtime export in tooltip.ts — the rest of the file
 * is the tooltip CONTRACT (types + docs). It had no test: jest reported the
 * file at 100% because V8 marks every line of a loaded module as covered, while
 * the story sweep reported 0% functions, which was the honest number.
 *
 * It matters more than its size suggests. `engine/hover.ts` calls it to decide
 * what a consumer's `tooltipRenderer` returned: a Node is appended as-is, and
 * anything else falls through to being set as TEXT. Getting it wrong in the
 * permissive direction would mean treating a plain object as a node; getting it
 * wrong in the strict direction breaks framework renderers that build nodes in
 * another document.
 */
describe('isDomNode', () => {
  describe('real nodes', () => {
    it('accepts an element', () => {
      expect(isDomNode(document.createElement('div'))).toBe(true);
    });

    it('accepts a text node', () => {
      expect(isDomNode(document.createTextNode('hi'))).toBe(true);
    });

    it('accepts a document fragment', () => {
      expect(isDomNode(document.createDocumentFragment())).toBe(true);
    });

    it('accepts a detached node, which is what a framework hands back', () => {
      // React/Vue/Angular render into a node that was never in the document.
      const el = document.createElement('span');
      el.textContent = 'from a framework';
      expect(isDomNode(el)).toBe(true);
    });

    it('accepts the document itself', () => {
      expect(isDomNode(document)).toBe(true);
    });
  });

  describe('cross-realm nodes', () => {
    it('accepts a node-shaped object from another document', () => {
      // The reason this is duck-typed rather than `instanceof Node`: a node
      // built in an iframe or a template's own document fails instanceof
      // against THIS realm's Node constructor.
      const foreign = { nodeType: 1, nodeName: 'DIV' };
      expect(isDomNode(foreign)).toBe(true);
    });

    it('accepts a foreign text node shape', () => {
      expect(isDomNode({ nodeType: 3, nodeName: '#text' })).toBe(true);
    });
  });

  describe('rejects non-nodes', () => {
    it('rejects null and undefined', () => {
      expect(isDomNode(null)).toBe(false);
      expect(isDomNode(undefined)).toBe(false);
    });

    it('rejects a string, which the tooltip sets as TEXT instead', () => {
      // The safety-relevant case: a returned string must NOT be treated as a
      // node, so it goes through textContent and cannot inject markup.
      expect(isDomNode('<b>hi</b>')).toBe(false);
      expect(isDomNode('')).toBe(false);
    });

    it('rejects numbers and booleans', () => {
      expect(isDomNode(0)).toBe(false);
      expect(isDomNode(42)).toBe(false);
      expect(isDomNode(false)).toBe(false);
      expect(isDomNode(true)).toBe(false);
    });

    it('rejects a plain object', () => {
      expect(isDomNode({})).toBe(false);
    });

    it('rejects the unsafeHtml wrapper, which has its own branch', () => {
      // `{ unsafeHtml }` is a separate opt-in path in the tooltip contract; it
      // must not be mistaken for a node.
      expect(isDomNode({ unsafeHtml: '<b>hi</b>' })).toBe(false);
    });

    it('rejects an array', () => {
      expect(isDomNode([])).toBe(false);
      expect(isDomNode([document.createElement('div')])).toBe(false);
    });

    it('rejects a function', () => {
      expect(isDomNode(() => undefined)).toBe(false);
    });
  });

  describe('partial shapes', () => {
    it('rejects an object with only nodeType', () => {
      expect(isDomNode({ nodeType: 1 })).toBe(false);
    });

    it('rejects an object with only nodeName', () => {
      expect(isDomNode({ nodeName: 'DIV' })).toBe(false);
    });

    it('rejects wrongly-typed members', () => {
      // Both have to be the right PRIMITIVE type, not merely present.
      expect(isDomNode({ nodeType: '1', nodeName: 'DIV' })).toBe(false);
      expect(isDomNode({ nodeType: 1, nodeName: 1 })).toBe(false);
      expect(isDomNode({ nodeType: null, nodeName: null })).toBe(false);
    });

    it('rejects an object whose members are inherited but undefined', () => {
      const proto = { nodeType: undefined, nodeName: undefined };
      expect(isDomNode(Object.create(proto))).toBe(false);
    });

    it('accepts a node shape inherited from a prototype', () => {
      // Real DOM nodes carry nodeType/nodeName on their prototype chain, so the
      // check must not require own properties.
      const proto = { nodeType: 1, nodeName: 'DIV' };
      expect(isDomNode(Object.create(proto))).toBe(true);
    });
  });
});
