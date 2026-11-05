// Web capture: Chrome (puppeteer's Chrome for Testing) renders the component from the SAME effective node the
// native host rendered, and the tree is read with CDP Accessibility.getFullAXTree (what platform screen readers
// receive from Chrome). Keyboard focus order comes from trusted CDP Tab presses.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const uuid = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

/** AWCNode → HTML. Node property keys are JS property names; they are assigned as properties after upgrade
 *  (structured values included). `aria-*`, `role` and `tabindex` keys are attributes. Text children with a slot
 *  become `<span slot>`; default-slot text stays a text node. */
export function nodeToHTML(node, props, counter = { n: 0 }, siblings = 1) {
  if (node.tag === '#text') {
    const text = node.properties?.text ?? '';
    // Separate text children stay separate runs (native renders each as its own Text); a lone text child stays bare.
    return node.slot ? `<span slot="${esc(node.slot)}">${esc(text)}</span>` : siblings > 1 ? `<span>${esc(text)}</span>` : esc(text);
  }
  const key = `n${counter.n++}`;
  const attrs = [`data-ax-node="${key}"`];
  if (node.id && !uuid.test(node.id)) attrs.push(`id="${esc(node.id)}"`);
  if (node.slot) attrs.push(`slot="${esc(node.slot)}"`);
  const values = {};
  for (const [name, value] of Object.entries(node.properties ?? {})) {
    if (value === null || value === undefined) continue;
    if (name.startsWith('aria-') || name === 'role' || name === 'tabindex') attrs.push(`${name}="${esc(value)}"`);
    else values[name] = value;
  }
  // md-time-picker opens in the variant it was given: `open` is assigned last (markup initialises all properties first).
  if (node.tag === 'md-time-picker' && 'open' in values) { const open = values.open; delete values.open; values.open = open; }
  props[key] = values;
  const kids = node.children ?? [];
  const inner = kids.map(child => nodeToHTML(child, props, counter, kids.length)).join('');
  return `<${node.tag} ${attrs.join(' ')}>${inner}</${node.tag}>`;
}

export async function webServer(root) {
  const dist = process.env.AWC_WEB_DIST || path.join(root, 'packages/core/dist');
  const pages = new Map();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/case/')) { const page = pages.get(url.pathname.slice(6)); res.writeHead(page ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page ?? ''); }
    if (url.pathname.startsWith('/dist/')) {
      const rel = url.pathname.slice(6); if (rel.includes('..')) { res.writeHead(400); return res.end(); }
      try {
        const body = await readFile(path.join(dist, rel));
        res.writeHead(200, { 'content-type': rel.endsWith('.css') ? 'text/css' : rel.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
        return res.end(body);
      } catch { res.writeHead(404); return res.end(); }
    }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, pages, close: () => server.close() };
}

export async function launchChrome(root) {
  const require = createRequire(path.join(process.env.AX_PUPPETEER_ROOT || root, 'package.json'));
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true, ...(process.env.AX_CHROME ? { executablePath: process.env.AX_CHROME } : {}),
    args: ['--force-renderer-accessibility', '--font-render-hinting=none', ...(process.env.AX_CHROME ? ['--no-sandbox'] : [])] });
  return { browser, version: await browser.version() };
}

const KEEP_PROPS = ['focusable', 'focused', 'disabled', 'checked', 'pressed', 'expanded', 'selected', 'required', 'invalid', 'readonly', 'level',
  'valuemin', 'valuemax', 'valuetext', 'live', 'atomic', 'relevant', 'busy', 'haspopup', 'modal', 'multiselectable', 'orientation', 'autocomplete',
  'roledescription', 'editable', 'settable', 'keyshortcuts'];

