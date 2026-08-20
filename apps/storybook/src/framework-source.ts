/**
 * Converts a story's rendered HTML into React / Vue / Angular usage of the
 * `@awc-ui/{react,vue,angular}` wrappers, driven by the Framework toolbar
 * global (see preview.ts `docs.source.transform`).
 *
 * Best-effort + illustrative — it mirrors the markup/props, which is the "how do
 * I use this" value. It cannot recover event handlers (lit `@click` bindings
 * don't serialize to HTML) or object/`.prop` bindings, so those aren't shown.
 */
export type Framework = 'html' | 'react' | 'vue' | 'angular' | 'svelte';

const pascal = (tag: string) =>
  tag.replace(/(^|-)([a-z0-9])/g, (_m, _d, c: string) => c.toUpperCase());
const camel = (s: string) => s.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());

const isCustom = (tag: string) => tag.includes('-');

/** Emit the tag name for a framework (custom elements → wrapper component name). */
function tagName(tag: string, fw: Framework): string {
  if (!isCustom(tag)) return tag;
  return fw === 'react' || fw === 'vue' ? pascal(tag) : tag; // angular/html keep the element selector
}

/** Emit one attribute `name="value"` (or boolean) for a framework. */
function attr(name: string, value: string, custom: boolean, fw: Framework): string | null {
  if (name.startsWith('data-') || name === 'part' || name === 'slot') {
    // keep slot (structural), keep data-* / part as-is
  }
  const boolean = value === '';
  if (fw === 'react') {
    // React keeps aria-*/data-* kebab; class→className, for→htmlFor; other
    // custom-element props are camelCased by the Stencil React bindings.
    const keepKebab = name.startsWith('aria-') || name.startsWith('data-');
    let n = name === 'class' ? 'className' : name === 'for' ? 'htmlFor' : keepKebab ? name : custom ? camel(name) : name;
    return boolean ? n : `${n}="${value}"`;
  }
  if (fw === 'angular') {
    // string attrs bind fine as attributes; booleans use property binding so
    // the custom element gets a real boolean, not the string "".
    return boolean ? `[${name}]="true"` : `${name}="${value}"`;
  }
  // vue + html: kebab attributes
  return boolean ? name : `${name}="${value}"`;
}

function serializeNode(node: Node, fw: Framework, indent: number): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
    return t ? '  '.repeat(indent) + t : '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''; // skip comments
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const custom = isCustom(tag);
  const name = tagName(tag, fw);
  const pad = '  '.repeat(indent);

  const attrs: string[] = [];
  for (const a of Array.from(el.attributes)) {
    if (a.name === 'class' && (a.value.includes('hydrated') || a.value.includes('md-'))) {
      // Stencil hydration/internal classes are runtime noise — drop them.
      const cleaned = a.value
        .split(/\s+/)
        .filter((c) => c !== 'hydrated' && !/^md-[a-z-]+--/.test(c) && !/^md-[a-z-]+$/.test(c))
        .join(' ');
      if (!cleaned) continue;
      const out = attr('class', cleaned, custom, fw);
      if (out) attrs.push(out);
      continue;
    }
    const out = attr(a.name, a.value, custom, fw);
    if (out) attrs.push(out);
  }
  const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';

  const kids = Array.from(el.childNodes)
    .map((n) => serializeNode(n, fw, indent + 1))
    .filter(Boolean);

  if (!kids.length) {
    return fw === 'react' || fw === 'vue'
      ? `${pad}<${name}${attrStr} />`
      : `${pad}<${name}${attrStr}></${name}>`;
  }
  const oneLine = kids.length === 1 && !kids[0].includes('\n') && kids[0].trim().length < 48;
  if (oneLine) return `${pad}<${name}${attrStr}>${kids[0].trim()}</${name}>`;
  return `${pad}<${name}${attrStr}>\n${kids.join('\n')}\n${pad}</${name}>`;
}

const IMPORT: Record<Exclude<Framework, 'html'>, (tags: string[]) => string> = {
  react: (tags) => `import { ${tags.map(pascal).join(', ')} } from '@awc-ui/react';\n\n`,
  vue: (tags) => `import { ${tags.map(pascal).join(', ')} } from '@awc-ui/vue';\n\n`,
  angular: () => `// import { AwcUiModule } from '@awc-ui/angular';\n\n`,
  svelte: () => `<script>\n  import '@awc-ui/core/define'; // registers the custom elements\n</script>\n\n`,
};

export function toFramework(htmlSource: string, fw: Framework): string {
  // Bulletproof: this runs inside Storybook's docs.source.transform for EVERY
  // story on an autodocs page. Any throw here crashes the DocsPage source block
  // and blanks the whole Docs tab, so on ANY failure fall back to the original
  // HTML rather than propagating.
  if (fw === 'html' || !htmlSource) return htmlSource;

  // Storybook's `dynamic` source can't statically render stories that use a
  // custom `render: (args) => html`…`` with interpolation — it falls back to the
  // *function source* (contains `=> html``, `render:`, `${…}`). Converting that
  // yields garbage (`export default () => ( { render: … }`). Only rewrite when
  // we were handed clean rendered markup; otherwise pass the source through so
  // the reader still sees a valid (web-component) snippet.
  if (/=>|\bhtml`|\brender\s*:|\$\{/.test(htmlSource)) return htmlSource;

  try {
    const doc = new DOMParser().parseFromString(`<div>${htmlSource}</div>`, 'text/html');
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) return htmlSource;

    const body = Array.from(root.childNodes)
      .map((n) => serializeNode(n, fw, 0))
      .filter(Boolean)
      .join('\n');
    if (!body) return htmlSource;

    const customTags = [...new Set([...htmlSource.matchAll(/<(md-[a-z0-9-]+)/g)].map((m) => m[1]))];
    const header = customTags.length ? IMPORT[fw](customTags) : '';

    if (fw === 'react') return `${header}export default () => (\n${body.replace(/^/gm, '  ')}\n);`;
    if (fw === 'vue') return `<template>\n${body.replace(/^/gm, '  ')}\n</template>\n\n<script setup>\n${header.trim()}\n</script>`;
    if (fw === 'svelte') return `${header}${body}`; // markup uses the elements directly
    return `${header}${body}`; // angular template markup
  } catch {
    return htmlSource;
  }
}
