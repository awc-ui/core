// Nitro server plugin: after Nuxt renders the page, run the AWC UI hydrate module
// over the body HTML to inject Declarative Shadow DOM (+ shadow styles) for every
// <md-*> element.
import { renderToString } from '@awc-ui/core/hydrate';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', async (html) => {
    const body = html.body.join('');
    if (!body.includes('<md-')) return;
    const { html: hydrated } = await renderToString(body, {
      fullDocument: false,
      serializeShadowRoot: 'declarative-shadow-dom',
      removeScripts: false,
      removeHtmlComments: false,
      afterHydrate(document) {
        // Vue claims light DOM before a lazy Stencil loader can upgrade it.
        // Keep the shadow annotations and Vue's own fragment comments intact.
        const pending: Node[] = [document.body];
        while (pending.length) {
          const parent = pending.pop()!;
          for (const child of Array.from(parent.childNodes)) {
            if (child.nodeType === 8 && /^[rcto]\.\d+(?:\.\d+)*(?:\.c?)?$/.test(child.nodeValue ?? '')) {
              parent.removeChild(child);
            } else if (child.nodeType === 1 && child.nodeName !== 'TEMPLATE') {
              pending.push(child);
            }
          }
        }
      },
    });
    html.body = [hydrated];
  });
});