/** Renders one case and captures the tree below the case root plus the Tab focus order through it. */
export async function captureWeb(ctx, { html, props, dir = 'ltr', tag, tabs = 0, width = 640, settle = 350 }) {
  const id = Math.random().toString(36).slice(2);
  ctx.server.pages.set(id, `<!doctype html><html lang="en" dir="${dir}"><head><meta charset="utf-8"><title>ax</title>
<link rel="stylesheet" href="/dist/md3/md3.css"><script type="module" src="/dist/md3/md3.esm.js"></script>
<style>body{margin:0;font-family:Roboto,system-ui}#ax-root{padding:16px;width:${width - 32}px;min-height:240px;position:relative}</style></head>
<body><div id="ax-before" tabindex="0">start</div><main id="ax-root">${html}</main><div id="ax-after" tabindex="0">end</div>
<script>window.__axProps=${JSON.stringify(props).replace(/</g, '\\u003c')};</script></body></html>`);
  const page = await ctx.browser.newPage();
  try {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
    await page.goto(`http://127.0.0.1:${ctx.server.port}/case/${id}`, { waitUntil: 'load' });
    await page.evaluate(async tagName => {
      await customElements.whenDefined(tagName);
      for (const el of document.querySelectorAll('[data-ax-node]')) {
        await customElements.whenDefined(el.localName).catch(() => {});
        Object.assign(el, window.__axProps[el.dataset.axNode] ?? {});
      }
      await Promise.all([...document.querySelectorAll('#ax-root *')].map(el => el.componentOnReady?.()));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, tag);
    await new Promise(r => setTimeout(r, settle));
    const cdp = await page.createCDPSession();
    await cdp.send('Accessibility.enable'); await cdp.send('DOM.enable');
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const byId = new Map(nodes.map(n => [n.nodeId, n]));
    const { root: docRoot } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId: rootDom } = await cdp.send('DOM.querySelector', { nodeId: docRoot.nodeId, selector: '#ax-root' });
    const { node: rootDesc } = await cdp.send('DOM.describeNode', { nodeId: rootDom });
    const rootAx = nodes.find(n => n.backendDOMNodeId === rootDesc.backendNodeId);
    const rootBox = await cdp.send('DOM.getBoxModel', { backendNodeId: rootDesc.backendNodeId }).catch(() => null);
    const ox = rootBox?.model.border[0] ?? 0, oy = rootBox?.model.border[1] ?? 0;
    async function frame(backendNodeId) {
      if (!backendNodeId) return undefined;
      const box = await cdp.send('DOM.getBoxModel', { backendNodeId }).catch(() => null); if (!box) return undefined;
      const q = box.model.border, xs = [q[0], q[2], q[4], q[6]], ys = [q[1], q[3], q[5], q[7]];
      return [Math.min(...xs) - ox, Math.min(...ys) - oy, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    }
    const value = v => v?.value;
    const skipIds = new Set();
    async function convert(n) {
      const out = { role: n.role?.value ?? '', name: n.name?.value ?? '', ignored: !!n.ignored };
      if (n.description?.value) out.description = n.description.value;
      if (n.value?.value !== undefined && n.value?.value !== '') out.value = n.value.value;
      for (const p of n.properties ?? []) if (KEEP_PROPS.includes(p.name)) out[p.name] = value(p.value);
      // aria-controls: the names of the controlled elements (compared with macOS AXLinkedUIElements).
      const controls = (n.properties ?? []).find(p => p.name === 'controls')?.value?.relatedNodes ?? [];
      if (controls.length) out.controls = controls.map(r => nodes.find(x => x.backendDOMNodeId === r.backendDOMNodeId)?.name?.value ?? '');
      if (n.backendDOMNodeId && !n.ignored) out.frame = await frame(n.backendDOMNodeId);
      const kids = [];
      for (const childId of n.childIds ?? []) { const c = byId.get(childId); if (c && !skipIds.has(c.backendDOMNodeId)) kids.push(await convert(c)); }
      if (kids.length) out.children = kids;
      return out;
    }
    // A modal (top-layer) dialog makes #ax-root inert, so it drops out of the tree: capture the page instead, minus the Tab guards.
    let tree = rootAx ? await convert(rootAx) : null;
    if (!tree) {
      for (const sel of ['#ax-before', '#ax-after']) {
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: docRoot.nodeId, selector: sel });
        if (nodeId) skipIds.add((await cdp.send('DOM.describeNode', { nodeId })).node.backendNodeId);
      }
      const docAx = nodes.find(n => n.role?.value === 'RootWebArea');
      if (docAx) tree = await convert(docAx);
    }
    // Pixels for the contrast check, before any focus ring is drawn: pixel = (frame + root offset) * 2.
    const png = Buffer.from(await page.screenshot({ type: 'png', fullPage: true }));
    // Top-layer content (modal dialogs, popovers) is outside #ax-root in the DOM; capture any open top-layer roots too.
    const focus = [];
    if (tabs > 0) {
      await page.focus('#ax-before');
      for (let i = 0; i < tabs; i++) {
        await page.keyboard.press('Tab');
        await new Promise(r => setTimeout(r, 80));
        const { result } = await cdp.send('Runtime.evaluate', { expression: '(() => { let a = document.activeElement; while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement; return a; })()' });
        const inside = result.objectId ? (await cdp.send('Runtime.callFunctionOn', { objectId: result.objectId, returnByValue: true,
          functionDeclaration: 'function () { let n = this; while (n) { if (n.id === "ax-root") return true; n = n.parentNode || n.host; } return false; }' })).result.value : false;
        if (!inside) {
          const where = result.objectId ? (await cdp.send('Runtime.callFunctionOn', { objectId: result.objectId, returnByValue: true, functionDeclaration: 'function () { return this.id || this.localName; }' })).result.value : null;
          focus.push({ outside: where }); break;
        }
        const { node } = await cdp.send('DOM.describeNode', { objectId: result.objectId });
        const partial = await cdp.send('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: true });
        const own = partial.nodes.find(n => n.backendDOMNodeId === node.backendNodeId);
        const exposed = own && !own.ignored && !['generic', 'none'].includes(own.role?.value) ? own
          : partial.nodes.find(n => !n.ignored && !['generic', 'none', 'RootWebArea', 'main'].includes(n.role?.value));
        focus.push({ dom: node.localName, role: exposed?.role?.value ?? '', name: exposed?.name?.value ?? '', frame: await frame(node.backendNodeId),
          props: Object.fromEntries((exposed?.properties ?? []).filter(p => KEEP_PROPS.includes(p.name)).map(p => [p.name, value(p.value)])) });
      }
    }
    return { platform: 'web', chrome: ctx.version, tree, focus, image: { scale: 2, offset: [ox, oy], cssPerUnit: 1 }, png };
  } finally { await page.close(); ctx.server.pages.delete(id); }
}
