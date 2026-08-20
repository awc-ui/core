/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * axe-spec.ts
 * ============
 *
 * Bridge that lets us run axe-core against Stencil-rendered components
 * at the spec level (mock-doc), even though mock-doc is not axe-compatible.
 *
 * Strategy
 * --------
 * 1. Render via `newSpecPage` (mock-doc).
 * 2. Pull `page.body.outerHTML` — Stencil emits Declarative Shadow DOM
 *    (`<template shadowrootmode="open">`) by default, so the shadow
 *    tree is preserved verbatim in the string.
 * 3. Spin up a fresh JSDOM with `runScripts: 'outside-only'`.
 * 4. Manually hydrate the `<template shadowrootmode>` elements into
 *    real shadow roots (JSDOM exposes the API but doesn't auto-hydrate).
 * 5. Inject axe-core's bundled `source` into the JSDOM window via `eval`,
 *    then call `window.axe.run()` from inside that realm. axe sees the
 *    JSDOM Node/Element/ShadowRoot classes natively — no global swap.
 * 6. Return the result back into the Jest realm.
 *
 * We disable a handful of rules that need real layout / computed style.
 * Those belong in e2e.
 */
import * as axeModule from 'axe-core';
import { JSDOM } from 'jsdom';
import type { SpecPage } from '@stencil/core/internal';

type AxeResults = axeModule.AxeResults;
type RunOptions = axeModule.RunOptions;

const axeSource: string = (axeModule as any).source ?? (axeModule as any).default?.source;
if (!axeSource) {
  throw new Error('axe-core source not available; expected `axe.source` to be a JS string.');
}

const DEFAULT_RULES: NonNullable<RunOptions['rules']> = {
  // Layout-dependent — needs real getComputedStyle / paint.
  'color-contrast': { enabled: false },
  'target-size': { enabled: false },
  // Region landmarks aren't relevant for the accordion-only sandbox
  // (no surrounding page chrome to anchor regions against).
  region: { enabled: false },
  // The test scaffolds don't include language metadata.
  'html-has-lang': { enabled: false },
  'html-lang-valid': { enabled: false },
  'document-title': { enabled: false },
  'landmark-one-main': { enabled: false },
  'page-has-heading-one': { enabled: false },
  bypass: { enabled: false },
};

export interface AxeOptions {
  /**
   * Extra HTML to render around the component under test — for example,
   * a `dir="rtl"` wrapper, or a heading hierarchy that affects the
   * `heading-order` rule. Inserted INSIDE the body, AROUND the spec
   * page's content.
   */
  wrap?: (innerHtml: string) => string;
  /** Per-run overrides merged on top of `DEFAULT_RULES`. */
  rules?: RunOptions['rules'];
}

/**
 * Run axe-core against the current state of a Stencil spec page. The
 * shadow trees of every component are preserved via Declarative Shadow
 * DOM, so axe sees the same accessible tree a real browser would build.
 */
export async function runAxe(page: SpecPage, options: AxeOptions = {}): Promise<AxeResults> {
  const inner = page.body.outerHTML;
  const wrapped = options.wrap ? options.wrap(inner) : inner;
  const dom = new JSDOM(`<!doctype html><html><head></head>${wrapped}</html>`, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });

  hydrateDeclarativeShadowRoots(dom.window.document);

  // Run axe-core inside the JSDOM realm.
  dom.window.eval(axeSource);
  const win = dom.window as any;

  const runOptions: RunOptions = {
    rules: { ...DEFAULT_RULES, ...(options.rules ?? {}) },
  };

  try {
    const results: AxeResults = await win.axe.run(win.document.body, runOptions);
    // Strip JSDOM-realm objects so Jest's matchers and JSON.stringify
    // don't trip on cross-realm references.
    return JSON.parse(JSON.stringify(results)) as AxeResults;
  } finally {
    dom.window.close();
  }
}

/**
 * Walk every `<template shadowrootmode="open|closed">` in the document
 * and attach its content as a real shadow root on the parent. This is
 * the WHATWG Declarative Shadow DOM hydration algorithm — JSDOM ships
 * the imperative API but doesn't auto-hydrate constructor-time HTML.
 */
function hydrateDeclarativeShadowRoots(root: Document | Element | ShadowRoot): void {
  const templates = Array.from(
    (root as Document).querySelectorAll('template[shadowrootmode]'),
  ) as HTMLTemplateElement[];
  for (const template of templates) {
    const host = template.parentElement;
    if (!host) continue;
    const mode = (template.getAttribute('shadowrootmode') ?? 'open') as ShadowRootMode;
    let shadow: ShadowRoot;
    try {
      shadow = host.attachShadow({ mode });
    } catch {
      template.remove();
      continue;
    }
    shadow.appendChild(template.content.cloneNode(true));
    template.remove();
    hydrateDeclarativeShadowRoots(shadow);
  }
}

/**
 * Jest matcher that pretty-prints axe violations. Re-exported so spec
 * files don't have to know about the underlying matcher.
 */
export const toHaveNoViolations = {
  toHaveNoViolations(received: AxeResults) {
    const violations = received?.violations ?? [];
    const pass = violations.length === 0;
    if (pass) {
      return {
        pass: true,
        message: () => 'expected axe violations but found none',
      };
    }
    const formatted = violations
      .map((v) => {
        const targets = v.nodes
          .map(
            (n) =>
              `  • ${n.target.join(', ')}\n    ${n.failureSummary?.replace(/\n/g, '\n    ') ?? ''}`,
          )
          .join('\n');
        return `[${v.id}] (${v.impact}) ${v.help}\n  ${v.helpUrl}\n${targets}`;
      })
      .join('\n\n');
    return {
      pass: false,
      message: () =>
        `Expected zero axe violations, found ${violations.length}:\n\n${formatted}`,
    };
  },
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}
